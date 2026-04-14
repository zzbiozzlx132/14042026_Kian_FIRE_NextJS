import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// DELETE user
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá thất bại" }, { status: 400 });
  }
}

// PATCH update user
export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const body = await req.json();

  try {
    const updateData: any = {};
    if (body.name) updateData.name = body.name;
    if (body.role) updateData.role = body.role;
    if (body.password) {
      const bcrypt = await import("bcryptjs");
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, email: true, role: true }
    });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}
