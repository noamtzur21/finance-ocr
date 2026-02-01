import { redirect } from "next/navigation";
import { requireAdmin } from "@/app/lib/auth/server";
import Link from "next/link";
import CreateUserForm from "./ui/CreateUserForm";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">ניהול משתמשים</h1>
        <p className="mt-1 text-sm text-zinc-600">
          צור משתמש חדש ללקוח — אימייל, סיסמה ומספר טלפון (לשליחת קבלות בוואטסאפ). הקבלות שיישלח ממספר זה יישמרו רק בחשבון שלו.
        </p>
      </div>
      <div className="card p-6">
        <CreateUserForm />
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-zinc-600">
        <Link href="/settings" className="font-medium text-zinc-900 underline">
          חזרה להגדרות
        </Link>
        <span>·</span>
        <a
          href="/api/admin/ocr-status"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-900 underline"
        >
          סטטוס OCR (כמה ממתינים, שגיאות)
        </a>
      </div>
    </div>
  );
}
