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
