"use client";

import { useEffect, useMemo, useState } from "react";

type CredentialRow = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
};

export default function CredentialsClient(props: { initial: CredentialRow[] }) {
  const [items, setItems] = useState<CredentialRow[]>(props.initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => (x.name + " " + x.email).toLowerCase().includes(q));
  }, [items, query]);

  // Allow server refresh (multi-device) to update UI
  useEffect(() => {
    setItems(props.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.initial)]);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/credentials");
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחתי לטעון");
      return;
    }
    setItems((await res.json()) as CredentialRow[]);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/credentials", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה");
      return;
    }
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    await load();
  }

  async function reveal(id: string) {
    const res = await fetch(`/api/credentials/${id}/reveal`);
    if (!res.ok) {
      setError("לא הצלחתי לחשוף סיסמה");
      return null;
    }
    const body = (await res.json()) as { password: string };
    return body.password;
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק את הרשומה הזו?")) return;
    const res = await fetch(`/api/credentials/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 sm:grid-cols-3">
        <div>
          <label className="text-sm font-medium">שם/שירות</label>
          <input
            className="field mt-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: iCount"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">אימייל</label>
          <input
            className="field mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium">סיסמה</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              className="field flex-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              required
            />
            <button type="button" className="btn" onClick={() => setShowPassword((s) => !s)} title="הצג/הסתר">
              {showPassword ? "🙈" : "👁"}
            </button>
          </div>
        </div>
        <div className="sm:col-span-3 flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-600">
            הסיסמה נשמרת מוצפנת (AES-256-GCM) ב-DB.
          </div>
          <button className="btn btn-primary" type="submit">
            הוסף
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3">
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם/אימייל…"
        />
        <button className="btn" type="button" onClick={load}>
          רענן
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-zinc-600">טוען…</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-zinc-600">
              <tr>
                <th className="px-3 py-2 text-right font-medium">שם</th>
                <th className="px-3 py-2 text-right font-medium">אימייל</th>
                <th className="px-3 py-2 text-right font-medium">סיסמה</th>
                <th className="px-3 py-2 text-right font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-center text-zinc-500" colSpan={4}>
                    אין רשומות
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <Row key={c.id} item={c} onReveal={reveal} onCopy={copy} onDelete={remove} onUpdated={load} />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row(props: {
  item: CredentialRow;
  onReveal: (id: string) => Promise<string | null>;
  onCopy: (text: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdated: () => Promise<void>;
}) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(props.item.name);
  const [editEmail, setEditEmail] = useState(props.item.email);
  const [editPassword, setEditPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);

  async function show() {
    setBusy(true);
    const p = await props.onReveal(props.item.id);
    setBusy(false);
    if (p != null) setRevealed(p);
  }

  async function copyPassword() {
    const p = revealed ?? (await props.onReveal(props.item.id));
    if (p) {
      setRevealed(p);
      await props.onCopy(p);
    }
  }

  function startEdit() {
    setEditing(true);
    setEditName(props.item.name);
    setEditEmail(props.item.email);
    setEditPassword("");
    setShowEditPassword(false);
  }

  async function saveEdit() {
    setBusy(true);
    const payload: Record<string, string> = {};
    const name = editName.trim();
    const email = editEmail.trim();
    if (name && name !== props.item.name) payload.name = name;
    if (email && email !== props.item.email) payload.email = email;
    if (editPassword.trim()) payload.password = editPassword;

    const res = await fetch(`/api/credentials/${props.item.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      setRevealed(null);
      await props.onUpdated();
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditName(props.item.name);
    setEditEmail(props.item.email);
    setEditPassword("");
    setShowEditPassword(false);
  }

  return (
    <tr className="border-t">
      <td className="px-3 py-2">
        {editing ? (
          <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
        ) : (
          props.item.name
        )}
      </td>
      <td className="px-3 py-2">
        {editing ? (
          <input className="field" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} type="email" />
        ) : (
          props.item.email
        )}
      </td>
      <td className="px-3 py-2 font-mono">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              className="field flex-1 font-mono"
              value={editPassword}
              onChange={(e) => setEditPassword(e.target.value)}
              type={showEditPassword ? "text" : "password"}
              placeholder="סיסמה חדשה (לא חובה)"
            />
            <button type="button" className="btn" onClick={() => setShowEditPassword((s) => !s)} title="הצג/הסתר">
              {showEditPassword ? "🙈" : "👁"}
            </button>
          </div>
        ) : revealed ? (
          revealed
        ) : (
          "••••••••"
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-wrap gap-2">
          {editing ? (
            <>
              <button type="button" className="btn btn-primary" onClick={() => void saveEdit()} disabled={busy}>
                {busy ? "שומר…" : "שמור"}
              </button>
              <button type="button" className="btn" onClick={cancelEdit} disabled={busy}>
                ביטול
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={startEdit} disabled={busy}>
                ערוך
              </button>
              <button type="button" className="btn" onClick={show} disabled={busy}>
                {busy ? "..." : "הצג"}
              </button>
              <button type="button" className="btn" onClick={copyPassword}>
                העתק סיסמה
              </button>
              <button type="button" className="btn" onClick={() => void props.onDelete(props.item.id)}>
                מחק
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}


