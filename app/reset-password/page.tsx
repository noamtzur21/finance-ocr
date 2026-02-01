import { redirect } from "next/navigation";
import Link from "next/link";
import ResetPasswordForm from "./ui/ResetPasswordForm";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ token?: string }> };

export default async function ResetPasswordPage(props: Props) {
  const sp = await props.searchParams;
  const token = sp.token?.trim();
  if (!token) redirect("/forgot-password");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-950">הגדרת סיסמה חדשה</h1>
        <p className="mt-1 text-sm text-zinc-600">
          הזן סיסמה חדשה (לפחות 8 תווים).
        </p>
        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>
        <p className="mt-4 text-center text-sm text-zinc-600">
          <Link href="/login" className="font-medium text-zinc-900 underline">
            חזרה להתחברות
          </Link>
        </p>
      </div>
    </div>
  );
}
