import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import InvoiceUploadForm from "./ui/InvoiceUploadForm";

export default async function InvoiceUploadPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">חשבונית חדשה</h1>
          <p className="mt-1 text-sm text-zinc-600">העלה חשבונית (PDF/תמונה). תסווג כהכנסה.</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn" href="/invoices">
            חזרה לחשבוניות
          </a>
          <a className="btn" href="/dashboard">
            דשבורד
          </a>
        </div>
      </div>

      <div className="card p-4">
        <InvoiceUploadForm />
      </div>
    </div>
  );
}

