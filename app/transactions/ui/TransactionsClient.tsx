"use client";

import { useEffect, useMemo, useState } from "react";

type Category = { id: string; name: string };
type Row = {
  id: string;
  date: string;
  amount: string;
  currency: string;
  vendor: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  cardLast4: string | null;
  updatedAt: string;
};

export default function TransactionsClient(props: { categories: Category[]; initial: Row[] }) {
  const [items, setItems] = useState<Row[]>(props.initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => new Date(), []);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [vendor, setVendor] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cardLast4, setCardLast4] = useState("7374");

  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));

  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((x) => (x.vendor + " " + (x.description ?? "")).toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    setItems(props.initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(props.initial)]);

  async function reload() {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ limit: "200", year: filterYear, month: filterMonth });
    const res = await fetch(`/api/transactions?${qs.toString()}`);
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחתי לטעון");
      return;
    }
    setItems((await res.json()) as Row[]);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("בחר קטגוריה");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        date,
        amount,
        vendor,
        description: description || null,
        categoryId,
        currency: "ILS",
        cardLast4: cardLast4 || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "שגיאה");
      return;
    }
    setAmount("");
    setVendor("");
    setDescription("");
    // keep category + card as convenience
    await reload();
  }

  async function remove(id: string) {
    if (!confirm("למחוק תנועה?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) setItems((prev) => prev.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="grid gap-3 rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 lg:grid-cols-6">
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">תאריך</label>
          <input className="field mt-1" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">סכום</label>
          <input
            className="field mt-1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="למשל 89.90"
            required
          />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm font-medium">בית עסק</label>
          <input className="field mt-1" value={vendor} onChange={(e) => setVendor(e.target.value)} required />
        </div>
        <div className="lg:col-span-2">
          <label className="text-sm font-medium">הערה</label>
          <input className="field mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="lg:col-span-3">
          <label className="text-sm font-medium">קטגוריה</label>
          <select className="field mt-1" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="">בחר קטגוריה…</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-1">
          <label className="text-sm font-medium">כרטיס אשראי</label>
          <select className="field mt-1" value={cardLast4} onChange={(e) => setCardLast4(e.target.value)}>
            <option value="7374">•••• 7374 (ברירת מחדל)</option>
            <option value="5622">•••• 5622 (בהצדעה)</option>
            <option value="9537">•••• 9537 (חיוב מידי)</option>
            <option value="7539">•••• 7539 (עסקי)</option>
          </select>
        </div>
        <div className="lg:col-span-2 flex items-end justify-end gap-2">
          <button className="btn" type="button" onClick={reload} disabled={loading}>
            רענן
          </button>
          <button className="btn btn-primary disabled:opacity-60" type="submit" disabled={loading}>
            הוסף תנועה
          </button>
        </div>
      </form>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
        <div>
          <label className="text-sm font-medium">חיפוש חופשי</label>
          <input
            className="field mt-1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי בית עסק / הערה…"
          />
        </div>
        <div>
          <label className="text-sm font-medium">שנה</label>
          <select className="field mt-1" value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
            {Array.from({ length: 6 }, (_, i) => String(today.getFullYear() - i)).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">חודש</label>
          <select className="field mt-1" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => {
              const m = String(i + 1);
              return (
                <option key={m} value={m}>
                  {m.padStart(2, "0")}
                </option>
              );
            })}
          </select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button className="btn" type="button" onClick={reload} disabled={loading}>
            החל פילטר
          </button>
          <div className="text-sm text-zinc-600">
            סה״כ: <span className="font-semibold text-zinc-900">{filtered.length}</span>
          </div>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-zinc-600">טוען…</p> : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-700">
            <tr>
              <th className="px-3 py-2 text-right font-medium">תאריך</th>
              <th className="px-3 py-2 text-right font-medium">בית עסק</th>
              <th className="px-3 py-2 text-right font-medium">קטגוריה</th>
              <th className="px-3 py-2 text-right font-medium">סכום</th>
              <th className="px-3 py-2 text-right font-medium">כרטיס</th>
              <th className="px-3 py-2 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-12 text-center text-zinc-600" colSpan={6}>
                  אין תנועות. הוסף תנועה למעלה.
                </td>
              </tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 hover:bg-zinc-50/60">
                  <td className="px-3 py-2">{t.date}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-zinc-900">{t.vendor}</div>
                    {t.description ? <div className="mt-0.5 text-xs text-zinc-600">{t.description}</div> : null}
                  </td>
                  <td className="px-3 py-2">{t.categoryName ?? "—"}</td>
                  <td className="px-3 py-2">
                    {t.amount} <span className="text-xs text-zinc-600">{t.currency}</span>
                  </td>
                  <td className="px-3 py-2">{t.cardLast4 ? `•••• ${t.cardLast4}` : "—"}</td>
                  <td className="px-3 py-2">
                    <button className="btn" type="button" onClick={() => void remove(t.id)}>
                      מחק
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

