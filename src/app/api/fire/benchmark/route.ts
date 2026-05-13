import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBenchmarkSnapshot } from "@/lib/fire-engine";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await getBenchmarkSnapshot();
  return NextResponse.json(snapshot);
}
