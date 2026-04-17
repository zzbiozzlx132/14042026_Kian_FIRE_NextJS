import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transactions = await prisma.transaction.findMany({
    orderBy: { date: "desc" },
    include: { category: true, fromAccount: true, toAccount: true },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kian FIRE";
  wb.created = new Date();

  const ws = wb.addWorksheet("Giao dịch");

  ws.columns = [
    { header: "Ngày", key: "date", width: 14 },
    { header: "Loại", key: "type", width: 12 },
    { header: "Số tiền (VNĐ)", key: "amount", width: 18 },
    { header: "Hạng mục", key: "category", width: 20 },
    { header: "Tài khoản nguồn", key: "fromAccount", width: 20 },
    { header: "Tài khoản đích", key: "toAccount", width: 20 },
    { header: "Ghi chú", key: "description", width: 30 },
    { header: "Tính chất", key: "essential", width: 16 },
    { header: "Đánh giá", key: "rating", width: 14 },
  ];

  // Style header
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE07B39" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  const typeMap: Record<string, string> = { EXPENSE: "Chi tiêu", INCOME: "Thu nhập", TRANSFER: "Chuyển khoản" };
  const essentialMap: Record<string, string> = { ESSENTIAL: "Thiết yếu", NON_ESSENTIAL: "Không thiết yếu" };
  const ratingMap: Record<string, string> = { WORTHY: "Xứng đáng", NORMAL: "Bình thường", WASTEFUL: "Phí tiền" };

  for (const tx of transactions) {
    const row = ws.addRow({
      date: new Date(tx.date).toLocaleDateString("vi-VN"),
      type: typeMap[tx.type] || tx.type,
      amount: tx.amount,
      category: tx.category?.name || "",
      fromAccount: tx.fromAccount?.name || "",
      toAccount: tx.toAccount?.name || "",
      description: tx.description || "",
      essential: tx.essential ? (essentialMap[tx.essential] || tx.essential) : "",
      rating: tx.rating ? (ratingMap[tx.rating] || tx.rating) : "",
    });

    // Color rows by type
    const bgColor = tx.type === "EXPENSE" ? "FFFFF0F0" : tx.type === "INCOME" ? "FFF0FFF0" : "FFF0F0FF";
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
    row.getCell("amount").numFmt = '#,##0 "đ"';
  }

  // Auto-filter
  ws.autoFilter = { from: "A1", to: "I1" };

  const buffer = await wb.xlsx.writeBuffer();
  const filename = `KianFIRE_GiaoDich_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
