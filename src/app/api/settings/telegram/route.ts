import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/settings/telegram — get connection status
 * POST /api/settings/telegram — save token + register webhook
 * DELETE /api/settings/telegram — disconnect bot
 */

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.lifePlanSettings.findFirst();
  const token = settings?.telegramBotToken || "";
  const connected = !!token;

  let botInfo = null;
  if (connected) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        botInfo = {
          username: data.result.username,
          name: data.result.first_name,
        };
      }
    } catch {}
  }

  return NextResponse.json({
    connected,
    botInfo,
    tokenMasked: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : "",
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: "Vui lòng nhập Bot Token" }, { status: 400 });
    }

    // Verify token with Telegram
    const verifyRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const verifyData = await verifyRes.json();

    if (!verifyData.ok) {
      return NextResponse.json({ error: "Token không hợp lệ. Kiểm tra lại với @BotFather" }, { status: 400 });
    }

    // Save token
    await prisma.lifePlanSettings.upsert({
      where: { id: "default" },
      update: { telegramBotToken: token },
      create: { id: "default", telegramBotToken: token },
    });

    // Register webhook
    const webhookUrl = `https://fire.kiantr.com/api/telegram`;
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl }),
    });
    const webhookData = await webhookRes.json();

    return NextResponse.json({
      success: true,
      botInfo: {
        username: verifyData.result.username,
        name: verifyData.result.first_name,
      },
      webhookSet: webhookData.ok,
      message: `Bot @${verifyData.result.username} đã kết nối thành công!`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Lỗi kết nối" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const settings = await prisma.lifePlanSettings.findFirst();
    const token = settings?.telegramBotToken;

    if (token) {
      // Remove webhook
      await fetch(`https://api.telegram.org/bot${token}/deleteWebhook`);

      // Clear token
      await prisma.lifePlanSettings.update({
        where: { id: "default" },
        data: { telegramBotToken: null },
      });
    }

    return NextResponse.json({ success: true, message: "Đã ngắt kết nối bot" });
  } catch {
    return NextResponse.json({ error: "Lỗi ngắt kết nối" }, { status: 500 });
  }
}
