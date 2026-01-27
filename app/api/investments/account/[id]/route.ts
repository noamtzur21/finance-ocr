import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const patchSchema = z.object({
  currentBalance: z.string().nullable(),
});

function toMoneyOrNull(s: string | null): string | null {
  if (s == null || s.trim() === "") return null;
  const n = Number(String(s).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000_000) return null;
  return n.toFixed(2);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const currentBalance = toMoneyOrNull(parsed.data.currentBalance);
  if (parsed.data.currentBalance != null && currentBalance == null) {
    return NextResponse.json({ error: "Invalid currentBalance" }, { status: 400 });
  }

  const exists = await prisma.investmentAccount.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!exists) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.investmentAccount.update({
    where: { id },
    data: {
      currentBalance,
      currentBalanceUpdatedAt: currentBalance == null ? null : new Date(),
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true });
}

