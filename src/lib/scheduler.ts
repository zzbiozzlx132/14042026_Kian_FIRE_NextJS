import { prisma } from "./prisma";
import { buildReport, getSummary, dateRange } from "./report-engine";
import { updateAutoInvestmentPrices } from "./market-data";

let started = false;

export function startScheduler() {
  if (started) return;
  started = true;
  console.log("[Scheduler] Started — checking every minute (TZ: Asia/Ho_Chi_Minh)");
  // Run first tick after 30s to let DB stabilize on startup
  setTimeout(() => {
    tick();
    setInterval(tick, 60_000);
  }, 30_000);
}

async function tick() {
  try {
    const autoPriceResult = await updateAutoInvestmentPrices();
    if (autoPriceResult.updated > 0 || autoPriceResult.failed > 0) {
      console.log(`[Scheduler] Auto price updated=${autoPriceResult.updated}, failed=${autoPriceResult.failed}, skipped=${autoPriceResult.skipped}`);
    }

    const settings = await prisma.lifePlanSettings.findUnique({ where: { id: "default" } });
    if (!settings?.telegramBotToken) return;

    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const token = settings.telegramBotToken;
    const dow = now.getDay();
    const dom = now.getDate();
    const month = now.getMonth();

    // Reminder nhập liệu — chỉ gửi nếu user chưa nhập hôm nay
    if (settings.reminderTime && settings.reminderTime === hhmm) {
      await sendReminders(token);
    }

    // Báo cáo ngày
    if (settings.dailyReportTime && settings.dailyReportTime === hhmm) {
      await sendScheduledReport("daily", token);
    }

    // Báo cáo tuần
    if (
      settings.weeklyReportTime && settings.weeklyReportTime === hhmm &&
      settings.weeklyReportDay !== null && settings.weeklyReportDay !== undefined &&
      dow === Number(settings.weeklyReportDay)
    ) {
      await sendScheduledReport("weekly", token);
    }

    // Báo cáo tháng
    if (
      settings.monthlyReportTime && settings.monthlyReportTime === hhmm &&
      settings.monthlyReportDay && dom === Number(settings.monthlyReportDay)
    ) {
      await sendScheduledReport("monthly", token);
    }

    // Báo cáo quý — ngày 1 của tháng 1/4/7/10 lúc 08:00
    if (settings.quarterlyReport && hhmm === "08:00" && dom === 1 && [0, 3, 6, 9].includes(month)) {
      await sendScheduledReport("quarterly", token);
    }

    // Báo cáo năm — 31/12 lúc 08:00
    if (settings.yearlyReport && hhmm === "08:00" && month === 11 && dom === 31) {
      await sendScheduledReport("yearly", token);
    }
  } catch (err) {
    console.error("[Scheduler] tick error:", err);
  }
}

async function sendReminders(token: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 86_400_000);

  const users = await prisma.user.findMany({
    where: { telegramChatId: { not: null }, telegramPaired: true },
  });

  for (const user of users) {
    const count = await prisma.transaction.count({
      where: { createdById: user.id, createdAt: { gte: todayStart, lt: todayEnd } },
    });
    if (count === 0) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text: `💡 Nhắc nhập thu chi hôm nay nhé!\n\nGõ <code>chi [số tiền] [mô tả]</code> để lưu nhanh.\nVí dụ: <code>chi 50k cà phê</code>`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }
  }
}

async function sendScheduledReport(
  type: "daily" | "weekly" | "monthly" | "quarterly" | "yearly",
  token: string
) {
  try {
    const { current, prev, label, prevLabel } = dateRange(type);
    const [currSummary, prevSummary] = await Promise.all([
      getSummary(current.from, current.to),
      getSummary(prev.from, prev.to),
    ]);
    const message = buildReport(type, label, prevLabel, currSummary, prevSummary);

    const recipients = await prisma.user.findMany({
      where: { telegramChatId: { not: null }, telegramPaired: true },
    });

    for (const user of recipients) {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: user.telegramChatId, text: message, parse_mode: "HTML" }),
      }).catch(() => {});
    }
    console.log(`[Scheduler] Sent ${type} report to ${recipients.length} users`);
  } catch (err) {
    console.error(`[Scheduler] sendScheduledReport(${type}) error:`, err);
  }
}
