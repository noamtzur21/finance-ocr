"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [passkeyBusy, setPasskeyBusy] = useState(false);

  async function loginWithPasskey() {
    setError(null);
    setPasskeyBusy(true);
    try {
      const { startAuthentication } = await import("@simplewebauthn/browser");
      const optRes = await fetch("/api/auth/passkey/authentication/options", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() || null }),
      });
      if (!optRes.ok) {
        const body = (await optRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "לא הצלחתי להתחיל התחברות");
        return;
      }
      const options = (await optRes.json()) as unknown;
      const response = await startAuthentication(options as never);
      const verifyRes = await fetch("/api/auth/passkey/authentication/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ response }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "התחברות עם Passkey נכשלה");
        return;
      }
      router.replace("/dashboard");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg ? `Passkey: ${msg}` : "התחברות עם Face ID/Touch ID בוטלה או נכשלה");
    } finally {
      setPasskeyBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאת התחברות");
      return;
    }
    router.replace("/dashboard");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <button
        type="button"
        onClick={() => void loginWithPasskey()}
        disabled={passkeyBusy || loading}
        className="w-full rounded-xl border border-zinc-200 bg-white py-2 text-zinc-900 disabled:opacity-60"
      >
        {passkeyBusy ? "פותח Face ID/Touch ID…" : "התחבר עם Face ID / Touch ID"}
      </button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <div className="text-xs text-zinc-500">או עם סיסמה</div>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

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
        <label className="text-sm font-medium text-zinc-950">סיסמה</label>
        <input
          dir="auto"
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2 font-medium text-black caret-black placeholder:font-normal placeholder:text-zinc-400 outline-none focus:ring-2 focus:ring-black/10"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={loading}
        className="w-full rounded-xl bg-black py-2 text-white disabled:opacity-60"
        type="submit"
      >
        {loading ? "מתחבר..." : "התחבר"}
      </button>
    </form>
  );
}


