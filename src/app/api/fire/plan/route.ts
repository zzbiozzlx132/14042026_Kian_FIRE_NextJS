import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { computeFirePlan, FireProjectionMode } from "@/lib/fire-engine";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const modeParam = String(searchParams.get("mode") || "expected").toLowerCase();
  const mode: FireProjectionMode = modeParam === "actual" ? "actual" : "expected";
  const plan = await computeFirePlan(mode);
  return NextResponse.json(plan);
}
