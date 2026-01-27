import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import BudgetClient from "./ui/BudgetClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const budget = await prisma.budget.findUnique({
    where: { userId_month: { userId: user.id, month } },
    select: { expenseLimit: true },
  });

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const expenseSum =
    (
      await prisma.document.aggregate({
        where: { userId: user.id, type: "expense", date: { gte: start, lt: end } },
        _sum: { amount: true },
      })
    )._sum.amount?.toString() ?? "0";

  return (
    <div className="space-y-6">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תקציב</h1>
          <p className="mt-1 text-sm text-zinc-600">הגדר תקרת הוצאות חודשית וקבל אינדיקציה על חריגה.</p>
        </div>
        <a className="btn" href="/dashboard">
          חזרה לדשבורד
        </a>
      </div>

      <div className="card p-4">
        <BudgetClient
          key={`${month}:${budget?.expenseLimit.toString() ?? ""}:${expenseSum}`}
          month={month}
          initialLimit={budget?.expenseLimit.toString() ?? ""}
          spent={expenseSum}
        />
      </div>
    </div>
  );
}


