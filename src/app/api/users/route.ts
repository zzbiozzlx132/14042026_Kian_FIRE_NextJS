import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const USER_SELECT = { id: true, name: true, email: true, username: true, phone: true, role: true, createdAt: true, telegramPaired: true, telegramChatId: true } as const;

// GET all users
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sessionUser = session.user as any;

  try {
    if (sessionUser.role !== "ADMIN") {
      const me = await prisma.user.findUnique({ where: { id: sessionUser.id }, select: USER_SELECT });
      return NextResponse.json(me ? [me] : []);
    }
    const users = await prisma.user.findMany({ select: USER_SELECT, orderBy: { createdAt: "asc" } });
    return NextResponse.json(users);
  } catch {
    return NextResponse.json([]);
  }
}

// POST create user — admin only
export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được tạo tài khoản mới" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, email, username, phone, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc (tên, email, mật khẩu)" }, { status: 400 });
    }
    if (String(password).length < 6) {
      return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 });
    }

    // Check duplicates
    const emailNormalized = String(email).trim().toLowerCase();
    const usernameNormalized = username ? String(username).trim().toLowerCase() : null;
    const emailExists = await prisma.user.findUnique({ where: { email: emailNormalized } });
    if (emailExists) return NextResponse.json({ error: "Email đã tồn tại" }, { status: 400 });

    if (usernameNormalized) {
      const usernameExists = await prisma.user.findUnique({ where: { username: usernameNormalized } });
      if (usernameExists) return NextResponse.json({ error: "Tên đăng nhập đã tồn tại" }, { status: 400 });
    }

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: emailNormalized,
        username: usernameNormalized || null,
        phone: phone ? String(phone).trim() : null,
        password: hashed,
        role: role === "ADMIN" ? "ADMIN" : "USER",
      },
      select: USER_SELECT,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: "Tạo người dùng thất bại" }, { status: 400 });
  }
}
