import { prisma } from "@/app/lib/prisma";
import { getObjectBytes } from "@/app/lib/r2/objects";
import { extractTextFromImage, extractTextFromPdfScannedViaVision } from "@/app/lib/ocr/googleVision";
import { extractTextFromPdf } from "@/app/lib/ocr/pdfText";
import { parseReceiptText } from "@/app/lib/ocr/parse";

const MAX_ATTEMPTS = 3;

function backoffMs(attempts: number) {
  // 1st retry: 10s, then 30s, then 2m
  const table = [10_000, 30_000, 120_000];
  return table[Math.min(table.length - 1, Math.max(0, attempts - 1))];
}

export async function enqueueOcrJob(opts: { userId: string; docId: string }) {
  // One job per document
  await prisma.ocrJob.upsert({
    where: { docId: opts.docId },
    update: { status: "pending", nextRunAt: null, lastError: null },
    create: { userId: opts.userId, docId: opts.docId, status: "pending" },
    select: { id: true },
  });
}

export async function runOneOcrJob() {
  const now = new Date();
  const job = await prisma.ocrJob.findFirst({
    where: {
      status: "pending",
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, docId: true, userId: true, attempts: true },
  });
  if (!job) return { ok: true, processed: false as const };

  // claim
  const claimed = await prisma.ocrJob.updateMany({
    where: { id: job.id, status: "pending" },
    data: { status: "running", startedAt: now, attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { ok: true, processed: false as const };

  try {
    const doc = await prisma.document.findFirst({
      where: { id: job.docId, userId: job.userId },
      select: { id: true, fileKey: true, fileMime: true, fileName: true, createdAt: true, vendor: true, amount: true, date: true, docNumber: true },
    });
    if (!doc) throw new Error("Document not found");

    const bytes = await getObjectBytes(doc.fileKey);

    // OCR
    let text = "";
    if (doc.fileMime === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf")) {
      // `pdf-parse` can fail on some environments/PDFs (e.g. missing DOM polyfills).
      // If it errors or returns empty text, fall back to Google Vision async PDF OCR.
      try {
        text = await extractTextFromPdf(bytes);
      } catch {
        text = "";
      }
      if (!text.trim()) text = await extractTextFromPdfScannedViaVision(bytes, { docId: doc.id });
    } else {
      text = await extractTextFromImage(bytes);
    }

    const parsed = parseReceiptText(text);

    const isVendorPlaceholder = !doc.vendor || doc.vendor === "—";
    const isAmountZero = Number(doc.amount.toString()) === 0;
    const isDocNumberEmpty = !doc.docNumber;

    const sameDayLocal = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const isDateDefault = sameDayLocal(doc.date, doc.createdAt);

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        ocrStatus: text.trim() ? "success" : "failed",
        ocrText: text.slice(0, 50_000),
        ...(parsed.date && isDateDefault ? { date: parsed.date } : {}),
        ...(parsed.amount && isAmountZero ? { amount: parsed.amount } : {}),
        ...(parsed.vendor && isVendorPlaceholder ? { vendor: parsed.vendor } : {}),
        ...(parsed.docNumber && isDocNumberEmpty ? { docNumber: parsed.docNumber } : {}),
        ...(parsed.currency ? { currency: parsed.currency } : {}),
      },
    });

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: { status: "success", finishedAt: new Date(), lastError: null, nextRunAt: null },
    });

    return { ok: true, processed: true as const, jobId: job.id, docId: doc.id };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    const attempts = job.attempts + 1;
    const willRetry = attempts < MAX_ATTEMPTS;
    await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: willRetry ? "pending" : "failed",
        lastError: err.slice(0, 4000),
        nextRunAt: willRetry ? new Date(Date.now() + backoffMs(attempts)) : null,
        finishedAt: willRetry ? null : new Date(),
      },
    });

    // Mark document as failed if we give up
    if (!willRetry) {
      await prisma.document.update({
        where: { id: job.docId },
        data: { ocrStatus: "failed", ocrText: `OCR job failed: ${err}`.slice(0, 50_000) },
      });
    }

    return { ok: false, processed: true as const, error: err, willRetry };
  } finally {
    // No-op: status transitions handled in try/catch.
  }
}

