import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const USER_SELECT = { id: true, name: true, email: true, username: true, phone: true, role: true, telegramPaired: true, telegramChatId: true } as const;

// GET single user
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  try {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Lỗi truy vấn" }, { status: 400 });
  }
}

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
    if (body.phone !== undefined) updateData.phone = body.phone || null;
    if (body.username !== undefined) {
      if (body.username) {
        const conflict = await prisma.user.findFirst({ where: { username: body.username, NOT: { id } } });
        if (conflict) return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
      }
      updateData.username = body.username || null;
    }
    if (body.password) {
      const bcrypt = await import("bcryptjs");
      updateData.password = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({ where: { id }, data: updateData, select: USER_SELECT });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}
