import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectReadUrl, objectExists } from "@/app/lib/r2/objects";

export const dynamic = "force-dynamic";

const NO_FILE_HTML = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>אין קובץ</title></head><body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f5;color:#71717a;"><p>אין קובץ זמין למסמך זה – ייתכן שהועלה לפני מעבר לאחסון הנוכחי.</p></body></html>`;

/** Serves document preview: redirect to signed R2 URL so the image/PDF loads in the editor. */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    select: { fileKey: true },
  });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const exists = await objectExists(doc.fileKey);
  if (!exists) {
    return new NextResponse(NO_FILE_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const url = await getObjectReadUrl(doc.fileKey, 60 * 15); // 15 min for preview
  return NextResponse.redirect(url);
}
