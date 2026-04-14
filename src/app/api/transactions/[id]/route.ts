import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const txId = params.id;
    await prisma.transaction.delete({
      where: { id: txId }
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Delete Tx Error:", error);
    return NextResponse.json({ error: "Lỗi xoá giao dịch" }, { status: 400 });
  }
}
