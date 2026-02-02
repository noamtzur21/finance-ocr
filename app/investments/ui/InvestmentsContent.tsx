import { prisma } from "@/app/lib/prisma";
import InvestmentsClient from "./InvestmentsClient";

export default async function InvestmentsContent(props: { userId: string }) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  const [accounts, entries] = await Promise.all([
    prisma.investmentAccount.findMany({
      where: { userId: props.userId },
      orderBy: { createdAt: "asc" },
      include: { years: { orderBy: { year: "asc" } } },
    }),
    prisma.investmentEntry.findMany({
      where: { userId: props.userId, date: { gte: new Date(2024, 0, 1), lt: new Date(currentYear + 1, 0, 1) } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      select: { id: true, accountId: true, type: true, date: true, amount: true, note: true },
    }),
  ]);

  const entriesByAccount = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = entriesByAccount.get(e.accountId) ?? [];
    arr.push(e);
    entriesByAccount.set(e.accountId, arr);
  }

  return (
    <>
      <InvestmentsClient
        years={years}
        initial={accounts.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          provider: a.provider,
          strategy: a.strategy,
          notes: a.notes ?? "",
          currency: a.currency,
          currentBalance: a.currentBalance?.toString() ?? "",
          currentBalanceUpdatedAt: a.currentBalanceUpdatedAt?.toISOString() ?? "",
          years: a.years.map((y) => ({
            year: y.year,
            deposits: y.deposits.toString(),
            withdrawals: y.withdrawals.toString(),
            feesPaid: y.feesPaid?.toString() ?? "",
            taxPaid: y.taxPaid?.toString() ?? "",
            endBalance: y.endBalance?.toString() ?? "",
          })),
          entries: (entriesByAccount.get(a.id) ?? []).map((e) => ({
            id: e.id,
            type: e.type,
            date: e.date.toISOString().slice(0, 10),
            amount: e.amount.toString(),
            note: e.note ?? "",
          })),
        }))}
      />
    </>
  );
}

