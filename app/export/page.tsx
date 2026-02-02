import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import ExportClient from "./ui/ExportClient";
import LiveRefresh from "@/app/ui/LiveRefresh";

export default async function ExportPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">ייצוא לרו״ח</h1>
          <p className="mt-1 text-sm text-zinc-600">
            הורד XLSX מסודר (קבלות/חשבוניות בנפרד + סיכומים) או ZIP של כל הקבצים לפי חודשים.
          </p>
        </div>
        <a className="btn" href="/dashboard">
          חזרה לדשבורד
        </a>
      </div>

      <div
        className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900"
        role="alert"
      >
        <strong>הבהרה:</strong> המערכת היא כלי עזר לניהול בלבד ואינה תחליף לייעוץ מס או רואה חשבון.
        האחריות על דיווח לרשויות המס, הגשת דוחות ורישום ספרים מוטלת עליך ורואה החשבון שלך בלבד.{" "}
        <Link href="/terms" className="font-medium underline hover:no-underline">
          תנאי שימוש
        </Link>
        .
      </div>

      <div className="card p-4">
        <ExportClient defaultYear={year} />
      </div>
    </div>
  );
}


