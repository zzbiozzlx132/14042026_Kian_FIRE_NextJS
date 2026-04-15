import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const accounts = await prisma.account.findMany({
      where: { status: "active" },
    });

    const txBaseFields = {
      amount: true,
      type: true,
      fromAccountId: true,
      toAccountId: true,
      date: true,
    };

    const allTx = await prisma.transaction.findMany({
      select: txBaseFields,
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

    // 4. Monthly Flow
    const txThisMonth = await prisma.transaction.findMany({
      where: {
        date: { gte: currentMonthStart, lte: currentMonthEnd }
      },
      include: {
        category: true,
        fromAccount: true,
        toAccount: true
      },
      orderBy: { date: "desc" }
    });

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    txThisMonth.forEach((tx: any) => {
      if (tx.type === "INCOME") monthlyIncome += tx.amount;
      else if (tx.type === "EXPENSE") monthlyExpense += tx.amount;
      else if (tx.type === "TRANSFER") {
        // Advanced logic from KianAppScript:
        // normal -> credit = expense
        // credit -> normal = income
        const fromType = tx.fromAccount?.type;
        const toType = tx.toAccount?.type;
        if (fromType !== "CREDIT_CARD" && toType === "CREDIT_CARD") monthlyExpense += tx.amount;
        if (fromType === "CREDIT_CARD" && toType !== "CREDIT_CARD") monthlyIncome += tx.amount;
      }
    });

    return NextResponse.json({
      netWorth,
      totalAssets,
      totalDebt: totalDebtAmount,
      totalCredit,
      totalInvest,
      monthlyIncome,
      monthlyExpense,
      recentTransactions: txThisMonth.slice(0, 5),
    });

  } catch (error) {
    console.error("Dashboard API Error:", error);
    return NextResponse.json({
      error: "Internal Server Error",
      netWorth: 0, totalAssets: 0, totalDebt: 0, totalCredit: 0,
      totalInvest: 0, monthlyIncome: 0, monthlyExpense: 0, recentTransactions: []
    }, { status: 500 });
  }
}
