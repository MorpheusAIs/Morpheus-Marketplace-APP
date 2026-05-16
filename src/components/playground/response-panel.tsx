"use client";

import React, { useState } from "react";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface ResponseMetrics {
  latencyMs: number | null;
  tokensIn: number | null;
  tokensOut: number | null;
  costUsd: number | null;
}

interface ResponsePanelProps {
  content: string;
  metrics: ResponseMetrics;
  finishReason: string | null;
  rawResponse: string;
  isLoading: boolean;
  curlSnippet: string;
  pythonSnippet: string;
  nodeSnippet: string;
}

type FinishReason = "stop" | "length" | "content_filter" | "error" | string;

function finishReasonChipClass(reason: FinishReason): string {
  if (reason === "stop") return "bg-primary/15 text-primary border-primary/20";
  if (reason === "length") return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (reason === "content_filter" || reason === "error")
    return "bg-destructive/15 text-destructive border-destructive/20";
  return "bg-muted text-muted-foreground border-border";
}

function MetricCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 p-3 border border-border rounded bg-card">
      <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
        {label}
      </span>
      <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
        {value !== null && value !== undefined ? (
          <>
            {value}
            {unit && (
              <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>
            )}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  );
}

function RawResponsePanel({ raw }: { raw: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="border border-border rounded bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {open ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          Raw Response
        </span>
        {open && raw && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors normal-case tracking-normal"
          >
            {copied ? (
              <Check className="h-3 w-3 text-primary" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </button>
      {open && (
        <div className="border-t border-border bg-background/40 p-3 overflow-x-auto max-h-80">
          {raw ? (
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
              {raw}
            </pre>
          ) : (
            <p className="text-xs text-muted-foreground">No response yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

function CodeSnippetTab({
  curl,
  python,
  node,
}: {
  curl: string;
  python: string;
  node: string;
}) {
  const [lang, setLang] = useState<"curl" | "python" | "node">("curl");
  const [copied, setCopied] = useState(false);

  const snippet = lang === "curl" ? curl : lang === "python" ? python : node;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {(["curl", "python", "node"] as const).map((l) => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={cn(
              "text-xs px-2.5 py-1 rounded border transition-colors",
              lang === l
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/70"
            )}
          >
            {l === "node" ? "Node.js" : l === "curl" ? "cURL" : "Python"}
          </button>
        ))}
        <button
          onClick={handleCopy}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <Check className="h-3 w-3 text-primary" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="bg-card border border-border rounded p-3 overflow-x-auto max-h-96">
        {snippet ? (
          <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
            {snippet}
          </pre>
        ) : (
          <p className="text-xs text-muted-foreground">
            Configure a request to generate code snippets.
          </p>
        )}
      </div>
    </div>
  );
}

export function ResponsePanel({
  content,
  metrics,
  finishReason,
  rawResponse,
  isLoading,
  curlSnippet,
  pythonSnippet,
  nodeSnippet,
}: ResponsePanelProps) {
  const [copiedResponse, setCopiedResponse] = useState(false);

  const handleCopyResponse = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedResponse(true);
      setTimeout(() => setCopiedResponse(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <aside className="flex flex-col gap-0 h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
          Response
        </span>
        {content && (
          <button
            onClick={handleCopyResponse}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {copiedResponse ? (
              <Check className="h-3 w-3 text-primary" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copiedResponse ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      <Tabs defaultValue="response" className="flex flex-col flex-1 min-h-0">
        {/* Tab list */}
        <div className="px-4 pt-3 shrink-0">
          <TabsList className="h-7 gap-0 bg-muted p-0.5 rounded">
            <TabsTrigger
              value="response"
              className="h-6 px-3 text-xs rounded data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Response
            </TabsTrigger>
            <TabsTrigger
              value="code"
              className="h-6 px-3 text-xs rounded data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              Code
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Response tab */}
        <TabsContent value="response" className="flex flex-col gap-4 px-4 py-4 flex-1 overflow-y-auto mt-0">
          {/* Metrics grid */}
          <div className="grid grid-cols-2 gap-2">
            <MetricCell
              label="Latency"
              value={metrics.latencyMs !== null ? metrics.latencyMs : null}
              unit="ms"
            />
            <MetricCell
              label="Tokens In"
              value={metrics.tokensIn}
            />
            <MetricCell
              label="Tokens Out"
              value={metrics.tokensOut}
            />
            <MetricCell
              label="Cost"
              value={
                metrics.costUsd !== null
                  ? `$${metrics.costUsd.toFixed(6)}`
                  : null
              }
            />
          </div>

          {/* Response body */}
          <div className="flex-1 min-h-[80px] rounded border border-border bg-card p-3">
            {isLoading && !content ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  {[0, 0.15, 0.3].map((d, i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                      style={{ animationDelay: `${d}s` }}
                    />
                  ))}
                </span>
                Waiting for response…
              </div>
            ) : content ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {content}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Run a request to see the response here.
              </p>
            )}
          </div>

          {/* Finish reason */}
          {finishReason && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>stream complete</span>
              <span className="text-muted-foreground/40">·</span>
              <span>finish_reason:</span>
              <span
                className={cn(
                  "px-1.5 py-0.5 rounded border text-[11px] font-mono",
                  finishReasonChipClass(finishReason)
                )}
              >
                {finishReason}
              </span>
            </div>
          )}

          {/* Raw response */}
          <RawResponsePanel raw={rawResponse} />
        </TabsContent>

        {/* Code tab */}
        <TabsContent value="code" className="flex flex-col px-4 py-4 flex-1 overflow-y-auto mt-0">
          <CodeSnippetTab
            curl={curlSnippet}
            python={pythonSnippet}
            node={nodeSnippet}
          />
        </TabsContent>
      </Tabs>
    </aside>
  );
}
