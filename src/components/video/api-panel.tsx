"use client";

import React, { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeSnippetTab, HighlightedCode } from "@/components/playground/response-panel";
import { API_URLS } from "@/lib/api/config";
import { subscribeVideoApi, type VideoApiExchange } from "@/lib/api/videos";
import type { CreateVideoRequest } from "@/lib/types/videos";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                             */
/* ------------------------------------------------------------------ */

const MAX_ENTRIES = 100;
// Paths show relative to it, and the snippets call it
const API_BASE = API_URLS.videos().replace(/\/videos$/, "");
const IMAGE_NOTE = "image_b64: replace <your image> with your image in base64 (JPEG, PNG or WebP, up to 10 MB)";
const TAB_TRIGGER =
  "h-6 px-3 text-xs rounded data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-none";

/* ------------------------------------------------------------------ */
/* Request history                                                       */
/* ------------------------------------------------------------------ */

export interface VideoApiEntry extends VideoApiExchange {
  id: number;
}

/** JSON.parse without the console error safeJsonParseOrNull writes: a body may hold a link */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

interface ClipState {
  id: string;
  status: string;
  error?: unknown;
}

function isClip(value: unknown): value is ClipState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Partial<ClipState>).id === "string" &&
    typeof (value as Partial<ClipState>).status === "string"
  );
}

/** The clips in a 2xx answer: one video, or a page of them */
function clipsIn({ response }: VideoApiExchange): ClipState[] {
  if (!response || response.status < 200 || response.status >= 300) return [];
  const body = parseJson(response.body);
  if (isClip(body)) return [body];
  const rows = typeof body === "object" && body !== null ? (body as { data?: unknown }).data : undefined;
  return Array.isArray(rows) ? rows.filter(isClip) : [];
}

/**
 * The page's video API calls, newest sent first, in memory only: at most 100, the
 * oldest dropped first, gone on reload. An automatic poll is kept only when it
 * failed or the clip's status or error changed, since polls run every 5 s.
 */
export function useVideoApiHistory() {
  const [entries, setEntries] = useState<VideoApiEntry[]>([]);
  const nextIdRef = useRef(1);
  // The last status and error seen for each clip, by its GET /videos/{id} URL
  const clipStatesRef = useRef(new Map<string, string>());

  useEffect(() => {
    const clipStates = clipStatesRef.current;
    return subscribeVideoApi((exchange) => {
      const clips = clipsIn(exchange);
      let unchanged = false;
      for (const clip of clips) {
        const key = API_URLS.video(clip.id);
        const state = JSON.stringify([clip.status, clip.error ?? null]);
        if (exchange.poll && key === exchange.url && clipStates.get(key) === state) unchanged = true;
        clipStates.set(key, state);
      }
      // A failed poll is kept, and so is the next answer for that clip
      if (exchange.poll && clips.length === 0) clipStates.delete(exchange.url);
      if (unchanged) return;
      const entry = { ...exchange, id: nextIdRef.current++ };
      // Answers can arrive out of order (a large upload answers late), so rows sort by send time
      setEntries((prev) =>
        [...prev, entry].sort((a, b) => b.sentAt - a.sentAt || b.id - a.id).slice(0, MAX_ENTRIES)
      );
    });
  }, []);

  return { entries, clear: () => setEntries([]) };
}

/* ------------------------------------------------------------------ */
/* Code snippets                                                         */
/* ------------------------------------------------------------------ */

