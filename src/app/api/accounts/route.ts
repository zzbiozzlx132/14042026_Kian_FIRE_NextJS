import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" }
  });
  return NextResponse.json(accounts);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, type, initialBalance, note, creditLimit, statementDay, dueDay, annualFee } = body;

    const account = await prisma.account.create({
      data: {
        name,
        type,
        initialBalance: Number(initialBalance) || 0,
        note,
        creditLimit: creditLimit ? Number(creditLimit) : null,
        statementDay: statementDay ? Number(statementDay) : null,
        dueDay: dueDay ? Number(dueDay) : null,
        annualFee: annualFee ? Number(annualFee) : 0,
      }
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Thêm tài khoản thất bại" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const txCount = await prisma.transaction.count({
      where: { OR: [{ fromAccountId: id }, { toAccountId: id }] }
    });
    if (txCount > 0) {
      return NextResponse.json({ error: `Không thể xoá: có ${txCount} giao dịch đang dùng tài khoản này` }, { status: 400 });
    }

    await prisma.account.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Xoá tài khoản thất bại" }, { status: 400 });
  }
}
