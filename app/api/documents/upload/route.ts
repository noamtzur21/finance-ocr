import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/app/lib/auth/server";
import { putObject } from "@/app/lib/r2/objects";
import { prisma } from "@/app/lib/prisma";
import crypto from "crypto";
import { enqueueOcrJob } from "@/app/lib/ocr/worker";

const metaSchema = z.object({
  type: z.enum(["expense", "income"]),
  date: z.string().optional(),
  vendor: z.string().optional(),
  amount: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().optional(),
});

type Meta = z.infer<typeof metaSchema>;

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const metaRaw = formData.get("meta") as string | null;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const meta: Meta = metaRaw ? metaSchema.parse(JSON.parse(metaRaw)) : { type: "expense" };

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Calculate SHA256 to detect duplicates
  const hash = crypto.createHash("sha256").update(buffer).digest("hex");

  const existing = await prisma.document.findFirst({
    where: { userId: user.id, sha256: hash },
    select: { id: true, fileName: true },
  });

  if (existing) {
    return NextResponse.json({ 
      error: "duplicate", 
      message: `הקובץ כבר קיים במערכת בשם: ${existing.fileName}`,
      docId: existing.id 
    }, { status: 409 });
  }

  const fileKey = `${user.id}/${Date.now()}-${file.name}`;
  await putObject({ key: fileKey, body: buffer, contentType: file.type });

  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      type: meta.type,
      date: meta.date ? new Date(meta.date) : new Date(),
      amount: parseFloat(meta.amount || "0"),
      vendor: meta.vendor || "Unknown",
      categoryId: meta.categoryId || null,
      description: meta.description || null,
      fileKey,
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size,
      sha256: hash,
    },
  });

  await enqueueOcrJob({ userId: user.id, docId: doc.id });

  return NextResponse.json({ ok: true, id: doc.id });
}
