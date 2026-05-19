"use client";

import { useEffect, useState } from "react";
import type { NetworkStatusPayload } from "@/app/api/status/route";

const POLL_MS = 60_000;

export function useNetworkStatus(): NetworkStatusPayload | null {
  const [status, setStatus] = useState<NetworkStatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as NetworkStatusPayload;
        if (!cancelled) setStatus(data);
      } catch {
        /* swallow — keep last known status */
      }
    };

    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return status;
}
