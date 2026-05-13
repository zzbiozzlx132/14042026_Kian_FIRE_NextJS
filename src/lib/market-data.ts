import { prisma } from "./prisma";

const GRAMS_PER_TROY_OUNCE = 31.1034768;
const GRAMS_PER_CHI = 3.75;

type MarketSettings = {
  marketDataProvider?: string | null;
  marketDataApiKey?: string | null;
  marketAutoUpdate?: boolean | null;
  marketUpdateIntervalMin?: number | null;
  goldPrimarySymbol?: string | null;
  goldFxSymbol?: string | null;
  goldPremiumPct?: number | null;
};

function toNum(value: any): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchTwelveLatestPrice(symbol: string, apiKey: string): Promise<number> {
  const url = `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) {
    throw new Error(`TwelveData HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data?.status === "error" || data?.code) {
    throw new Error(data?.message || `Không lấy được giá cho ${symbol}`);
  }
  const price = toNum(data?.price);
  if (price <= 0) {
    throw new Error(`Giá trả về không hợp lệ cho ${symbol}`);
  }
  return price;
}

async function getGoldVndPerChi(settings: MarketSettings, apiKey: string): Promise<number> {
  const goldSymbol = (settings.goldPrimarySymbol || "XAU/USD").trim();
  const fxSymbol = (settings.goldFxSymbol || "USD/VND").trim();
  const premiumPct = toNum(settings.goldPremiumPct);

  const [xauUsd, usdVnd] = await Promise.all([
    fetchTwelveLatestPrice(goldSymbol, apiKey),
    fetchTwelveLatestPrice(fxSymbol, apiKey),
  ]);

  const usdPerGram = xauUsd / GRAMS_PER_TROY_OUNCE;
  const vndPerChi = usdPerGram * GRAMS_PER_CHI * usdVnd;
  const adjusted = vndPerChi * (1 + premiumPct / 100);
  return Math.round(adjusted);
}

async function resolveAutoPrice(inv: any, settings: MarketSettings, apiKey: string): Promise<{ price: number; sourceMeta: string }> {
  if (inv.type === "GOLD") {
    const price = await getGoldVndPerChi(settings, apiKey);
    return {
      price,
      sourceMeta: `XAU/USD -> USD/VND (${settings.goldPremiumPct || 0}% premium)`,
    };
  }

  const symbol = (inv.autoPriceSymbol || "").trim();
  if (!symbol) {
    throw new Error("Thiếu mã tự động (symbol)");
  }

  const price = await fetchTwelveLatestPrice(symbol, apiKey);
  return { price: Math.round(price), sourceMeta: symbol };
}

export async function updateAutoInvestmentPrices(opts?: { force?: boolean }) {
  const force = !!opts?.force;
  const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  const intervalMin = Math.max(1, Number(settings?.marketUpdateIntervalMin || 15));
  const apiKey = (settings?.marketDataApiKey || "").trim();
  const autoEnabled = !!settings?.marketAutoUpdate;

  const investments = await prisma.investment.findMany({
    where: { status: "holding", autoPriceEnabled: true, priceMode: "AUTO" },
    orderBy: { updatedAt: "desc" },
  });

  if (!force && !autoEnabled) {
    return { updated: 0, failed: 0, skipped: investments.length, logs: ["Auto update đang tắt trong cài đặt"] };
  }
  if (!apiKey) {
    return { updated: 0, failed: 0, skipped: investments.length, logs: ["Chưa có API key dữ liệu thị trường"] };
  }

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const logs: string[] = [];
  const now = Date.now();

  for (const inv of investments) {
    const msSinceLast = inv.lastPriceSyncAt ? now - inv.lastPriceSyncAt.getTime() : Number.POSITIVE_INFINITY;
    if (!force && msSinceLast < intervalMin * 60_000) {
      skipped += 1;
      continue;
    }

    try {
      const { price, sourceMeta } = await resolveAutoPrice(inv, settings || {}, apiKey);
      await prisma.investment.update({
        where: { id: inv.id },
        data: {
          currentPrice: price,
          lastPriceSyncAt: new Date(),
          lastPriceSyncStatus: "OK",
          lastPriceSyncError: null,
          note: inv.note || "",
        },
      });
      updated += 1;
      logs.push(`${inv.name}: ${price} (${sourceMeta})`);
    } catch (err: any) {
      failed += 1;
      await prisma.investment.update({
        where: { id: inv.id },
        data: {
          lastPriceSyncAt: new Date(),
          lastPriceSyncStatus: "ERROR",
          lastPriceSyncError: err?.message?.slice(0, 250) || "Lỗi không xác định",
        },
      });
      logs.push(`${inv.name}: ${err?.message || "error"}`);
    }
  }

  return { updated, failed, skipped, logs };
}
