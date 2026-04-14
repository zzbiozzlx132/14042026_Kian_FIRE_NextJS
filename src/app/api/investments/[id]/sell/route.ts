import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/investments/[id]/sell
// Body: { quantitySold: number, sellPrice: number }
// If selling all: mark as sold
// If selling partial: reduce holding quantity, create new "sold" record
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const quantitySold = Number(body.quantitySold);
    const sellPrice = Number(body.sellPrice);

    if (!quantitySold || quantitySold <= 0) {
      return NextResponse.json({ error: "Số lượng bán phải > 0" }, { status: 400 });
    }
    if (!sellPrice || sellPrice <= 0) {
      return NextResponse.json({ error: "Giá bán phải > 0" }, { status: 400 });
    }

    const inv = await prisma.investment.findUnique({ where: { id } });
    if (!inv) return NextResponse.json({ error: "Không tìm thấy khoản đầu tư" }, { status: 404 });
    if (quantitySold > inv.quantity) {
      return NextResponse.json({ error: `Chỉ có ${inv.quantity} đơn vị, không thể bán ${quantitySold}` }, { status: 400 });
    }

    const remainingQty = inv.quantity - quantitySold;

    if (remainingQty <= 0) {
      // Sell all: just update the existing record
      const updated = await prisma.investment.update({
        where: { id },
        data: { status: "sold", currentPrice: sellPrice, quantity: quantitySold }
      });
      return NextResponse.json({ holding: null, sold: updated });
    } else {
      // Partial sell: reduce holding + create sold record
      const [holding, sold] = await prisma.$transaction([
        prisma.investment.update({
          where: { id },
          data: { quantity: remainingQty }
        }),
        prisma.investment.create({
          data: {
            name: `${inv.name} (đã bán)`,
            type: inv.type,
            buyPrice: inv.buyPrice,
            currentPrice: sellPrice,
            quantity: quantitySold,
            buyDate: inv.buyDate,
            note: `Bán ${quantitySold} từ lô gốc. Giá bán: ${sellPrice}`,
            status: "sold",
          }
        })
      ]);
      return NextResponse.json({ holding, sold });
    }
  } catch (error) {
    console.error("Sell Investment Error:", error);
    return NextResponse.json({ error: "Bán thất bại" }, { status: 400 });
  }
}
