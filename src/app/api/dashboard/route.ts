import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { eachDayOfInterval, endOfDay, endOfMonth, format, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Support ?month=2026-04 parameter
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // format: YYYY-MM
    const rangeParam = Number(searchParams.get("range") || 30);
    const rangeDays = [7, 30, 90].includes(rangeParam) ? rangeParam : 30;
    
    let targetDate = new Date();
    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      targetDate = new Date(y, m - 1, 15);
    }

    const currentMonthStart = startOfMonth(targetDate);
    const currentMonthEnd = endOfMonth(targetDate);
    const prevMonthStart = startOfMonth(subMonths(targetDate, 1));
    const prevMonthEnd = endOfMonth(subMonths(targetDate, 1));
    const periodEnd = endOfDay(new Date());
    const periodStart = startOfDay(subDays(periodEnd, rangeDays - 1));

    const accounts = await prisma.account.findMany({
      where: { status: "active" },
    });

    const allTx = await prisma.transaction.findMany({
      select: { amount: true, type: true, fromAccountId: true, toAccountId: true, date: true },
    });

    // 1. Calculate Balances
    const balances: Record<string, number> = {};
    const accountTypes: Record<string, string> = {};
    accounts.forEach((a: any) => {
      balances[a.id] = a.initialBalance;
      accountTypes[a.id] = a.type;
    });

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

    let totalAssets = 0;
    let totalCredit = 0;

    Object.keys(balances).forEach(id => {
      const bal = balances[id] || 0;
      if (accountTypes[id] === "CREDIT_CARD") {
        totalCredit += Math.max(0, -bal);
        if (bal > 0) totalAssets += bal;
      } else {
        totalAssets += bal;
      }
    });

    // 2. Debts & Investments
    const debts = await prisma.debt.findMany({ where: { status: "active" } });
    let totalDebtAmount = totalCredit;
    debts.forEach((d: any) => {
      if (d.type === "BORROW") {
        totalDebtAmount += (d.principal - d.paid);
      } else if (d.type === "LEND") {
        totalAssets += (d.principal - d.paid);
      }
    });

    const investments = await prisma.investment.findMany({ where: { status: "holding" } });
    let totalInvest = 0;
    investments.forEach((i: any) => {
      totalInvest += (i.quantity * i.currentPrice);
    });
    totalAssets += totalInvest;

    // 3. Physical Assets
    const physicals = await prisma.physicalAsset.findMany();
    physicals.forEach((p: any) => {
      if (p.status !== "sold") {
        totalAssets += p.value > 0 ? p.value : p.remainingValue;
      }
    });

    const netWorth = totalAssets - totalDebtAmount;

    // 4. Monthly Flow — selected month
    const txThisMonth = await prisma.transaction.findMany({
      where: { date: { gte: currentMonthStart, lte: currentMonthEnd } },
      include: { category: true, fromAccount: true, toAccount: true },
      orderBy: { date: "desc" }
    });

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    txThisMonth.forEach((tx: any) => {
      if (tx.type === "INCOME") monthlyIncome += tx.amount;
      else if (tx.type === "EXPENSE") monthlyExpense += tx.amount;
    });

    // 5. Previous month for comparison
    const txPrevMonth = await prisma.transaction.findMany({
      where: { date: { gte: prevMonthStart, lte: prevMonthEnd } },
      include: { fromAccount: true, toAccount: true },
    });

    let prevIncome = 0;
    let prevExpense = 0;

    txPrevMonth.forEach((tx: any) => {
      if (tx.type === "INCOME") prevIncome += tx.amount;
      else if (tx.type === "EXPENSE") prevExpense += tx.amount;
    });

    // 6. Dashboard charts — selected rolling range
    const txInRange = await prisma.transaction.findMany({
      where: {
        date: { gte: periodStart, lte: periodEnd },
        type: { in: ["INCOME", "EXPENSE"] },
      },
      include: { category: true, fromAccount: true, toAccount: true },
      orderBy: { date: "asc" },
    });

    const dailyMap = new Map<string, { date: string; label: string; income: number; expense: number; net: number }>();
    eachDayOfInterval({ start: periodStart, end: periodEnd }).forEach(day => {
      const key = format(day, "yyyy-MM-dd");
      dailyMap.set(key, {
        date: key,
        label: format(day, "dd/MM"),
        income: 0,
        expense: 0,
        net: 0,
      });
    });

    const categoryMap = new Map<string, number>();
    const accountMap = new Map<string, number>();
    let periodIncome = 0;
    let periodExpense = 0;

    txInRange.forEach((tx: any) => {
      const key = format(tx.date, "yyyy-MM-dd");
      const day = dailyMap.get(key);
      if (!day) return;

      if (tx.type === "INCOME") {
        day.income += tx.amount;
        periodIncome += tx.amount;
      } else if (tx.type === "EXPENSE") {
        day.expense += tx.amount;
        periodExpense += tx.amount;
        const categoryName = tx.category?.name || "Chưa phân loại";
        const accountName = tx.fromAccount?.name || "Không rõ";
        categoryMap.set(categoryName, (categoryMap.get(categoryName) || 0) + tx.amount);
        accountMap.set(accountName, (accountMap.get(accountName) || 0) + tx.amount);
      }
      day.net = day.income - day.expense;
    });

    const dailyFlow = Array.from(dailyMap.values());
    const expenseByCategory = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const expenseByAccount = Array.from(accountMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    const biggestExpenseDay = dailyFlow.reduce((max, day) => day.expense > max.expense ? day : max, dailyFlow[0] || { label: "", expense: 0 });

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalDebt: totalDebtAmount,
      totalCredit,
      totalInvest,
      monthlyIncome,
      monthlyExpense,
      prevIncome,
      prevExpense,
      selectedMonth: format(targetDate, "yyyy-MM"),
      rangeDays,
      periodStart: format(periodStart, "yyyy-MM-dd"),
      periodEnd: format(periodEnd, "yyyy-MM-dd"),
      periodIncome,
      periodExpense,
      periodNet: periodIncome - periodExpense,
      avgDailyExpense: rangeDays > 0 ? periodExpense / rangeDays : 0,
      biggestExpenseDay,
      dailyFlow,
      expenseByCategory,
      expenseByAccount,
      recentTransactions: txThisMonth.slice(0, 5),
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      netWorth: 0, totalAssets: 0, totalDebt: 0, totalCredit: 0,
      totalInvest: 0, monthlyIncome: 0, monthlyExpense: 0,
      prevIncome: 0, prevExpense: 0, selectedMonth: "",
      rangeDays: 30, periodIncome: 0, periodExpense: 0, periodNet: 0,
      avgDailyExpense: 0, biggestExpenseDay: null,
      dailyFlow: [], expenseByCategory: [], expenseByAccount: [],
      recentTransactions: []
    }, { status: 500 });
  }
}
