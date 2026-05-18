import type { LedgerEntryResponse } from "@/types/billing";

export interface KeyStats {
  requests: number;
  spend: number;
  lastUsedAt: string | null;
}

const USAGE_ENTRY_TYPES = new Set(["usage_charge", "usage_hold"]);

/**
 * Aggregate per-API-key stats from the ledger over the supplied window.
 * Only usage_charge / usage_hold entries count toward requests + spend;
 * lastUsedAt tracks the most recent usage entry timestamp.
 */
export function aggregateKeyStats(
  entries: LedgerEntryResponse[],
): Map<number, KeyStats> {
  const stats = new Map<number, KeyStats>();
  for (const entry of entries) {
    if (entry.api_key_id == null) continue;
    if (!USAGE_ENTRY_TYPES.has(entry.entry_type)) continue;

    const current = stats.get(entry.api_key_id) ?? {
      requests: 0,
      spend: 0,
      lastUsedAt: null,
    };
    current.requests += 1;
    current.spend += Math.abs(parseFloat(entry.amount_total) || 0);
    if (
      !current.lastUsedAt ||
      new Date(entry.created_at) > new Date(current.lastUsedAt)
    ) {
      current.lastUsedAt = entry.created_at;
    }
    stats.set(entry.api_key_id, current);
  }
  return stats;
}

/** Render relative-time labels like "2 min ago", "6 hours ago", "3 days ago", "Never". */
export function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMs = now - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "just now";
  if (diffMs < hour) {
    const m = Math.floor(diffMs / minute);
    return `${m} min ago`;
  }
  if (diffMs < day) {
    const h = Math.floor(diffMs / hour);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const d = Math.floor(diffMs / day);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const months = Math.floor(d / 30);
  if (months < 12) return `${months} mo ago`;
  const years = Math.floor(months / 12);
  return `${years} yr ago`;
}
