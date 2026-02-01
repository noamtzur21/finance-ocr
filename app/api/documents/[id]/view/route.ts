import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { getObjectReadUrl } from "@/app/lib/r2/objects";

export const dynamic = "force-dynamic";

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

  const url = await getObjectReadUrl(doc.fileKey, 60 * 15); // 15 min for preview
  return NextResponse.redirect(url);
}
