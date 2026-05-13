import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeFirePlan } from "@/lib/fire-engine";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const plan = await computeFirePlan("expected");
    const annualRate = plan.params.expectedReturnPct / 100;
    const monthlyRate = annualRate / 12;
    const realRate = (1 + annualRate) / (1 + plan.params.inflationPct / 100) - 1;
    const principal = Math.max(0, plan.totals.investableNetWorth);
    const monthlyContribution = Math.max(0, plan.cashflow.avgMonthlySavings);

    const projections = Array.from({ length: 30 }, (_, i) => i + 1).map((years) => {
      const months = years * 12;
      const factor = Math.pow(1 + monthlyRate, months);
      const futureValue = principal * factor + (monthlyRate > 0 ? monthlyContribution * ((factor - 1) / monthlyRate) : monthlyContribution * months);
      const realMonthlyRate = realRate / 12;
      const realFactor = Math.pow(1 + realMonthlyRate, months);
      const realFutureValue = principal * realFactor + (realMonthlyRate > 0 ? monthlyContribution * ((realFactor - 1) / realMonthlyRate) : monthlyContribution * months);
      const totalContributed = principal + monthlyContribution * months;
      return {
        years,
        futureValue: Math.round(futureValue),
        realFutureValue: Math.round(realFutureValue),
        totalContributed: Math.round(totalContributed),
        interestEarned: Math.round(futureValue - totalContributed),
      };
    });

    const fireScenarios = [5, 10, 15, 20, 25, 30].map((years) => {
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 100; i++) {
        const mid = (lo + hi) / 2;
        const mr = mid / 12;
        const n = years * 12;
        const fv = mr > 0
          ? principal * Math.pow(1 + mr, n) + monthlyContribution * ((Math.pow(1 + mr, n) - 1) / mr)
          : principal + monthlyContribution * n;
        const target = plan.fire.fireNumber * Math.pow(1 + plan.params.inflationPct / 100, years);
        if (fv < target) lo = mid;
        else hi = mid;
      }
      return { years, requiredReturnPct: Math.round(((lo + hi) / 2) * 10000) / 100 };
    });

    return NextResponse.json({
      totalInvested: plan.totals.totalInvested,
      totalCurrentValue: plan.totals.totalCurrentValue,
      totalPnL: plan.totals.totalPnL,
      returnPct: plan.totals.returnPct,
      investmentCount: plan.allocation.buckets.length,
      savingsRate: plan.cashflow.avgMonthlyIncome > 0
        ? Math.round((plan.cashflow.avgMonthlySavings / plan.cashflow.avgMonthlyIncome) * 100)
        : 0,
      avgMonthlyIncome: plan.cashflow.avgMonthlyIncome,
      avgMonthlyExpense: plan.cashflow.avgMonthlyExpense,
      avgMonthlySavings: plan.cashflow.avgMonthlySavings,
      fireNumber: plan.fire.fireNumber,
      fireProgress: plan.fire.fireProgressPct,
      yearsToFire: plan.fire.yearsToFire,
      fireTargetYears: plan.params.fireTargetYears,
      requiredMonthlyInvest: plan.fire.requiredMonthlyInvestForTargetAge,
      requiredAnnualInvest: plan.fire.requiredAnnualInvestForTargetAge,
      investGapMonthly: plan.fire.investGapMonthly,
      totalNetWorth: plan.totals.totalNetWorth,
      emergencyFundCurrent: plan.emergencyFund.current,
      emergencyFundMinTarget: plan.emergencyFund.target6m,
      emergencyFundMaxTarget: plan.emergencyFund.target12m,
      emergencyFundGapMin: plan.emergencyFund.gap6m,
      emergencyFundGapMax: plan.emergencyFund.gap12m,
      emergencyFundRecommendedMonthly: plan.emergencyFund.monthlyTopUpFor6mIn12Months,
      expectedReturnPct: plan.params.expectedReturnPct,
      inflationPct: plan.params.inflationPct,
      fireScenarios,
      insights: plan.strategySuggestions.map((s) => ({
        type: s.type === "recovery" ? "warning" : "info",
        title: s.title,
        desc: s.detail,
        impact: s.actionAmount ? `${s.actionAmount.toLocaleString("vi-VN")} đ` : "Theo dõi",
      })),
      projections,
    });
  } catch (error) {
    console.error("Projection API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
