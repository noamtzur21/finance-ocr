import { redirect } from "next/navigation";
import { prisma } from "@/app/lib/prisma";
import Link from "next/link";
import SignupForm from "./ui/SignupForm";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const users = await prisma.user.count();
  if (users === 0) redirect("/setup");

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-950">הרשמה</h1>
        <p className="mt-1 text-sm text-zinc-600">
          צור חשבון חדש. מספר הטלפון מקשר את הוואטסאפ שלך — קבלות שתשלח ממנו יישמרו אוטומטית בחשבון שלך.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-4 text-center text-sm text-zinc-600">
          כבר יש לך חשבון?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline">
            התחבר
          </Link>
        </p>
      </div>
    </div>
  );
}
