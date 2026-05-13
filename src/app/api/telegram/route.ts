import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/telegram
 * Webhook handler for Telegram Bot — nhập thu chi qua chat
 *
 * Formats: "chi 50k cafe", "thu 5tr luong", "-200 tien nha", "+500k freelance"
 *          "chi 20k cafe vcb"  ← auto-detect account từ cuối message
 *          "chuyen 1tr vcb sang momo" ← luân chuyển giữa 2 tài khoản
 *          ">500k tm vcb" ← luân chuyển nhanh từ tiền mặt sang vcb
 * Commands: /balance, /today, /help
 *
 * Flow: User nhắn → Bot show preview + nút Lưu/Đổi TK/Huỷ → Confirm → Lưu DB
 */

type MoneyTxType = "EXPENSE" | "INCOME";
type TelegramTxType = MoneyTxType | "TRANSFER";

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

async function clearKeyboard(token: string, chatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageReplyMarkup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] } }),
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
  const t = type === "EXPENSE" ? "E" : type === "TRANSFER" ? "T" : "I";
  const shortDesc = byteSlice(desc, 16);
  const base = `${action}|${t}|${amount}|${shortDesc}`;
  return accountIdShort ? `${base}|${accountIdShort}` : base;
}

function decodeCallback(data: string): {
  action: string;
  type: TelegramTxType;
  amount: number;
  description: string;
  accountIdShort?: string;
} | null {
  const parts = data.split("|");
  if (parts.length < 4) return null;
  const type =
    parts[1] === "E" ? "EXPENSE" :
    parts[1] === "T" ? "TRANSFER" :
    "INCOME";
  return {
    action: parts[0],
    type,
    amount: parseFloat(parts[2]),
    description: parts[3],
    accountIdShort: parts[4] || undefined,
  };
}

function splitTransferAccountIds(accountIdShort?: string): {
  fromIdShort?: string;
  toIdShort?: string;
} {
  const [fromIdShort, toIdShort] = (accountIdShort || "").split(">");
  return { fromIdShort: fromIdShort || undefined, toIdShort: toIdShort || undefined };
}

async function findAccountByShort(accountIdShort?: string) {
  if (!accountIdShort) return null;
  const accounts = await prisma.account.findMany({
    where: {
      status: "active",
      type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] },
    },
  });
  return accounts.find((a: any) => a.id.startsWith(accountIdShort)) || null;
}

async function getCreatorId(senderChatId?: string) {
  if (senderChatId) {
    const sender = await prisma.user.findFirst({
      where: { telegramChatId: senderChatId, telegramPaired: true },
    });
    if (sender?.id) return sender.id;
  }

  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  return adminUser?.id || null;
}

async function getAccountBalance(account: any): Promise<number> {
  const incoming = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { toAccountId: account.id },
  });
  const outgoing = await prisma.transaction.aggregate({
    _sum: { amount: true },
    where: { fromAccountId: account.id },
  });
  return account.initialBalance + (incoming._sum.amount || 0) - (outgoing._sum.amount || 0);
}

// ══════════════════════════════════════════════════════════
// SAVE TRANSACTION
// ══════════════════════════════════════════════════════════

