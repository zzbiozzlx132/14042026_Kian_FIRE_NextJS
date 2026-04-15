import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/telegram
 * Webhook handler for Telegram Bot — nhập thu chi qua chat
 * 
 * Formats: "chi 50k cafe", "thu 5tr luong", "-200 tien nha", "+500k freelance", "50k cafe"
 * Commands: /balance, /today, /help
 * 
 * Flow: User nhắn → Bot show preview + nút Lưu/Huỷ → User bấm Lưu → Lưu vào DB
 */

// ── Get bot token from DB ──
async function getBotToken(): Promise<string> {
  const settings = await prisma.lifePlanSettings.findFirst();
  return settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
}

// ── Parse Vietnamese amount ──
function parseAmount(text: string): number {
  text = text.toLowerCase().replace(/,/g, ".").trim();
  const trMatch = text.match(/^(\d+)tr(\d)$/);
  if (trMatch) return (parseInt(trMatch[1]) * 1000000) + (parseInt(trMatch[2]) * 100000);
  const trDecimalMatch = text.match(/^([\d.]+)tr$/);
  if (trDecimalMatch) return Math.round(parseFloat(trDecimalMatch[1]) * 1000000);
  const kMatch = text.match(/^([\d.]+)k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  const mMatch = text.match(/^([\d.]+)m$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1000000);
  const num = parseFloat(text);
  if (!isNaN(num)) return num < 1000 ? num * 1000 : num;
  return 0;
}

// ── Format money ──
function fmtVND(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

// ── Send message ──
async function send(token: string, chatId: number, text: string, replyMarkup?: any) {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Answer callback query ──
async function answerCallback(token: string, callbackId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}

// ── Edit message ──
async function editMessage(token: string, chatId: number, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" }),
  });
}

// ── Parse message → transaction data ──
// Supports: "chi 50k cafe", "thu 5tr luong", "-200 tien nha", "+500k", "50k cafe"
function parseMessage(text: string): { type: "EXPENSE" | "INCOME"; amount: number; description: string } | null {
  text = text.trim();

  // Format 1: chi/thu [amount] [description]
  const match1 = text.match(/^(chi|thu)\s+([\d.]+(?:k|tr|m|\d)*)\s*(.*)$/i);
  if (match1) {
    const type = match1[1].toLowerCase() === "chi" ? "EXPENSE" : "INCOME";
    const amount = parseAmount(match1[2]);
    const description = match1[3].trim() || (type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    if (amount <= 0) return null;
    return { type, amount, description };
  }

  // Format 2: -50k cafe (negative = expense), +5tr luong (positive = income)
  const match2 = text.match(/^([+-])\s*([\d.]+(?:k|tr|m|\d)*)\s*(.*)$/);
  if (match2) {
    const type = match2[1] === "-" ? "EXPENSE" : "INCOME";
    const amount = parseAmount(match2[2]);
    const description = match2[3].trim() || (type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    if (amount <= 0) return null;
    return { type, amount, description };
  }

  // Format 3: [amount] [description] → ask user to choose type
  const match3 = text.match(/^([\d.]+(?:k|tr|m|\d)*)\s+(.+)$/);
  if (match3) {
    const amount = parseAmount(match3[1]);
    const description = match3[2].trim();
    if (amount <= 0) return null;
    // Default to EXPENSE (most common), user confirms
    return { type: "EXPENSE", amount, description };
  }

  return null;
}

// ── Encode transaction data for callback ──
// Format: "SAVE|E|50000|cafe" or "SAVE|I|5000000|luong" (max 64 bytes)
function encodeCallback(action: string, type: string, amount: number, desc: string): string {
  const shortDesc = desc.substring(0, 20); // trim to fit 64 byte limit
  return `${action}|${type === "EXPENSE" ? "E" : "I"}|${amount}|${shortDesc}`;
}

function decodeCallback(data: string): { action: string; type: "EXPENSE" | "INCOME"; amount: number; description: string } | null {
  const parts = data.split("|");
  if (parts.length < 4) return null;
  return {
    action: parts[0],
    type: parts[1] === "E" ? "EXPENSE" : "INCOME",
    amount: parseFloat(parts[2]),
    description: parts.slice(3).join("|"),
  };
}

// ── Handle /balance ──
async function handleBalance(token: string, chatId: number) {
  try {
    const accounts = await prisma.account.findMany({ where: { status: "active" }, orderBy: { name: "asc" } });
    if (accounts.length === 0) { await send(token, chatId, "📭 Chưa có tài khoản nào."); return; }

    let msg = "💰 <b>Số dư tài khoản</b>\n\n";
    let totalNet = 0;

    for (const acc of accounts) {
      const incoming = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { toAccountId: acc.id } });
      const outgoing = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { fromAccountId: acc.id } });
      const totalIn = incoming._sum.amount || 0;
      const totalOut = outgoing._sum.amount || 0;

      let balance: number;
      if (acc.type === "CREDIT_CARD") {
        const creditUsed = totalOut - totalIn;
        balance = -creditUsed;
        const icon = "💳";
        msg += `${icon} <b>${acc.name}</b>\n   Nợ: ${creditUsed > 0 ? `-${fmtVND(creditUsed)}` : "0đ"}${acc.creditLimit ? ` / ${fmtVND(acc.creditLimit)}` : ""}\n\n`;
      } else {
        balance = acc.initialBalance + totalIn - totalOut;
        const icon = acc.type === "CASH" ? "💵" : acc.type === "BANK" ? "🏦" : acc.type === "E_WALLET" ? "📱" : "💎";
        msg += `${icon} <b>${acc.name}</b>\n   ${fmtVND(balance)}\n\n`;
      }
      totalNet += balance;
    }

    msg += `━━━━━━━━━━━━\n💎 <b>Tổng ròng:</b> ${fmtVND(totalNet)}`;
    await send(token, chatId, msg);
  } catch { await send(token, chatId, "❌ Lỗi khi lấy số dư."); }
}

