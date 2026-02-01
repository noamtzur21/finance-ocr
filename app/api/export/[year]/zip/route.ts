import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectBytes } from "@/app/lib/r2/objects";
import archiver from "archiver";
import { Readable } from "stream";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

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

  if (receiptRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows), `קבלות_${y}`);
  if (invoiceRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(invoiceRows), `חשבוניות_${y}`);

  const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  // Create ZIP
  const archive = archiver("zip", { zlib: { level: 9 } });
  const stream = new Readable({
    read() {},
  });

  archive.on("data", (chunk: Buffer) => stream.push(chunk));
  archive.on("end", () => stream.push(null));
  archive.on("error", (err: Error) => {
    throw err;
  });

  // Add XLSX to ZIP root
  archive.append(xlsxBuf, { name: `report_${y}.xlsx" ` });

  // Add Files in folders: type/YYYY-MM/
  for (const d of docs) {
    try {
      const bytes = await getObjectBytes(d.fileKey);
      if (!bytes) continue;

      const month = d.date.toISOString().slice(0, 7); // YYYY-MM
      const typeDir = d.type === "expense" ? "receipts" : "invoices";
      const path = `${typeDir}/${month}/${d.fileName}`;

      archive.append(Buffer.from(bytes), { name: path });
    } catch {
      // skip individual missing files
    }
  }

  void archive.finalize();

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="finance_archive_${y}.zip"`,
    },
  });
}
