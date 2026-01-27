import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireUser } from "@/app/lib/auth/server";

export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.investmentAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { years: { orderBy: { year: "asc" } } },
  });

  return NextResponse.json(
    accounts.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      type: a.type,
      provider: a.provider,
      strategy: a.strategy,
      currency: a.currency,
      notes: a.notes,
      currentBalance: a.currentBalance?.toString() ?? null,
      currentBalanceUpdatedAt: a.currentBalanceUpdatedAt?.toISOString() ?? null,
      years: a.years.map((y) => ({
        id: y.id,
        year: y.year,
        deposits: y.deposits.toString(),
        withdrawals: y.withdrawals.toString(),
        feesPaid: y.feesPaid?.toString() ?? null,
        taxPaid: y.taxPaid?.toString() ?? null,
        endBalance: y.endBalance?.toString() ?? null,
        updatedAt: y.updatedAt.toISOString(),
      })),
    })),
  );
}