// ── Handle /today ──
async function handleToday(token: string, chatId: number) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const txs = await prisma.transaction.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    if (txs.length === 0) { await send(token, chatId, "📭 Hôm nay chưa có giao dịch nào."); return; }

    let totalIn = 0, totalOut = 0;
    let msg = `📋 <b>Giao dịch hôm nay</b>\n\n`;
    for (const tx of txs) {
      const icon = tx.type === "INCOME" ? "🟢" : tx.type === "EXPENSE" ? "🔴" : "🔄";
      const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "↔";
      msg += `${icon} ${sign}${fmtVND(tx.amount)} — ${tx.description || tx.category?.name || tx.type}\n`;
      if (tx.type === "INCOME") totalIn += tx.amount;
      if (tx.type === "EXPENSE") totalOut += tx.amount;
    }
    msg += `\n━━━━━━━━━━━━\n🟢 +${fmtVND(totalIn)} · 🔴 -${fmtVND(totalOut)} · 💰 ${fmtVND(totalIn - totalOut)}`;
    await send(token, chatId, msg);
  } catch { await send(token, chatId, "❌ Lỗi khi lấy giao dịch."); }
}

// ── Handle /help ──
async function handleHelp(token: string, chatId: number) {
  const msg = `🔥 <b>Kian FIRE Bot</b>

<b>📝 Nhập giao dịch:</b>
<code>chi 50k cà phê</code>
<code>thu 5tr lương</code>
<code>-200 tiền nhà</code>
<code>+500k freelance</code>
<code>50k cafe</code> (mặc định = chi)

Bot sẽ hỏi xác nhận trước khi lưu ✅

<b>📊 Lệnh:</b>
/balance — Số dư tài khoản
/today — Giao dịch hôm nay
/help — Hướng dẫn

<b>💡 Số tiền:</b>
• k = nghìn · tr = triệu
• <code>1tr5</code> = 1,500,000
• Số < 1000 tự ×1000`;
  await send(token, chatId, msg);
}

// ── Save transaction ──
async function saveTransaction(type: "EXPENSE" | "INCOME", amount: number, description: string) {
  const defaultAccount = await prisma.account.findFirst({
    where: { status: "active", type: { in: ["CASH", "BANK", "E_WALLET"] } },
    orderBy: { createdAt: "asc" },
  });
  const category = await prisma.category.findFirst({
    where: { type, status: "active", name: { contains: description, mode: "insensitive" } },
  });
  const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

  await prisma.transaction.create({
    data: {
      date: new Date(),
      type,
      amount,
      fromAccountId: type === "EXPENSE" ? (defaultAccount?.id || null) : null,
      toAccountId: type === "INCOME" ? (defaultAccount?.id || null) : null,
      categoryId: category?.id || null,
      description,
      essential: type === "EXPENSE" ? "NON_ESSENTIAL" : null,
      rating: null,
      createdById: adminUser?.id || null,
    },
  });

  return { accountName: defaultAccount?.name, categoryName: category?.name };
}

