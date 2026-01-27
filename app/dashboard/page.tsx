import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import LogoutButton from "./ui/LogoutButton";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function DashboardPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [budget, recentTx, sums] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: user.id, month } },
      select: { expenseLimit: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: { category: { select: { name: true } } },
    }),
    prisma.document.groupBy({
      by: ["type"],
      where: { userId: user.id, date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const income = sums.find((s) => s.type === "income")?._sum.amount?.toString() ?? "0";
  const expense = sums.find((s) => s.type === "expense")?._sum.amount?.toString() ?? "0";
  const net = (Number(income) - Number(expense)).toFixed(2);
  const budgetLimit = budget?.expenseLimit?.toString() ?? "";
  const pct =
    budgetLimit && Number(budgetLimit) > 0
      ? Math.min(100, Math.round((Number(expense) / Number(budgetLimit)) * 100))
      : 0;

  const todayLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">{todayLabel}</h1>
          <p className="mt-1 text-sm text-zinc-600">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <LogoutButton />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="card p-4">
          <div className="text-sm text-zinc-600">הכנסות החודש</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{income}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-zinc-600">הוצאות החודש</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{expense}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-zinc-600">נטו</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">{net}</div>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-zinc-600">תקציב החודש</div>
            <a className="text-xs underline" href="/budget">
              עריכה
            </a>
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            {budgetLimit ? budgetLimit : "—"}
          </div>
          {budgetLimit ? (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>נוצל</span>
                <span className={pct >= 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-zinc-700"}>
                  {pct}%
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-600">הגדר תקציב כדי לראות התקדמות.</div>
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">10 תנועות אחרונות</div>
            <div className="mt-0.5 text-xs text-zinc-600">סיכום קצר (פירוט מלא במסך תנועות אחרונות)</div>
          </div>
          <a className="btn" href="/transactions">
            לכל התנועות
          </a>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-3 py-2 text-right font-medium">תאריך</th>
                <th className="px-3 py-2 text-right font-medium">בית עסק</th>
                <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
                <th className="px-3 py-2 text-right font-medium">סכום</th>
                <th className="px-3 py-2 text-right font-medium">כרטיס</th>
              </tr>
            </thead>
            <tbody>
              {recentTx.length === 0 ? (
                <tr>
                  <td className="px-3 py-10 text-center text-zinc-600" colSpan={5}>
                    אין תנועות עדיין. <a className="underline" href="/transactions">הוסף תנועה</a>
                  </td>
                </tr>
              ) : (
                recentTx.map((t) => (
                  <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                    <td className="px-3 py-2">{t.date.toISOString().slice(0, 10)}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium text-zinc-900">{t.vendor}</span>
                      {t.description ? <div className="mt-0.5 text-xs text-zinc-600">{t.description}</div> : null}
                    </td>
                    <td className="px-3 py-2">{t.category?.name ?? "—"}</td>
                    <td className="px-3 py-2">
                      {t.amount.toString()} <span className="text-xs text-zinc-600">{t.currency}</span>
                    </td>
                    <td className="px-3 py-2">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


