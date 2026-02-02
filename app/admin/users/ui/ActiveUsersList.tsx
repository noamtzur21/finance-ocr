"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  phoneNumber: string | null;
  approved: boolean;
  createdAt: string;
};

export default function ActiveUsersList() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = (await res.json()) as { approved?: UserRow[] };
      setUsers(data.approved ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(u: UserRow) {
    if (!confirm(`למחוק את המשתמש ${u.email}? כל הנתונים שלו (מסמכים, קבלות וכו') יימחקו לצמיתות.`)) return;
    setDeleting(u.id);
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
      if (res.ok) await load();
      else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        alert(data?.error ?? "מחיקה נכשלה");
      }
    } finally {
      setDeleting(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">טוען...</p>;
  if (users.length === 0) return <p className="text-sm text-zinc-500">אין משתמשים פעילים (מלבדך).</p>;

  return (
    <ul className="space-y-2">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-white px-4 py-3">
          <div>
            <span className="font-medium text-zinc-900">{u.email}</span>
            {u.phoneNumber ? <span className="mr-2 text-sm text-zinc-600"> · {u.phoneNumber}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => remove(u)}
            disabled={deleting === u.id}
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
          >
            {deleting === u.id ? "מוחק..." : "מחק"}
          </button>
        </li>
      ))}
    </ul>
  );
}
