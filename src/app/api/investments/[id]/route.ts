import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const inv = await prisma.investment.update({
      where: { id },
      data: {
        name: body.name,
        type: body.type,
        buyPrice: body.buyPrice !== undefined ? Number(body.buyPrice) : undefined,
        currentPrice: body.currentPrice !== undefined ? Number(body.currentPrice) : undefined,
        quantity: body.quantity !== undefined ? Number(body.quantity) : undefined,
        note: body.note,
        status: body.status,
      }
    });
    return NextResponse.json(inv);
  } catch (error) {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await prisma.investment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Xoá thất bại" }, { status: 400 });
  }
}
