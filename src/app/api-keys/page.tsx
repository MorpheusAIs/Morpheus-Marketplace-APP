"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Trash2,
  Plus,
  Pencil,
  X,
  Copy,
  Check,
  Star,
  Search,
  MoreVertical,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import { apiPost, apiDelete, apiPut } from "@/lib/api/apiService";
import { formatLocaleDate, ensureUTCTimestamp } from "@/lib/utils/billing-utils";
import { API_URLS, DOC_URLS } from "@/lib/api/config";
import { useNotification } from "@/lib/NotificationContext";
import { CreateApiKeyDialog } from "@/components/create-api-key-dialog";
import { NewApiKeyModal } from "@/components/new-api-key-modal";
import { VerifyApiKeyModal } from "@/components/verify-api-key-modal";
import { useBillingTransactionsAll } from "@/lib/hooks/use-billing";
import { useNetworkStatus } from "@/components/network-status/use-network-status";
import { NetworkStatusDot } from "@/components/network-status/network-status-dot";
import { QuickStart } from "@/components/api-keys/quick-start";
import {
  aggregateKeyStats,
  formatRelativeTime,
  type KeyStats,
} from "@/components/api-keys/key-stats";
import { cn } from "@/lib/utils";

interface ApiKeyResponse {
  key: string;
  key_prefix: string;
  name: string;
}

type FilterTab = "all" | "active" | "stale" | "revoked";

