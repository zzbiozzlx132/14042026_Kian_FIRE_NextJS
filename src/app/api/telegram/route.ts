import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/telegram
 * Webhook handler for Telegram Bot — nhập thu chi qua chat
 *
 * Formats: "chi 50k cafe", "thu 5tr luong", "-200 tien nha", "+500k freelance"
 *          "chi 20k cafe vcb"  ← auto-detect account từ cuối message
 * Commands: /balance, /today, /help
 *
 * Flow: User nhắn → Bot show preview + nút Lưu/Đổi TK/Huỷ → Confirm → Lưu DB
 */

// ══════════════════════════════════════════════════════════
// ACCOUNT MATCHING — Nhận diện tài khoản từ shorthand
// ══════════════════════════════════════════════════════════

// Viết tắt ngân hàng phổ biến VN → normalize name
const BANK_ABBREVS: Record<string, string[]> = {
  vcb: ["vietcombank", "vietcom"],
  tcb: ["techcombank", "techcom"],
  bid: ["bidv"],
  agr: ["agribank"],
  mb:  ["mbbank", "mb bank", "quandoi"],
  tpb: ["tpbank", "tp bank"],
  vp:  ["vpbank", "vp bank"],
  acb: ["acb"],
  vib: ["vib"],
  ocb: ["ocb"],
  scb: ["scb"],
  msb: ["msb", "maritime"],
  hdb: ["hdbank"],
  shb: ["shb"],
  vba: ["vietbank"],
  momo: ["momo"],
  zalo: ["zalopay", "zalopay"],
  vnpay: ["vnpay"],
  tm: ["tienmat", "tien mat", "cash"],
  cash: ["tienmat", "tien mat", "cash"],
  vi:  ["vidienmato", "ewallet"],
};

function normalizeVi(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

function accountMatchesQuery(query: string, account: any): boolean {
  const nq = normalizeVi(query);
  if (!nq || nq.length < 2) return false;

  // 1. Ưu tiên: kiểm tra aliases tùy chỉnh (exact match)
  if (account.aliases) {
    const aliasList = account.aliases
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(normalizeVi);
    if (aliasList.includes(nq)) return true;
  }

  const nname = normalizeVi(account.name);

  // 2. Direct substring match
  if (nname.includes(nq) || nq.includes(nname)) return true;

  // 3. Abbreviation map lookup
  const abbrevs = BANK_ABBREVS[nq];
  if (abbrevs) return abbrevs.some((a) => nname.includes(a));

  // 4. Prefix match
  if (nname.startsWith(nq)) return true;

  return false;
}

/**
 * Tìm tài khoản từ cuối description.
 * Nếu từ cuối (hoặc 2 từ cuối) khớp tên account → tách ra.
 */
function extractAccount(
  desc: string,
  accounts: any[]
): { cleanDesc: string; account: any | null } {
  if (!accounts.length || !desc.trim())
    return { cleanDesc: desc, account: null };

  const words = desc.trim().split(/\s+/);
  if (words.length <= 1) return { cleanDesc: desc, account: null };

  // Thử 1 từ cuối
  const last1 = words[words.length - 1];
  let found = accounts.find((a) => accountMatchesQuery(last1, a));
  if (found) {
    const cleanDesc = words.slice(0, -1).join(" ") || last1;
    return { cleanDesc, account: found };
  }

  // Thử 2 từ cuối
  if (words.length >= 3) {
    const last2 = words.slice(-2).join(" ");
    found = accounts.find((a) => accountMatchesQuery(last2, a));
    if (found) {
      const cleanDesc = words.slice(0, -2).join(" ") || last2;
      return { cleanDesc, account: found };
    }
  }

  return { cleanDesc: desc, account: null };
}

// ══════════════════════════════════════════════════════════
// TELEGRAM API HELPERS
// ══════════════════════════════════════════════════════════

async function getBotToken(): Promise<string> {
  const settings = await prisma.lifePlanSettings.findFirst();
  return settings?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || "";
}

function parseAmount(text: string): number {
  text = text.toLowerCase().replace(/,/g, ".").trim();
  const trMatch = text.match(/^(\d+)tr(\d)$/);
  if (trMatch)
    return parseInt(trMatch[1]) * 1_000_000 + parseInt(trMatch[2]) * 100_000;
  const trDecimalMatch = text.match(/^([\d.]+)tr$/);
  if (trDecimalMatch) return Math.round(parseFloat(trDecimalMatch[1]) * 1_000_000);
  const kMatch = text.match(/^([\d.]+)k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);
  const mMatch = text.match(/^([\d.]+)m$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const num = parseFloat(text);
  if (!isNaN(num)) return num < 1000 ? num * 1000 : num;
  return 0;
}

function fmtVND(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

async function send(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: any
) {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function answerCallback(
  token: string,
  callbackId: string,
  text?: string
) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: callbackId, text }),
  });
}

