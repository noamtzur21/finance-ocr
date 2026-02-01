import { NextResponse } from "next/server";
import { requireAdmin } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

/** דיאגנוסטיקה: כמה ממתינים, שגיאות אחרונות. רק לאדמין. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [pendingCount, failedJob, pendingJobs] = await Promise.all([
    prisma.ocrJob.count({ where: { status: "pending" } }),
    prisma.ocrJob.findFirst({
      where: { status: "failed" },
      orderBy: { updatedAt: "desc" },
      select: { docId: true, lastError: true, attempts: true, updatedAt: true },
    }),
    prisma.ocrJob.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      take: 10,
      select: { id: true, docId: true, createdAt: true },
    }),
  ]);

  return NextResponse.json({
    pendingCount,
    pendingSample: pendingJobs.map((j) => ({ docId: j.docId, createdAt: j.createdAt.toISOString() })),
    lastFailed: failedJob
      ? {
          docId: failedJob.docId,
          lastError: failedJob.lastError,
          attempts: failedJob.attempts,
          updatedAt: failedJob.updatedAt.toISOString(),
        }
      : null,
    hint:
      pendingCount > 0
        ? "יש ממתינים. אם ה-cron רץ כל דקה ו-CRON_SECRET מוגדר ב-Vercel, הם אמורים להיעבד. בדוק ב-Vercel → Logs סינון /api/cron/ocr."
        : "אין ממתינים.",
  });
}
