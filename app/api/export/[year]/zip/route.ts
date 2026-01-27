import { NextResponse } from "next/server";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import type { ReadableStream as NodeWebReadableStream } from "stream/web";
import * as XLSX from "xlsx";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectStream } from "@/app/lib/r2/objects";

export const runtime = "nodejs";

function isNodeReadableStream(x: unknown): x is NodeJS.ReadableStream {
  return !!x && typeof (x as { pipe?: unknown }).pipe === "function";
}

function isWebReadableStream(x: unknown): x is ReadableStream<Uint8Array> {
  return !!x && typeof (x as { getReader?: unknown }).getReader === "function";
}

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

  const archive = archiver("zip", { zlib: { level: 9 } });

  const pass = new PassThrough();
  archive.pipe(pass);

  (async () => {
    // Add the XLSX summary as part of the ZIP so the accountant gets "everything in one file".
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

    const xlsxBuf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    archive.append(xlsxBuf, { name: `accountant_${y}.xlsx` });

    for (const d of docs) {
      const month = d.date.toISOString().slice(0, 7);
      const base = d.fileKey.split("/").pop() ?? d.fileName;
      const top = d.type === "income" ? "invoices" : "receipts";
      const zipPath = `${top}/${month}/${base}`;
      const body: unknown = await getObjectStream(d.fileKey);

      // archiver expects Node streams/buffers; Body can be a Node stream in node runtime
      const nodeStream = isNodeReadableStream(body)
        ? body
        : isWebReadableStream(body) && typeof Readable.fromWeb === "function"
          ? Readable.fromWeb(body as unknown as NodeWebReadableStream)
          : Readable.from([]);

      archive.append(nodeStream, { name: zipPath });
    }
    await archive.finalize();
  })().catch(() => {
    archive.abort();
  });

  // Convert Node stream -> Web ReadableStream for NextResponse
  const webStream = Readable.toWeb(pass) as ReadableStream<Uint8Array>;

  return new NextResponse(webStream, {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="accountant_${y}.zip"`,
    },
  });
}


