import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await prisma.category.findMany({
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }]
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const cat = await prisma.category.create({
      data: {
        name: body.name,
        type: body.type,
        icon: body.icon || "circle",
        sortOrder: body.sortOrder || 99,
      }
    });
    return NextResponse.json(cat, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Tạo hạng mục thất bại" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Check if category has transactions
    const txCount = await prisma.transaction.count({ where: { categoryId: id } });
    if (txCount > 0) {
      return NextResponse.json({ error: `Không thể xoá: có ${txCount} giao dịch đang dùng hạng mục này` }, { status: 400 });
    }

    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Xoá hạng mục thất bại" }, { status: 400 });
  }
}
