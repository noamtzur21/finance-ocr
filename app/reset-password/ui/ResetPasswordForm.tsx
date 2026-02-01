"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("הסיסמאות לא תואמות");
      return;
    }
    if (newPassword.length < 8) {
      setError("סיסמה לפחות 8 תווים");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    setLoading(false);
    if (!res.ok) {
      setError(data?.error ?? "שגיאה באיפוס");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <label className="text-sm font-medium text-zinc-950">סיסמה חדשה</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-zinc-950">אימות סיסמה</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "מעדכן..." : "עדכן סיסמה"}
      </button>
    </form>
  );
}
