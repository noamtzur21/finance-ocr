import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { decryptPassword } from "@/app/lib/credentials/crypto";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const cred = await prisma.credential.findFirst({
    where: { id, userId: user.id },
    select: { passwordCiphertext: true, passwordIv: true, passwordTag: true },
  });
  if (!cred) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const password = decryptPassword({
    ciphertext: cred.passwordCiphertext,
    iv: cred.passwordIv,
    tag: cred.passwordTag,
  });

  return NextResponse.json({ password });
}