/** The body the snippets send: a first frame as a short placeholder, never its data */
function snippetBody(body: CreateVideoRequest): CreateVideoRequest {
  if (!body.image_b64) return body;
  const type = /^data:([^;,]+)/.exec(body.image_b64)?.[1] ?? "image/png";
  return { ...body, image_b64: `data:${type};base64,<your image>` };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function pythonValue(value: string | number | boolean): string {
  if (typeof value === "boolean") return value ? "True" : "False";
  return JSON.stringify(value);
}

function generateCurlSnippet(apiKey: string, body: CreateVideoRequest): string {
  const auth = `-H 'Authorization: Bearer ${apiKey}'`;
  return `# 1. Create the job: the answer is the queued video, with its id${body.image_b64 ? `\n# ${IMAGE_NOTE}` : ""}
curl -X POST '${API_URLS.videos()}' \\
  -H 'accept: application/json' \\
  ${auth} \\
  -H 'Content-Type: application/json' \\
  -d ${shellQuote(JSON.stringify(body, null, 2))}

# 2. Poll every few seconds until status is "completed" or "failed"
VIDEO_ID='<id from step 1>'
curl "${API_URLS.videos()}/$VIDEO_ID" \\
  ${auth}

# 3. Download: /content answers 307 to the clip, and -L follows it.
#    -f stops on an error (409 while the clip is not ready) instead of saving it as clip.mp4
curl -fL "${API_URLS.videos()}/$VIDEO_ID/content?variant=video" \\
  ${auth} \\
  -o clip.mp4`;
}

// Plain requests: the OpenAI SDK marks its videos methods deprecated (the Sora API shutdown)
function generatePythonSnippet(apiKey: string, body: CreateVideoRequest): string {
  const bodyLines = Object.entries(body)
    .flatMap(([name, value]) => (value === undefined ? [] : [`        "${name}": ${pythonValue(value)},`]))
    .join("\n");
  return `import time

import requests

BASE_URL = "${API_BASE}"
HEADERS = {"Authorization": "Bearer ${apiKey}"}


def api(method, path, **kwargs):
    res = requests.request(method, f"{BASE_URL}{path}", headers=HEADERS, **kwargs)
    if not res.ok:
        raise SystemExit(f"HTTP {res.status_code}: {res.text}")
    return res.json()


# 1. Create the job: the answer is the queued video${body.image_b64 ? `\n# ${IMAGE_NOTE}` : ""}
video = api(
    "POST",
    "/videos",
    json={
${bodyLines}
    },
)

# 2. Poll every 5 s until it completes or fails
while video["status"] in ("queued", "in_progress"):
    time.sleep(5)
    video = api("GET", f"/videos/{video['id']}")
if video["status"] == "failed":
    raise SystemExit(f"The video failed: {video.get('error')}")

# 3. Download: /content answers 307 to the clip, and requests follows it
#    (it drops the Authorization header on the way to the video host)
clip = requests.get(
    f"{BASE_URL}/videos/{video['id']}/content",
    headers=HEADERS,
    params={"variant": "video"},
)
if not clip.ok:
    raise SystemExit(f"HTTP {clip.status_code}")
with open("clip.mp4", "wb") as f:
    f.write(clip.content)`;
}

function generateNodeSnippet(apiKey: string, body: CreateVideoRequest): string {
  return `// Node.js 18+, as an ES module (save as video.mjs)
import { writeFile } from "node:fs/promises";

const BASE_URL = "${API_BASE}";
const headers = { Authorization: "Bearer ${apiKey}" };

async function api(path, init = {}) {
  const res = await fetch(\`\${BASE_URL}\${path}\`, {
    ...init,
    headers: { ...headers, "Content-Type": "application/json" },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? \`HTTP \${res.status}\`);
  return data;
}

// 1. Create the job: the answer is the queued video${body.image_b64 ? `\n// ${IMAGE_NOTE}` : ""}
let video = await api("/videos", {
  method: "POST",
  body: JSON.stringify(${JSON.stringify(body, null, 2).replace(/\n/g, "\n  ")}),
});

// 2. Poll every 5 s until it completes or fails
while (video.status === "queued" || video.status === "in_progress") {
  await new Promise((resolve) => setTimeout(resolve, 5000));
  video = await api(\`/videos/\${video.id}\`);
}
if (video.status === "failed") throw new Error(video.error?.message ?? "The video failed");

// 3. Download: fetch follows the 307 from /content to the clip
const clip = await fetch(\`\${BASE_URL}/videos/\${video.id}/content?variant=video\`, {
  headers,
  redirect: "follow",
});
if (!clip.ok) throw new Error(\`HTTP \${clip.status}\`);
await writeFile("clip.mp4", Buffer.from(await clip.arrayBuffer()));`;
}

/* ------------------------------------------------------------------ */
/* Request entry                                                         */
/* ------------------------------------------------------------------ */

function statusTone(status: number | null): string {
  if (status === null || status >= 500) return "bg-destructive/15 text-destructive border-destructive/20";
  if (status >= 400) return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  if (status >= 200 && status < 300) return "bg-primary/15 text-primary border-primary/20";
  return "bg-muted text-muted-foreground border-border";
}

/** Local time as HH:MM:SS */
function clockTime(ms: number): string {
  const date = new Date(ms);
  return [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
}

function prettyJson(text: string): string | null {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return null;
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : label}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      data-analytics-action="copy-video-api-body"
      data-analytics-label={label}
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Detail({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function CodeBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-h-80 overflow-auto rounded border border-border bg-background/40 p-3">{children}</div>
  );
}

function RequestEntry({
  entry,
  open,
  onToggle,
}: {
  entry: VideoApiEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const path = entry.url.startsWith(API_BASE) ? entry.url.slice(API_BASE.length) : entry.url;
  const status = entry.response?.status ?? null;
  const headerLines = Object.entries(entry.requestHeaders)
    .map(([name, value]) => `${name}: ${value}`)
    .join("\n");
  const requestBody = entry.requestBody && JSON.stringify(entry.requestBody, null, 2);
  const responseText = entry.response?.body ?? null;
  const responseJson = responseText && prettyJson(responseText);
  const shownResponse = responseJson ?? responseText;

  return (
    <div className="rounded border border-border">
      {/* The analytics label keeps the row's text (paths, ids) out of click tracking */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2 p-3 text-left transition-colors hover:bg-muted/50"
        data-analytics-action="toggle-video-api-request"
        data-analytics-label="Video API request"
      >
        {open ? (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-foreground">
            <span className="shrink-0 font-semibold">{entry.method}</span>
            <span className="truncate" title={path}>
              {path}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{clockTime(entry.sentAt)}</span>
            <span className="font-mono tabular-nums">{entry.durationMs} ms</span>
            {entry.poll && (
              <span
                className={cn(
                  badgeVariants({ variant: "outline" }),
                  "px-1.5 py-0 text-[10px] font-medium text-muted-foreground"
                )}
              >
                auto
              </span>
            )}
          </span>
        </span>
        <span className={cn(badgeVariants({ variant: "outline" }), "shrink-0 font-mono", statusTone(status))}>
          {status ?? "no response"}
        </span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <Detail label="URL">
            <p className="break-all font-mono text-xs text-foreground">{entry.url}</p>
          </Detail>
          <Detail label="Request headers">
            <pre className="whitespace-pre-wrap break-all font-mono text-xs text-foreground">{headerLines}</pre>
          </Detail>
          {requestBody && (
            <Detail
              label="Request body"
              action={<CopyButton text={requestBody} label="Copy request body" />}
            >
              <CodeBox>
                <HighlightedCode code={requestBody} language="json" />
              </CodeBox>
            </Detail>
          )}
          <Detail
            label={status === null ? "Response" : `Response · ${status}`}
            action={shownResponse ? <CopyButton text={shownResponse} label="Copy response body" /> : undefined}
          >
            {responseText === null ? (
              <p className="text-xs text-destructive">No response (network error or blocked by CORS)</p>
            ) : !shownResponse ? (
              <p className="text-xs text-muted-foreground">Empty body</p>
            ) : (
              <CodeBox>
                {responseJson ? (
                  <HighlightedCode code={responseJson} language="json" />
                ) : (
                  <pre className="whitespace-pre-wrap break-all font-mono text-xs">{responseText}</pre>
                )}
              </CodeBox>
            )}
          </Detail>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panel                                                                 */
/* ------------------------------------------------------------------ */

export function VideoApiPanel({
  entries,
  onClear,
  apiKey,
  body,
  className,
}: {
  entries: VideoApiEntry[];
  onClear: () => void;
  apiKey: string;
  /** The POST /videos body for the form as it stands; null while no model is selected */
  body: CreateVideoRequest | null;
  className?: string;
}) {
  // Rows the user opened or closed; otherwise only the newest POST /videos is open
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const newestCreateId = entries.find((entry) => entry.method === "POST")?.id;
  const shownBody = body && snippetBody(body);

  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>API</CardTitle>
        <CardDescription>The calls this page makes, and code to make them yourself.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="requests">
          <TabsList className="h-7 gap-0 bg-muted p-0.5 rounded">
            <TabsTrigger value="requests" className={TAB_TRIGGER}>
              Requests
            </TabsTrigger>
            <TabsTrigger value="code" className={TAB_TRIGGER}>
              Code
            </TabsTrigger>
          </TabsList>

          {/* Both tabs stay mounted, so open rows and the snippet language survive a switch */}
          <TabsContent value="requests" className="mt-4 space-y-3 data-[state=inactive]:hidden" forceMount>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {entries.length} {entries.length === 1 ? "request" : "requests"} · kept until you reload
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClear();
                  setToggled({});
                }}
                disabled={entries.length === 0}
                data-analytics-action="clear-video-api-requests"
                data-analytics-label="Clear video API requests"
              >
                <Trash2 />
                Clear
              </Button>
            </div>
            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet. The calls this page makes show up here.</p>
            ) : (
              <div className="max-h-[36rem] space-y-2 overflow-y-auto">
                {entries.map((entry) => {
                  const open = toggled[entry.id] ?? entry.id === newestCreateId;
                  return (
                    <RequestEntry
                      key={entry.id}
                      entry={entry}
                      open={open}
                      onToggle={() => setToggled((prev) => ({ ...prev, [entry.id]: !open }))}
                    />
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="mt-4 data-[state=inactive]:hidden" forceMount>
            {/* The snippet box scrolls inside this height */}
            <div className="flex max-h-[36rem] flex-col">
              <CodeSnippetTab
                curl={shownBody ? generateCurlSnippet(apiKey, shownBody) : ""}
                python={shownBody ? generatePythonSnippet(apiKey, shownBody) : ""}
                node={shownBody ? generateNodeSnippet(apiKey, shownBody) : ""}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
