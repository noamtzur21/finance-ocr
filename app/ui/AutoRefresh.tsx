"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AutoRefresh(props: { intervalMs?: number }) {
  const router = useRouter();
  const intervalMs = props.intervalMs ?? 4000;

  useEffect(() => {
    if (!Number.isFinite(intervalMs) || intervalMs < 1000) return;
    let alive = true;
    const id = setInterval(() => {
      if (!alive) return;
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    }, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs, router]);

  return null;
}