async function saveTransaction(
  type: MoneyTxType,
  amount: number,
  description: string,
  accountIdShort?: string,
  senderChatId?: string
) {
  let targetAccount: any = null;

  // Tìm theo accountIdShort (12 ký tự đầu của id)
  if (accountIdShort) {
    const allAccounts = await prisma.account.findMany({
      where: {
        status: "active",
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] },
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
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // Block negative balance for non-credit-card accounts
  if (type === "EXPENSE" && targetAccount && targetAccount.type !== "CREDIT_CARD") {
    const incoming = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { toAccountId: targetAccount.id } });
    const outgoing = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { fromAccountId: targetAccount.id } });
    const balance = targetAccount.initialBalance + (incoming._sum.amount || 0) - (outgoing._sum.amount || 0);
    if (amount > balance) {
      throw new Error(`Số dư ${targetAccount.name} không đủ. Hiện có: ${Math.round(balance).toLocaleString("vi-VN")}đ`);
    }
  } else if (type === "EXPENSE" && targetAccount?.type === "CREDIT_CARD" && targetAccount.creditLimit) {
    const balance = await getAccountBalance(targetAccount);
    const available = targetAccount.creditLimit + balance;
    if (amount > available) {
      throw new Error(`Hạn mức ${targetAccount.name} không đủ. Khả dụng: ${Math.round(available).toLocaleString("vi-VN")}đ`);
    }
  }

  // Find category: keyword match first, then name match
  const descLower = description.toLowerCase();
  const allKeywords = await prisma.categoryKeyword.findMany({ include: { category: true } });
  const keywordMatch = allKeywords.find(k => descLower.includes(k.keyword.toLowerCase()) && k.category.type === type && k.category.status === "active");
  const category = keywordMatch?.category || await prisma.category.findFirst({
    where: { type, status: "active", name: { contains: description, mode: "insensitive" } },
  });
  // Ghi đúng người gửi lệnh; fallback về admin nếu không tìm được
  const creatorId = await getCreatorId(senderChatId);

  const tx = await prisma.transaction.create({
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
      createdById: creatorId,
    },
  });

  return {
    txId: tx.id,
    accountName: targetAccount?.name,
    categoryName: category?.name,
  };
}

