import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { putObject } from "@/app/lib/r2/objects";
import { enqueueOcrJob } from "@/app/lib/ocr/worker";

const metaSchema = z.object({
  type: z.enum(["expense", "income"]),
  categoryId: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // YYYY-MM-DD
  amount: z.string().optional().nullable(),
  docNumber: z.string().optional().nullable(),
});

function parseDateOnly(s: string) {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function extFromFileName(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m?.[1] ?? "bin";
}

function buildR2KeyStable(opts: { userId: string; docId: string; date: Date; ext: string }) {
  const yyyy = opts.date.getFullYear();
  const mm = String(opts.date.getMonth() + 1).padStart(2, "0");
  return `receipts/${opts.userId}/${yyyy}/${mm}/${opts.docId}.${opts.ext}`;
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const metaRaw = form.get("meta");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  const metaJson = typeof metaRaw === "string" ? JSON.parse(metaRaw) : {};
  const parsedMeta = metaSchema.safeParse(metaJson);
  if (!parsedMeta.success) {
    return NextResponse.json({ error: "Invalid meta" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const fileSize = bytes.byteLength;
  const fileMime = file.type || "application/octet-stream";
  const fileName = file.name || "upload";

  const existing = await prisma.document.findFirst({
    where: { userId: user.id, sha256 },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Duplicate file", existingId: existing.id },
      { status: 409 },
    );
  }

  // create DB row first (we'll update after OCR)
  const now = new Date();
  const metaVendor = parsedMeta.data.vendor?.trim() || null;
  const metaDesc = parsedMeta.data.description ?? null;
  const metaDate = parsedMeta.data.date ? parseDateOnly(parsedMeta.data.date) : null;
  const metaAmountRaw = parsedMeta.data.amount?.trim() || "";
  const metaAmountNum = metaAmountRaw ? Number(metaAmountRaw.replace(/,/g, "")) : NaN;
  const metaAmount = Number.isFinite(metaAmountNum) && metaAmountNum > 0 && metaAmountNum < 1_000_000 ? metaAmountNum.toFixed(2) : null;
  const metaDocNumber = parsedMeta.data.docNumber?.trim() || null;

  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      type: parsedMeta.data.type,
      date: metaDate ?? now,
      amount: metaAmount ?? "0",
      vendor: metaVendor ?? "—",
      categoryId: parsedMeta.data.categoryId ?? null,
      description: metaDesc,
      docNumber: metaDocNumber,
      fileKey: "pending",
      fileName,
      fileMime,
      fileSize,
      sha256,
      ocrStatus: "pending",
    },
    select: { id: true },
  });

  // upload to R2 (use placeholder vendor/amount/date for the key; we'll keep original fileName in DB anyway)
  const ext = extFromFileName(fileName);
  const key = buildR2KeyStable({ userId: user.id, docId: doc.id, date: now, ext });
  await putObject({ key, body: bytes, contentType: fileMime });

  await prisma.document.update({
    where: { id: doc.id },
    data: {
      fileKey: key,
      ocrStatus: "pending",
    },
  });

  // Enqueue OCR in background (queue runner will pick it up).
  await enqueueOcrJob({ userId: user.id, docId: doc.id });

  return NextResponse.json({
    id: doc.id,
  });
}


