import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "asc" }
  });

  // Compute real balance for each account
  const enriched = await Promise.all(accounts.map(async (acc) => {
    const incoming = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { toAccountId: acc.id },
    });
    const outgoing = await prisma.transaction.aggregate({
      _sum: { amount: true },
      where: { fromAccountId: acc.id },
    });

    const totalIn = incoming._sum.amount || 0;
    const totalOut = outgoing._sum.amount || 0;

    if (acc.type === "CREDIT_CARD") {
      // Credit card: nợ đang dùng = chi tiêu - đã trả
      // outgoing = chi tiêu (quẹt thẻ), incoming = trả nợ
      const creditUsed = totalOut - totalIn;
      return {
        ...acc,
        computedBalance: -creditUsed, // negative = debt
        creditUsed: creditUsed,       // positive = amount owed
        creditAvailable: (acc.creditLimit || 0) - creditUsed,
      };
    } else {
      // Normal: số dư = initialBalance + thu - chi
      return {
        ...acc,
        computedBalance: acc.initialBalance + totalIn - totalOut,
        creditUsed: 0,
        creditAvailable: 0,
      };
    }
  }));

  return NextResponse.json(enriched);
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

// PATCH — update account (name, initialBalance, creditLimit, note)
export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { id, name, initialBalance, creditLimit, note } = body;

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (initialBalance !== undefined) updateData.initialBalance = Number(initialBalance) || 0;
    if (creditLimit !== undefined) updateData.creditLimit = creditLimit ? Number(creditLimit) : null;
    if (note !== undefined) updateData.note = note;

    const account = await prisma.account.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(account);
  } catch (error) {
    return NextResponse.json({ error: "Cập nhật tài khoản thất bại" }, { status: 400 });
  }
}
