import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildReport, getSummary, dateRange } from "@/lib/report-engine";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | null;
  const secret = searchParams.get("secret");

  if (!type || !["daily", "weekly", "monthly", "quarterly", "yearly"].includes(type)) {
    return NextResponse.json({ error: "type phải là daily/weekly/monthly/quarterly/yearly" }, { status: 400 });
  }

  const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
  if (!settings?.telegramBotToken) return NextResponse.json({ error: "Bot chưa được kết nối" }, { status: 400 });

  if (!secret || !settings.cronSecret || settings.cronSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { current, prev, label, prevLabel } = dateRange(type);
  const [currSummary, prevSummary] = await Promise.all([
    getSummary(current.from, current.to),
    getSummary(prev.from, prev.to),
  ]);

  const message = buildReport(type, label, prevLabel, currSummary, prevSummary);

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