async function editMessage(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: any
) {
  const body: any = {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: "HTML",
  };
  if (replyMarkup) body.reply_markup = replyMarkup;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ══════════════════════════════════════════════════════════
// CALLBACK ENCODING
// Format: ACTION|TYPE|AMOUNT|DESC_MAX16BYTES|ACCT_ID12
// Telegram callback_data limit: 64 bytes
// ══════════════════════════════════════════════════════════

/** Cắt chuỗi theo byte limit (hỗ trợ UTF-8 Vietnamese) */
function byteSlice(s: string, maxBytes: number): string {
  let bytes = 0;
  let i = 0;
  while (i < s.length) {
    const code = s.charCodeAt(i);
    bytes += code > 0x7ff ? 3 : code > 0x7f ? 2 : 1;
    if (bytes > maxBytes) break;
    i++;
  }
  return s.slice(0, i);
}

function encodeCallback(
  action: string,
  type: string,
  amount: number,
  desc: string,
  accountIdShort?: string
): string {
  const t = type === "EXPENSE" ? "E" : "I";
  const shortDesc = byteSlice(desc, 16);
  const base = `${action}|${t}|${amount}|${shortDesc}`;
  return accountIdShort ? `${base}|${accountIdShort}` : base;
}

function decodeCallback(data: string): {
  action: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  description: string;
  accountIdShort?: string;
} | null {
  const parts = data.split("|");
  if (parts.length < 4) return null;
  return {
    action: parts[0],
    type: parts[1] === "E" ? "EXPENSE" : "INCOME",
    amount: parseFloat(parts[2]),
    description: parts[3],
    accountIdShort: parts[4] || undefined,
  };
}

// ══════════════════════════════════════════════════════════
// SAVE TRANSACTION
// ══════════════════════════════════════════════════════════

async function saveTransaction(
  type: "EXPENSE" | "INCOME",
  amount: number,
  description: string,
  accountIdShort?: string
) {
  let targetAccount: any = null;

  // Tìm theo accountIdShort (12 ký tự đầu của id)
  if (accountIdShort) {
    const allAccounts = await prisma.account.findMany({
      where: {
        status: "active",
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS"] },
      },
    });
    targetAccount = allAccounts.find((a: any) =>
      a.id.startsWith(accountIdShort)
    ) || null;
  }

  // Fallback: tài khoản đầu tiên active
  if (!targetAccount) {
    targetAccount = await prisma.account.findFirst({
      where: {
        status: "active",
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS"] },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  const category = await prisma.category.findFirst({
    where: { type, status: "active", name: { contains: description, mode: "insensitive" } },
  });
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });

  await prisma.transaction.create({
    data: {
      date: new Date(),
      type,
      amount,
      fromAccountId: type === "EXPENSE" ? (targetAccount?.id || null) : null,
      toAccountId: type === "INCOME" ? (targetAccount?.id || null) : null,
      categoryId: category?.id || null,
      description,
      essential: type === "EXPENSE" ? "NON_ESSENTIAL" : null,
      rating: null,
      createdById: adminUser?.id || null,
    },
  });

  return {
    accountName: targetAccount?.name,
    categoryName: category?.name,
  };
}

// ══════════════════════════════════════════════════════════
// COMMANDS: /balance, /today, /help
// ══════════════════════════════════════════════════════════

async function handleBalance(token: string, chatId: number) {
  try {
    const accounts = await prisma.account.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    });
    if (accounts.length === 0) {
      await send(token, chatId, "Chưa có tài khoản nào.");
      return;
    }

    let msg = "<b>Số dư tài khoản</b>\n\n";
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
      const totalIn = incoming._sum.amount || 0;
      const totalOut = outgoing._sum.amount || 0;

      let balance: number;
      if (acc.type === "CREDIT_CARD") {
        const creditUsed = totalOut - totalIn;
        balance = -creditUsed;
        msg += `<b>${acc.name}</b> [Thẻ]\n   Nợ: ${creditUsed > 0 ? `-${fmtVND(creditUsed)}` : "0đ"}${acc.creditLimit ? ` / ${fmtVND(acc.creditLimit)}` : ""}\n\n`;
      } else {
        balance = acc.initialBalance + totalIn - totalOut;
        const typeLabel =
          acc.type === "CASH" ? "Tiền mặt" :
          acc.type === "BANK" ? "Ngân hàng" :
          acc.type === "E_WALLET" ? "Ví" : "Tiết kiệm";
        msg += `<b>${acc.name}</b> [${typeLabel}]\n   ${fmtVND(balance)}\n\n`;
      }
      totalNet += balance;
    }

    msg += `━━━━━━━━━━━━\n<b>Tổng ròng:</b> ${fmtVND(totalNet)}`;
    await send(token, chatId, msg);
  } catch {
    await send(token, chatId, "Lỗi khi lấy số dư.");
  }
}

