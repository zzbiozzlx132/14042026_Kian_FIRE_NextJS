import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/auth/reset-password
 * 
 * Reset mật khẩu về mặc định cho user bằng email.
 * Không cần đăng nhập — dùng cho end user quên mật khẩu.
 * Mật khẩu mặc định: Kian@2026
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Vui lòng nhập email" }, { status: 400 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't reveal if email exists — always show success
      return NextResponse.json({ 
        success: true, 
        message: "Nếu email tồn tại, mật khẩu đã được đặt lại thành Kian@2026" 
      });
    }

    const bcrypt = await import("bcryptjs");
    const defaultPassword = "Kian@2026";
    const hashed = await bcrypt.hash(defaultPassword, 10);

    await prisma.user.update({
      where: { email },
      data: { password: hashed }
    });

    return NextResponse.json({ 
      success: true, 
      message: "Mật khẩu đã được đặt lại thành Kian@2026" 
    });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return NextResponse.json({ error: "Lỗi hệ thống" }, { status: 500 });
  }
}
