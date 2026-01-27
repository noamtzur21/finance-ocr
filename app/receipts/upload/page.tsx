import { redirect } from "next/navigation";
import { requireUser } from "@/app/lib/auth/server";
import ReceiptUploadForm from "./ui/ReceiptUploadForm";

export default async function ReceiptUploadPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">קבלה חדשה</h1>
          <p className="mt-1 text-sm text-zinc-600">העלה קבלה (תמונה/‏PDF) והשלם פרטים בסיסיים.</p>
        </div>
        <div className="flex items-center gap-2">
          <a className="btn" href="/receipts">
            חזרה לקבלות
          </a>
          <a className="btn" href="/dashboard">
            דשבורד
          </a>
        </div>
      </div>

      <div className="card p-4">
        <ReceiptUploadForm />
      </div>
    </div>
  );
}

