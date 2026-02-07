import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import * as ExcelJS from "exceljs";

function addSheetFromRows(wb: ExcelJS.Workbook, name: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const ws = wb.addWorksheet(name, { headerFooter: { firstHeader: "", firstFooter: "" } });
  const keys = Object.keys(rows[0]!);
  ws.columns = keys.map((k) => ({ header: k, key: k, width: 14 }));
  ws.addRows(rows);
}

export async function GET(req: Request, ctx: { params: Promise<{ year: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year } = await ctx.params;
  const y = parseInt(year);
  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);

  const docs = await prisma.document.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
    include: { category: { select: { name: true } } },
  });

  const rows = docs.map((d) => ({
    תאריך: d.date.toISOString().slice(0, 10),
    "סוג מסמך":
      d.type === "expense"
        ? "הוצאה (קבלת החזר מס)"
        : d.type === "payment_receipt"
          ? "קבלה על תשלום"
          : "הכנסה (חשבונית)",
    "בית עסק / לקוח": d.vendor,
    "מספר מסמך": d.docNumber ?? "",
    קטגוריה: d.category?.name ?? "",
    "סה״כ (₪)": d.amount.toNumber(),
    "מע״מ (₪)": d.vatAmount.toNumber(),
    "לפני מע״מ (₪)": d.preVatAmount.toNumber(),
    "הוצאה מוכרת (%)": d.isRecognized.toNumber(),
    תיאור: d.description ?? "",
    "שם קובץ": d.fileName,
    סטטוס: d.ocrStatus,
  }));

  const wb = new ExcelJS.Workbook();

  const receiptRows = rows.filter((r) => r["סוג מסמך"] === "הוצאה (קבלת החזר מס)");
  const invoiceRows = rows.filter((r) => r["סוג מסמך"] === "הכנסה (חשבונית)");
  const paymentReceiptRows = rows.filter((r) => r["סוג מסמך"] === "קבלה על תשלום");

  addSheetFromRows(wb, `קבלות_החזר_מס_${y}`, receiptRows);
  addSheetFromRows(wb, `חשבוניות_${y}`, invoiceRows);
  addSheetFromRows(wb, `קבלות_על_תשלום_${y}`, paymentReceiptRows);

  const totalExp = receiptRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalInc = invoiceRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalPaymentReceipts = paymentReceiptRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalVatExp = receiptRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);
  const totalVatInc = invoiceRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);

  const summary = [
    { נושא: "סיכום שנתי", ערך: y },
    { נושא: "סה״כ הכנסות (חשבוניות)", ערך: totalInc },
    { נושא: "מע״מ עסקאות (הכנסות)", ערך: totalVatInc },
    { נושא: "סה״כ הוצאות (קבלות החזר מס)", ערך: totalExp },
    { נושא: "מע״מ תשומות (הוצאות)", ערך: totalVatExp },
    { נושא: "סה״כ קבלות על תשלום", ערך: totalPaymentReceipts },
    { נושא: "נטו (לפני מס)", ערך: totalInc - totalExp },
  ];
  addSheetFromRows(wb, "סיכום", summary);

  const buf = await wb.xlsx.writeBuffer();

  return new NextResponse(new Uint8Array(buf as ArrayBuffer), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="finance_report_${y}.xlsx"`,
    },
  });
}