async function handleToday(token: string, chatId: number) {
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
      await send(token, chatId, "Hôm nay chưa có giao dịch nào.");
      return;
    }

    let totalIn = 0, totalOut = 0;
    let msg = `<b>Giao dịch hôm nay</b>\n\n`;
    for (const tx of txs) {
      const sign = tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : "↔";
      const label = tx.description || tx.category?.name || tx.type;
      msg += `${sign}${fmtVND(tx.amount)} — ${label}\n`;
      if (tx.type === "INCOME") totalIn += tx.amount;
      if (tx.type === "EXPENSE") totalOut += tx.amount;
    }
    msg += `\n━━━━━━━━━━━━\n+${fmtVND(totalIn)} | -${fmtVND(totalOut)} | ${fmtVND(totalIn - totalOut)}`;
    await send(token, chatId, msg);
  } catch {
    await send(token, chatId, "Lỗi khi lấy giao dịch.");
  }
}

async function handleHelp(token: string, chatId: number) {
  const msg = `<b>Kian FIRE Bot</b>

<b>Nhập giao dịch:</b>
<code>chi 50k cà phê</code>
<code>thu 5tr lương</code>
<code>-200 tiền nhà</code>
<code>+500k freelance</code>

<b>Chỉ định tài khoản (thêm vào cuối):</b>
<code>chi 20k cafe vcb</code>
<code>thu 5tr luong mb</code>
<code>chi 50k xang momo</code>

Bot hỏi xác nhận trước khi lưu.
Bấm <b>Đổi TK</b> để chọn tài khoản khác.

<b>Lệnh:</b>
/balance — Số dư · /today — Hôm nay · /help`;
  await send(token, chatId, msg);
}

// ══════════════════════════════════════════════════════════
// PARSE MESSAGE
// ══════════════════════════════════════════════════════════

