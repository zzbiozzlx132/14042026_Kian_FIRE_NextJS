import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const USER_SELECT = { id: true, name: true, email: true, username: true, phone: true, role: true, telegramPaired: true, telegramChatId: true } as const;

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const sessionUser = session.user as any;
  // Users can only fetch their own profile; admins can fetch anyone
  if (sessionUser.role !== "ADMIN" && sessionUser.id !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) return NextResponse.json({ error: "Không tìm thấy" }, { status: 404 });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Lỗi truy vấn" }, { status: 400 });
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được phép xoá thành viên" }, { status: 403 });
  }

  const { id } = await context.params;
  if ((session.user as any).id === id) {
    return NextResponse.json({ error: "Không thể tự xoá tài khoản của mình" }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Xoá thất bại" }, { status: 400 });
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  const sessionUser = session.user as any;
  const isAdmin = sessionUser.role === "ADMIN";
  const isSelf = sessionUser.id === id;

  // Only admin can edit others; users can only edit themselves
  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const updateData: any = {};
    if (body.name) updateData.name = String(body.name).trim();
    // Only admin can change roles
    if (body.role && isAdmin) updateData.role = body.role === "ADMIN" ? "ADMIN" : "USER";
    if (body.phone !== undefined) updateData.phone = body.phone ? String(body.phone).trim() : null;
    if (body.username !== undefined) {
      const normalizedUsername = body.username ? String(body.username).trim().toLowerCase() : "";
      if (normalizedUsername) {
        const conflict = await prisma.user.findFirst({ where: { username: normalizedUsername, NOT: { id } } });
        if (conflict) return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
      }
      updateData.username = normalizedUsername || null;
    }
    if (body.password) {
      const bcrypt = await import("bcryptjs");
      if (String(body.password).length < 6) {
        return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 });
      }
      // Khi user tự đổi mật khẩu, yêu cầu mật khẩu cũ; admin reset cho người khác thì không cần
      if (isSelf) {
        if (!body.oldPassword) {
          return NextResponse.json({ error: "Vui lòng nhập mật khẩu hiện tại" }, { status: 400 });
        }
        const current = await prisma.user.findUnique({ where: { id }, select: { password: true } });
        const valid = current ? await bcrypt.compare(body.oldPassword, current.password) : false;
        if (!valid) {
          return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 400 });
        }
      }
      updateData.password = await bcrypt.hash(body.password, 10);
    }
    if (body.telegramPairingCode !== undefined) updateData.telegramPairingCode = body.telegramPairingCode;

    const user = await prisma.user.update({ where: { id }, data: updateData, select: USER_SELECT });
    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: "Cập nhật thất bại" }, { status: 400 });
  }
}
