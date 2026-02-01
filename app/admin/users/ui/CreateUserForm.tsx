"use client";

import { useState } from "react";
import Link from "next/link";

export default function CreateUserForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setOk(false);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email.trim(),
        password,
        phoneNumber: phoneNumber.trim() || undefined,
      }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "שגיאה");
      return;
    }
    setOk(true);
    setEmail("");
    setPassword("");
    setPhoneNumber("");
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4">
      <div>
        <label className="text-sm font-medium text-zinc-900">אימייל (שם משתמש)</label>
        <input
          dir="auto"
          className="field mt-1 w-full"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="customer@example.com"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-900">סיסמה (לפחות 8 תווים)</label>
        <input
          dir="auto"
          className="field mt-1 w-full"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="תן ללקוח — הוא יוכל לשנות בהגדרות"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-900">מספר טלפון (וואטסאפ)</label>
        <input
          dir="ltr"
          className="field mt-1 w-full"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="050-1234567"
        />
        <p className="mt-1 text-xs text-zinc-500">
          קבלות שהלקוח ישלח ממספר זה בוואטסאפ יישמרו אוטומטית בחשבון שלו בלבד.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {ok ? <p className="text-sm font-medium text-emerald-600">המשתמש נוצר. תן ללקוח את האימייל והסיסמה.</p> : null}
      <button type="submit" disabled={loading} className="btn btn-primary">
        {loading ? "יוצר..." : "צור משתמש"}
      </button>
    </form>
  );
}
