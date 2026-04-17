import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const keywords = await prisma.categoryKeyword.findMany({
    include: { category: { select: { id: true, name: true, type: true } } },
    orderBy: { keyword: "asc" },
  });
  return NextResponse.json(keywords);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { keyword, categoryId } = await req.json();
  if (!keyword?.trim() || !categoryId) {
    return NextResponse.json({ error: "Thiếu từ khoá hoặc hạng mục" }, { status: 400 });
  }

  const kw = keyword.trim().toLowerCase();

  const existing = await prisma.categoryKeyword.findUnique({ where: { keyword: kw } });
  if (existing) {
    return NextResponse.json({ error: `Từ khoá "${kw}" đã tồn tại` }, { status: 400 });
  }

  const created = await prisma.categoryKeyword.create({
    data: { keyword: kw, categoryId },
    include: { category: { select: { id: true, name: true, type: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  await prisma.categoryKeyword.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, keyword, categoryId } = await req.json();
  if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

  const kw = keyword?.trim().toLowerCase();
  if (kw) {
    const conflict = await prisma.categoryKeyword.findFirst({ where: { keyword: kw, NOT: { id } } });
    if (conflict) return NextResponse.json({ error: `Từ khoá "${kw}" đã tồn tại` }, { status: 400 });
  }

  const updated = await prisma.categoryKeyword.update({
    where: { id },
    data: { ...(kw ? { keyword: kw } : {}), ...(categoryId ? { categoryId } : {}) },
    include: { category: { select: { id: true, name: true, type: true } } },
  });
  return NextResponse.json(updated);
}
