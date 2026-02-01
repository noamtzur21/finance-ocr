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
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה בהרשמה");
      return;
    }
    router.replace("/dashboard");
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
        <label className="text-sm font-medium text-zinc-950">מספר טלפון (לשליחת קבלות בוואטסאפ)</label>
        <input
          dir="ltr"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="050-1234567"
        />
        <p className="mt-1 text-xs text-zinc-500">אם תמלא — קבלות שתשלח ממספר זה בוואטסאפ יישמרו אוטומטית בחשבון שלך.</p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "נרשם..." : "הרשם"}
      </button>
    </form>
  );
}
