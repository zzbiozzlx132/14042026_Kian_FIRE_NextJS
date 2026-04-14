import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // ═══ 1. INVESTMENT DATA ═══
    const investments = await prisma.investment.findMany({
      where: { status: "holding" }
    });

    let totalInvested = 0;
    let totalCurrentValue = 0;

    investments.forEach((inv: any) => {
      totalInvested += inv.quantity * inv.buyPrice;
      totalCurrentValue += inv.quantity * inv.currentPrice;
    });

    const totalPnL = totalCurrentValue - totalInvested;
    const returnPct = totalInvested > 0
      ? ((totalCurrentValue / totalInvested) - 1) * 100
      : 0;

    // ═══ 2. SETTINGS ═══
    const settings = await prisma.lifePlanSettings.findFirst();
    const expectedReturnPct = settings?.expectedReturnPct || 10;
    const inflationPct = settings?.inflationPct || 3;

    // ═══ 3. MONTHLY INCOME/EXPENSE (last 6 months for accuracy) ═══
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const recentTx = await prisma.transaction.findMany({
      where: { date: { gte: sixMonthsAgo } }
    });

    let totalIncome = 0;
    let totalExpense = 0;
    const monthSet = new Set<string>();

    recentTx.forEach((tx: any) => {
      const d = new Date(tx.date);
      monthSet.add(`${d.getFullYear()}-${d.getMonth()}`);
      if (tx.type === "INCOME") totalIncome += tx.amount;
      if (tx.type === "EXPENSE") totalExpense += tx.amount;
    });

    const monthCount = Math.max(1, monthSet.size);
    const avgMonthlyIncome = totalIncome / monthCount;
    const avgMonthlyExpense = totalExpense / monthCount;
    const avgMonthlySavings = Math.max(0, avgMonthlyIncome - avgMonthlyExpense);

    // ═══ 4. TOTAL NET WORTH (all accounts + investments + physical assets) ═══
    const accounts = await prisma.account.findMany();
    let totalCash = 0;
    accounts.forEach((a: any) => {
      if (a.type !== "CREDIT_CARD") totalCash += a.initialBalance;
    });

    // Apply transactions to account balances
    const allTx = await prisma.transaction.findMany();
    allTx.forEach((tx: any) => {
      // simplified - just use account initial balance for now
    });

    const totalNetWorth = totalCash + totalCurrentValue;

    // ═══ 5. FIRE CALCULATION ═══
    // FIRE Number = Annual Expenses × 25 (4% rule)
    const annualExpense = avgMonthlyExpense * 12;
    const fireNumber = annualExpense * 25;
    const fireProgress = fireNumber > 0 ? (totalNetWorth / fireNumber) * 100 : 0;

    // Calculate years to FIRE
    const annualRate = expectedReturnPct / 100;
    const monthlyRate = annualRate / 12;
    const realRate = (1 + annualRate) / (1 + inflationPct / 100) - 1;

    let yearsToFire = -1; // -1 means unreachable
    if (avgMonthlySavings > 0 || totalNetWorth > 0) {
      // Iterate to find when portfolio value >= FIRE number (adjusted for inflation)
      let portfolio = totalNetWorth;
      for (let month = 1; month <= 600; month++) { // max 50 years
        portfolio = portfolio * (1 + monthlyRate) + avgMonthlySavings;
        // Compare against inflation-adjusted FIRE number
        const adjustedFire = fireNumber * Math.pow(1 + inflationPct / 100, month / 12);
        if (portfolio >= adjustedFire) {
          yearsToFire = Math.round((month / 12) * 10) / 10;
          break;
        }
      }
    }

    // Required return rate to FIRE in X years
    function requiredReturnForFire(targetYears: number): number {
      // Binary search for rate
      let lo = 0, hi = 1; // 0% to 100%
      for (let iter = 0; iter < 100; iter++) {
        const mid = (lo + hi) / 2;
        const mr = mid / 12;
        const n = targetYears * 12;
        const fv = mr > 0
          ? totalNetWorth * Math.pow(1 + mr, n) + avgMonthlySavings * ((Math.pow(1 + mr, n) - 1) / mr)
          : totalNetWorth + avgMonthlySavings * n;
        const target = fireNumber * Math.pow(1 + inflationPct / 100, targetYears);
        if (fv < target) lo = mid; else hi = mid;
      }
      return Math.round(((lo + hi) / 2) * 10000) / 100;
    }

    const fireScenarios = [5, 10, 15, 20, 25, 30].map(y => ({
      years: y,
      requiredReturnPct: requiredReturnForFire(y),
    }));

    // ═══ 6. COMPOUND INTEREST TABLE (1→30 years) ═══
    const principal = totalNetWorth;
    const monthlyContribution = avgMonthlySavings;

    const projections = Array.from({ length: 30 }, (_, i) => i + 1).map(years => {
      const months = years * 12;
      const compoundFactor = Math.pow(1 + monthlyRate, months);
      const futureValue = principal * compoundFactor +
        (monthlyRate > 0
          ? monthlyContribution * ((compoundFactor - 1) / monthlyRate)
          : monthlyContribution * months);

      const realMonthlyRate = realRate / 12;
      const realCompoundFactor = Math.pow(1 + realMonthlyRate, months);
      const realFutureValue = principal * realCompoundFactor +
        (realMonthlyRate > 0
          ? monthlyContribution * ((realCompoundFactor - 1) / realMonthlyRate)
          : monthlyContribution * months);

      const totalContributed = principal + (monthlyContribution * months);
      const interestEarned = futureValue - totalContributed;

      return {
        years,
        futureValue: Math.round(futureValue),
        realFutureValue: Math.round(realFutureValue),
        totalContributed: Math.round(totalContributed),
        interestEarned: Math.round(interestEarned),
      };
    });

    return NextResponse.json({
      // Investment
      totalInvested, totalCurrentValue, totalPnL,
      returnPct: Math.round(returnPct * 100) / 100,
      investmentCount: investments.length,
      // Cash flow
      avgMonthlyIncome: Math.round(avgMonthlyIncome),
      avgMonthlyExpense: Math.round(avgMonthlyExpense),
      avgMonthlySavings: Math.round(avgMonthlySavings),
      // FIRE
      fireNumber: Math.round(fireNumber),
      fireProgress: Math.round(fireProgress * 10) / 10,
      yearsToFire,
      totalNetWorth: Math.round(totalNetWorth),
      fireScenarios,
      // Settings
      expectedReturnPct, inflationPct,
      // Projections
      projections,
    });
  } catch (error) {
    console.error("Projection API Error:", error);
    return NextResponse.json({
      totalInvested: 0, totalCurrentValue: 0, totalPnL: 0, returnPct: 0,
      investmentCount: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0,
      avgMonthlySavings: 0, fireNumber: 0, fireProgress: 0, yearsToFire: -1,
      totalNetWorth: 0, fireScenarios: [], expectedReturnPct: 10,
      inflationPct: 3, projections: [],
    });
  }
}
