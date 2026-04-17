import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";

// GET: generate a pairing code for the logged-in user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

  // If already paired, return status
  if (user.telegramPaired && user.telegramChatId) {
    return NextResponse.json({ paired: true, chatId: user.telegramChatId });
  }

  // Generate or reuse existing pairing code (6-char uppercase)
  const code = user.telegramPairingCode || crypto.randomBytes(3).toString("hex").toUpperCase();
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramPairingCode: code },
  });

  const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  const botToken = settings?.telegramBotToken;
  let botUsername = null;
  if (botToken) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const d = await r.json();
      if (d.ok) botUsername = d.result.username;
    } catch {}
  }

  return NextResponse.json({ paired: false, code, botUsername });
}

// POST: admin approves/rejects a pending pairing request
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Chỉ admin mới được duyệt" }, { status: 403 });

  const { userId, approve } = await req.json();

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });

  if (approve) {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramPaired: true, telegramPairingCode: null },
    });

    // Notify user via Telegram
    const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
    if (settings?.telegramBotToken && target.telegramChatId) {
      await fetch(`https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: target.telegramChatId,
          text: `✅ Tài khoản <b>${target.name}</b> đã được Admin duyệt!\n\nBạn có thể bắt đầu nhập thu chi qua bot. Gõ /help để xem hướng dẫn.`,
          parse_mode: "HTML",
        }),
      });
    }
    return NextResponse.json({ ok: true, message: "Đã duyệt" });
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: null, telegramPairingCode: null },
    });
    return NextResponse.json({ ok: true, message: "Đã từ chối" });
  }
}

// GET pending pairing requests (for admin panel)
export async function PUT() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const me = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const pending = await prisma.user.findMany({
    where: { telegramChatId: { not: null }, telegramPaired: false },
    select: { id: true, name: true, email: true, telegramChatId: true },
  });

  return NextResponse.json(pending);
}
