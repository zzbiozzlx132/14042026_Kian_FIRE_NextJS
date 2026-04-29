import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";

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

  // Silently re-register webhook with secret_token if connected (idempotent)
  if (connected) {
    try {
      const { createHmac } = await import("crypto");
      const webhookSecret = createHmac("sha256", "kian-fire-webhook").update(token).digest("hex").slice(0, 32);
      fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://fire.kiantr.com/api/telegram", secret_token: webhookSecret }),
      }).catch(() => {});
    } catch {}
  }

  return NextResponse.json({
    connected,
    botInfo,
    tokenMasked: token ? `${token.slice(0, 8)}...${token.slice(-4)}` : "",
    schedule: {
      reminderTime: settings?.reminderTime || "",
      dailyReportTime: settings?.dailyReportTime || "",
      weeklyReportDay: settings?.weeklyReportDay ?? null,
      weeklyReportTime: settings?.weeklyReportTime || "",
      monthlyReportDay: settings?.monthlyReportDay ?? null,
      monthlyReportTime: settings?.monthlyReportTime || "",
      quarterlyReport: settings?.quarterlyReport || false,
      yearlyReport: settings?.yearlyReport || false,
      cronSecret: settings?.cronSecret || "",
    },
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Chỉ Admin được cấu hình bot" }, { status: 403 });

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

    // Register webhook with secret_token so we can verify incoming requests
    const { createHmac } = await import("crypto");
    const webhookSecret = createHmac("sha256", "kian-fire-webhook").update(token).digest("hex").slice(0, 32);
    const webhookUrl = `https://fire.kiantr.com/api/telegram`;
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: webhookUrl, secret_token: webhookSecret }),
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

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Chỉ Admin được cấu hình lịch" }, { status: 403 });

  try {
    const body = await req.json();
    const { reminderTime, dailyReportTime, weeklyReportDay, weeklyReportTime, monthlyReportDay, monthlyReportTime, quarterlyReport, yearlyReport } = body;

    const existing = await prisma.lifePlanSettings.findFirst();
    const finalSecret = existing?.cronSecret || crypto.randomBytes(16).toString("hex");

    await prisma.lifePlanSettings.upsert({
      where: { id: "default" },
      update: {
        ...(reminderTime !== undefined ? { reminderTime: reminderTime || null } : {}),
        ...(dailyReportTime !== undefined ? { dailyReportTime: dailyReportTime || null } : {}),
        ...(weeklyReportDay !== undefined ? { weeklyReportDay: weeklyReportDay !== null && weeklyReportDay !== "" ? Number(weeklyReportDay) : null } : {}),
        ...(weeklyReportTime !== undefined ? { weeklyReportTime: weeklyReportTime || null } : {}),
        ...(monthlyReportDay !== undefined ? { monthlyReportDay: monthlyReportDay !== null && monthlyReportDay !== "" ? Number(monthlyReportDay) : null } : {}),
        ...(monthlyReportTime !== undefined ? { monthlyReportTime: monthlyReportTime || null } : {}),
        ...(quarterlyReport !== undefined ? { quarterlyReport } : {}),
        ...(yearlyReport !== undefined ? { yearlyReport } : {}),
        cronSecret: finalSecret,
      },
      create: { id: "default", cronSecret: finalSecret },
    });

    return NextResponse.json({ ok: true, cronSecret: finalSecret });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lỗi lưu cài đặt" }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") return NextResponse.json({ error: "Chỉ Admin được ngắt kết nối bot" }, { status: 403 });

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
