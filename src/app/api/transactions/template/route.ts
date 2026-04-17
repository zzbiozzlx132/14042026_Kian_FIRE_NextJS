import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kian FIRE";

  const ws = wb.addWorksheet("Giao dịch");

  ws.columns = [
    { header: "Ngày (DD/MM/YYYY)", key: "date", width: 20 },
    { header: "Loại (chi/thu/chuyenkhoan)", key: "type", width: 26 },
    { header: "Số tiền (VNĐ)", key: "amount", width: 18 },
    { header: "Hạng mục", key: "category", width: 20 },
    { header: "Tài khoản nguồn", key: "fromAccount", width: 20 },
    { header: "Tài khoản đích", key: "toAccount", width: 20 },
    { header: "Ghi chú", key: "description", width: 30 },
    { header: "Tính chất (thietyeu/khongthietyeu)", key: "essential", width: 32 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE07B39" } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 22;

  // Sample rows
  const samples = [
    { date: "17/04/2026", type: "chi", amount: 50000, category: "Ăn uống", fromAccount: "Tiền mặt", toAccount: "", description: "Cà phê sáng", essential: "khongthietyeu" },
    { date: "17/04/2026", type: "thu", amount: 15000000, category: "Lương", fromAccount: "", toAccount: "Vietcombank", description: "Lương tháng 4", essential: "" },
    { date: "16/04/2026", type: "chi", amount: 200000, category: "Đi lại", fromAccount: "Vietcombank", toAccount: "", description: "Đổ xăng", essential: "thietyeu" },
  ];

  for (const s of samples) {
    const row = ws.addRow(s);
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9F9F9" } };
    row.getCell("amount").numFmt = '#,##0';
  }

  // Note sheet
  const noteWs = wb.addWorksheet("Hướng dẫn");
  noteWs.getColumn(1).width = 60;
  const notes = [
    ["Hướng dẫn nhập file Excel — Kian FIRE"],
    [""],
    ["Cột Loại: nhập chi / thu / chuyenkhoan"],
    ["Cột Ngày: định dạng DD/MM/YYYY (ví dụ: 17/04/2026)"],
    ["Cột Hạng mục: tên hạng mục phải khớp chính xác với hạng mục trong app"],
    ["Cột Tài khoản: tên tài khoản phải khớp chính xác"],
    ["Cột Tính chất: thietyeu hoặc khongthietyeu (chỉ áp dụng cho chi tiêu)"],
    [""],
    ["Lưu ý: Hàng đầu tiên (header) sẽ bị bỏ qua khi import"],
  ];
  for (const [text] of notes) {
    const r = noteWs.addRow([text]);
    if (text?.startsWith("Hướng")) r.font = { bold: true, size: 13 };
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="KianFIRE_Template_Import.xlsx"',
    },
  });
}