// ═════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ═════════════════════════════════════════
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = await getBotToken();
    if (!token) return NextResponse.json({ ok: true });

    // ── Handle callback query (confirm/cancel buttons) ──
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const callbackId = cb.id;
      const decoded = decodeCallback(cb.data);

      if (!decoded) {
        await answerCallback(token, callbackId, "❓ Dữ liệu không hợp lệ");
        return NextResponse.json({ ok: true });
      }

      if (decoded.action === "CANCEL") {
        await answerCallback(token, callbackId, "❌ Đã huỷ");
        await editMessage(token, chatId, messageId, "❌ Đã huỷ giao dịch.");
        return NextResponse.json({ ok: true });
      }

      if (decoded.action === "SAVE") {
        try {
          const result = await saveTransaction(decoded.type, decoded.amount, decoded.description);
          const icon = decoded.type === "EXPENSE" ? "🔴" : "🟢";
          const sign = decoded.type === "EXPENSE" ? "-" : "+";
          const typeName = decoded.type === "EXPENSE" ? "Chi" : "Thu";
          await answerCallback(token, callbackId, "✅ Đã lưu!");
          await editMessage(token, chatId, messageId,
            `${icon} <b>${typeName}:</b> ${sign}${fmtVND(decoded.amount)}\n📝 ${decoded.description}${result.categoryName ? `\n🏷 ${result.categoryName}` : ""}${result.accountName ? `\n💳 ${result.accountName}` : ""}\n\n✅ <b>Đã lưu thành công!</b>`
          );
        } catch (e) {
          await answerCallback(token, callbackId, "❌ Lỗi lưu");
          await editMessage(token, chatId, messageId, "❌ Lỗi khi lưu giao dịch. Thử lại.");
        }
        return NextResponse.json({ ok: true });
      }

      // SWITCH type: toggle E↔I
      if (decoded.action === "SWITCH") {
        const newType = decoded.type === "EXPENSE" ? "INCOME" : "EXPENSE";
        const icon = newType === "EXPENSE" ? "🔴" : "🟢";
        const sign = newType === "EXPENSE" ? "-" : "+";
        const typeName = newType === "EXPENSE" ? "Chi tiêu" : "Thu nhập";

        await answerCallback(token, callbackId);
        await editMessage(token, chatId, messageId,
          `${icon} <b>${typeName}</b>\n💰 ${sign}${fmtVND(decoded.amount)}\n📝 ${decoded.description}\n\n👇 <b>Xác nhận lưu?</b>`
        );
        // Re-send with new buttons
        const saveData = encodeCallback("SAVE", newType, decoded.amount, decoded.description);
        const cancelData = encodeCallback("CANCEL", newType, decoded.amount, decoded.description);
        const switchData = encodeCallback("SWITCH", newType, decoded.amount, decoded.description);

        // Need to use editMessageReplyMarkup for buttons
        await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId, message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "✅ Lưu", callback_data: saveData },
                  { text: newType === "EXPENSE" ? "↔ Đổi → Thu" : "↔ Đổi → Chi", callback_data: switchData },
                  { text: "❌ Huỷ", callback_data: cancelData },
                ]
              ]
            }
          }),
        });
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Handle text message ──
    const message = body?.message;
    if (!message?.text || !message?.chat?.id) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Commands
    if (text === "/start" || text === "/help") { await handleHelp(token, chatId); return NextResponse.json({ ok: true }); }
    if (text === "/balance" || text === "/sodu") { await handleBalance(token, chatId); return NextResponse.json({ ok: true }); }
    if (text === "/today" || text === "/homnay") { await handleToday(token, chatId); return NextResponse.json({ ok: true }); }

    // Parse transaction
    const parsed = parseMessage(text);
    if (!parsed) {
      await send(token, chatId, `❓ Không hiểu. Gõ /help để xem hướng dẫn.\n\nVí dụ:\n<code>chi 50k cà phê</code>\n<code>-200 tiền nhà</code>\n<code>thu 5tr lương</code>`);
      return NextResponse.json({ ok: true });
    }

    // Show confirmation with inline buttons
    const icon = parsed.type === "EXPENSE" ? "🔴" : "🟢";
    const sign = parsed.type === "EXPENSE" ? "-" : "+";
    const typeName = parsed.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập";

    const saveData = encodeCallback("SAVE", parsed.type, parsed.amount, parsed.description);
    const cancelData = encodeCallback("CANCEL", parsed.type, parsed.amount, parsed.description);
    const switchData = encodeCallback("SWITCH", parsed.type, parsed.amount, parsed.description);

    await send(token, chatId,
      `${icon} <b>${typeName}</b>\n💰 ${sign}${fmtVND(parsed.amount)}\n📝 ${parsed.description}\n\n👇 <b>Xác nhận lưu?</b>`,
      {
        inline_keyboard: [
          [
            { text: "✅ Lưu", callback_data: saveData },
            { text: parsed.type === "EXPENSE" ? "↔ Đổi → Thu" : "↔ Đổi → Chi", callback_data: switchData },
            { text: "❌ Huỷ", callback_data: cancelData },
          ]
        ]
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Kian FIRE Telegram Bot is running 🔥" });
}
