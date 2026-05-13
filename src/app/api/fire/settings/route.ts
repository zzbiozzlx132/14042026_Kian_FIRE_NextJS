import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFireSettings, updateFireSettings } from "@/lib/fire-engine";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getFireSettings();
  return NextResponse.json(settings);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được cấu hình FIRE" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const updated = await updateFireSettings({
    birthYear: body.birthYear,
    currentAge: body.currentAge,
    targetAge: body.targetAge,
    expectedReturnPct: body.expectedReturnPct,
    inflationPct: body.inflationPct,
    swrPct: body.swrPct,
    salaryGrowthPct: body.salaryGrowthPct,
    targetMonthlyExpenseAtFire: body.targetMonthlyExpenseAtFire,
    plannedMonthlyInvest: body.plannedMonthlyInvest,
    riskProfile: body.riskProfile,
    objectiveMode: body.objectiveMode,
    missedTargetPolicy: body.missedTargetPolicy,
    depositRateSource: body.depositRateSource,
    depositRateManual: body.depositRateManual,
  });
  return NextResponse.json(updated);
}
