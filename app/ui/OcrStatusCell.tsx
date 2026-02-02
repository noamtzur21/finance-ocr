"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Status = "pending" | "success" | "failed";

function clsStatus(status: Status) {
  if (status === "success") return "text-emerald-700";
  if (status === "failed") return "text-red-700";
  return "text-zinc-700";
}

export default function OcrStatusCell(props: { docId: string; status: Status; errorMessage?: string | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(props.status);
  const [busy, setBusy] = useState(false);

  const label = useMemo(() => {
    if (status === "pending") return "pending";
    if (status === "success") return "success";
    return "failed";
  }, [status]);

  async function retry() {
    setBusy(true);
    try {
      const res = await fetch(`/api/documents/${props.docId}/retry-ocr`, { method: "POST" });
      if (res.ok) {
        setStatus("pending");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={clsStatus(status)}>{label}</span>

      {status === "pending" ? (
        <div className="h-2 w-20 overflow-hidden rounded-full bg-zinc-200/70">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-zinc-500/60" />
        </div>
      ) : null}

      {status === "failed" ? (
        <span className="flex flex-col items-start gap-0.5">
          {props.errorMessage ? (
            <span className="text-[10px] text-red-600 max-w-[180px] truncate" title={props.errorMessage}>
              {props.errorMessage}
            </span>
          ) : null}
          <button type="button" className="btn" title="נסה שוב OCR" disabled={busy} onClick={() => void retry()}>
            {busy ? "…" : "↻"}
          </button>
        </span>
      ) : null}
    </div>
  );
}

