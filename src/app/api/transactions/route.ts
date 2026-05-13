import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limitRaw = Number(searchParams.get("limit") || "50");
  const pageRaw = Number(searchParams.get("page") || "1");
  const limit = Number.isFinite(limitRaw) ? Math.min(200, Math.max(1, Math.floor(limitRaw))) : 50;
  const page = Number.isFinite(pageRaw) ? Math.max(1, Math.floor(pageRaw)) : 1;

  const transactions = await prisma.transaction.findMany({
    take: limit,
    skip: (page - 1) * limit,
    orderBy: { date: "desc" },
    include: {
      category: true,
      fromAccount: true,
      toAccount: true,
    }
  });

  return NextResponse.json(transactions);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    
    // Convert text date "2026-04-14" to Date object
    if (body.date) {
        body.date = new Date(body.date);
    } else {
        body.date = new Date();
    }

    body.amount = Number(body.amount);
    if (!body.amount || body.amount <= 0) {
        return NextResponse.json({ error: "Số tiền không hợp lệ" }, { status: 400 });
    }
    if (body.type === "TRANSFER" && body.fromAccountId && body.toAccountId && body.fromAccountId === body.toAccountId) {
      return NextResponse.json({ error: "Tài khoản chuyển và nhận không được trùng nhau" }, { status: 400 });
    }

    // Block if insufficient balance or credit limit exceeded
    if ((body.type === "EXPENSE" || body.type === "TRANSFER") && body.fromAccountId) {
      const account = await prisma.account.findUnique({ where: { id: body.fromAccountId } });
      if (account) {
        const incoming = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { toAccountId: account.id } });
        const outgoing = await prisma.transaction.aggregate({ _sum: { amount: true }, where: { fromAccountId: account.id } });
        const currentBalance = account.initialBalance + (incoming._sum.amount || 0) - (outgoing._sum.amount || 0);

        if (account.type === "CREDIT_CARD") {
          const available = (account.creditLimit || 0) + currentBalance;
          if (account.creditLimit && body.amount > available) {
            return NextResponse.json({
              error: `Hạn mức ${account.name} không đủ. Khả dụng: ${Math.round(available).toLocaleString("vi-VN")}đ, cần: ${Math.round(body.amount).toLocaleString("vi-VN")}đ`
            }, { status: 400 });
          }
        } else if (body.amount > currentBalance) {
          return NextResponse.json({
            error: `Số dư ${account.name} không đủ. Hiện có: ${Math.round(currentBalance).toLocaleString("vi-VN")}đ, cần: ${Math.round(body.amount).toLocaleString("vi-VN")}đ`
          }, { status: 400 });
        }
      }
    }

    const tx = await prisma.transaction.create({
      data: {
        date: new Date(body.date),
        type: body.type,
        amount: body.amount,
        fromAccountId: body.fromAccountId || null,
        toAccountId: body.toAccountId || null,
        categoryId: body.categoryId || null,
        description: body.description || "",
        essential: body.type === "EXPENSE" ? (body.essential || "NON_ESSENTIAL") : null,
        rating: body.type === "EXPENSE" ? (body.rating || "NORMAL") : null,
        createdById: session.user?.id || ""
      }
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (error: any) {
    console.error("Add Tx Error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Lỗi tạo giao dịch" }, { status: 400 });
  }
}
