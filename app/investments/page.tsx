import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import LiveRefresh from "@/app/ui/LiveRefresh";
import InvestmentsClient from "./ui/InvestmentsClient";

async function ensureDefaultAccounts(userId: string) {
  await prisma.investmentAccount.upsert({
    where: { userId_slug: { userId, slug: "btb" } },
    update: {
      name: "BTB",
      type: "btb",
      provider: "BTB",
      strategy: "B-match",
      currency: "ILS",
    },
    create: {
      userId,
      slug: "btb",
      name: "BTB",
      type: "btb",
      provider: "BTB",
      strategy: "B-match",
      currency: "ILS",
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
    },
    create: {
      userId,
      slug: "migdal-gemel-sp500",
      name: "קופת גמל (S&P 500)",
      type: "gemel",
      provider: "מגדל",
      strategy: "עוקב מדד S&P 500",
      currency: "ILS",
    },
  });
}

export default async function InvestmentsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  await ensureDefaultAccounts(user.id);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2024 + 1 }, (_, i) => 2024 + i);

  const accounts = await prisma.investmentAccount.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    include: { years: { orderBy: { year: "asc" } } },
  });

  const entries = await prisma.investmentEntry.findMany({
    where: { userId: user.id, date: { gte: new Date(2024, 0, 1), lt: new Date(currentYear + 1, 0, 1) } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    select: { id: true, accountId: true, type: true, date: true, amount: true, note: true },
  });
  const entriesByAccount = new Map<string, typeof entries>();
  for (const e of entries) {
    const arr = entriesByAccount.get(e.accountId) ?? [];
    arr.push(e);
    entriesByAccount.set(e.accountId, arr);
  }

  return (
    <div className="space-y-6">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">השקעות</h1>
          <p className="mt-1 text-sm text-zinc-600">ריכוז הפקדות/משיכות לפי שנה + עלויות (אם ידוע).</p>
        </div>
        <a className="btn" href="/dashboard">
          דשבורד
        </a>
      </div>

      <div className="card p-4">
        <div className="text-sm font-semibold text-zinc-900">מה כדאי להביא כדי להבין “כמה זה עולה לי”</div>
        <ul className="mt-2 list-disc space-y-1 ps-5 text-sm text-zinc-700">
          <li>דוח שנתי / פירוט חיובים (דמי ניהול, עמלות, דמי משמרת/תפעול אם קיימים).</li>
          <li>פירוט הפקדות ומשיכות לפי שנה (אנחנו כבר מרכזים פה ברגע שמזינים).</li>
          <li>
            לקופת גמל: בד״כ מס רווחי הון על הרווח בעת משיכה (המספר המדויק תלוי בדוחות; זה לא ייעוץ מס).
          </li>
          <li>ל‑BTB: עמלות/דמי שירות/דמי ניהול (לפי תנאי החשבון) + פירוט ריבית/תשואה בדוח.</li>
        </ul>
      </div>

      <InvestmentsClient
        years={years}
        initial={accounts.map((a) => ({
          id: a.id,
          slug: a.slug,
          name: a.name,
          provider: a.provider,
          strategy: a.strategy,
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
    </div>
  );
}

