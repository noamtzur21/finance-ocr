import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

const upsertSchema = z.object({
  accountId: z.string().min(1),
  year: z.number().int().min(2024).max(2100),
  deposits: z.string(),
  withdrawals: z.string(),
  feesPaid: z.string().nullable().optional(),
  taxPaid: z.string().nullable().optional(),
  endBalance: z.string().nullable().optional(),
});

function toMoney(s: string): string | null {
  const n = Number(String(s).replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000_000) return null;
  return n.toFixed(2);
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = upsertSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Ensure account belongs to user
  const account = await prisma.investmentAccount.findFirst({
    where: { id: parsed.data.accountId, userId: user.id },
    select: { id: true },
  });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const deposits = toMoney(parsed.data.deposits);
  const withdrawals = toMoney(parsed.data.withdrawals);
  if (deposits == null || withdrawals == null) {
    return NextResponse.json({ error: "Invalid deposits/withdrawals" }, { status: 400 });
  }

  const feesPaid = parsed.data.feesPaid != null ? toMoney(parsed.data.feesPaid) : null;
  const taxPaid = parsed.data.taxPaid != null ? toMoney(parsed.data.taxPaid) : null;
  const endBalance = parsed.data.endBalance != null ? toMoney(parsed.data.endBalance) : null;

  const row = await prisma.investmentYear.upsert({
    where: { accountId_year: { accountId: parsed.data.accountId, year: parsed.data.year } },
    update: {
      deposits,
      withdrawals,
      feesPaid,
      taxPaid,
      endBalance,
    },
    create: {
      userId: user.id,
      accountId: parsed.data.accountId,
      year: parsed.data.year,
      deposits,
      withdrawals,
      feesPaid,
      taxPaid,
      endBalance,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: row.id });
}

