import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateAutoInvestmentPrices } from "@/lib/market-data";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  const key = settings?.marketDataApiKey || "";

  return NextResponse.json({
    provider: settings?.marketDataProvider || "VNSTOCK",
    apiKeyMasked: key ? `${key.slice(0, 4)}...${key.slice(-3)}` : "",
    hasApiKey: !!key,
    autoUpdate: settings?.marketAutoUpdate || false,
    intervalMin: settings?.marketUpdateIntervalMin || 15,
    goldPrimarySymbol: settings?.goldPrimarySymbol || "XAU/USD",
    goldFxSymbol: settings?.goldFxSymbol || "USD/VND",
    goldPremiumPct: settings?.goldPremiumPct || 0,
  });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Chỉ Admin được cấu hình" }, { status: 403 });

  const body = await req.json();
  const intervalMin = Math.max(1, Math.min(240, Number(body.intervalMin || 15)));
  const provider = body.provider === "TWELVEDATA" ? "TWELVEDATA" : "VNSTOCK";

  await prisma.lifePlanSettings.upsert({
    where: { id: "default" },
    update: {
      marketDataProvider: provider,
      ...(body.apiKey !== undefined ? { marketDataApiKey: (body.apiKey || "").trim() || null } : {}),
      ...(body.autoUpdate !== undefined ? { marketAutoUpdate: !!body.autoUpdate } : {}),
      marketUpdateIntervalMin: intervalMin,
      ...(body.goldPrimarySymbol !== undefined ? { goldPrimarySymbol: (body.goldPrimarySymbol || "XAU/USD").trim() || "XAU/USD" } : {}),
      ...(body.goldFxSymbol !== undefined ? { goldFxSymbol: (body.goldFxSymbol || "USD/VND").trim() || "USD/VND" } : {}),
      ...(body.goldPremiumPct !== undefined ? { goldPremiumPct: Number(body.goldPremiumPct) || 0 } : {}),
    },
    create: {
      id: "default",
      marketDataProvider: provider,
      marketDataApiKey: (body.apiKey || "").trim() || null,
      marketAutoUpdate: !!body.autoUpdate,
      marketUpdateIntervalMin: intervalMin,
      goldPrimarySymbol: (body.goldPrimarySymbol || "XAU/USD").trim() || "XAU/USD",
      goldFxSymbol: (body.goldFxSymbol || "USD/VND").trim() || "USD/VND",
      goldPremiumPct: Number(body.goldPremiumPct) || 0,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Chỉ Admin được đồng bộ" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  if (body?.action !== "sync-now") {
    return NextResponse.json({ error: "Action không hợp lệ" }, { status: 400 });
  }

  const result = await updateAutoInvestmentPrices({ force: true });
  return NextResponse.json(result);
}
