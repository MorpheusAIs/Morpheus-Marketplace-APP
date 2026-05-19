"use client";

import { cn } from "@/lib/utils";
import type { NetworkStatusLevel } from "@/app/api/status/route";

const COLOR_BY_LEVEL: Record<NetworkStatusLevel, string> = {
  operational: "bg-primary shadow-[0_0_6px_hsl(var(--primary))]",
  degraded: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  outage: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  maintenance: "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.6)]",
  unknown: "bg-muted-foreground/60",
};

export function NetworkStatusDot({
  level,
  className,
}: {
  level: NetworkStatusLevel;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-2 w-2 rounded-full transition-colors",
        COLOR_BY_LEVEL[level],
        className,
      )}
    />
  );
}
