"use client";

import { useMemo, useState } from "react";

export default function BudgetClient(props: {
  month: string;
  initialLimit: string;
  spent: string;
}) {
  const [limit, setLimit] = useState(props.initialLimit);
  const [loading, setLoading] = useState(false);
  const spentNum = useMemo(() => Number(props.spent) || 0, [props.spent]);
  const limitNum = useMemo(() => Number(limit) || 0, [limit]);

  const pct = limitNum > 0 ? Math.min(100, Math.round((spentNum / limitNum) * 100)) : 0;

  async function save() {
    setLoading(true);
    await fetch("/api/budget", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ month: props.month, expenseLimit: limit }),
    });
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-zinc-600">חודש: {props.month}</div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card card-soft p-4">
          <div className="text-sm text-zinc-600">הוצאות החודש</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            {spentNum.toFixed(2)}
          </div>
        </div>
        <div className="card card-soft p-4">
          <div className="text-sm text-zinc-600">מגבלת הוצאות</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            {limitNum ? limitNum.toFixed(2) : "—"}
          </div>
        </div>
      </div>

      {limitNum > 0 ? (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span>התקדמות</span>
            <span className={pct >= 100 ? "text-red-700" : pct >= 80 ? "text-amber-700" : "text-zinc-700"}>
              {pct}%
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-200">
            <div
              className={`h-full ${pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="text-sm font-medium">עדכן מגבלת הוצאות לחודש</label>
          <input
            className="field mt-1"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            inputMode="decimal"
            placeholder="למשל 6000"
          />
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={save}
          className="btn btn-primary disabled:opacity-60"
        >
          {loading ? "שומר..." : "שמור"}
        </button>
      </div>
    </div>
  );
}


