import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const schema = z.object({ name: z.string().min(1).max(60) });

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const category = await prisma.category.create({
      data: { userId: user.id, name: parsed.data.name.trim() },
      select: { id: true, name: true },
    });
    return NextResponse.json(category);
  } catch {
    return NextResponse.json({ error: "Category already exists" }, { status: 409 });
  }
}


