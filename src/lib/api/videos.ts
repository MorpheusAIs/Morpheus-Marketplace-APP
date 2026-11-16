/**
 * Video generation API client (gateway /api/v1/videos)
 *
 * Calls use a raw fetch with the user's API key (Bearer sk-...), as the
 * Playground does, not apiRequest: a 401 from a stale key must not start the
 * Cognito retry and logout path. Every failure is thrown as a VideoApiError.
 *
 * Never log the API key or the clip's link from /content: it is a bearer URL.
 * subscribeVideoApi hands each exchange to the Video page's API card with
 * both of them, and a first frame's data, already masked.
 */

import { API_URLS } from './config';
import { safeJsonParseOrNull } from '@/lib/utils/safe-json';
import type {
  CreateVideoRequest,
  Video,
  VideoContentLink,
  VideoLimits,
  VideoList,
  VideoModel,
} from '@/lib/types/videos';

/**
 * A failed video call. type is the gateway's error.type (insufficient_balance,
 * video_not_ready, ...), or one set here: network, aborted, http_error,
 * invalid_response.
 */
export class VideoApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly code: string | null;

  constructor({
    status,
    type,
    code = null,
    message,
  }: {
    status: number;
    type: string;
    code?: string | null;
    message: string;
  }) {
    super(message);
    this.name = 'VideoApiError';
    this.status = status;
    this.type = type;
    this.code = code;
  }
}

interface ApiErrorBody {
  error?: { message?: unknown; type?: unknown; code?: unknown };
  detail?: unknown;
}

interface ApiModelRow {
  id: string;
  modelType?: string;
  ModelType?: string;
  video?: VideoLimits | null;
}

/**
 * One request this client made and its answer, for the Video page's API card.
 * The key, the clip's signed link and a first frame's data are masked.
 */
export interface VideoApiExchange {
  /** When the request was sent (ms since the epoch) */
  sentAt: number;
  method: 'GET' | 'POST';
  url: string;
  /** Authorization shows as `Bearer sk-…` and the key's last 4 characters */
  requestHeaders: Record<string, string>;
  /** The JSON body sent; image_b64 shows as its data: prefix and size */
  requestBody: CreateVideoRequest | null;
  /** null when no answer came back: a network failure or a response blocked by CORS */
  response: { status: number; body: string } | null;
  durationMs: number;
  /** An automatic poll of a running clip */
  poll: boolean;
}

type VideoApiListener = (exchange: VideoApiExchange) => void;

const listeners = new Set<VideoApiListener>();

/**
 * Calls listener once for every request that got an answer or failed; a
 * cancelled request is left out. Returns the unsubscribe function.
 */
export function subscribeVideoApi(listener: VideoApiListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The Authorization header cut to the key's last 4 characters */
function maskHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      name.toLowerCase() === 'authorization' ? `Bearer sk-…${value.slice(-4)}` : value,
    ])
  );
}

function formatSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The body with a first frame's data replaced by its data: prefix and size */
function maskImage(body: CreateVideoRequest): CreateVideoRequest {
  if (!body.image_b64) return body;
  const prefix = /^data:[^;,]*;base64,/.exec(body.image_b64)?.[0] ?? '';
  const omitted = formatSize(body.image_b64.length - prefix.length);
  return { ...body, image_b64: `${prefix}… (${omitted} omitted)` };
}

/** A signed link cut to its host: anyone who has the link can download the clip */
function hideLink(link: string): string {
  try {
    const url = new URL(link);
    return `${url.protocol}//${url.host}/… (signed link hidden)`;
  } catch {
    return '(signed link hidden)';
  }
}

/** A /content answer with its link hidden; links in a body that is not JSON are hidden too */
function maskLinkBody(text: string): string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return text.replace(/https?:\/\/[^\s"'<>]+/g, hideLink);
  }
  if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') {
    return JSON.stringify({ ...data, url: hideLink(data.url) });
  }
  return text;
}

/** A fetch that rejected: cancelled by the caller, or the request never got an answer */
function transportError(signal: AbortSignal | undefined): VideoApiError {
  if (signal?.aborted) {
    return new VideoApiError({ status: 0, type: 'aborted', message: 'The request was cancelled' });
  }
  return new VideoApiError({ status: 0, type: 'network', message: 'Could not reach the API.' });
}

/** The {error: {...}} body of a failed response as a VideoApiError; only a JSON body is read */
function errorFromResponse(response: Response, text: string): VideoApiError {
  let body: ApiErrorBody | null = null;
  if ((response.headers.get('content-type') || '').includes('json')) {
    body = text ? safeJsonParseOrNull<ApiErrorBody>(text, { maxDepth: 100 }) : null;
  }
  const error = body?.error;
  const message =
    (typeof error?.message === 'string' && error.message) ||
    (typeof body?.detail === 'string' && body.detail) ||
    `HTTP ${response.status}`;
  return new VideoApiError({
    status: response.status,
    type: typeof error?.type === 'string' ? error.type : 'http_error',
    code: typeof error?.code === 'string' ? error.code : null,
    message,
  });
}

