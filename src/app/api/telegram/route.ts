import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/telegram
 * Webhook handler for Telegram Bot — nhập thu chi qua chat
 * 
 * Cú pháp: "chi 50k cà phê", "thu 5tr lương", "chi 1.5tr tiền nhà"
 * Commands: /balance, /today, /help
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";

// ── Parse Vietnamese amount ──
// 50k → 50,000 | 1.5tr → 1,500,000 | 200 → 200,000
function parseAmount(text: string): number {
  text = text.toLowerCase().replace(/,/g, ".").trim();

  // 1tr5, 2tr3 → 1,500,000 / 2,300,000
  const trMatch = text.match(/^(\d+)tr(\d)$/);
  if (trMatch) {
    return (parseInt(trMatch[1]) * 1000000) + (parseInt(trMatch[2]) * 100000);
  }

  // 1.5tr, 2.3tr → 1,500,000 / 2,300,000
  const trDecimalMatch = text.match(/^([\d.]+)tr$/);
  if (trDecimalMatch) {
    return Math.round(parseFloat(trDecimalMatch[1]) * 1000000);
  }

  // 50k, 100k → 50,000 / 100,000
  const kMatch = text.match(/^([\d.]+)k$/);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // 1m, 2.5m → 1,000,000 / 2,500,000
  const mMatch = text.match(/^([\d.]+)m$/);
  if (mMatch) {
    return Math.round(parseFloat(mMatch[1]) * 1000000);
  }

  // Plain number less than 1000 → assume x1000
  const num = parseFloat(text);
  if (!isNaN(num)) {
    return num < 1000 ? num * 1000 : num;
  }

  return 0;
}

// ── Format money for reply ──
function fmtVND(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

// ── Send reply to Telegram ──
async function sendTelegram(chatId: number, text: string, parseMode = "HTML") {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

// ── Parse message → transaction data ──
function parseMessage(text: string): { type: "EXPENSE" | "INCOME"; amount: number; description: string } | null {
  text = text.trim();

  // Match: chi/thu [amount] [description]
  const match = text.match(/^(chi|thu)\s+([\d.]+(?:k|tr|m|\d)*)\s*(.*)$/i);
  if (!match) return null;

  const type = match[1].toLowerCase() === "chi" ? "EXPENSE" : "INCOME";
  const amount = parseAmount(match[2]);
  const description = match[3].trim() || (type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");

  if (amount <= 0) return null;

  return { type, amount, description };
}

// ── Handle /balance command ──
async function handleBalance(chatId: number) {
  try {
    const accounts = await prisma.account.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    });

    if (accounts.length === 0) {
      await sendTelegram(chatId, "📭 Chưa có tài khoản nào.");
      return;
    }

    // Calculate real balance for each account
    let msg = "💰 <b>Số dư tài khoản</b>\n\n";
    let totalNet = 0;

    for (const acc of accounts) {
      const incoming = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { toAccountId: acc.id },
      });
      const outgoing = await prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { fromAccountId: acc.id },
      });

      const balance = acc.initialBalance + (incoming._sum.amount || 0) - (outgoing._sum.amount || 0);
      totalNet += balance;

      const icon = acc.type === "CASH" ? "💵" : acc.type === "BANK" ? "🏦" : acc.type === "CREDIT_CARD" ? "💳" : acc.type === "E_WALLET" ? "📱" : "💎";
      msg += `${icon} <b>${acc.name}</b>\n   ${fmtVND(balance)}\n\n`;
    }

    msg += `━━━━━━━━━━━━━━\n💎 <b>Tổng:</b> ${fmtVND(totalNet)}`;
    await sendTelegram(chatId, msg);
  } catch (error) {
    await sendTelegram(chatId, "❌ Lỗi khi lấy số dư.");
  }
}

