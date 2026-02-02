"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim(),
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; pendingApproval?: boolean; error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "שגיאה בהרשמה");
      return;
    }
    if (data?.pendingApproval) {
      setSuccess(true);
      return;
    }
    router.replace("/dashboard");
  }

  if (success) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
        <p className="font-medium text-emerald-800">נשלח אישור למנהל המערכת</p>
        <p className="mt-1 text-sm text-emerald-700">אחרי האישור תוכל להתחבר עם האימייל והסיסמה שבחרת.</p>
        <Link href="/login" className="mt-4 inline-block text-sm font-medium text-emerald-800 underline">
          מעבר להתחברות
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-zinc-950">אימייל</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-950">סיסמה (לפחות 8 תווים)</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-950">מספר טלפון <span className="text-red-500">*</span></label>
        <input
          dir="ltr"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="050-1234567"
          required
        />
        <p className="mt-1 text-xs text-zinc-500">המספר שמקושר לחשבון – לקבלת קבלות בוואטסאפ (תוכל לעדכן בהגדרות).</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "שולח..." : "הרשם"}
      </button>
    </form>
  );
}
