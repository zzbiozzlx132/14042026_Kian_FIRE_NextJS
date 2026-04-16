import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    await prisma.transaction.delete({
      where: { id }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete Tx Error:", error);
    return NextResponse.json({ error: "Lỗi xoá giao dịch" }, { status: 400 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await req.json();
    const updateData: any = {};
    if (body.essential !== undefined) updateData.essential = body.essential;
    if (body.rating !== undefined) updateData.rating = body.rating;

    const tx = await prisma.transaction.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json(tx);
  } catch (error) {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}
