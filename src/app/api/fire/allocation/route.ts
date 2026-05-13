import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFireAllocation, updateFireAllocation } from "@/lib/fire-engine";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const allocation = await getFireAllocation();
  return NextResponse.json(allocation);
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được chỉnh phân bổ" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const buckets = Array.isArray(body?.buckets) ? body.buckets : [];

  try {
    const updated = await updateFireAllocation(
      buckets.map((b: any, idx: number) => ({
        id: b.id,
        name: b.name,
        assetClass: b.assetClass,
        targetPct: Number(b.targetPct),
        sortOrder: b.sortOrder ?? (idx + 1),
      })),
    );
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Lưu phân bổ thất bại" }, { status: 400 });
  }
}
