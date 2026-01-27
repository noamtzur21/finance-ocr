import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import { prisma } from "@/app/lib/prisma";
import LiveRefresh from "@/app/ui/LiveRefresh";
import TransactionsClient from "./ui/TransactionsClient";

export default async function TransactionsPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const [categories, items] = await Promise.all([
    prisma.category.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.transaction.findMany({
      where: { userId: user.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 100,
      include: { category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תנועות אחרונות</h1>
          <p className="mt-1 text-sm text-zinc-600">כאן אתה מוסיף ידנית תנועות אשראי/בנק ורואה פירוט מלא.</p>
        </div>
        <a className="btn" href="/dashboard">
          דשבורד
        </a>
      </div>

      <div className="card p-4">
        <TransactionsClient
          categories={categories}
          initial={items.map((t) => ({
            id: t.id,
            date: t.date.toISOString().slice(0, 10),
            amount: t.amount.toString(),
            currency: t.currency,
            vendor: t.vendor,
            description: t.description,
            categoryId: t.categoryId,
            categoryName: t.category?.name ?? null,
            cardLast4: t.cardLast4,
            updatedAt: t.updatedAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}

