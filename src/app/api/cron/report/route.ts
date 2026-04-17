import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function fmtVND(n: number) {
  return Math.round(Math.abs(n)).toLocaleString("vi-VN") + "đ";
}

function dateRange(type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly") {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (type === "daily") {
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    return { current: { from: today, to: new Date(today.getTime() + 86400000) }, prev: { from: yesterday, to: today }, label: "Hôm nay", prevLabel: "hôm qua" };
  }
  if (type === "weekly") {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(weekStart.getDate() - 7);
    return { current: { from: weekStart, to: new Date(weekStart.getTime() + 7 * 86400000) }, prev: { from: prevWeekStart, to: weekStart }, label: "Tuần này", prevLabel: "tuần trước" };
  }
  if (type === "monthly") {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { current: { from: monthStart, to: new Date(now.getFullYear(), now.getMonth() + 1, 1) }, prev: { from: prevMonthStart, to: monthStart }, label: "Tháng này", prevLabel: "tháng trước" };
  }
  if (type === "quarterly") {
    const q = Math.floor(now.getMonth() / 3);
    const qStart = new Date(now.getFullYear(), q * 3, 1);
    const prevQStart = new Date(now.getFullYear(), q * 3 - 3, 1);
    return { current: { from: qStart, to: new Date(now.getFullYear(), q * 3 + 3, 1) }, prev: { from: prevQStart, to: qStart }, label: `Q${q + 1}/${now.getFullYear()}`, prevLabel: "quý trước" };
  }
  // yearly
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const prevYearStart = new Date(now.getFullYear() - 1, 0, 1);
  return { current: { from: yearStart, to: new Date(now.getFullYear() + 1, 0, 1) }, prev: { from: prevYearStart, to: yearStart }, label: `Năm ${now.getFullYear()}`, prevLabel: `năm ${now.getFullYear() - 1}` };
}

async function getSummary(from: Date, to: Date) {
  const txs = await prisma.transaction.findMany({
    where: { date: { gte: from, lt: to } },
    include: { category: true },
  });

  const totalExpense = txs.filter(t => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const totalIncome = txs.filter(t => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const essential = txs.filter(t => t.essential === "ESSENTIAL").reduce((s, t) => s + t.amount, 0);

  // Top 3 expense categories
  const catMap: Record<string, number> = {};
  for (const tx of txs.filter(t => t.type === "EXPENSE")) {
    const name = tx.category?.name || "Khác";
    catMap[name] = (catMap[name] || 0) + tx.amount;
  }
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return { totalExpense, totalIncome, essential, topCats, txCount: txs.length };
}

function buildReport(
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  label: string,
  prevLabel: string,
  curr: Awaited<ReturnType<typeof getSummary>>,
  prev: Awaited<ReturnType<typeof getSummary>>
): string {
  const titleMap = { daily: "📅 Báo cáo ngày", weekly: "📆 Báo cáo tuần", monthly: "🗓 Báo cáo tháng", quarterly: "📊 Báo cáo quý", yearly: "🏆 Báo cáo năm" };
  const title = titleMap[type];

  const expenseDiff = prev.totalExpense > 0 ? ((curr.totalExpense - prev.totalExpense) / prev.totalExpense * 100) : 0;
  const incomeDiff = prev.totalIncome > 0 ? ((curr.totalIncome - prev.totalIncome) / prev.totalIncome * 100) : 0;
  const expArrow = expenseDiff > 0 ? `📈 +${expenseDiff.toFixed(1)}%` : expenseDiff < 0 ? `📉 ${expenseDiff.toFixed(1)}%` : "—";
  const incArrow = incomeDiff > 0 ? `📈 +${incomeDiff.toFixed(1)}%` : incomeDiff < 0 ? `📉 ${incomeDiff.toFixed(1)}%` : "—";

  let msg = `${title} — <b>${label}</b>\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;
  msg += `🔴 Chi tiêu: <b>${fmtVND(curr.totalExpense)}</b>`;
  if (prev.totalExpense > 0) msg += ` (${expArrow} so với ${prevLabel}: ${fmtVND(prev.totalExpense)})`;
  msg += `\n`;
  msg += `🟢 Thu nhập: <b>${fmtVND(curr.totalIncome)}</b>`;
  if (prev.totalIncome > 0) msg += ` (${incArrow} so với ${prevLabel}: ${fmtVND(prev.totalIncome)})`;
  msg += `\n`;

  const net = curr.totalIncome - curr.totalExpense;
  msg += `💰 Ròng: <b>${net >= 0 ? "+" : ""}${fmtVND(net)}</b>\n`;

  if (curr.totalExpense > 0) {
    const essentialPct = (curr.essential / curr.totalExpense * 100).toFixed(0);
    msg += `\n🏠 Thiết yếu: ${fmtVND(curr.essential)} (${essentialPct}% chi tiêu)\n`;
  }

  if (curr.topCats.length > 0) {
    msg += `\n📋 Top hạng mục chi:\n`;
    for (const [name, amount] of curr.topCats) {
      msg += `  • ${name}: ${fmtVND(amount)}\n`;
    }
  }

  msg += `\n📝 Tổng ${curr.txCount} giao dịch`;

  if (type === "yearly") {
    // Extra info for yearly
    msg += `\n━━━━━━━━━━━━━━━━\n💡 Tiết kiệm được: <b>${fmtVND(Math.max(0, curr.totalIncome - curr.totalExpense))}</b>`;
  }

  return msg;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null;
  const secret = searchParams.get("secret");

  if (!type || !["daily", "weekly", "monthly", "quarterly", "yearly"].includes(type)) {
    return NextResponse.json({ error: "type phải là daily/weekly/monthly/quarterly/yearly" }, { status: 400 });
  }

  const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  if (!settings?.telegramBotToken) return NextResponse.json({ error: "Bot chưa được kết nối" }, { status: 400 });

  // Verify secret if configured
  if (settings.cronSecret && settings.cronSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { current, prev, label, prevLabel } = dateRange(type);
  const [currSummary, prevSummary] = await Promise.all([getSummary(current.from, current.to), getSummary(prev.from, prev.to)]);

  const message = buildReport(type, label, prevLabel, currSummary, prevSummary);

  // Send to all paired admins + users
  const recipients = await prisma.user.findMany({
    where: { telegramChatId: { not: null }, telegramPaired: true },
  });

  const token = settings.telegramBotToken;
  for (const user of recipients) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: user.telegramChatId, text: message, parse_mode: "HTML" }),
    });
  }

  return NextResponse.json({ ok: true, sent: recipients.length, type });
}
