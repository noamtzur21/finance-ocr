"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSent(false);
    setResetLink(null);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; resetLink?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "שגיאה");
      return;
    }
    setSent(true);
    if (data?.resetLink) setResetLink(data.resetLink);
  }

  if (sent) {
    return (
      <div className="space-y-3 text-sm text-zinc-700">
        <p>אם האימייל רשום במערכת, נשלח אליך קישור לאיפוס סיסמה.</p>
        {resetLink ? (
          <p className="break-all rounded border border-zinc-200 bg-zinc-50 p-2 text-xs">
            קישור לאיפוס (אם לא קיבלת אימייל, העתק והדבק):{" "}
            <a href={resetLink} className="text-blue-600 underline">
              {resetLink}
            </a>
          </p>
        ) : null}
        <Link href="/login" className="block text-center font-medium text-zinc-900 underline">
          חזרה להתחברות
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
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "שולח..." : "שלח קישור לאיפוס"}
      </button>
    </form>
  );
}
