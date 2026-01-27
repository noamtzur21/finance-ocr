import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { enqueueOcrJob } from "@/app/lib/ocr/worker";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;

  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { id: true, ocrStatus: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.document.update({
    where: { id: doc.id },
    data: { ocrStatus: "pending", ocrText: null },
    select: { id: true },
  });

  // Reset/re-enqueue job for this document
  await prisma.ocrJob.upsert({
    where: { docId: doc.id },
    update: {
      status: "pending",
      attempts: 0,
      nextRunAt: null,
      lastError: null,
      startedAt: null,
      finishedAt: null,
    },
    create: { userId: user.id, docId: doc.id, status: "pending", attempts: 0 },
    select: { id: true },
  });

  // Keep behavior consistent with upload flow (one job per doc).
  await enqueueOcrJob({ userId: user.id, docId: doc.id });

  // If called from a <form>, bounce back.
  const accept = req.headers.get("accept") ?? "";
  const referer = req.headers.get("referer");
  if (accept.includes("text/html") && referer) {
    return NextResponse.redirect(referer, { status: 303 });
  }

  return NextResponse.json({ ok: true });
}

