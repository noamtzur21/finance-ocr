import { prisma } from "@/app/lib/prisma";
import { getObjectBytes } from "@/app/lib/r2/objects";
import { extractTextFromImage, extractTextFromPdfScannedViaVision } from "@/app/lib/ocr/googleVision";
import { extractTextFromPdf } from "@/app/lib/ocr/pdfText";
import { parseReceiptText } from "@/app/lib/ocr/parse";
import { getUsdIlsRate } from "@/app/lib/fx/usdIlsRate";

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
      select: { id: true, fileKey: true, fileMime: true, fileName: true, createdAt: true, vendor: true, amount: true, date: true, docNumber: true, description: true },
    });
    if (!doc) throw new Error("Document not found");

    const bytes = await getObjectBytes(doc.fileKey);

    // OCR
    let text = "";
    const isPdf = doc.fileMime === "application/pdf" || doc.fileName.toLowerCase().endsWith(".pdf");
    const hasGcsPdfOcr = !!process.env.GOOGLE_VISION_OCR_GCS_OUTPUT_URI?.trim();
    const hasVisionApiKey = !!process.env.GOOGLE_VISION_API_KEY?.trim();
    const isVercel = !!process.env.VERCEL;

    console.info("[ocr/worker] starting", {
      docId: doc.id,
      isPdf,
      fileMime: doc.fileMime,
      fileName: doc.fileName,
      isVercel,
      hasVisionApiKey,
      hasGcsPdfOcr,
    });

    if (isPdf) {
      // On Vercel/serverless, pdf-parse often fails (Path2D, streams). When GCS is set, use Vision only.
      if (hasGcsPdfOcr) {
        console.info("[ocr/worker] ocr method", { docId: doc.id, method: "vision_pdf_gcs" });
        text = await extractTextFromPdfScannedViaVision(bytes, { docId: doc.id });
      } else {
        console.info("[ocr/worker] ocr method", { docId: doc.id, method: "pdf_text_then_vision" });
        try {
          text = await extractTextFromPdf(bytes);
        } catch {
          text = "";
        }
        if (!text.trim()) text = await extractTextFromPdfScannedViaVision(bytes, { docId: doc.id });
      }
    } else {
      console.info("[ocr/worker] ocr method", { docId: doc.id, method: hasVisionApiKey ? "vision_image_rest" : "vision_image_sdk" });
      text = await extractTextFromImage(bytes);
    }

    const parsed = parseReceiptText(text);

    const vendorNorm = (doc.vendor ?? "").trim().toLowerCase();
    const isVendorPlaceholder = !vendorNorm || vendorNorm === "—" || vendorNorm === "unknown" || vendorNorm === "לא ידוע";

    const currentAmount = Number(doc.amount.toString());
    const isAmountZero = currentAmount === 0;
    const isDocNumberEmpty = !doc.docNumber;

    const sameDayLocal = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const isDateDefault = sameDayLocal(doc.date, doc.createdAt);

    // Currency handling:
    // - If OCR text looks like USD, store amount in ILS (business bookkeeping) and keep currency as ILS.
    // - We'll still show original "(19$)" in the UI by re-parsing the OCR text.
    const parsedAmountNum = parsed.amount ? Number(parsed.amount) : null;
    const amountLooksAutoFilled =
      parsedAmountNum !== null && Number.isFinite(parsedAmountNum) && Math.abs(currentAmount - parsedAmountNum) < 0.01;
    const shouldOverwriteAmount = isAmountZero || amountLooksAutoFilled;
    let amountToStore: string | null = parsed.amount ?? null;
    let currencyToStore: string | null = parsed.currency ?? null;

    if (parsed.currency === "USD" && parsedAmountNum !== null && Number.isFinite(parsedAmountNum) && shouldOverwriteAmount) {
      const rate = await getUsdIlsRate();
      const ils = parsedAmountNum * rate;
      if (Number.isFinite(ils)) {
        amountToStore = ils.toFixed(2);
        currencyToStore = "ILS";
      }
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: {
        ocrStatus: text.trim() ? "success" : "failed",
        ocrText: text.slice(0, 50_000),
        ocrConfidence: parsed.confidence,
        ...(parsed.date && isDateDefault ? { date: parsed.date } : {}),
        ...(amountToStore && shouldOverwriteAmount ? { amount: amountToStore } : {}),
        ...(parsed.vendor && isVendorPlaceholder ? { vendor: parsed.vendor } : {}),
        ...(parsed.docNumber && isDocNumberEmpty ? { docNumber: parsed.docNumber } : {}),
        ...(currencyToStore ? { currency: currencyToStore } : {}),
      },
    });

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: { status: "success", finishedAt: new Date(), lastError: null, nextRunAt: null },
    });

    return { ok: true, processed: true as const, jobId: job.id, docId: doc.id };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    console.error("[ocr/worker] job failed", {
      docId: job.docId,
      attempts: job.attempts,
      error: err,
      name: e instanceof Error ? e.name : undefined,
      stack: e instanceof Error ? e.stack : undefined,
      cause: e instanceof Error ? (e as { cause?: unknown }).cause : undefined,
    });
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
      // User-friendly message for stream/connection errors (common on serverless)
      const isStreamError = /stream was destroyed|write after.*destroy|ECONNRESET|ETIMEDOUT/i.test(err);
      const displayErr = isStreamError
        ? "OCR זמנית נכשל (שגיאת תקשורת). נסה שוב או לחץ 'נסה OCR שוב' במסמך."
        : `OCR job failed: ${err}`;
      await prisma.document.update({
        where: { id: job.docId },
        data: { ocrStatus: "failed", ocrText: displayErr.slice(0, 50_000) },
      });
    }

    return { ok: false, processed: true as const, error: err, willRetry };
  } finally {
    // No-op: status transitions handled in try/catch.
  }
}

