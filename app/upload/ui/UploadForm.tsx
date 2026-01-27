"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Category = { id: string; name: string };

export default function UploadForm(props: {
  categories: Category[];
  forcedType?: "expense" | "income";
  hideType?: boolean;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<"expense" | "income">(props.forcedType ?? "expense");
  const [categoryId, setCategoryId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveType = props.forcedType ?? type;
  const accept = useMemo(() => "image/*,application/pdf", []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError(null);

    const form = new FormData();
    form.append("file", file);
    form.append(
      "meta",
      JSON.stringify({
        type: effectiveType,
        categoryId: categoryId || null,
        description: description || null,
      }),
    );

    const res = await fetch("/api/documents/upload", { method: "POST", body: form });
    setLoading(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string; existingId?: string }
        | null;
      if (res.status === 409 && body?.existingId) {
        setError(`הקובץ כבר הועלה. מעבר למסמך: ${body.existingId}`);
        router.replace(`/documents/${body.existingId}`);
        return;
      }
      setError(body?.error ?? "שגיאת העלאה");
      return;
    }
    const body = (await res.json()) as { id: string };
    router.replace(`/documents/${body.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">קובץ (תמונה או PDF)</label>
        <input
          className="mt-1 block w-full"
          type="file"
          accept={accept}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {!props.hideType ? (
          <div>
            <label className="text-sm font-medium">סוג</label>
            <select
              className="field mt-1"
              value={type}
              onChange={(e) => setType(e.target.value as "expense" | "income")}
              disabled={Boolean(props.forcedType)}
            >
              <option value="expense">הוצאה</option>
              <option value="income">הכנסה</option>
            </select>
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}

        <div>
          <label className="text-sm font-medium">קטגוריה</label>
          <select
            className="field mt-1"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            <option value="">—</option>
            {props.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">הערה (אופציונלי)</label>
        <input
          className="field mt-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder='למשל: "מצלמה לעסק"'
        />
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        disabled={!file || loading}
        className="btn btn-primary disabled:opacity-60"
        type="submit"
      >
        {loading ? "מעלה ומנתח (OCR)..." : "העלה"}
      </button>
    </form>
  );
}


