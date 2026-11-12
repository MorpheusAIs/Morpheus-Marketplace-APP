/**
 * Video generation API client (gateway /api/v1/videos)
 *
 * Calls use a raw fetch with the user's API key (Bearer sk-...), as the
 * Playground does, not apiRequest: a 401 from a stale key must not start the
 * Cognito retry and logout path. Every failure is thrown as a VideoApiError.
 *
 * Never log the API key or the clip's link from /content: it is a bearer URL.
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

/** A fetch that rejected: cancelled by the caller, or the request never got an answer */
function transportError(signal: AbortSignal | undefined): VideoApiError {
  if (signal?.aborted) {
    return new VideoApiError({ status: 0, type: 'aborted', message: 'The request was cancelled' });
  }
  return new VideoApiError({ status: 0, type: 'network', message: 'Could not reach the API.' });
}

/** The {error: {...}} body of a failed response as a VideoApiError; only a JSON body is read */
async function errorFromResponse(response: Response): Promise<VideoApiError> {
  let body: ApiErrorBody | null = null;
  if ((response.headers.get('content-type') || '').includes('json')) {
    const text = await response.text().catch(() => '');
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

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  let response: Response;
  let text: string;
  try {
    response = await fetch(url, init);
    if (!response.ok) throw await errorFromResponse(response);
    text = await response.text();
  } catch (err) {
    if (err instanceof VideoApiError) throw err;
    throw transportError(init.signal ?? undefined);
  }
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
    body: JSON.stringify(body),
  });
}

/** One video job. A failed job is a 200 with status failed, not an error. */
export async function getVideo(apiKey: string, id: string, signal?: AbortSignal): Promise<Video> {
  return requestJson<Video>(API_URLS.video(id), { headers: authHeaders(apiKey), signal });
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
  const link = await requestJson<VideoContentLink>(API_URLS.videoContent(id), {
    headers: authHeaders(apiKey),
    signal,
  });
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
