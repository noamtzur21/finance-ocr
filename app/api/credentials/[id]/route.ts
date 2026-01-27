import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { encryptPassword } from "@/app/lib/credentials/crypto";

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().max(120).optional(),
  password: z.string().min(1).max(500).optional(),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (parsed.data.name) data.name = parsed.data.name.trim();
  if (parsed.data.email) data.email = parsed.data.email.toLowerCase();
  if (parsed.data.password) {
    const enc = encryptPassword(parsed.data.password);
    data.passwordCiphertext = enc.ciphertext;
    data.passwordIv = enc.iv;
    data.passwordTag = enc.tag;
  }

  const updated = await prisma.credential.updateMany({
    where: { id, userId: user.id },
    data,
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const deleted = await prisma.credential.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}


