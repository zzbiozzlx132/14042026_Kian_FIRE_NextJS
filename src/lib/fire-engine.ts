import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays, subMonths } from "date-fns";
import { prisma } from "./prisma";

export type FireProjectionMode = "expected" | "actual";

type FireSettingsInput = {
  birthYear?: number | null;
  currentAge?: number;
  targetAge?: number;
  expectedReturnPct?: number;
  inflationPct?: number;
  swrPct?: number;
  salaryGrowthPct?: number;
  targetMonthlyExpenseAtFire?: number;
  plannedMonthlyInvest?: number;
  riskProfile?: string;
  objectiveMode?: string;
  missedTargetPolicy?: string;
  depositRateSource?: string;
  depositRateManual?: number | null;
};

export type FireAllocationBucketInput = {
  id?: string;
  name: string;
  assetClass: string;
  targetPct: number;
  sortOrder?: number;
};

type BenchmarkSnapshot = {
  vnIndexAnnualReturnPct: number;
  depositRatePct: number;
  depositRateSource: string;
  depositRateUpdatedAt: string | null;
};

export type FirePlanOutput = {
  mode: FireProjectionMode;
  params: {
    birthYear: number | null;
    currentAge: number;
    targetAge: number;
    fireTargetYears: number;
    expectedReturnPct: number;
    actualReturnPct: number;
    inflationPct: number;
    swrPct: number;
    salaryGrowthPct: number;
    targetMonthlyExpenseAtFire: number;
  };
  benchmark: BenchmarkSnapshot;
  totals: {
    totalNetWorth: number;
    investableNetWorth: number;
    totalCash: number;
    totalDebt: number;
    totalInvested: number;
    totalCurrentValue: number;
    totalPnL: number;
    returnPct: number;
  };
  cashflow: {
    avgMonthlyIncome: number;
    avgMonthlyExpense: number;
    avgMonthlySavings: number;
    currentMonthIncome: number;
    currentMonthExpense: number;
  };
  emergencyFund: {
    current: number;
    target6m: number;
    target12m: number;
    gap6m: number;
    gap12m: number;
    monthlyTopUpFor6mIn12Months: number;
    is6mReady: boolean;
  };
  kpi: {
    monthlyInvestTarget: number;
    monthlyExpenseCap: number;
    monthlyEmergencyTopUp: number;
    monthlyGapToPlan: number;
    thisWeekIncome: number;
    thisWeekExpense: number;
    thisWeekSavings: number;
    thisWeekInvestProgressPct: number;
  };
  fire: {
    fireNumber: number;
    fireProgressPct: number;
    yearsToFire: number;
    etaYear: number | null;
    requiredMonthlyInvestForTargetAge: number;
    requiredAnnualInvestForTargetAge: number;
    investGapMonthly: number;
  };
  allocation: {
    buckets: Array<{
      id: string;
      name: string;
      assetClass: string;
      targetPct: number;
      currentPct: number;
      targetAmount: number;
      currentAmount: number;
      monthlyAdjustAmount: number;
      exceedsGuardrail: boolean;
    }>;
    totalPct: number;
    exceedsBucketCount: boolean;
  };
  strategySuggestions: Array<{
    type: "allocation" | "valuation" | "recovery";
    title: string;
    detail: string;
    actionAmount?: number;
    etaImpactMonths?: number;
  }>;
  recoveryPlan: {
    status: "on_track" | "warning" | "recovery";
    actions: string[];
  };
};

const DEFAULT_FIRE_BUCKETS: FireAllocationBucketInput[] = [
  { name: "Danh mục 1", assetClass: "CASH", targetPct: 20, sortOrder: 1 },
  { name: "Danh mục 2", assetClass: "STOCK", targetPct: 20, sortOrder: 2 },
  { name: "Danh mục 3", assetClass: "GOLD", targetPct: 20, sortOrder: 3 },
  { name: "Danh mục 4", assetClass: "REAL_ESTATE", targetPct: 20, sortOrder: 4 },
  { name: "Danh mục 5", assetClass: "OTHER", targetPct: 20, sortOrder: 5 },
];

function safeNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value: number): number {
  return Math.round(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function ensureSettingsExists() {
  const existing = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  if (existing) return existing;
  return prisma.lifePlanSettings.create({ data: { id: "default" } });
}

export async function ensureDefaultFireAllocation() {
  await ensureSettingsExists();
  const existing = await prisma.fireAllocationBucket.findMany({
    where: { settingsId: "default" },
    orderBy: { sortOrder: "asc" },
  });
  if (existing.length > 0) return existing;
  await prisma.fireAllocationBucket.createMany({
    data: DEFAULT_FIRE_BUCKETS.map((b) => ({
      settingsId: "default",
      name: b.name,
      assetClass: b.assetClass,
      targetPct: b.targetPct,
      sortOrder: b.sortOrder || 0,
    })),
  });
  return prisma.fireAllocationBucket.findMany({ where: { settingsId: "default" }, orderBy: { sortOrder: "asc" } });
}

async function fetchDepositRateFromWorldBank(): Promise<{ ratePct: number; source: string; updatedAt: string | null }> {
  const url = "https://api.worldbank.org/v2/country/VN/indicator/FR.INR.DPST?format=json&per_page=100";
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`WorldBank HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data?.[1]) ? data[1] : [];
  const latest = rows.find((r: any) => safeNum(r?.value, Number.NaN) > 0);
  const ratePct = safeNum(latest?.value, Number.NaN);
  if (!Number.isFinite(ratePct) || ratePct <= 0) throw new Error("WorldBank deposit rate unavailable");
  const updatedAt = latest?.date ? `${latest.date}-12-31` : null;
  return { ratePct, source: "worldbank_vn", updatedAt };
}

function dateToDdMmYyyy(date: Date): string {
  return format(date, "dd-MM-yyyy");
}

async function fetchVnIndexAnnualReturnPct(): Promise<number> {
  const endDate = new Date();
  const startDate = subDays(endDate, 370);
  const query = new URLSearchParams({
    sdate: dateToDdMmYyyy(startDate),
    edate: dateToDdMmYyyy(endDate),
  });
  const url = `https://kbbuddywts.kbsec.com.vn/iis-server/investment/index/VNINDEX/data_day?${query.toString()}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`VNINDEX HTTP ${res.status}`);
  const data = await res.json();
  const rows = Array.isArray(data?.data_day) ? data.data_day : [];
  if (rows.length < 2) throw new Error("VNINDEX rows insufficient");

  const normalized = rows
    .map((r: any) => ({
      t: new Date(r?.t || 0).getTime(),
      c: safeNum(r?.c),
    }))
    .filter((r: any) => Number.isFinite(r.t) && r.c > 0)
    .sort((a: any, b: any) => a.t - b.t);

  if (normalized.length < 2) throw new Error("VNINDEX data invalid");
  const first = normalized[0];
  const last = normalized[normalized.length - 1];
  const days = Math.max(1, Math.round((last.t - first.t) / 86_400_000));
  const growth = last.c / first.c;
  const annualized = Math.pow(growth, 365 / days) - 1;
  return annualized * 100;
}

async function resolveDepositRate(settings: any): Promise<{ ratePct: number; source: string; updatedAt: string | null }> {
  const source = (settings?.depositRateSource || "worldbank_vn").toLowerCase();
  if (source === "manual" && safeNum(settings?.depositRateManual) > 0) {
    return { ratePct: safeNum(settings.depositRateManual), source: "manual", updatedAt: settings.depositRateUpdatedAt?.toISOString?.() || null };
  }

  try {
    const auto = await fetchDepositRateFromWorldBank();
    await prisma.lifePlanSettings.update({
      where: { id: "default" },
      data: {
        depositRateUpdatedAt: auto.updatedAt ? new Date(auto.updatedAt) : new Date(),
      },
    });
    return auto;
  } catch {
    const fallback = safeNum(settings?.depositRateManual, 6);
    return { ratePct: fallback > 0 ? fallback : 6, source: "manual_fallback", updatedAt: null };
  }
}

async function fetchStockPe(symbol: string): Promise<number | null> {
  const upper = symbol.trim().toUpperCase();
  if (!/^[A-Z]{2,4}$/.test(upper)) return null;
  const q = new URLSearchParams({
    page: "1",
    pageSize: "4",
    type: "CSTC",
    unit: "1000",
    termtype: "1",
    languageid: "1",
  });
  const url = `https://kbbuddywts.kbsec.com.vn/iis-server/investment/stock/finance-info/${encodeURIComponent(upper)}?${q.toString()}`;
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();
  const valuationGroup = data?.Content?.["Nhóm chỉ số Định giá"];
  if (!Array.isArray(valuationGroup)) return null;
  const peRow = valuationGroup.find((row: any) => {
    const name = String(row?.NameEn || row?.Name || "").toLowerCase();
    return name.includes("p/e") || name.includes("price") || name.includes("thu nhập");
  });
  if (!peRow) return null;
  const pe = safeNum(peRow?.Value1, Number.NaN);
  if (!Number.isFinite(pe) || pe <= 0) return null;
  return pe;
}

function computeMonthlyAverages(transactions: any[]) {
  const monthSet = new Set<string>();
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    const d = new Date(tx.date);
    monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
    if (tx.type === "INCOME") income += safeNum(tx.amount);
    if (tx.type === "EXPENSE") expense += safeNum(tx.amount);
  }
  const months = Math.max(1, monthSet.size);
  const avgIncome = income / months;
  const avgExpense = expense / months;
  return {
    avgIncome,
    avgExpense,
    avgSavings: Math.max(0, avgIncome - avgExpense),
  };
}

function computeYearsToFire(
  principal: number,
  monthlyContributionBase: number,
  annualReturn: number,
  annualInflation: number,
  annualContributionGrowth: number,
  fireNumberToday: number,
): number {
  if (fireNumberToday <= 0) return 0;
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  let portfolio = Math.max(0, principal);
  let monthlyContribution = Math.max(0, monthlyContributionBase);
  for (let month = 1; month <= 600; month++) {
    portfolio = portfolio * (1 + monthlyRate) + monthlyContribution;
    if (month % 12 === 0) {
      monthlyContribution = monthlyContribution * (1 + annualContributionGrowth);
    }
    const adjustedFire = fireNumberToday * Math.pow(1 + annualInflation, month / 12);
    if (portfolio >= adjustedFire) return Math.round((month / 12) * 10) / 10;
  }
  return -1;
}

function computeRequiredMonthlyInvest(
  principal: number,
  fireTargetYears: number,
  fireNumberToday: number,
  annualReturn: number,
  annualInflation: number,
): number {
  if (fireTargetYears <= 0 || fireNumberToday <= 0) return 0;
  const target = fireNumberToday * Math.pow(1 + annualInflation, fireTargetYears);
  const n = fireTargetYears * 12;
  const monthlyRate = Math.pow(1 + annualReturn, 1 / 12) - 1;
  const basePrincipal = Math.max(0, principal);

  if (monthlyRate <= 0) {
    return Math.max(0, (target - basePrincipal) / n);
  }

  const growthFactor = Math.pow(1 + monthlyRate, n);
  const principalFuture = basePrincipal * growthFactor;
  if (principalFuture >= target) return 0;
  return Math.max(0, ((target - principalFuture) * monthlyRate) / (growthFactor - 1));
}

function normalizeAllocation(buckets: any[]) {
  const totalPct = buckets.reduce((sum, b) => sum + safeNum(b.targetPct), 0);
  return {
    buckets: buckets.map((b) => ({
      id: String(b.id),
      name: String(b.name || ""),
      assetClass: String(b.assetClass || "OTHER"),
      targetPct: safeNum(b.targetPct),
      sortOrder: safeNum(b.sortOrder),
    })),
    totalPct,
    exceedsBucketCount: buckets.length > 5,
  };
}

function mapInvestmentAssetClass(type: string): string {
  if (type === "STOCK") return "STOCK";
  if (type === "GOLD") return "GOLD";
  if (type === "CRYPTO") return "CRYPTO";
  if (type === "REAL_ESTATE") return "REAL_ESTATE";
  return "OTHER";
}

function pickAnnualReturn(mode: FireProjectionMode, expectedPct: number, actualPct: number): number {
  if (mode === "actual" && Number.isFinite(actualPct) && actualPct !== 0) {
    return clamp(actualPct / 100, -0.5, 0.6);
  }
  return clamp(expectedPct / 100, -0.1, 0.4);
}

export async function getFireSettings() {
  const settings = await ensureSettingsExists();
  const currentYear = new Date().getFullYear();
  const derivedAge = settings.birthYear && settings.birthYear > 1900
    ? Math.max(18, currentYear - settings.birthYear)
    : settings.currentAge;
  return {
    birthYear: settings.birthYear,
    derivedCurrentAge: derivedAge,
    currentAge: settings.currentAge,
    targetAge: settings.targetAge,
    expectedReturnPct: settings.expectedReturnPct,
    inflationPct: settings.inflationPct,
    swrPct: settings.swrPct,
    salaryGrowthPct: settings.salaryGrowthPct,
    targetMonthlyExpenseAtFire: settings.targetMonthlyExpense,
    plannedMonthlyInvest: settings.plannedMonthlyInvest,
    riskProfile: settings.riskProfile,
    objectiveMode: settings.objectiveMode,
    missedTargetPolicy: settings.missedTargetPolicy,
    depositRateSource: settings.depositRateSource,
    depositRateManual: settings.depositRateManual,
    depositRateUpdatedAt: settings.depositRateUpdatedAt?.toISOString?.() || null,
  };
}

export async function updateFireSettings(input: FireSettingsInput) {
  await ensureSettingsExists();
  const updateData: any = {};
  if (input.birthYear !== undefined) {
    updateData.birthYear = input.birthYear === null ? null : Math.max(1900, Math.min(2100, Math.round(input.birthYear)));
  }
  if (input.currentAge !== undefined) updateData.currentAge = Math.max(18, Math.min(90, Math.round(input.currentAge)));
  if (input.targetAge !== undefined) updateData.targetAge = Math.max(25, Math.min(100, Math.round(input.targetAge)));
  if (input.expectedReturnPct !== undefined) updateData.expectedReturnPct = clamp(safeNum(input.expectedReturnPct), -5, 40);
  if (input.inflationPct !== undefined) updateData.inflationPct = clamp(safeNum(input.inflationPct), 0, 25);
  if (input.swrPct !== undefined) updateData.swrPct = clamp(safeNum(input.swrPct), 2, 10);
  if (input.salaryGrowthPct !== undefined) updateData.salaryGrowthPct = clamp(safeNum(input.salaryGrowthPct), 0, 30);
  if (input.targetMonthlyExpenseAtFire !== undefined) updateData.targetMonthlyExpense = Math.max(0, safeNum(input.targetMonthlyExpenseAtFire));
  if (input.plannedMonthlyInvest !== undefined) updateData.plannedMonthlyInvest = Math.max(0, safeNum(input.plannedMonthlyInvest));
  if (input.riskProfile !== undefined) updateData.riskProfile = String(input.riskProfile || "capital_preservation");
  if (input.objectiveMode !== undefined) updateData.objectiveMode = String(input.objectiveMode || "fast_but_safe");
  if (input.missedTargetPolicy !== undefined) updateData.missedTargetPolicy = String(input.missedTargetPolicy || "cut_expense_first");
  if (input.depositRateSource !== undefined) updateData.depositRateSource = String(input.depositRateSource || "worldbank_vn");
  if (input.depositRateManual !== undefined) updateData.depositRateManual = input.depositRateManual === null ? null : Math.max(0, safeNum(input.depositRateManual));

  await prisma.lifePlanSettings.update({ where: { id: "default" }, data: updateData });
  return getFireSettings();
}

export async function getFireAllocation() {
  const buckets = await ensureDefaultFireAllocation();
  return normalizeAllocation(buckets);
}

export async function updateFireAllocation(inputBuckets: FireAllocationBucketInput[]) {
  await ensureDefaultFireAllocation();
  if (!Array.isArray(inputBuckets) || inputBuckets.length === 0) {
    throw new Error("Cần ít nhất 1 danh mục phân bổ");
  }
  if (inputBuckets.length > 5) {
    throw new Error("Tối đa 5 danh mục phân bổ");
  }

  const normalized = inputBuckets.map((b, idx) => ({
    id: b.id,
    name: String(b.name || "").trim(),
    assetClass: String(b.assetClass || "OTHER").toUpperCase(),
    targetPct: safeNum(b.targetPct),
    sortOrder: b.sortOrder ?? idx + 1,
  }));

  if (normalized.some((b) => !b.name)) {
    throw new Error("Tên danh mục không được để trống");
  }
  const totalPct = normalized.reduce((sum, b) => sum + b.targetPct, 0);
  if (Math.abs(totalPct - 100) > 0.01) {
    throw new Error("Tổng tỷ lệ phân bổ phải bằng 100%");
  }

  await prisma.$transaction([
    prisma.fireAllocationBucket.deleteMany({ where: { settingsId: "default" } }),
    prisma.fireAllocationBucket.createMany({
      data: normalized.map((b) => ({
        settingsId: "default",
        name: b.name,
        assetClass: b.assetClass,
        targetPct: b.targetPct,
        sortOrder: b.sortOrder,
      })),
    }),
  ]);

  return getFireAllocation();
}

export async function getBenchmarkSnapshot(): Promise<BenchmarkSnapshot> {
  const settings = await ensureSettingsExists();
  const [vnIndexAnnualReturnPct, deposit] = await Promise.all([
    fetchVnIndexAnnualReturnPct().catch(() => 0),
    resolveDepositRate(settings),
  ]);

  return {
    vnIndexAnnualReturnPct: Math.round(vnIndexAnnualReturnPct * 100) / 100,
    depositRatePct: Math.round(deposit.ratePct * 100) / 100,
    depositRateSource: deposit.source,
    depositRateUpdatedAt: deposit.updatedAt,
  };
}

export async function computeFirePlan(mode: FireProjectionMode): Promise<FirePlanOutput> {
  const [settings, bucketsRaw, accounts, investments, physicalAssets] = await Promise.all([
    ensureSettingsExists(),
    ensureDefaultFireAllocation(),
    prisma.account.findMany({ where: { status: "active" } }),
    prisma.investment.findMany({ where: { status: "holding" } }),
    prisma.physicalAsset.findMany({ where: { status: { not: "sold" } } }),
  ]);

  const sixMonthsAgo = subMonths(new Date(), 6);
  const transactions = await prisma.transaction.findMany({
    where: { date: { gte: sixMonthsAgo } },
    orderBy: { date: "asc" },
  });

  const accountIds = new Set(accounts.map((a) => a.id));
  const balances: Record<string, number> = {};
  for (const a of accounts) balances[a.id] = safeNum(a.initialBalance);

  for (const tx of transactions) {
    const amount = safeNum(tx.amount);
    if (tx.type === "EXPENSE" && tx.fromAccountId && accountIds.has(tx.fromAccountId)) {
      balances[tx.fromAccountId] = safeNum(balances[tx.fromAccountId]) - amount;
    } else if (tx.type === "INCOME" && tx.toAccountId && accountIds.has(tx.toAccountId)) {
      balances[tx.toAccountId] = safeNum(balances[tx.toAccountId]) + amount;
    } else if (tx.type === "TRANSFER" && tx.fromAccountId && tx.toAccountId && accountIds.has(tx.fromAccountId) && accountIds.has(tx.toAccountId)) {
      balances[tx.fromAccountId] = safeNum(balances[tx.fromAccountId]) - amount;
      balances[tx.toAccountId] = safeNum(balances[tx.toAccountId]) + amount;
    }
  }

  let totalCash = 0;
  let totalDebt = 0;
  for (const acc of accounts) {
    const bal = safeNum(balances[acc.id]);
    if (acc.type === "CREDIT_CARD") {
      totalDebt += Math.max(0, -bal);
      if (bal > 0) totalCash += bal;
    } else {
      totalCash += bal;
    }
  }

  let totalInvested = 0;
  let totalCurrentValue = 0;
  const allocationCurrentByClass: Record<string, number> = { CASH: Math.max(0, totalCash), STOCK: 0, GOLD: 0, CRYPTO: 0, REAL_ESTATE: 0, OTHER: 0 };

  const now = new Date();
  let actualReturnWeightedSum = 0;
  let actualReturnWeight = 0;
  for (const inv of investments) {
    const invested = safeNum(inv.buyPrice) * safeNum(inv.quantity);
    const current = safeNum(inv.currentPrice) * safeNum(inv.quantity);
    totalInvested += invested;
    totalCurrentValue += current;
    const cls = mapInvestmentAssetClass(inv.type);
    allocationCurrentByClass[cls] = safeNum(allocationCurrentByClass[cls]) + current;

    if (invested > 0) {
      const days = Math.max(30, Math.round((now.getTime() - new Date(inv.buyDate || now).getTime()) / 86_400_000));
      const growth = current / invested;
      if (growth > 0) {
        const annualized = Math.pow(growth, 365 / days) - 1;
        actualReturnWeightedSum += annualized * invested;
        actualReturnWeight += invested;
      }
    }
  }

  const physicalValue = physicalAssets.reduce((sum, p) => sum + Math.max(0, safeNum(p.value) || safeNum(p.remainingValue)), 0);
  allocationCurrentByClass.REAL_ESTATE += physicalValue;

  const totalNetWorth = totalCash + totalCurrentValue + physicalValue - totalDebt;
  const investableNetWorth = Math.max(0, totalCash + totalCurrentValue - totalDebt);
  const totalPnL = totalCurrentValue - totalInvested;
  const returnPct = totalInvested > 0 ? ((totalCurrentValue / totalInvested) - 1) * 100 : 0;
  const actualAnnualReturnPct = actualReturnWeight > 0 ? (actualReturnWeightedSum / actualReturnWeight) * 100 : returnPct;

  const averages = computeMonthlyAverages(transactions);

  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  let currentMonthIncome = 0;
  let currentMonthExpense = 0;
  for (const tx of transactions) {
    const dt = new Date(tx.date);
    if (dt >= monthStart && dt <= monthEnd) {
      if (tx.type === "INCOME") currentMonthIncome += safeNum(tx.amount);
      if (tx.type === "EXPENSE") currentMonthExpense += safeNum(tx.amount);
    }
  }

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  let thisWeekIncome = 0;
  let thisWeekExpense = 0;
  for (const tx of transactions) {
    const dt = new Date(tx.date);
    if (dt >= weekStart && dt <= weekEnd) {
      if (tx.type === "INCOME") thisWeekIncome += safeNum(tx.amount);
      if (tx.type === "EXPENSE") thisWeekExpense += safeNum(tx.amount);
    }
  }

  const targetMonthlyExpenseAtFire = settings.targetMonthlyExpense > 0 ? settings.targetMonthlyExpense : averages.avgExpense;
  const currentYear = now.getFullYear();
  const derivedCurrentAge = settings.birthYear && settings.birthYear > 1900
    ? Math.max(18, currentYear - settings.birthYear)
    : safeNum(settings.currentAge, 27);
  const swrPct = safeNum(settings.swrPct, 4);
  const swrRate = swrPct / 100;
  const fireNumber = swrRate > 0 ? (targetMonthlyExpenseAtFire * 12) / swrRate : targetMonthlyExpenseAtFire * 12 * 25;

  const benchmark = await getBenchmarkSnapshot();
  const annualReturn = pickAnnualReturn(mode, safeNum(settings.expectedReturnPct, 10), actualAnnualReturnPct);
  const annualInflation = safeNum(settings.inflationPct, 3) / 100;
  const salaryGrowth = safeNum(settings.salaryGrowthPct, 5) / 100;

  const yearsToFire = computeYearsToFire(
    investableNetWorth,
    averages.avgSavings,
    annualReturn,
    annualInflation,
    salaryGrowth,
    fireNumber,
  );

  const fireTargetYears = Math.max(1, safeNum(settings.targetAge, 40) - derivedCurrentAge);
  const requiredMonthlyInvest = computeRequiredMonthlyInvest(
    investableNetWorth,
    fireTargetYears,
    fireNumber,
    annualReturn,
    annualInflation,
  );

  const emergencyTarget6m = averages.avgExpense * 6;
  const emergencyTarget12m = averages.avgExpense * 12;
  const emergencyGap6m = Math.max(0, emergencyTarget6m - Math.max(0, totalCash));
  const emergencyGap12m = Math.max(0, emergencyTarget12m - Math.max(0, totalCash));
  const emergencyTopUpMonthly = emergencyGap6m > 0 ? emergencyGap6m / 12 : 0;
  const is6mReady = emergencyGap6m <= 0;

  const monthlyInvestTarget = Math.max(requiredMonthlyInvest, safeNum(settings.plannedMonthlyInvest));
  const monthlyExpenseCap = Math.max(0, averages.avgIncome - monthlyInvestTarget - emergencyTopUpMonthly);
  const monthlyGapToPlan = Math.max(0, monthlyInvestTarget - Math.max(0, currentMonthIncome - currentMonthExpense));

  const allocation = normalizeAllocation(bucketsRaw);
  const totalAllocBase = Math.max(1, investableNetWorth + physicalValue);
  const allocationBuckets = allocation.buckets.map((b) => {
    const currentAmount = safeNum(allocationCurrentByClass[b.assetClass]);
    const targetAmount = totalAllocBase * (b.targetPct / 100);
    const monthlyAdjustAmount = (targetAmount - currentAmount) * 0.2;
    return {
      id: b.id,
      name: b.name,
      assetClass: b.assetClass,
      targetPct: b.targetPct,
      currentPct: (currentAmount / totalAllocBase) * 100,
      targetAmount,
      currentAmount,
      monthlyAdjustAmount,
      exceedsGuardrail: b.targetPct > 25 || b.targetPct < 20,
    };
  });

  const etaYear = yearsToFire >= 0 ? now.getFullYear() + Math.ceil(yearsToFire) : null;
  const fireProgressPct = fireNumber > 0 ? (totalNetWorth / fireNumber) * 100 : 0;

  let portfolioAvgPe: number | null = null;
  const stockPositions = investments.filter((inv) => inv.type === "STOCK" && (inv.autoPriceSymbol || "").trim());
  if (stockPositions.length > 0) {
    const peList = await Promise.all(stockPositions.map((p) => fetchStockPe(String(p.autoPriceSymbol))));
    let weightedPeInv = 0;
    let stockValueSum = 0;
    for (let i = 0; i < stockPositions.length; i++) {
      const pe = peList[i];
      const v = safeNum(stockPositions[i].currentPrice) * safeNum(stockPositions[i].quantity);
      if (pe && pe > 0 && v > 0) {
        weightedPeInv += (1 / pe) * v;
        stockValueSum += v;
      }
    }
    if (stockValueSum > 0 && weightedPeInv > 0) {
      portfolioAvgPe = 1 / (weightedPeInv / stockValueSum);
    }
  }

  const strategySuggestions: FirePlanOutput["strategySuggestions"] = [];
  if (portfolioAvgPe && portfolioAvgPe > 0) {
    const earningsYieldPct = (1 / portfolioAvgPe) * 100;
    const spread = earningsYieldPct - benchmark.depositRatePct;
    strategySuggestions.push({
      type: "valuation",
      title: "Định giá cổ phiếu so với lãi gửi",
      detail: `Earnings Yield danh mục cổ phiếu ~${earningsYieldPct.toFixed(2)}%, chênh so với lãi gửi ${spread.toFixed(2)} điểm %.`,
    });
  }

  const investGapMonthly = Math.max(0, monthlyInvestTarget - averages.avgSavings);
  if (investGapMonthly > 0) {
    strategySuggestions.push({
      type: "allocation",
      title: "Bù thiếu mục tiêu đầu tư tháng",
      detail: "Tăng trích lập quỹ đầu tư hoặc cắt chi không thiết yếu để bù thiếu mục tiêu tháng.",
      actionAmount: round(investGapMonthly),
      etaImpactMonths: Math.max(1, Math.round((investGapMonthly / Math.max(1, monthlyInvestTarget)) * 6)),
    });
  }

  let recoveryStatus: FirePlanOutput["recoveryPlan"]["status"] = "on_track";
  const recoveryActions: string[] = [];

  if (currentMonthExpense > monthlyExpenseCap * 1.05) {
    recoveryStatus = "recovery";
    recoveryActions.push(`Chi tiêu tháng đang vượt trần khoảng ${round(currentMonthExpense - monthlyExpenseCap)} đ. Tháng tới cắt nhóm không thiết yếu trước.`);
  }
  if (monthlyGapToPlan > 0) {
    recoveryStatus = recoveryStatus === "recovery" ? "recovery" : "warning";
    recoveryActions.push(`Đầu tư tháng này đang thiếu ${round(monthlyGapToPlan)} đ. Chia bù dần 3 tháng tiếp theo để không sốc dòng tiền.`);
  }
  if (!is6mReady) {
    recoveryStatus = recoveryStatus === "recovery" ? "recovery" : "warning";
    recoveryActions.push(`Quỹ dự phòng chưa đủ 6 tháng, ưu tiên nạp thêm ${round(emergencyTopUpMonthly)} đ/tháng trước khi tăng tốc đầu tư rủi ro cao.`);
  }
  if (recoveryActions.length === 0) {
    recoveryActions.push("Bạn đang đi đúng quỹ đạo. Giữ kỷ luật đầu tư và trần chi tiêu hiện tại.");
  }

  return {
    mode,
    params: {
      birthYear: settings.birthYear ?? null,
      currentAge: derivedCurrentAge,
      targetAge: safeNum(settings.targetAge, 40),
      fireTargetYears,
      expectedReturnPct: safeNum(settings.expectedReturnPct, 10),
      actualReturnPct: Math.round(actualAnnualReturnPct * 100) / 100,
      inflationPct: safeNum(settings.inflationPct, 3),
      swrPct,
      salaryGrowthPct: safeNum(settings.salaryGrowthPct, 5),
      targetMonthlyExpenseAtFire: round(targetMonthlyExpenseAtFire),
    },
    benchmark,
    totals: {
      totalNetWorth: round(totalNetWorth),
      investableNetWorth: round(investableNetWorth),
      totalCash: round(totalCash),
      totalDebt: round(totalDebt),
      totalInvested: round(totalInvested),
      totalCurrentValue: round(totalCurrentValue),
      totalPnL: round(totalPnL),
      returnPct: Math.round(returnPct * 100) / 100,
    },
    cashflow: {
      avgMonthlyIncome: round(averages.avgIncome),
      avgMonthlyExpense: round(averages.avgExpense),
      avgMonthlySavings: round(averages.avgSavings),
      currentMonthIncome: round(currentMonthIncome),
      currentMonthExpense: round(currentMonthExpense),
    },
    emergencyFund: {
      current: round(Math.max(0, totalCash)),
      target6m: round(emergencyTarget6m),
      target12m: round(emergencyTarget12m),
      gap6m: round(emergencyGap6m),
      gap12m: round(emergencyGap12m),
      monthlyTopUpFor6mIn12Months: round(emergencyTopUpMonthly),
      is6mReady,
    },
    kpi: {
      monthlyInvestTarget: round(monthlyInvestTarget),
      monthlyExpenseCap: round(monthlyExpenseCap),
      monthlyEmergencyTopUp: round(emergencyTopUpMonthly),
      monthlyGapToPlan: round(monthlyGapToPlan),
      thisWeekIncome: round(thisWeekIncome),
      thisWeekExpense: round(thisWeekExpense),
      thisWeekSavings: round(thisWeekIncome - thisWeekExpense),
      thisWeekInvestProgressPct: monthlyInvestTarget > 0 ? Math.round(((Math.max(0, thisWeekIncome - thisWeekExpense) / monthlyInvestTarget) * 100) * 10) / 10 : 0,
    },
    fire: {
      fireNumber: round(fireNumber),
      fireProgressPct: Math.round(fireProgressPct * 10) / 10,
      yearsToFire,
      etaYear,
      requiredMonthlyInvestForTargetAge: round(requiredMonthlyInvest),
      requiredAnnualInvestForTargetAge: round(requiredMonthlyInvest * 12),
      investGapMonthly: round(investGapMonthly),
    },
    allocation: {
      buckets: allocationBuckets.map((b) => ({
        ...b,
        currentPct: Math.round(b.currentPct * 10) / 10,
        targetAmount: round(b.targetAmount),
        currentAmount: round(b.currentAmount),
        monthlyAdjustAmount: round(b.monthlyAdjustAmount),
      })),
      totalPct: Math.round(allocation.totalPct * 10) / 10,
      exceedsBucketCount: allocation.exceedsBucketCount,
    },
    strategySuggestions,
    recoveryPlan: {
      status: recoveryStatus,
      actions: recoveryActions,
    },
  };
}
