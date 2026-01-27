import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET(_req: Request, ctx: { params: Promise<{ year: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { year } = await ctx.params;
  const y = Number(year);
  if (!Number.isFinite(y) || y < 2000 || y > 2100) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  const start = new Date(y, 0, 1);
  const end = new Date(y + 1, 0, 1);

  const docs = await prisma.document.findMany({
    where: { userId: user.id, date: { gte: start, lt: end } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { category: { select: { name: true } } },
  });

  const rows = docs.map((d) => {
    const yyyyMm = d.date.toISOString().slice(0, 7);
    const top = d.type === "income" ? "invoices" : "receipts";
    const zipPath = `${top}/${yyyyMm}/${d.fileKey.split("/").pop() ?? d.fileName}`;
    return {
      Type: d.type,
      Date: d.date.toISOString().slice(0, 10),
      Vendor: d.vendor,
      Amount: d.amount.toString(),
      Currency: d.currency,
      Category: d.category?.name ?? "",
      Description: d.description ?? "",
      DocumentNumber: d.docNumber ?? "",
      FileName: d.fileName,
      ZipPath: zipPath,
      OcrStatus: d.ocrStatus,
      CreatedAt: d.createdAt.toISOString(),
      UpdatedAt: d.updatedAt.toISOString(),
    };
  });

  const wb = XLSX.utils.book_new();
  const receiptRows = rows.filter((r) => r.Type === "expense");
  const invoiceRows = rows.filter((r) => r.Type === "income");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows), `receipts_${y}`);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), `invoices_${y}`);

  // summaries
  const byMonth = new Map<string, { income: number; expense: number }>();
  const byCat = new Map<string, number>();
  for (const d of docs) {
    const m = d.date.toISOString().slice(0, 7);
    const cur = byMonth.get(m) ?? { income: 0, expense: 0 };
    const val = Number(d.amount);
    if (d.type === "income") cur.income += val;
    else cur.expense += val;
    byMonth.set(m, cur);

    if (d.type === "expense") {
      const c = d.category?.name ?? "אחר";
      byCat.set(c, (byCat.get(c) ?? 0) + val);
    }
  }

  const monthRows = Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, v]) => ({
      Month: month,
      Income: v.income.toFixed(2),
      Expense: v.expense.toFixed(2),
      Net: (v.income - v.expense).toFixed(2),
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthRows), "summary_by_month");

  const catRows = Array.from(byCat.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([category, sum]) => ({ Category: category, Expense: sum.toFixed(2) }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows), "summary_by_category");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const body = new Uint8Array(buf);
  return new NextResponse(body, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="accountant_${y}.xlsx"`,
    },
  });
}


