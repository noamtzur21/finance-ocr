"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function LiveRefresh(props: { url?: string }) {
  const router = useRouter();
  const url = props.url ?? "/api/stream/events";
  const lastRefreshAt = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let stopped = false;

    const scheduleRefresh = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const now = Date.now();
      const since = now - lastRefreshAt.current;
      const minGap = 1500;
      if (since >= minGap) {
        lastRefreshAt.current = now;
        router.refresh();
        return;
      }
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        if (typeof document !== "undefined" && document.hidden) return;
        lastRefreshAt.current = Date.now();
        router.refresh();
      }, minGap - since);
    };

    const connect = () => {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) return;
      es?.close();
      es = new EventSource(url);
      es.addEventListener("changed", scheduleRefresh);
    };

    const onVis = () => {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        es?.close();
        es = null;
      } else {
        connect();
      }
    };

    connect();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }

    return () => {
      stopped = true;
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      es?.close();
      es = null;
    };
  }, [router, url]);

  return null;
}

