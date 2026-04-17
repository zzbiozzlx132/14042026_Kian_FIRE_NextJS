import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const s = String(val).trim();
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`);
  // YYYY-MM-DD
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

function parseType(val: any): "EXPENSE" | "INCOME" | "TRANSFER" | null {
  const s = String(val || "").trim().toLowerCase();
  if (["chi", "expense", "chi tiêu"].includes(s)) return "EXPENSE";
  if (["thu", "income", "thu nhập"].includes(s)) return "INCOME";
  if (["chuyenkhoan", "chuyển khoản", "transfer"].includes(s)) return "TRANSFER";
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Không có file" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(arrayBuffer as any);

  const ws = wb.worksheets[0];
  if (!ws) return NextResponse.json({ error: "File không hợp lệ" }, { status: 400 });

  const [categories, accounts, adminUser] = await Promise.all([
    prisma.category.findMany({ where: { status: "active" } }),
    prisma.account.findMany({ where: { status: "active" } }),
    prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } }),
  ]);

  const errors: string[] = [];
  const toCreate: any[] = [];
  let rowIndex = 0;

  ws.eachRow((row, rn) => {
    if (rn === 1) return; // skip header
    rowIndex++;
    const cells = row.values as any[];
    const [, dateVal, typeVal, amountVal, categoryVal, fromAccVal, toAccVal, descVal, essentialVal] = cells;

    const date = parseDate(dateVal);
    if (!date) { errors.push(`Dòng ${rn}: Ngày không hợp lệ ("${dateVal}")`); return; }

    const type = parseType(typeVal);
    if (!type) { errors.push(`Dòng ${rn}: Loại không hợp lệ ("${typeVal}")`); return; }

    const amount = Number(amountVal);
    if (!amount || amount <= 0) { errors.push(`Dòng ${rn}: Số tiền không hợp lệ`); return; }

    const category = categoryVal ? categories.find(c => c.name.toLowerCase() === String(categoryVal).toLowerCase().trim()) : null;
    const fromAccount = fromAccVal ? accounts.find(a => a.name.toLowerCase() === String(fromAccVal).toLowerCase().trim()) : null;
    const toAccount = toAccVal ? accounts.find(a => a.name.toLowerCase() === String(toAccVal).toLowerCase().trim()) : null;

    const essStr = String(essentialVal || "").toLowerCase().trim();
    const essential = essStr === "thietyeu" ? "ESSENTIAL" : essStr === "khongthietyeu" ? "NON_ESSENTIAL" : (type === "EXPENSE" ? "NON_ESSENTIAL" : null);

    toCreate.push({
      date,
      type,
      amount,
      categoryId: category?.id || null,
      fromAccountId: (type === "EXPENSE" || type === "TRANSFER") ? (fromAccount?.id || null) : null,
      toAccountId: (type === "INCOME" || type === "TRANSFER") ? (toAccount?.id || null) : null,
      description: String(descVal || "").trim(),
      essential,
      rating: type === "EXPENSE" ? "NORMAL" : null,
      createdById: adminUser?.id || null,
    });
  });

  if (errors.length > 0 && toCreate.length === 0) {
    return NextResponse.json({ error: "File có lỗi", details: errors }, { status: 400 });
  }

  const created = await prisma.transaction.createMany({ data: toCreate });

  return NextResponse.json({
    imported: created.count,
    skipped: errors.length,
    errors: errors.slice(0, 10),
  });
}