function parseMessage(
  text: string
): { type: "EXPENSE" | "INCOME"; amount: number; description: string } | null {
  text = text.trim();

  const match1 = text.match(/^(chi|thu)\s+([\d.]+(?:k|tr|m|\d)*)\s*(.*)$/i);
  if (match1) {
    const type = match1[1].toLowerCase() === "chi" ? "EXPENSE" : "INCOME";
    const amount = parseAmount(match1[2]);
    const description =
      match1[3].trim() || (type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    if (amount <= 0) return null;
    return { type, amount, description };
  }

  const match2 = text.match(/^([+-])\s*([\d.]+(?:k|tr|m|\d)*)\s*(.*)$/);
  if (match2) {
    const type = match2[1] === "-" ? "EXPENSE" : "INCOME";
    const amount = parseAmount(match2[2]);
    const description =
      match2[3].trim() || (type === "EXPENSE" ? "Chi tiêu" : "Thu nhập");
    if (amount <= 0) return null;
    return { type, amount, description };
  }

  const match3 = text.match(/^([\d.]+(?:k|tr|m|\d)*)\s+(.+)$/);
  if (match3) {
    const amount = parseAmount(match3[1]);
    const description = match3[2].trim();
    if (amount <= 0) return null;
    return { type: "EXPENSE", amount, description };
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// BUILD CONFIRM MESSAGE & BUTTONS
// ══════════════════════════════════════════════════════════

function buildConfirmMsg(
  type: "EXPENSE" | "INCOME",
  amount: number,
  desc: string,
  accountName?: string
): string {
  const icon = type === "EXPENSE" ? "🔴" : "🟢";
  const sign = type === "EXPENSE" ? "-" : "+";
  const typeName = type === "EXPENSE" ? "Chi tiêu" : "Thu nhập";
  let msg = `${icon} <b>${typeName}</b>\n💰 ${sign}${fmtVND(amount)}\n📝 ${desc}`;
  if (accountName) msg += `\n💳 ${accountName}`;
  msg += `\n\n👇 <b>Xác nhận lưu?</b>`;
  return msg;
}

function buildConfirmButtons(
  type: "EXPENSE" | "INCOME",
  amount: number,
  desc: string,
  accountIdShort: string | undefined,
  hasMultipleAccounts: boolean
) {
  const saveData = encodeCallback("SAVE", type, amount, desc, accountIdShort);
  const cancelData = encodeCallback("CANCEL", type, amount, desc);
  const switchData = encodeCallback("SWITCH", type, amount, desc, accountIdShort);
  const acctData = encodeCallback("ACCT", type, amount, desc);
  const switchLabel = type === "EXPENSE" ? "↔ → Thu" : "↔ → Chi";

  const row1: any[] = [
    { text: "✅ Lưu", callback_data: saveData },
  ];
  if (hasMultipleAccounts) {
    row1.push({ text: "💳 Đổi TK", callback_data: acctData });
  }
  row1.push({ text: switchLabel, callback_data: switchData });
  row1.push({ text: "❌ Huỷ", callback_data: cancelData });

  return { inline_keyboard: [row1] };
}

// ══════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = await getBotToken();
    if (!token) return NextResponse.json({ ok: true });

    // ── Handle callback query ──────────────────────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const callbackId = cb.id;
      const decoded = decodeCallback(cb.data);

      if (!decoded) {
        await answerCallback(token, callbackId, "Dữ liệu không hợp lệ");
        return NextResponse.json({ ok: true });
      }

      // ── CANCEL ──
      if (decoded.action === "CANCEL") {
        await answerCallback(token, callbackId, "Đã huỷ");
        await editMessage(token, chatId, messageId, "❌ Đã huỷ giao dịch.");
        return NextResponse.json({ ok: true });
      }

      // ── SAVE ──
      if (decoded.action === "SAVE" || decoded.action === "ACCS") {
        try {
          const result = await saveTransaction(
            decoded.type,
            decoded.amount,
            decoded.description,
            decoded.accountIdShort
          );
          const sign = decoded.type === "EXPENSE" ? "-" : "+";
          const typeName = decoded.type === "EXPENSE" ? "Chi" : "Thu";
          await answerCallback(token, callbackId, "Đã lưu!");
          await editMessage(
            token, chatId, messageId,
            `${decoded.type === "EXPENSE" ? "🔴" : "🟢"} <b>${typeName}:</b> ${sign}${fmtVND(decoded.amount)}\n` +
            `📝 ${decoded.description}` +
            `${result.categoryName ? `\n🏷 ${result.categoryName}` : ""}` +
            `${result.accountName ? `\n💳 ${result.accountName}` : ""}` +
            `\n\n✅ <b>Đã lưu thành công!</b>`
          );
        } catch {
          await answerCallback(token, callbackId, "Lỗi lưu");
          await editMessage(token, chatId, messageId, "❌ Lỗi khi lưu. Thử lại.");
        }
        return NextResponse.json({ ok: true });
      }

      // ── ACCT — show account selection ──
      if (decoded.action === "ACCT") {
        const accounts = await prisma.account.findMany({
          where: { status: "active", type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS"] } },
          orderBy: { createdAt: "asc" },
        });

        if (accounts.length === 0) {
          await answerCallback(token, callbackId, "Chưa có tài khoản");
          return NextResponse.json({ ok: true });
        }

        const acctButtons = accounts.map((a: any) => ({
          text: `${a.name}`,
          callback_data: encodeCallback("ACCS", decoded.type, decoded.amount, decoded.description, a.id.slice(0, 12)),
        }));

        // Chia thành hàng 2 nút
        const rows: any[][] = [];
        for (let i = 0; i < acctButtons.length; i += 2) {
          rows.push(acctButtons.slice(i, i + 2));
        }
        rows.push([{ text: "❌ Huỷ", callback_data: encodeCallback("CANCEL", decoded.type, decoded.amount, decoded.description) }]);

        const sign = decoded.type === "EXPENSE" ? "-" : "+";
        const typeName = decoded.type === "EXPENSE" ? "Chi tiêu" : "Thu nhập";
        await answerCallback(token, callbackId);
        await editMessage(
          token, chatId, messageId,
          `💳 <b>Chọn tài khoản</b>\n${typeName}: ${sign}${fmtVND(decoded.amount)} · ${decoded.description}`,
          { inline_keyboard: rows }
        );
        return NextResponse.json({ ok: true });
      }

      // ── SWITCH — toggle INCOME ↔ EXPENSE ──
      if (decoded.action === "SWITCH") {
        const newType: "EXPENSE" | "INCOME" =
          decoded.type === "EXPENSE" ? "INCOME" : "EXPENSE";

        // Tìm tên account nếu có accountIdShort
        let accountName: string | undefined;
        if (decoded.accountIdShort) {
          const acc = await prisma.account.findFirst({
            where: { id: { startsWith: decoded.accountIdShort } },
          });
          accountName = acc?.name;
        }

        const buttons = buildConfirmButtons(
          newType,
          decoded.amount,
          decoded.description,
          decoded.accountIdShort,
          true // keep Đổi TK visible
        );

        await answerCallback(token, callbackId);
        await editMessage(
          token, chatId, messageId,
          buildConfirmMsg(newType, decoded.amount, decoded.description, accountName),
          buttons
        );
        return NextResponse.json({ ok: true });
      }

      return NextResponse.json({ ok: true });
    }

    // ── Handle text message ────────────────────────────────
    const message = body?.message;
    if (!message?.text || !message?.chat?.id)
      return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    const text = message.text.trim();

    // Commands
    if (text === "/start" || text === "/help") {
      await handleHelp(token, chatId);
      return NextResponse.json({ ok: true });
    }
    if (text === "/balance" || text === "/sodu") {
      await handleBalance(token, chatId);
      return NextResponse.json({ ok: true });
    }
    if (text === "/today" || text === "/homnay") {
      await handleToday(token, chatId);
      return NextResponse.json({ ok: true });
    }

    // Parse transaction
    const parsed = parseMessage(text);
    if (!parsed) {
      await send(
        token, chatId,
        `Không hiểu. Gõ /help để xem hướng dẫn.\n\nVí dụ:\n<code>chi 50k cà phê</code>\n<code>chi 20k cafe vcb</code>\n<code>thu 5tr lương mb</code>`
      );
      return NextResponse.json({ ok: true });
    }

    // Tìm tài khoản từ cuối description
    const accounts = await prisma.account.findMany({
      where: {
        status: "active",
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS"] },
      },
      orderBy: { createdAt: "asc" },
    });

    const { cleanDesc, account: detectedAccount } = extractAccount(
      parsed.description,
      accounts
    );
    const finalDesc = cleanDesc || parsed.description;
    const selectedAccount = detectedAccount || accounts[0] || null;
    const accountIdShort = selectedAccount?.id?.slice(0, 12);

    const buttons = buildConfirmButtons(
      parsed.type,
      parsed.amount,
      finalDesc,
      accountIdShort,
      accounts.length > 1
    );

    await send(
      token,
      chatId,
      buildConfirmMsg(parsed.type, parsed.amount, finalDesc, selectedAccount?.name),
      buttons
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("Telegram webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Kian FIRE Telegram Bot is running" });
}
