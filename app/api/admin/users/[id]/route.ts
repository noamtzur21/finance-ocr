import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth/server";

/** מנהל מאשר משתמש (מאפשר לו להתחבר) */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: { id, isAdmin: false },
    select: { id: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  await prisma.user.update({
    where: { id },
    data: { approved: true },
  });

  return NextResponse.json({ ok: true });
}
