import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const investments = await prisma.investment.findMany({
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(investments);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const autoEnabled = !!body.autoPriceEnabled;
    const autoSource = body.type === "STOCK" ? "VNSTOCK" : "TWELVEDATA";
    const inv = await prisma.investment.create({
      data: {
        name: body.name,
        type: body.type || "OTHER",
        buyPrice: Number(body.buyPrice) || 0,
        currentPrice: Number(body.currentPrice) || Number(body.buyPrice) || 0,
        quantity: Number(body.quantity) || 1,
        priceMode: autoEnabled ? "AUTO" : (body.priceMode === "AUTO" ? "AUTO" : "MANUAL"),
        autoPriceEnabled: autoEnabled,
        autoPriceSymbol: body.autoPriceSymbol ? String(body.autoPriceSymbol).trim() : null,
        autoPriceSource: autoSource,
        autoFallbackManual: body.autoFallbackManual !== false,
        buyDate: body.buyDate ? new Date(body.buyDate) : new Date(),
        note: body.note || "",
        status: "holding",
      }
    });
    return NextResponse.json(inv, { status: 201 });
  } catch (error) {
    console.error("Create Investment Error:", error);
    return NextResponse.json({ error: "Tạo khoản đầu tư thất bại" }, { status: 400 });
  }
}