async function saveTransferTransaction(
  amount: number,
  description: string,
  fromIdShort?: string,
  toIdShort?: string,
  senderChatId?: string
) {
  const fromAccount = await findAccountByShort(fromIdShort);
  const toAccount = await findAccountByShort(toIdShort);

  if (!fromAccount || !toAccount) {
    throw new Error("Không tìm thấy tài khoản chuyển/nhận.");
  }
  if (fromAccount.id === toAccount.id) {
    throw new Error("Tài khoản chuyển và nhận không được trùng nhau.");
  }

  const balance = await getAccountBalance(fromAccount);
  if (fromAccount.type !== "CREDIT_CARD") {
    if (amount > balance) {
      throw new Error(`Số dư ${fromAccount.name} không đủ. Hiện có: ${Math.round(balance).toLocaleString("vi-VN")}đ`);
    }
  } else if (fromAccount.creditLimit) {
    const available = fromAccount.creditLimit + balance;
    if (amount > available) {
      throw new Error(`Hạn mức ${fromAccount.name} không đủ. Khả dụng: ${Math.round(available).toLocaleString("vi-VN")}đ`);
    }
  }

  const creatorId = await getCreatorId(senderChatId);
  const category = await prisma.category.findFirst({
    where: { type: "TRANSFER", status: "active" },
    orderBy: { sortOrder: "asc" },
  });

  const tx = await prisma.transaction.create({
    data: {
      date: new Date(),
      type: "TRANSFER",
      amount,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      categoryId: category?.id || null,
      description,
      essential: null,
      rating: null,
      createdById: creatorId,
    },
  });

  return {
    txId: tx.id,
    fromAccountName: fromAccount.name,
    toAccountName: toAccount.name,
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
        balance = acc.initialBalance + totalIn - totalOut;
        const creditUsed = Math.max(0, -balance);
        const available = (acc.creditLimit || 0) - creditUsed;
        msg += `<b>${acc.name}</b> [Thẻ]\n   Nợ: ${creditUsed > 0 ? `-${fmtVND(creditUsed)}` : "0đ"}${acc.creditLimit ? ` / ${fmtVND(acc.creditLimit)}` : ""}\n`;
        if (acc.creditLimit) {
          msg += `   Khả dụng: ${fmtVND(available)}\n`;
        }
        msg += "\n";
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
  const msg = `<b>Kian FIRE Bot — Hướng dẫn nhanh</b>

<b>1) Nếu chưa kết nối tài khoản:</b>
<code>/pair MÃ</code>
Ví dụ: <code>/pair ABC123</code>

<b>2) Nhập giao dịch:</b>
<code>chi 50k cà phê</code>
<code>thu 5tr lương</code>
<code>-200 tiền nhà</code>
<code>+500k freelance</code>

<b>3) Chỉ định tài khoản (thêm vào cuối):</b>
<code>chi 20k cafe vcb</code>
<code>thu 5tr luong mb</code>
<code>chi 50k xang momo</code>

<b>4) Luân chuyển tiền:</b>
<code>&gt;500k tm vcb</code>
<code>&gt; 1tr vcb momo</code>
<code>chuyen 1tr vcb sang momo</code>
<code>ck 500k cash momo</code>

Bot hỏi xác nhận trước khi lưu.
Bấm <b>Đổi TK</b> để chọn tài khoản khác.

<b>Lệnh:</b>
/start · /help · /pair · /balance · /today`;
  await send(token, chatId, msg);
}

// ══════════════════════════════════════════════════════════
// PARSE MESSAGE
// ══════════════════════════════════════════════════════════

function parseMessage(
  text: string
): { type: MoneyTxType; amount: number; description: string } | null {
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

function parseCommand(text: string): string | null {
  const firstToken = text.trim().split(/\s+/)[0] || "";
  if (!firstToken.startsWith("/")) return null;
  return firstToken.toLowerCase().split("@")[0] || null;
}

function findAccountFromQuery(query: string, accounts: any[]) {
  return accounts.find((a) => accountMatchesQuery(query, a)) || null;
}

function parseTransferMessage(
  text: string,
  accounts: any[]
): { type: "TRANSFER"; amount: number; description: string; fromAccount: any; toAccount: any } | null {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 3) return null;

  const n0 = normalizeVi(tokens[0]);
  const n1 = normalizeVi(tokens[1] || "");
  let amountToken = "";
  let rest: string[] = [];

  if (tokens[0] === ">" || tokens[0] === "->") {
    amountToken = tokens[1] || "";
    rest = tokens.slice(2);
  } else if (tokens[0].startsWith(">")) {
    amountToken = tokens[0].slice(1);
    rest = tokens.slice(1);
  } else if (n0 === "luan" && n1 === "chuyen") {
    amountToken = tokens[2] || "";
    rest = tokens.slice(3);
  } else if (n0 === "chuyen" && n1 === "khoan") {
    amountToken = tokens[2] || "";
    rest = tokens.slice(3);
  } else if (["chuyen", "ck", "transfer"].includes(n0)) {
    amountToken = tokens[1] || "";
    rest = tokens.slice(2);
  }

  if (!amountToken || rest.length < 2) return null;

  const amount = parseAmount(amountToken);
  if (amount <= 0) return null;

  const separators = new Set(["sang", "qua", "toi", "den", "vao", "->", ">"]);
  const sepIndex = rest.findIndex((w) => separators.has(w) || separators.has(normalizeVi(w)));

  let fromAccount: any = null;
  let toAccount: any = null;

  if (sepIndex > 0 && sepIndex < rest.length - 1) {
    fromAccount = findAccountFromQuery(rest.slice(0, sepIndex).join(" "), accounts);
    toAccount = findAccountFromQuery(rest.slice(sepIndex + 1).join(" "), accounts);
  } else {
    for (let i = 1; i < rest.length; i++) {
      const from = findAccountFromQuery(rest.slice(0, i).join(" "), accounts);
      const to = findAccountFromQuery(rest.slice(i).join(" "), accounts);
      if (from && to && from.id !== to.id) {
        fromAccount = from;
        toAccount = to;
        break;
      }
    }
  }

  if (!fromAccount || !toAccount || fromAccount.id === toAccount.id) return null;

  return {
    type: "TRANSFER",
    amount,
    description: `Luân chuyển ${fromAccount.name} -> ${toAccount.name}`,
    fromAccount,
    toAccount,
  };
}

// ══════════════════════════════════════════════════════════
// BUILD CONFIRM MESSAGE & BUTTONS
// ══════════════════════════════════════════════════════════

function buildConfirmMsg(
  type: MoneyTxType,
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
  type: MoneyTxType,
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

function buildTransferConfirmMsg(
  amount: number,
  desc: string,
  fromAccountName?: string,
  toAccountName?: string
): string {
  let msg = `🔵 <b>Luân chuyển</b>\n💰 ${fmtVND(amount)}`;
  if (fromAccountName) msg += `\n🏦 Từ: ${fromAccountName}`;
  if (toAccountName) msg += `\n💳 Đến: ${toAccountName}`;
  msg += `\n📝 ${desc}\n\n👇 <b>Xác nhận lưu?</b>`;
  return msg;
}

function buildTransferConfirmButtons(
  amount: number,
  desc: string,
  fromIdShort: string,
  toIdShort: string,
  hasMultipleAccounts: boolean
) {
  const accountPair = `${fromIdShort}>${toIdShort}`;
  const saveData = encodeCallback("SAVE", "TRANSFER", amount, desc, accountPair);
  const cancelData = encodeCallback("CANCEL", "TRANSFER", amount, desc);
  const row1: any[] = [{ text: "✅ Lưu", callback_data: saveData }];
  if (hasMultipleAccounts) {
    row1.push({ text: "💳 Đổi TK", callback_data: encodeCallback("TACCT", "TRANSFER", amount, desc, accountPair) });
  }
  row1.push({ text: "❌ Huỷ", callback_data: cancelData });
  return { inline_keyboard: [row1] };
}

// ══════════════════════════════════════════════════════════
// MAIN WEBHOOK HANDLER
// ══════════════════════════════════════════════════════════

export async function POST(req: Request) {
  try {
    const token = await getBotToken();
    if (!token) return NextResponse.json({ ok: true });

    // Verify request is from Telegram using X-Telegram-Bot-Api-Secret-Token header
    const { createHmac } = await import("crypto");
    const expectedSecret = createHmac("sha256", "kian-fire-webhook").update(token).digest("hex").slice(0, 32);
    const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
    if (incomingSecret !== expectedSecret) {
      return NextResponse.json({ ok: false }, { status: 403 });
    }

    const body = await req.json();

    // ── Handle callback query ──────────────────────────────
    if (body.callback_query) {
      const cb = body.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const callbackId = cb.id;

      // ── RKEY — classify essential/rating (handle before generic decode) ──
      if (cb.data?.startsWith("RKEY|")) {
        const parts = cb.data.split("|");
        if (parts.length === 3) {
          const txId12 = parts[1];
          const code = parts[2];
          try {
            const allTx = await prisma.transaction.findMany({ where: { type: "EXPENSE" }, orderBy: { createdAt: "desc" }, take: 100 });
            const tx = allTx.find((t: any) => t.id.startsWith(txId12));
            if (tx) {
              const updateData: any = {};
              if (code === "E") { updateData.essential = "ESSENTIAL"; }
              else if (code === "N") { updateData.essential = "NON_ESSENTIAL"; }
              else if (code === "W") { updateData.rating = "WORTHY"; }
              else if (code === "B") { updateData.rating = "NORMAL"; }
              else if (code === "P") { updateData.rating = "WASTEFUL"; }
              await prisma.transaction.update({ where: { id: tx.id }, data: updateData });
            }
            const labels: Record<string, string> = { E: "Thiết yếu", N: "Không thiết yếu", W: "Xứng đáng", B: "Bình thường", P: "Phí tiền" };
            await answerCallback(token, callbackId, `Đã đánh dấu: ${labels[code] || code}`);
            await clearKeyboard(token, chatId, messageId);
          } catch {
            await answerCallback(token, callbackId, "Lỗi cập nhật");
          }
        }
        return NextResponse.json({ ok: true });
      }

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
      if (decoded.action === "SAVE" && decoded.type === "TRANSFER") {
        try {
          const msgText: string = cb.message?.text || "";
          const descMatch = msgText.match(/📝 (.+?)(?:\n|$)/);
          const fullDesc = descMatch ? descMatch[1].trim() : decoded.description;
          const { fromIdShort, toIdShort } = splitTransferAccountIds(decoded.accountIdShort);

          await answerCallback(token, callbackId, "Đang lưu...");
          await clearKeyboard(token, chatId, messageId);

          const result = await saveTransferTransaction(
            decoded.amount,
            fullDesc,
            fromIdShort,
            toIdShort,
            String(chatId)
          );

          await editMessage(
            token, chatId, messageId,
            `🔵 <b>Luân chuyển:</b> ${fmtVND(decoded.amount)}\n` +
            `🏦 Từ: ${result.fromAccountName}\n` +
            `💳 Đến: ${result.toAccountName}\n` +
            `📝 ${fullDesc}` +
            `\n\n✅ <b>Đã lưu thành công!</b>`
          );
        } catch (err: any) {
          const msg = err?.message || "Lỗi khi lưu";
          await answerCallback(token, callbackId, msg.slice(0, 200));
          await editMessage(token, chatId, messageId, `❌ ${msg}`);
        }
        return NextResponse.json({ ok: true });
      }

      if (decoded.action === "SAVE" || decoded.action === "ACCS") {
        try {
          if (decoded.type === "TRANSFER") {
            await answerCallback(token, callbackId, "Dữ liệu không hợp lệ");
            return NextResponse.json({ ok: true });
          }

          // Recover full description from message text to avoid callback truncation
          const msgText: string = cb.message?.text || "";
          const descMatch = msgText.match(/📝 (.+?)(?:\n|$)/);
          const fullDesc = descMatch ? descMatch[1].trim() : decoded.description;

          // Answer and remove keyboard immediately to prevent double-tap duplicates
          await answerCallback(token, callbackId, "Đang lưu...");
          await clearKeyboard(token, chatId, messageId);

          const result = await saveTransaction(
            decoded.type,
            decoded.amount,
            fullDesc,
            decoded.accountIdShort,
            String(chatId)
          );
          const txId12 = result.txId.slice(0, 12);

          // EXPENSE: show essential classification (1 row only — rating edit on web)
          if (decoded.type === "EXPENSE") {
            const rKeyButtons = {
              inline_keyboard: [[
                { text: "Thiết yếu", callback_data: `RKEY|${txId12}|E` },
                { text: "Không thiết yếu", callback_data: `RKEY|${txId12}|N` },
              ]],
            };
            await editMessage(
              token, chatId, messageId,
              `🔴 <b>Chi:</b> -${fmtVND(decoded.amount)}\n` +
              `📝 ${fullDesc}` +
              `${result.categoryName ? `\n🏷 ${result.categoryName}` : ""}` +
              `${result.accountName ? `\n💳 ${result.accountName}` : ""}` +
              `\n\n✅ <b>Đã lưu!</b> Thiết yếu không?`,
              rKeyButtons
            );
          } else {
            await editMessage(
              token, chatId, messageId,
              `🟢 <b>Thu:</b> +${fmtVND(decoded.amount)}\n` +
              `📝 ${fullDesc}` +
              `${result.categoryName ? `\n🏷 ${result.categoryName}` : ""}` +
              `${result.accountName ? `\n💳 ${result.accountName}` : ""}` +
              `\n\n✅ <b>Đã lưu thành công!</b>`
            );
          }
        } catch (err: any) {
          const msg = err?.message || "Lỗi khi lưu";
          await answerCallback(token, callbackId, msg.slice(0, 200));
          await editMessage(token, chatId, messageId, `❌ ${msg}`);
        }
        return NextResponse.json({ ok: true });
      }

      // ── TACCT — choose which side of a transfer to change ──
      if (decoded.action === "TACCT") {
        const { fromIdShort, toIdShort } = splitTransferAccountIds(decoded.accountIdShort);
        const fromAccount = await findAccountByShort(fromIdShort);
        const toAccount = await findAccountByShort(toIdShort);
        const accountPair = `${fromIdShort || ""}>${toIdShort || ""}`;
        const rows = [
          [
            { text: "🏦 Đổi TK đi", callback_data: encodeCallback("TFROM", "TRANSFER", decoded.amount, decoded.description, accountPair) },
            { text: "💳 Đổi TK đến", callback_data: encodeCallback("TTO", "TRANSFER", decoded.amount, decoded.description, accountPair) },
          ],
          [{ text: "❌ Huỷ", callback_data: encodeCallback("CANCEL", "TRANSFER", decoded.amount, decoded.description) }],
        ];

        await answerCallback(token, callbackId);
        await editMessage(
          token, chatId, messageId,
          `💳 <b>Đổi tài khoản luân chuyển</b>\n` +
          `Từ: ${fromAccount?.name || "?"}\n` +
          `Đến: ${toAccount?.name || "?"}\n` +
          `${fmtVND(decoded.amount)} · ${decoded.description}`,
          { inline_keyboard: rows }
        );
        return NextResponse.json({ ok: true });
      }

      // ── TFROM/TTO — list accounts for transfer side ──
      if (decoded.action === "TFROM" || decoded.action === "TTO") {
        const accounts = await prisma.account.findMany({
          where: { status: "active", type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] } },
          orderBy: { createdAt: "asc" },
        });
        const { fromIdShort, toIdShort } = splitTransferAccountIds(decoded.accountIdShort);
        const acctButtons = accounts.map((a: any) => {
          const short = a.id.slice(0, 10);
          const pair = decoded.action === "TFROM"
            ? `${short}>${toIdShort || ""}`
            : `${fromIdShort || ""}>${short}`;
          return {
            text: `${a.name}`,
            callback_data: encodeCallback(decoded.action === "TFROM" ? "TSETF" : "TSETT", "TRANSFER", decoded.amount, decoded.description, pair),
          };
        });

        const rows: any[][] = [];
        for (let i = 0; i < acctButtons.length; i += 2) {
          rows.push(acctButtons.slice(i, i + 2));
        }
        rows.push([{ text: "❌ Huỷ", callback_data: encodeCallback("CANCEL", "TRANSFER", decoded.amount, decoded.description) }]);

        await answerCallback(token, callbackId);
        await editMessage(
          token, chatId, messageId,
          decoded.action === "TFROM"
            ? `🏦 <b>Chọn tài khoản chuyển đi</b>\n${fmtVND(decoded.amount)} · ${decoded.description}`
            : `💳 <b>Chọn tài khoản nhận</b>\n${fmtVND(decoded.amount)} · ${decoded.description}`,
          { inline_keyboard: rows }
        );
        return NextResponse.json({ ok: true });
      }

      // ── TSETF/TSETT — rebuild transfer preview after account change ──
      if (decoded.action === "TSETF" || decoded.action === "TSETT") {
        const { fromIdShort, toIdShort } = splitTransferAccountIds(decoded.accountIdShort);
        const fromAccount = await findAccountByShort(fromIdShort);
        const toAccount = await findAccountByShort(toIdShort);
        if (!fromAccount || !toAccount || fromAccount.id === toAccount.id) {
          await answerCallback(token, callbackId, "Tài khoản không hợp lệ");
          return NextResponse.json({ ok: true });
        }

        const desc = `Luân chuyển ${fromAccount.name} -> ${toAccount.name}`;
        const buttons = buildTransferConfirmButtons(
          decoded.amount,
          desc,
          fromAccount.id.slice(0, 10),
          toAccount.id.slice(0, 10),
          true
        );

        await answerCallback(token, callbackId);
        await editMessage(
          token, chatId, messageId,
          buildTransferConfirmMsg(decoded.amount, desc, fromAccount.name, toAccount.name),
          buttons
        );
        return NextResponse.json({ ok: true });
      }

      // ── ACCT — show account selection ──
      if (decoded.action === "ACCT") {
        const accounts = await prisma.account.findMany({
          where: { status: "active", type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] } },
          orderBy: { createdAt: "asc" },
        });

        if (accounts.length === 0) {
          await answerCallback(token, callbackId, "Chưa có tài khoản");
          return NextResponse.json({ ok: true });
        }

        const acctButtons = accounts.map((a: any) => ({
          text: `${a.name}`,
          callback_data: encodeCallback("ACCS", decoded.type, decoded.amount, decoded.description, a.id.slice(0, 20)),
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
    const command = parseCommand(text);

    // Commands
    if (command === "/start" || command === "/help" || command === "/commands" || command === "/menu") {
      await handleHelp(token, chatId);
      return NextResponse.json({ ok: true });
    }
    if (command === "/balance" || command === "/sodu") {
      await handleBalance(token, chatId);
      return NextResponse.json({ ok: true });
    }
    if (command === "/today" || command === "/homnay") {
      await handleToday(token, chatId);
      return NextResponse.json({ ok: true });
    }

    // ── /pair CODE ─────────────────────────────────────────
    if (command === "/pair") {
      const code = text.split(/\s+/)[1]?.toUpperCase();
      if (!code) {
        await send(token, chatId, "❌ Vui lòng nhập mã xác nhận.\nVí dụ: <code>/pair ABC123</code>");
        return NextResponse.json({ ok: true });
      }
      const user = await prisma.user.findFirst({ where: { telegramPairingCode: code } });
      if (!user) {
        await send(token, chatId, "❌ Mã không hợp lệ hoặc đã hết hạn.\nVui lòng tạo mã mới trên web.");
        return NextResponse.json({ ok: true });
      }
      if (user.telegramPaired) {
        await send(token, chatId, "✅ Tài khoản này đã được kết nối rồi!");
        return NextResponse.json({ ok: true });
      }
      // Save chatId, wait for admin approval
      await prisma.user.update({
        where: { id: user.id },
        data: { telegramChatId: String(chatId) },
      });
      await send(token, chatId, `⏳ Đã nhận yêu cầu kết nối cho tài khoản <b>${user.name}</b>.\n\nAdmin đang xem xét — bạn sẽ nhận thông báo khi được duyệt.`);

      // Notify all admins
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", telegramChatId: { not: null }, telegramPaired: true } });
      for (const admin of admins) {
        await send(token, Number(admin.telegramChatId),
          `🔔 <b>Yêu cầu kết nối Telegram</b>\n\n👤 ${user.name} (${user.email})\n\nVào Cài đặt → Thành viên để duyệt.`
        );
      }
      return NextResponse.json({ ok: true });
    }

    // Chỉ paired users mới được gửi lệnh giao dịch
    const senderChatId = String(chatId);
    const pairedUser = await prisma.user.findFirst({
      where: { telegramChatId: senderChatId, telegramPaired: true },
    });

    if (!pairedUser) {
      await send(token, chatId, "❌ Tài khoản của bạn chưa được kết nối.\n\nVào web → Cài đặt → Tài khoản → kéo xuống mục Telegram để lấy mã, rồi gõ <code>/pair MÃ</code> ở đây.");
      return NextResponse.json({ ok: true });
    }

    // Tìm tài khoản để parse cả thu/chi lẫn luân chuyển
    const accounts = await prisma.account.findMany({
      where: {
        status: "active",
        type: { in: ["CASH", "BANK", "E_WALLET", "SAVINGS", "CREDIT_CARD"] },
      },
      orderBy: { createdAt: "asc" },
    });

    // Parse transaction
    const transferParsed = parseTransferMessage(text, accounts);
    if (transferParsed) {
      const fromIdShort = transferParsed.fromAccount.id.slice(0, 10);
      const toIdShort = transferParsed.toAccount.id.slice(0, 10);
      const buttons = buildTransferConfirmButtons(
        transferParsed.amount,
        transferParsed.description,
        fromIdShort,
        toIdShort,
        accounts.length > 1
      );

      await send(
        token,
        chatId,
        buildTransferConfirmMsg(
          transferParsed.amount,
          transferParsed.description,
          transferParsed.fromAccount.name,
          transferParsed.toAccount.name
        ),
        buttons
      );
      return NextResponse.json({ ok: true });
    }

    const parsed = parseMessage(text);
    if (!parsed) {
      await send(
        token, chatId,
        `Không hiểu. Gõ /help để xem hướng dẫn.\n\nVí dụ:\n<code>chi 50k cà phê</code>\n<code>chi 20k cafe vcb</code>\n<code>thu 5tr lương mb</code>\n<code>chuyen 1tr vcb sang momo</code>`
      );
      return NextResponse.json({ ok: true });
    }

    // Tìm tài khoản từ cuối description
    const { cleanDesc, account: detectedAccount } = extractAccount(
      parsed.description,
      accounts
    );
    const finalDesc = cleanDesc || parsed.description;
    const selectedAccount = detectedAccount || accounts[0] || null;
    const accountIdShort = selectedAccount?.id?.slice(0, 20);

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
