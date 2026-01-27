"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

type Doc = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: string;
  vendor: string;
  categoryId: string | null;
  description: string | null;
  docNumber: string | null;
  fileName: string;
  fileMime: string;
  fileUrl: string;
  ocrStatus: "pending" | "success" | "failed";
};

type Category = { id: string; name: string };

export default function DocumentEditor(props: { categories: Category[]; defaultBackHref: string }) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const id = params.id;

  const [doc, setDoc] = useState<Doc | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPdf = useMemo(() => doc?.fileMime === "application/pdf", [doc?.fileMime]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/documents/${id}`);
    setLoading(false);
    if (!res.ok) {
      setError("לא הצלחתי לטעון את המסמך");
      return;
    }
    setDoc((await res.json()) as Doc);
  }, [id]);

  useEffect(() => {
    // We intentionally fetch on mount; this updates component state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Live sync: refresh when this document changes (multi-device)
  useEffect(() => {
    const es = new EventSource(`/api/stream/documents?docId=${encodeURIComponent(String(id))}`);
    const onChanged = () => {
      if (saving) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void load();
    };
    es.addEventListener("changed", onChanged);
    es.onerror = () => {
      // ignore
    };
    return () => {
      es.removeEventListener("changed", onChanged);
      es.close();
    };
  }, [id, load, saving]);

  async function savePatch(patch: Partial<Doc>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    if (!res.ok) {
      setError("שמירה נכשלה");
      return;
    }
    await load();
  }

  async function del() {
    if (!confirm("מחיקה לצמיתות? אי אפשר לשחזר.")) return;
    const confirmText = prompt('הקלד DELETE כדי לאשר מחיקה לצמיתות');
    if (confirmText !== "DELETE") return;
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      const from = sp?.get("from");
      if (from === "receipts") router.replace("/receipts");
      else if (from === "invoices") router.replace("/invoices");
      else router.replace(props.defaultBackHref || "/dashboard");
    }
  }

  if (loading) return <div className="text-sm text-zinc-600">טוען…</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!doc) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">{doc.fileName}</div>
          <div className="text-xs text-zinc-600">OCR: {doc.ocrStatus}</div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-zinc-50">
          {isPdf ? (
            <iframe className="h-[70vh] w-full" src={doc.fileUrl} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="w-full object-contain" src={doc.fileUrl} alt={doc.fileName} />
          )}
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-900">פרטים</div>
          <button
            type="button"
            onClick={del}
            className="btn"
          >
            מחיקה
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">סוג</label>
              <select
                className="field mt-1"
                value={doc.type}
                onChange={(e) => {
                  const type = e.target.value as Doc["type"];
                  setDoc({ ...doc, type });
                  void savePatch({ type });
                }}
                disabled={saving}
              >
                <option value="expense">הוצאה</option>
                <option value="income">הכנסה</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">תאריך</label>
              <input
                className="field mt-1"
                type="date"
                value={doc.date}
                onChange={(e) => {
                  const date = e.target.value;
                  setDoc({ ...doc, date });
                  void savePatch({ date });
                }}
                disabled={saving}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">סכום</label>
              <input
                className="field mt-1"
                value={doc.amount}
                onChange={(e) => setDoc({ ...doc, amount: e.target.value })}
                onBlur={() => void savePatch({ amount: doc.amount })}
                inputMode="decimal"
                disabled={saving}
              />
            </div>
            <div>
              <label className="text-sm font-medium">ספק</label>
              <input
                className="field mt-1"
                value={doc.vendor}
                onChange={(e) => setDoc({ ...doc, vendor: e.target.value })}
                onBlur={() => void savePatch({ vendor: doc.vendor })}
                disabled={saving}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">קטגוריה</label>
            <select
              className="field mt-1"
              value={doc.categoryId ?? ""}
              onChange={(e) => {
                const categoryId = e.target.value || null;
                setDoc({ ...doc, categoryId });
                void savePatch({ categoryId });
              }}
              disabled={saving}
            >
              <option value="">—</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">מספר מסמך (אופציונלי)</label>
            <input
              className="field mt-1"
              value={doc.docNumber ?? ""}
              onChange={(e) => setDoc({ ...doc, docNumber: e.target.value || null })}
              onBlur={() => void savePatch({ docNumber: doc.docNumber })}
              disabled={saving}
            />
          </div>

          <div>
            <label className="text-sm font-medium">הערה (אופציונלי)</label>
            <input
              className="field mt-1"
              value={doc.description ?? ""}
              onChange={(e) => setDoc({ ...doc, description: e.target.value || null })}
              onBlur={() => void savePatch({ description: doc.description })}
              disabled={saving}
            />
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}


