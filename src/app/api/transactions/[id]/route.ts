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

    if (body.type !== undefined) updateData.type = body.type;
    if (body.amount !== undefined) updateData.amount = Number(body.amount);
    if (body.date !== undefined) updateData.date = new Date(body.date);
    if (body.description !== undefined) updateData.description = body.description;
    if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
    if (body.fromAccountId !== undefined) updateData.fromAccountId = body.fromAccountId || null;
    if (body.toAccountId !== undefined) updateData.toAccountId = body.toAccountId || null;
    if (body.essential !== undefined) updateData.essential = body.essential;
    if (body.rating !== undefined) updateData.rating = body.rating;

    // Clear essential/rating when changing to non-EXPENSE
    if (body.type && body.type !== "EXPENSE") {
      updateData.essential = null;
      updateData.rating = null;
    }

    const tx = await prisma.transaction.update({
      where: { id },
      data: updateData,
      include: { category: true, fromAccount: true, toAccount: true },
    });
    return NextResponse.json(tx);
  } catch (error) {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}