function formatCreated(dateString: string): string {
  const date = new Date(ensureUTCTimestamp(dateString));
  const now = new Date();
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.floor(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatLocaleDate(date);
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function formatCurrency(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return `$${n.toFixed(2)}`;
}

function ApiKeysPageContent() {
  const { apiKeys, refreshApiKeys, defaultApiKey, getValidToken } = useCognitoAuth();
  const { success, error, warning } = useNotification();
  const searchParams = useSearchParams();
  const network = useNetworkStatus();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [selectedKeyPrefix, setSelectedKeyPrefix] = useState<string>("");
  const [isEditingDefaultKey, setIsEditingDefaultKey] = useState(false);
  const [pendingDefaultKeyId, setPendingDefaultKeyId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<{ id: number; name: string; isDefault: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<FilterTab>("all");
  const [copiedBase, setCopiedBase] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;

  // 30-day window for per-key stats
  const fromIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString();
  }, []);
  const { data: ledger } = useBillingTransactionsAll({ from: fromIso });
  const statsByKey = useMemo<Map<number, KeyStats>>(
    () => aggregateKeyStats(ledger?.items ?? []),
    [ledger],
  );

  const baseUrl = useMemo(() => DOC_URLS.baseAPI(), []);

  useEffect(() => {
    if (searchParams.get("create") === "true") {
      setIsCreateDialogOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    let mounted = true;
    const validateSession = async () => {
      if (!mounted) return;
      await getValidToken();
    };
    void validateSession();
    const intervalId = window.setInterval(() => void validateSession(), 60_000);
    const onFocus = () => void validateSession();
    const onVis = () => {
      if (document.visibilityState === "visible") void validateSession();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [getValidToken]);

  const activeApiKeys = apiKeys.filter((k) => k.is_active);
  const currentDefaultKey =
    activeApiKeys.find((k) => k.is_default) ?? defaultApiKey ?? null;

  // ---- derived: rows with stats and bucket ----
  const rows = useMemo(() => {
    return apiKeys.map((k) => {
      const stats = statsByKey.get(k.id) ?? {
        requests: 0,
        spend: 0,
        lastUsedAt: null as string | null,
      };
      let bucket: FilterTab = "active";
      if (!k.is_active) bucket = "revoked";
      else if (stats.requests === 0) bucket = "stale";
      return { key: k, stats, bucket };
    });
  }, [apiKeys, statsByKey]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, stale: 0, revoked: 0 };
    for (const r of rows) {
      c[r.bucket] += 1;
      if (r.bucket !== "revoked") c.all += 1;
    }
    return c;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      // "All" hides revoked keys; pick the dedicated Revoked tab to see them.
      if (tab === "all" && r.bucket === "revoked") return false;
      if (tab !== "all" && r.bucket !== tab) return false;
      if (!q) return true;
      const nameHit = (r.key.name || "").toLowerCase().includes(q);
      const last4 = r.key.key_prefix.slice(-4).toLowerCase();
      return nameHit || last4.includes(q);
    });
    // Default key pinned to the top; then most-recently-used; then most
    // requests; revoked keys fall to the bottom of their tab.
    return filtered.sort((a, b) => {
      const aDefault = a.key.is_default || a.key.id === defaultApiKey?.id;
      const bDefault = b.key.is_default || b.key.id === defaultApiKey?.id;
      if (aDefault !== bDefault) return aDefault ? -1 : 1;
      if (a.key.is_active !== b.key.is_active) return a.key.is_active ? -1 : 1;
      const aTime = a.stats.lastUsedAt ? new Date(a.stats.lastUsedAt).getTime() : 0;
      const bTime = b.stats.lastUsedAt ? new Date(b.stats.lastUsedAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      if (a.stats.requests !== b.stats.requests) return b.stats.requests - a.stats.requests;
      return new Date(b.key.created_at).getTime() - new Date(a.key.created_at).getTime();
    });
  }, [rows, tab, search, defaultApiKey]);

  // Pagination — reset to first page whenever the filter set shrinks/changes
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  useEffect(() => {
    setPage(0);
  }, [tab, search]);
  useEffect(() => {
    if (page >= pageCount) setPage(pageCount - 1);
  }, [page, pageCount]);
  const visibleRows = useMemo(
    () => filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filteredRows, page],
  );

  // ---- handlers (preserved from the previous implementation) ----
  const handleCreateKey = async (name: string) => {
    const token = await getValidToken();
    if (!token) {
      error("Authentication Required", "Please sign in to create API keys");
      return;
    }
    try {
      const response = await apiPost<ApiKeyResponse>(API_URLS.keys(), { name }, token);
      if (response.error) throw new Error(response.error);
      if (response.data && response.data.key) {
        setNewlyCreatedKey(response.data.key);
        setIsCreateDialogOpen(false);
        setIsNewKeyModalOpen(true);
        await refreshApiKeys();
        success("API Key Created", `Your API key "${name}" has been created successfully.`);
      }
    } catch (err) {
      error("Failed to Create API Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDeleteClick = (keyId: number, keyName: string) => {
    const k = apiKeys.find((x) => x.id === keyId);
    const isDefaultKey = k?.is_default || keyId === defaultApiKey?.id || false;
    setKeyToDelete({ id: keyId, name: keyName, isDefault: isDefaultKey });
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!keyToDelete) return;
    const token = await getValidToken();
    if (!token) {
      error("Authentication Required", "Please sign in to delete keys");
      return;
    }
    const wasDefault = keyToDelete.isDefault;
    const remaining = activeApiKeys.filter((k) => k.id !== keyToDelete.id);
    try {
      const response = await apiDelete(API_URLS.deleteKey(keyToDelete.id), token);
      if (response.error) throw new Error(response.error);
      if (wasDefault || remaining.length === 0) {
        sessionStorage.removeItem("verified_api_key");
        sessionStorage.removeItem("verified_api_key_prefix");
        sessionStorage.removeItem("verified_api_key_timestamp");
        sessionStorage.removeItem("verified_api_key_name");
        localStorage.removeItem("selected_api_key_prefix");
      }
      await refreshApiKeys();
      if (wasDefault) {
        if (remaining.length > 0) {
          warning(
            "Default API Key Changed",
            `"${keyToDelete.name}" was deleted. Another key has been set as your default. You will need to verify it before using the API.`,
            { duration: 8000 },
          );
        } else {
          warning(
            "Default API Key Deleted",
            "You've deleted your default API key. Please create a new key to continue using the API.",
            { duration: 8000 },
          );
        }
      } else {
        success("API Key Deleted", `The API key "${keyToDelete.name}" has been deleted.`);
      }
      setShowDeleteDialog(false);
      setKeyToDelete(null);
    } catch (err) {
      error("Failed to Delete Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const cancelDelete = () => {
    setShowDeleteDialog(false);
    setKeyToDelete(null);
  };

  const handleVerifySuccess = async () => {
    setIsVerifyModalOpen(false);
    setSelectedKeyPrefix("");
    if (pendingDefaultKeyId !== null) {
      const pendingKey = apiKeys.find((k) => k.id === pendingDefaultKeyId);
      if (pendingKey) await handleSetDefaultKey(pendingKey.id, pendingKey.name);
      setPendingDefaultKeyId(null);
    } else {
      success("API Key Verified", "Your API key has been verified. You can now use the Test feature.");
    }
  };

  const handleSetDefaultKey = async (keyId: number, keyName: string) => {
    const token = await getValidToken();
    if (!token) {
      error("Authentication Required", "Please sign in to set default key");
      return;
    }
    try {
      const response = await apiPut(API_URLS.setDefaultKey(keyId), {}, token);
      if (response.error) throw new Error(response.error);
      await refreshApiKeys();
      setIsEditingDefaultKey(false);
      success("Default API Key Updated", `"${keyName}" is now your default API key and has been verified.`);
    } catch (err) {
      error("Failed to Set Default Key", err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handleDefaultKeyChange = (keyId: string) => {
    const selected = apiKeys.find((k) => k.id.toString() === keyId);
    if (selected && selected.id !== currentDefaultKey?.id) {
      setPendingDefaultKeyId(selected.id);
      setSelectedKeyPrefix(selected.key_prefix);
      setIsEditingDefaultKey(false);
      setIsVerifyModalOpen(true);
    } else {
      setIsEditingDefaultKey(false);
    }
  };

  const handleStarClick = (keyId: number, keyName: string, currentlyDefault: boolean) => {
    if (currentlyDefault) return;
    setPendingDefaultKeyId(keyId);
    const k = apiKeys.find((x) => x.id === keyId);
    if (k) {
      setSelectedKeyPrefix(k.key_prefix);
      setIsVerifyModalOpen(true);
    } else {
      handleSetDefaultKey(keyId, keyName);
    }
  };

  const handleCopyBase = async () => {
    try {
      await navigator.clipboard.writeText(baseUrl);
      setCopiedBase(true);
      setTimeout(() => setCopiedBase(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">API keys</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-2">
              Authenticate requests to the Morpheus inference API.{" "}
              <a
                href="https://apidocs.mor.org?utm_source=api-admin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                Read the docs <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </p>
          </div>
          <Button
            variant="default"
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shrink-0"
          >
            <Plus className="h-4 w-4" />
            Create key
          </Button>
        </div>

        {/* Base URL + Quick start */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded border border-border bg-card p-4 flex flex-col gap-3">
            <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              Base URL
            </span>
            <div className="flex items-center gap-2 rounded border border-border bg-background p-2">
              <code className="flex-1 self-center px-2 font-mono text-sm text-foreground truncate">
                {baseUrl}
              </code>
              <button
                type="button"
                onClick={handleCopyBase}
                aria-label="Copy base URL"
                className="inline-flex items-center justify-center h-7 w-7 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/10 transition-colors shrink-0"
              >
                {copiedBase ? (
                  <Check className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                OpenAI-compatible
              </span>
              <span className="inline-flex items-center gap-1.5">
                {network ? (
                  <NetworkStatusDot level={network.status} className="h-1.5 w-1.5" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                )}
                {network?.label ?? "Status unknown"}
              </span>
            </div>
          </div>
          <QuickStart baseUrl={baseUrl} />
        </div>

        {/* Keys table card */}
        <div className="rounded border border-border bg-card">
          {/* Search + filter tabs */}
          <div className="flex flex-col md:flex-row md:items-center gap-3 p-4 border-b border-border">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or last-4..."
                className="pl-9 h-9 bg-background border-border"
              />
            </div>
            <div className="inline-flex items-center gap-0.5 rounded border border-border bg-background p-0.5 self-start md:self-auto">
              {(["all", "active", "stale", "revoked"] as const).map((t) => {
                const c = counts[t];
                const showCount = (t === "stale" || t === "revoked") && c > 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={cn(
                      "h-7 px-3 text-xs rounded capitalize transition-colors",
                      tab === t
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t}
                    {showCount && <span className="ml-1 text-muted-foreground/70">· {c}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 border-b border-border text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
              <div>Name</div>
              <div>Key</div>
              <div>Created</div>
              <div>Last used</div>
              <div>Requests · 30D</div>
              <div>Spend · 30D</div>
              <div />
            </div>
            {visibleRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {apiKeys.length === 0
                  ? "No API keys yet. Create your first key above."
                  : "No keys match the current filter."}
              </div>
            ) : (
              visibleRows.map(({ key, stats }) => {
                const isDefault =
                  key.is_default || key.id === defaultApiKey?.id;
                return (
                  <div
                    key={key.id}
                    className="grid grid-cols-[1.6fr_1.1fr_1fr_1fr_1fr_1fr_40px] gap-4 px-4 py-3 border-b border-border/60 last:border-b-0 items-center text-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-foreground truncate">{key.name}</span>
                      {isDefault && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">
                          Default
                        </Badge>
                      )}
                      {!key.is_active && (
                        <Badge variant="outline" className="text-[10px] border-border text-muted-foreground shrink-0">
                          Revoked
                        </Badge>
                      )}
                    </div>
                    <code className="font-mono text-xs text-muted-foreground truncate">
                      {key.key_prefix}…
                    </code>
                    <div className="text-muted-foreground">
                      {formatCreated(key.created_at)}
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          stats.lastUsedAt
                            ? "bg-primary"
                            : "bg-amber-400",
                        )}
                      />
                      {formatRelativeTime(stats.lastUsedAt)}
                    </div>
                    <div className="font-mono tabular-nums text-foreground">
                      {formatNumber(stats.requests)}
                    </div>
                    <div className="font-mono tabular-nums text-foreground">
                      {formatCurrency(stats.spend)}
                    </div>
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
                            aria-label="Key actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          {!isDefault && key.is_active && (
                            <DropdownMenuItem
                              onClick={() => handleStarClick(key.id, key.name, false)}
                            >
                              <Star className="mr-2 h-3.5 w-3.5" /> Set as default
                            </DropdownMenuItem>
                          )}
                          {!isDefault && key.is_active && <DropdownMenuSeparator />}
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(key.id, key.name)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mobile card view */}
          <div className="md:hidden divide-y divide-border">
            {visibleRows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                {apiKeys.length === 0
                  ? "No API keys yet. Create your first key above."
                  : "No keys match the current filter."}
              </div>
            ) : (
              visibleRows.map(({ key, stats }) => {
                const isDefault =
                  key.is_default || key.id === defaultApiKey?.id;
                return (
                  <div key={key.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-foreground font-medium truncate">
                          {key.name}
                        </span>
                        {isDefault && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] shrink-0">
                            Default
                          </Badge>
                        )}
                        {!key.is_active && (
                          <Badge variant="outline" className="text-[10px] border-border text-muted-foreground shrink-0">
                            Revoked
                          </Badge>
                        )}
                      </div>
                      <code className="font-mono text-xs text-muted-foreground shrink-0">
                        {key.key_prefix}…
                      </code>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-muted-foreground">Created</div>
                        <div className="text-foreground">{formatCreated(key.created_at)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Last used</div>
                        <div className="text-foreground">
                          {formatRelativeTime(stats.lastUsedAt)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Requests · 30d</div>
                        <div className="text-foreground font-mono">
                          {formatNumber(stats.requests)}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Spend · 30d</div>
                        <div className="text-foreground font-mono">
                          {formatCurrency(stats.spend)}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteClick(key.id, key.name)}
                      className="w-full text-destructive border-border hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          {filteredRows.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border text-xs text-muted-foreground">
              <span>
                Showing{" "}
                <span className="text-foreground font-medium">
                  {page * PAGE_SIZE + 1}
                  &ndash;
                  {Math.min((page + 1) * PAGE_SIZE, filteredRows.length)}
                </span>{" "}
                of{" "}
                <span className="text-foreground font-medium">
                  {filteredRows.length}
                </span>
              </span>
              <div className="inline-flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2 tabular-nums">
                  {page + 1} / {pageCount}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={page >= pageCount - 1}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* Footer: default-key selector + reveal-once note */}
          <div className="border-t border-border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-xs text-muted-foreground">
              Keys are shown in full only once at creation. Store them in a secrets manager.
            </p>
            <div className="flex items-center gap-2 self-end md:self-auto">
              <span className="text-xs text-muted-foreground">Default API key:</span>
              {isEditingDefaultKey ? (
                <>
                  <Select
                    value={currentDefaultKey?.id.toString() || ""}
                    onValueChange={handleDefaultKeyChange}
                  >
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Select API key" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeApiKeys.map((k) => (
                        <SelectItem key={k.id} value={k.id.toString()}>
                          {k.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingDefaultKey(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  {currentDefaultKey ? (
                    <span className="inline-flex items-center gap-1.5 h-9 px-3 text-sm border border-border rounded bg-background">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      {currentDefaultKey.name}
                    </span>
                  ) : (
                    <span className="h-9 px-3 text-sm text-muted-foreground border border-input rounded bg-background flex items-center">
                      No default key
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                    onClick={() => setIsEditingDefaultKey(true)}
                    disabled={activeApiKeys.length === 0}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateApiKeyDialog
        open={isCreateDialogOpen}
        onOpenChangeAction={setIsCreateDialogOpen}
        onCreateAction={handleCreateKey}
        existingApiKeys={activeApiKeys}
      />

      <NewApiKeyModal
        open={isNewKeyModalOpen}
        onOpenChange={setIsNewKeyModalOpen}
        apiKey={newlyCreatedKey || ""}
      />

      <VerifyApiKeyModal
        open={isVerifyModalOpen}
        onOpenChangeAction={(open) => {
          setIsVerifyModalOpen(open);
          if (!open && pendingDefaultKeyId !== null) {
            setPendingDefaultKeyId(null);
            setIsEditingDefaultKey(false);
          }
        }}
        keyPrefix={selectedKeyPrefix}
        keyName={apiKeys.find((k) => k.key_prefix === selectedKeyPrefix)?.name}
        onVerifySuccessAction={handleVerifySuccess}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete API Key</AlertDialogTitle>
            <AlertDialogDescription>
              {keyToDelete?.isDefault ? (
                <>
                  <span className="font-semibold text-yellow-600 dark:text-yellow-500">
                    Warning:
                  </span>{" "}
                  You are about to delete your{" "}
                  <span className="font-semibold">default API key</span> &quot;
                  {keyToDelete?.name}&quot;.
                  <br />
                  <br />
                  {activeApiKeys.length > 1
                    ? "If you have other keys, one will be automatically promoted to default. You'll need to verify the new default key before using it."
                    : "After deletion, you will need to create and set a new default API key to continue using the API."}{" "}
                  This action cannot be undone.
                </>
              ) : (
                <>
                  Are you sure you want to delete the API key &quot;{keyToDelete?.name}&quot;?
                  This action cannot be undone.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {keyToDelete?.isDefault ? "Delete Default Key" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AuthenticatedLayout>
  );
}

export default function ApiKeysPage() {
  return (
    <Suspense>
      <ApiKeysPageContent />
    </Suspense>
  );
}
