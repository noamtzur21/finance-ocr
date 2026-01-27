import { prisma } from "@/app/lib/prisma";
import BudgetClient from "./BudgetClient";

export default async function BudgetContent(props: { userId: string }) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [budget, expenseAgg] = await Promise.all([
    prisma.budget.findUnique({
      where: { userId_month: { userId: props.userId, month } },
      select: { expenseLimit: true },
    }),
    prisma.document.aggregate({
      where: { userId: props.userId, type: "expense", date: { gte: start, lt: end } },
      _sum: { amount: true },
    }),
  ]);

  const expenseSum = expenseAgg._sum.amount?.toString() ?? "0";

  return (
    <div className="card p-4">
      <BudgetClient
        key={`${month}:${budget?.expenseLimit.toString() ?? ""}:${expenseSum}`}
        month={month}
        initialLimit={budget?.expenseLimit.toString() ?? ""}
        spent={expenseSum}
      />
    </div>
  );
}

