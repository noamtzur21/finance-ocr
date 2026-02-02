"use client";

import { useEffect, useState } from "react";

type UserRow = {
  id: string;
  email: string;
  phoneNumber: string | null;
  approved: boolean;
  createdAt: string;
};

export default function PendingApprovalList() {
  const [pending, setPending] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) return;
      const data = (await res.json()) as { pending?: UserRow[] };
      setPending(data.pending ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: string) {
    setApproving(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "PATCH" });
      if (res.ok) await load();
    } finally {
      setApproving(null);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">טוען...</p>;
  if (pending.length === 0) return <p className="text-sm text-zinc-500">אין ממתינים לאישור.</p>;

  return (
    <ul className="space-y-2">
      {pending.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-3">
          <div>
            <span className="font-medium text-zinc-900">{u.email}</span>
            {u.phoneNumber ? <span className="mr-2 text-sm text-zinc-600"> · {u.phoneNumber}</span> : null}
          </div>
          <button
            type="button"
            onClick={() => approve(u.id)}
            disabled={approving === u.id}
            className="btn btn-primary text-sm disabled:opacity-60"
          >
            {approving === u.id ? "מאשר..." : "אישור"}
          </button>
        </li>
      ))}
    </ul>
  );
}
