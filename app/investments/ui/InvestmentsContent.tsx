import { prisma } from "@/app/lib/prisma";
import InvestmentsClient from "./InvestmentsClient";

async function ensureDefaultAccounts(userId: string) {
  const btbNotes = [
    "דמי ניהול: 0.7% שנתי מגובה התיק.",
    "דמי הפקדה: 1% מכל הפקדה (יורד בפריסה על פני 24 חודשים).",
    "דמי ניהול נוספים: 0.15% שנתי — “קופת ערבות הדדית” (BTB).",
    "מיסוי על רווחים: 15%.",
  ].join("\n");

  const migdalNotes = [
    "דמי ניהול מהפקדה: 0%.",
    "דמי ניהול מחיסכון: 0.7% שנתי.",
    "מיסוי על משיכה (כפי שציינת): 35%.",
  ].join("\n");

  await prisma.investmentAccount.upsert({
    where: { userId_slug: { userId, slug: "btb" } },
    update: {
      name: "BTB",
      type: "btb",
      provider: "BTB",
      strategy: "B-match",
      currency: "ILS",
      notes: btbNotes,
    },
    create: {
      userId,
      slug: "btb",
      name: "BTB",
      type: "btb",
      provider: "BTB",
      strategy: "B-match",
      currency: "ILS",
      notes: btbNotes,
    },
  });

  await prisma.investmentAccount.upsert({
    where: { userId_slug: { userId, slug: "migdal-gemel-sp500" } },
    update: {
      name: "קופת גמל (S&P 500)",
      type: "gemel",
      provider: "מגדל",
      strategy: "עוקב מדד S&P 500",
      currency: "ILS",
      notes: migdalNotes,
    },
    create: {
      userId,
      slug: "migdal-gemel-sp500",
      name: "קופת גמל (S&P 500)",
      type: "gemel",
      provider: "מגדל",
      strategy: "עוקב מדד S&P 500",
      currency: "ILS",
      notes: migdalNotes,
    },
  });
}

export default async function InvestmentsContent(props: { userId: string }) {
  await ensureDefaultAccounts(props.userId);

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

