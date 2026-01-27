"use client";

import { useEffect, useState } from "react";

type Category = { id: string; name: string };

export default function CategoriesClient(props: { initial: Category[] }) {
  const [items, setItems] = useState<Category[]>(props.initial);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allow server refresh (multi-device) to update UI
  useEffect(() => {
    setItems(props.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.initial)]);

  async function create() {
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    const res = await fetch("/api/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה");
      return;
    }
    const body = (await res.json()) as Category;
    setItems((prev) => [...prev, body].sort((a, b) => a.name.localeCompare(b.name, "he")));
    setName("");
  }

  async function remove(id: string) {
    if (!confirm("למחוק קטגוריה?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="שם קטגוריה חדשה"
        />
        <button
          type="button"
          onClick={create}
          disabled={loading || !name.trim()}
          className="btn btn-primary disabled:opacity-60"
        >
          הוסף
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <ul className="divide-y rounded-xl border border-zinc-200/70 bg-white">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm">{c.name}</span>
            <button
              type="button"
              onClick={() => remove(c.id)}
              className="btn"
            >
              מחק
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}


