import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import * as XLSX from "xlsx";

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
    "סוג מסמך": d.type === "expense" ? "הוצאה (קבלה)" : "הכנסה (חשבונית)",
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

  const wb = XLSX.utils.book_new();
  
  const receiptRows = rows.filter((r) => r["סוג מסמך"] === "הוצאה (קבלה)");
  const invoiceRows = rows.filter((r) => r["סוג מסמך"] === "הכנסה (חשבונית)");

  if (receiptRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows), `קבלות_${y}`);
  }
  if (invoiceRows.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), `חשבוניות_${y}`);
  }

  // Summary Sheet
  const totalExp = receiptRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalInc = invoiceRows.reduce((s, r) => s + r["סה״כ (₪)"], 0);
  const totalVatExp = receiptRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);
  const totalVatInc = invoiceRows.reduce((s, r) => s + r["מע״מ (₪)"], 0);

  const summary = [
    { נושא: "סיכום שנתי", ערך: y },
    { נושא: "סה״כ הכנסות", ערך: totalInc },
    { נושא: "מע״מ עסקאות (הכנסות)", ערך: totalVatInc },
    { נושא: "סה״כ הוצאות", ערך: totalExp },
    { נושא: "מע״מ תשומות (הוצאות)", ערך: totalVatExp },
    { נושא: "נטו (לפני מס)", ערך: totalInc - totalExp },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "סיכום");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="finance_report_${y}.xlsx"`,
    },
  });
}