// ── Handle /today command ──
async function handleToday(chatId: number) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const txs = await prisma.transaction.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    if (txs.length === 0) {
      await sendTelegram(chatId, "📭 Hôm nay chưa có giao dịch nào.");
      return;
    }

    let totalIn = 0, totalOut = 0;
    let msg = `📋 <b>Giao dịch hôm nay</b> (${today.toLocaleDateString("vi-VN")})\n\n`;

    for (const tx of txs) {
      const icon = tx.type === "INCOME" ? "🟢" : tx.type === "EXPENSE" ? "🔴" : "🔄";
      const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "↔";
      msg += `${icon} ${sign}${fmtVND(tx.amount)} — ${tx.description || tx.category?.name || tx.type}\n`;

      if (tx.type === "INCOME") totalIn += tx.amount;
      if (tx.type === "EXPENSE") totalOut += tx.amount;
    }

    msg += `\n━━━━━━━━━━━━━━\n`;
    msg += `🟢 Thu: +${fmtVND(totalIn)}\n`;
    msg += `🔴 Chi: -${fmtVND(totalOut)}\n`;
    msg += `💰 Ròng: ${fmtVND(totalIn - totalOut)}`;

    await sendTelegram(chatId, msg);
  } catch (error) {
    await sendTelegram(chatId, "❌ Lỗi khi lấy giao dịch hôm nay.");
  }
}

// ── Handle /help command ──
async function handleHelp(chatId: number) {
  const msg = `🔥 <b>Kian FIRE Bot</b> — Nhập thu chi nhanh

<b>📝 Nhập giao dịch:</b>
<code>chi 50k cà phê</code> → -50,000đ
<code>thu 5tr lương</code> → +5,000,000đ
<code>chi 1.5tr tiền nhà</code> → -1,500,000đ
<code>chi 1tr5 điện nước</code> → -1,500,000đ
<code>chi 200 xăng</code> → -200,000đ

<b>📊 Xem thông tin:</b>
/balance — Số dư tài khoản
/today — Giao dịch hôm nay
/help — Hướng dẫn này

<b>💡 Quy ước số tiền:</b>
• <code>k</code> = nghìn (50k = 50,000)
• <code>tr</code> = triệu (1.5tr = 1,500,000)
• <code>1tr5</code> = 1,500,000
• Số < 1000 tự nhân 1000 (200 = 200,000)`;

  await sendTelegram(chatId, msg);
}

// ── Main webhook handler ──
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body?.message;

    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Commands
    if (text === "/start" || text === "/help") {
      await handleHelp(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/balance" || text === "/sodu") {
      await handleBalance(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/today" || text === "/homnay") {
      await handleToday(chatId);
      return NextResponse.json({ ok: true });
    }

    // Parse transaction message
    const parsed = parseMessage(text);
    if (!parsed) {
      await sendTelegram(chatId, `❓ Không hiểu. Gõ /help để xem hướng dẫn.\n\nVí dụ: <code>chi 50k cà phê</code>`);
      return NextResponse.json({ ok: true });
    }

    // Find default account (first active CASH or BANK)
    const defaultAccount = await prisma.account.findFirst({
      where: { status: "active", type: { in: ["CASH", "BANK", "E_WALLET"] } },
      orderBy: { createdAt: "asc" },
    });

    // Find matching category
    const category = await prisma.category.findFirst({
      where: {
        type: parsed.type,
        status: "active",
        name: { contains: parsed.description, mode: "insensitive" },
      },
    });

    // Find default user (admin)
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      orderBy: { createdAt: "asc" },
    });

    // Create transaction
    const tx = await prisma.transaction.create({
      data: {
        date: new Date(),
        type: parsed.type,
        amount: parsed.amount,
        fromAccountId: parsed.type === "EXPENSE" ? (defaultAccount?.id || null) : null,
        toAccountId: parsed.type === "INCOME" ? (defaultAccount?.id || null) : null,
        categoryId: category?.id || null,
        description: parsed.description,
        essential: parsed.type === "EXPENSE" ? "NON_ESSENTIAL" : null,
        rating: null,
        createdById: adminUser?.id || null,
      },
    });

    // Success reply
    const icon = parsed.type === "EXPENSE" ? "🔴" : "🟢";
    const sign = parsed.type === "EXPENSE" ? "-" : "+";
    const typeName = parsed.type === "EXPENSE" ? "Chi" : "Thu";
    const accName = defaultAccount ? ` (${defaultAccount.name})` : "";

    const reply = `${icon} <b>${typeName}:</b> ${sign}${fmtVND(parsed.amount)}
📝 ${parsed.description}${category ? `\n🏷 ${category.name}` : ""}
💳 ${accName}
✅ Đã lưu!`;

    await sendTelegram(chatId, reply);

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true }); // Always 200 for Telegram
  }
}

// GET — for webhook verification
export async function GET() {
  return NextResponse.json({ status: "Kian FIRE Telegram Bot is running 🔥" });
}
