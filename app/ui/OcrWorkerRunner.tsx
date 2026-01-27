"use client";

import { useEffect } from "react";

export default function OcrWorkerRunner(props: { intervalMs?: number }) {
  const intervalMs = props.intervalMs ?? 2000;

  useEffect(() => {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) return;
    let alive = true;
    const id = setInterval(() => {
      if (!alive) return;
      if (typeof document !== "undefined" && document.hidden) return;
      // Fire-and-forget kick
      void fetch("/api/worker/ocr", { method: "POST" }).catch(() => {});
    }, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return null;
}

