import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Chỉ Admin được phép reset mật khẩu" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { email, newPassword } = body;

    if (!email || !newPassword) {
      return NextResponse.json({ error: "Vui lòng nhập email và mật khẩu mới" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Mật khẩu tối thiểu 6 ký tự" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
    }

    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({ where: { email }, data: { password: hashed } });

    return NextResponse.json({ success: true, message: "Đã reset mật khẩu thành công" });
  } catch {
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
