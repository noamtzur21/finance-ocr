"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LiveRefresh(props: { url?: string }) {
  const router = useRouter();
  const url = props.url ?? "/api/stream/events";

  useEffect(() => {
    const es = new EventSource(url);
    const onChanged = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      router.refresh();
    };
    es.addEventListener("changed", onChanged);
    return () => {
      es.removeEventListener("changed", onChanged);
      es.close();
    };
  }, [router, url]);

  return null;
}

