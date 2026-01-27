import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import LiveRefresh from "@/app/ui/LiveRefresh";
import Link from "next/link";
import { Suspense } from "react";
import BudgetContent from "./ui/BudgetContent";

export default async function BudgetPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <LiveRefresh url="/api/stream/events?full=1" />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">תקציב</h1>
          <p className="mt-1 text-sm text-zinc-600">העמוד נטען בהדרגה — הנתונים יופיעו מיד כשמוכן.</p>
        </div>
        <Link className="btn" href="/dashboard">
          חזרה לדשבורד
        </Link>
      </div>

      <Suspense
        fallback={
          <div className="card p-4">
            <div className="h-5 w-48 animate-pulse rounded bg-zinc-200" />
            <div className="mt-4 h-40 animate-pulse rounded-2xl border border-zinc-200/70 bg-white" />
          </div>
        }
      >
        <BudgetContent userId={user.id} />
      </Suspense>
    </div>
  );
}


