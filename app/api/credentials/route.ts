import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";
import { encryptPassword } from "@/app/lib/credentials/crypto";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email().max(120),
  password: z.string().min(1).max(500),
});

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const items = await prisma.credential.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const enc = encryptPassword(parsed.data.password);
  const created = await prisma.credential.create({
    data: {
      userId: user.id,
      name: parsed.data.name.trim(),
      email: parsed.data.email.toLowerCase(),
      passwordCiphertext: enc.ciphertext,
      passwordIv: enc.iv,
      passwordTag: enc.tag,
    },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
  });

  return NextResponse.json(created);
}


