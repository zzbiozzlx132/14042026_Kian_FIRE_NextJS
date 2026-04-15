import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "B";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000) return Math.round(n / 1_000) + "K";
  return Math.round(n).toString();
}

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
    const balances: Record<string, number> = {};
    accounts.forEach((a: any) => { balances[a.id] = a.initialBalance; });

    // Apply all transactions to account balances
    const allTx = await prisma.transaction.findMany();
    allTx.forEach((tx: any) => {
      if (tx.type === "EXPENSE" && tx.fromAccountId) {
        balances[tx.fromAccountId] = (balances[tx.fromAccountId] || 0) - tx.amount;
      } else if (tx.type === "INCOME" && tx.toAccountId) {
        balances[tx.toAccountId] = (balances[tx.toAccountId] || 0) + tx.amount;
      } else if (tx.type === "TRANSFER" && tx.fromAccountId && tx.toAccountId) {
        balances[tx.fromAccountId] = (balances[tx.fromAccountId] || 0) - tx.amount;
        balances[tx.toAccountId] = (balances[tx.toAccountId] || 0) + tx.amount;
      }
    });

    let totalCash = 0;
    let totalDebt = 0;
    accounts.forEach((a: any) => {
      const bal = balances[a.id] || 0;
      if (a.type === "CREDIT_CARD") {
        // Credit card: outgoing = debt used
        totalDebt += Math.max(0, -bal); // negative balance = debt
      } else {
        totalCash += bal;
      }
    });

    const totalNetWorth = totalCash + totalCurrentValue - totalDebt;

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
    if (fireNumber <= 0) {
      yearsToFire = 0; // No expenses = already FIRE
    } else if (totalNetWorth >= fireNumber) {
      yearsToFire = 0; // Already have enough
    } else if (avgMonthlySavings > 0 || totalNetWorth > 0) {
      let portfolio = Math.max(0, totalNetWorth); // Don't start negative for projection
      for (let month = 1; month <= 600; month++) {
        portfolio = portfolio * (1 + monthlyRate) + avgMonthlySavings;
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
    const principal = Math.max(0, totalNetWorth); // Don't compound negative values
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

    // ═══ 7. SMART INSIGHTS ═══
    const insights: { type: string; title: string; desc: string; impact: string }[] = [];

    const savingsRate = avgMonthlyIncome > 0 ? (avgMonthlySavings / avgMonthlyIncome) * 100 : 0;

    // Savings rate analysis
    if (savingsRate < 20 && avgMonthlyIncome > 0) {
      insights.push({
        type: "warning",
        title: "Tỷ lệ tiết kiệm thấp",
        desc: `Bạn đang tiết kiệm ${Math.round(savingsRate)}% thu nhập. Để FIRE sớm, nên đẩy lên ít nhất 30-50%. Giảm 10% chi tiêu không thiết yếu có thể rút ngắn ${yearsToFire > 0 ? Math.round(yearsToFire * 0.15) : 3}-${yearsToFire > 0 ? Math.round(yearsToFire * 0.25) : 5} năm đến FIRE.`,
        impact: `Tiết kiệm thêm ${fmtCompact(avgMonthlyExpense * 0.1)}/tháng`,
      });
    } else if (savingsRate >= 50) {
      insights.push({
        type: "success",
        title: "Tỷ lệ tiết kiệm xuất sắc",
        desc: `${Math.round(savingsRate)}% thu nhập được tiết kiệm — đây là mức FIRE accelerator. Duy trì và tập trung tối ưu lợi nhuận đầu tư.`,
        impact: "Duy trì momentum",
      });
    } else if (savingsRate >= 20) {
      insights.push({
        type: "info",
        title: "Tỷ lệ tiết kiệm khá",
        desc: `${Math.round(savingsRate)}% thu nhập. Tăng thêm 10% nữa sẽ rút ngắn thời gian FIRE đáng kể.`,
        impact: `Tiết kiệm thêm ${fmtCompact(avgMonthlyIncome * 0.1)}/tháng`,
      });
    }

    // Investment allocation
    if (totalCurrentValue === 0 && totalNetWorth > 0) {
      insights.push({
        type: "warning",
        title: "Chưa có khoản đầu tư nào",
        desc: `Bạn có ${fmtCompact(totalNetWorth)} tài sản nhưng chưa đầu tư. Tiền mặt mất giá ${inflationPct}%/năm do lạm phát. Bắt đầu với ETF/Quỹ chỉ số để lãi kép hoạt động.`,
        impact: `Đầu tư ${fmtCompact(totalNetWorth * 0.5)} có thể sinh thêm ${fmtCompact(totalNetWorth * 0.5 * expectedReturnPct / 100)}/năm`,
      });
    } else if (totalCurrentValue > 0 && returnPct < 0) {
      insights.push({
        type: "danger",
        title: "Danh mục đang lỗ",
        desc: `Danh mục đầu tư đang lỗ ${Math.abs(Math.round(returnPct))}%. Xem xét đa dạng hoá hoặc chuyển sang các kênh ít biến động hơn (Tiết kiệm kỳ hạn, Trái phiếu).`,
        impact: "Giảm rủi ro, bảo toàn vốn",
      });
    } else if (totalCurrentValue > 0 && returnPct > 0 && returnPct < expectedReturnPct) {
      insights.push({
        type: "info",
        title: "Lợi nhuận dưới kỳ vọng",
        desc: `Danh mục đang lãi ${Math.round(returnPct)}% nhưng kỳ vọng là ${expectedReturnPct}%. Cân nhắc tái phân bổ vào kênh lợi nhuận cao hơn.`,
        impact: `Tăng ${expectedReturnPct - Math.round(returnPct)}% nữa`,
      });
    }

    // Expense optimization
    if (avgMonthlyExpense > avgMonthlyIncome * 0.8 && avgMonthlyIncome > 0) {
      insights.push({
        type: "danger",
        title: "Chi tiêu gần sát thu nhập",
        desc: `Chi tiêu chiếm ${Math.round((avgMonthlyExpense / avgMonthlyIncome) * 100)}% thu nhập. Rà soát các khoản chi không thiết yếu (ăn ngoài, giải trí, mua sắm) để cắt giảm.`,
        impact: "Cắt 20% chi không thiết yếu",
      });
    }

    // Income growth suggestion
    if (avgMonthlyIncome > 0 && yearsToFire > 15) {
      insights.push({
        type: "info",
        title: "Tăng thu nhập để FIRE sớm hơn",
        desc: `Với thu nhập hiện tại, FIRE cần ${yearsToFire > 0 ? yearsToFire : "50+"} năm. Tăng thu nhập thêm 30% (side hustle, thăng tiến, freelance) có thể rút ngắn 5-8 năm.`,
        impact: `Thu nhập thêm ${fmtCompact(avgMonthlyIncome * 0.3)}/tháng`,
      });
    }

    // Emergency fund check
    const emergencyFundTarget = avgMonthlyExpense * 6;
    if (totalCash < emergencyFundTarget && avgMonthlyExpense > 0) {
      insights.push({
        type: "warning",
        title: "Quỹ khẩn cấp chưa đủ",
        desc: `Cần ít nhất ${fmtCompact(emergencyFundTarget)} (6 tháng chi tiêu) trong tài khoản dễ rút. Hiện có ${fmtCompact(totalCash)}.`,
        impact: `Cần thêm ${fmtCompact(Math.max(0, emergencyFundTarget - totalCash))}`,
      });
    }

    // No data scenario
    if (avgMonthlyIncome === 0 && avgMonthlyExpense === 0) {
      insights.push({
        type: "info",
        title: "Bắt đầu ghi chép thu chi",
        desc: "Chưa có dữ liệu giao dịch. Hãy ghi chép thu nhập và chi tiêu hàng ngày để hệ thống tính toán FIRE chính xác hơn.",
        impact: "Nhập giao dịch đầu tiên",
      });
    }

    return NextResponse.json({
      // Investment
      totalInvested, totalCurrentValue, totalPnL,
      returnPct: Math.round(returnPct * 100) / 100,
      investmentCount: investments.length,
      // Cash flow
      savingsRate: Math.round(savingsRate),
      avgMonthlyIncome: Math.round(avgMonthlyIncome),
      avgMonthlyExpense: Math.round(avgMonthlyExpense),
      avgMonthlySavings: Math.round(avgMonthlySavings),
      // FIRE
      fireNumber: Math.round(fireNumber),
      fireProgress: Math.round(fireProgress * 10) / 10,
      yearsToFire,
      totalNetWorth: Math.round(totalNetWorth),
      fireScenarios,
      // Insights
      insights,
      // Settings
      expectedReturnPct, inflationPct,
      // Projections
      projections,
    });
  } catch (error) {
    console.error("Projection API Error:", error);
    return NextResponse.json({
      totalInvested: 0, totalCurrentValue: 0, totalPnL: 0, returnPct: 0,
      investmentCount: 0, savingsRate: 0, avgMonthlyIncome: 0, avgMonthlyExpense: 0,
      avgMonthlySavings: 0, fireNumber: 0, fireProgress: 0, yearsToFire: -1,
      totalNetWorth: 0, fireScenarios: [], insights: [], expectedReturnPct: 10,
      inflationPct: 3, projections: [],
    });
  }
}