interface VideoRequest {
  method?: 'GET' | 'POST';
  headers: Record<string, string>;
  /** Sent as JSON */
  body?: CreateVideoRequest;
  signal?: AbortSignal;
}

interface ExchangeOptions {
  /** An automatic poll of a running clip */
  poll?: boolean;
  /** The answer carries the clip's signed link */
  hasLink?: boolean;
}

async function requestJson<T>(
  url: string,
  { method = 'GET', headers, body, signal }: VideoRequest,
  { poll = false, hasLink = false }: ExchangeOptions = {}
): Promise<T> {
  const sentAt = Date.now();
  const started = performance.now();
  const record = (answer: VideoApiExchange['response']) => {
    if (signal?.aborted || listeners.size === 0) return;
    const exchange: VideoApiExchange = {
      sentAt,
      method,
      url,
      requestHeaders: maskHeaders(headers),
      requestBody: body ? maskImage(body) : null,
      response: answer && {
        status: answer.status,
        body: hasLink ? maskLinkBody(answer.body) : answer.body,
      },
      durationMs: Math.round(performance.now() - started),
      poll,
    };
    for (const listener of listeners) {
      try {
        listener(exchange);
      } catch {
        // The API card must not break the call
      }
    }
  };

  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    // A failed response whose body cannot be read is still a definite answer
    text = response.ok ? await response.text() : await response.text().catch(() => '');
  } catch {
    record(null);
    throw transportError(signal);
  }
  record({ status: response.status, body: text });
  if (!response.ok) throw errorFromResponse(response, text);
  const data = safeJsonParseOrNull<T>(text, { maxDepth: 100 });
  if (!data) {
    throw new VideoApiError({
      status: response.status,
      type: 'invalid_response',
      message: 'The API answered with an unreadable response.',
    });
  }
  return data;
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    accept: 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };
}

/**
 * Submit a video job; the gateway answers it queued.
 *
 * No Idempotency-Key: the gateway's CORS does not allow the header, so the
 * preflight would fail. Callers must not retry this call on their own.
 */
export async function createVideo(apiKey: string, body: CreateVideoRequest): Promise<Video> {
  return requestJson<Video>(API_URLS.videos(), {
    method: 'POST',
    headers: { ...authHeaders(apiKey), 'Content-Type': 'application/json' },
    body,
  });
}

/**
 * One video job. A failed job is a 200 with status failed, not an error.
 * poll marks an automatic refresh, which the API card keeps only when the clip changed.
 */
export async function getVideo(
  apiKey: string,
  id: string,
  signal?: AbortSignal,
  { poll = false }: { poll?: boolean } = {}
): Promise<Video> {
  return requestJson<Video>(API_URLS.video(id), { headers: authHeaders(apiKey), signal }, { poll });
}

/** The caller's video jobs, newest first */
export async function listVideos(
  apiKey: string,
  { after, limit = 20 }: { after?: string; limit?: number } = {},
  signal?: AbortSignal
): Promise<VideoList> {
  const params = new URLSearchParams({ limit: String(limit), order: 'desc' });
  if (after) params.set('after', after);
  return requestJson<VideoList>(`${API_URLS.videos()}?${params}`, {
    headers: authHeaders(apiKey),
    signal,
  });
}

/**
 * The VIDEO rows of the public /models list, sorted by id. Filtered here and
 * not with filterModelsByType: NEXT_PUBLIC_ALLOWED_MODEL_TYPES would drop them.
 */
export async function listVideoModels(signal?: AbortSignal): Promise<VideoModel[]> {
  const data = await requestJson<{ data?: ApiModelRow[] } | ApiModelRow[]>(API_URLS.models(), {
    headers: { accept: 'application/json' },
    signal,
  });
  const rows = Array.isArray(data) ? data : data.data ?? [];
  return rows
    .filter((row) => (row.modelType || row.ModelType || '').toUpperCase() === 'VIDEO')
    .map((row) => ({ id: row.id, limits: row.video ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The clip's short-lived link at the video host, for <video src> and a new tab.
 *
 * /content is asked for the link as JSON (redirect=false) instead of being
 * followed through its 307: the video hosts send no CORS headers, so a page
 * cannot read the clip with fetch, while a media element or a tab loads it
 * without CORS. Only an https link is accepted, since it ends up in src.
 */
export async function getVideoLink(
  apiKey: string,
  id: string,
  signal?: AbortSignal
): Promise<VideoContentLink> {
  const link = await requestJson<VideoContentLink>(
    API_URLS.videoContent(id),
    { headers: authHeaders(apiKey), signal },
    { hasLink: true }
  );
  let https = false;
  try {
    https = typeof link.url === 'string' && new URL(link.url).protocol === 'https:';
  } catch {
    https = false;
  }
  if (!https) {
    throw new VideoApiError({
      status: 200,
      type: 'invalid_response',
      message: 'The API answered with an unreadable response.',
    });
  }
  return link;
}
