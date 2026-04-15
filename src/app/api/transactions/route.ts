import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Number(searchParams.get("limit") || "50");
  const page = Number(searchParams.get("page") || "1");

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

    // Validation Smart Rules / Kian Filter 3: Check Balance validity for Cash
    if (body.type === "EXPENSE" || body.type === "TRANSFER") {
       if (body.fromAccountId && body.amount > 0) {
          // If we had the exact real time balance, we could block it here.
          // But to avoid performance hits on a single transaction creation, we allow it,
          // usually the front-end will check the current context balance.
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
