"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Download, ImagePlus, Key, Loader2, Play, RefreshCw, X } from "lucide-react";
import { AuthenticatedLayout } from "@/components/authenticated-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeTime } from "@/components/api-keys/key-stats";
import { useNotification } from "@/lib/NotificationContext";
import { useCognitoAuth } from "@/lib/auth/CognitoAuthContext";
import {
  createVideo,
  getVideo,
  getVideoLink,
  listVideoModels,
  listVideos,
  VideoApiError,
} from "@/lib/api/videos";
import type {
  CreateVideoRequest,
  Video,
  VideoLimits,
  VideoModel,
  VideoStatus,
} from "@/lib/types/videos";
import { formatLocaleDateTime } from "@/lib/utils/billing-utils";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Constants                                                             */
/* ------------------------------------------------------------------ */

// The gateway's limits: prompt bytes after trimming, first-frame size and types
const MAX_PROMPT_BYTES = 4000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
// The gateway refuses longer clips whatever a provider states
const MAX_SECONDS = 600;

const PAGE_SIZE = 20;
const POLL_INTERVAL_MS = 5000;

// Choices for a model without a /models `video` object, or for a field it leaves
// out; the server's 400 stays the final word
const DEFAULT_LIMITS = {
  minSeconds: 4,
  maxSeconds: 12,
  seconds: 5,
  resolutions: ["480p", "720p"],
  aspectRatios: ["16:9", "9:16", "1:1"],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */

interface FormChoices {
  seconds: number[];
  defaultSeconds: number;
  resolutions: string[];
  aspectRatios: string[];
  audio: boolean;
  image: boolean;
}

/** What the form offers for a model: its stated limits, defaults for the rest */
function formChoices(limits: VideoLimits | null): FormChoices {
  // A one-sided bound pulls the default range to it, so the range is never empty
  const statedMax = limits?.max_seconds ?? null;
  const min = Math.min(
    MAX_SECONDS,
    Math.max(1, limits?.min_seconds ?? Math.min(DEFAULT_LIMITS.minSeconds, statedMax ?? DEFAULT_LIMITS.minSeconds))
  );
  const max = Math.min(MAX_SECONDS, Math.max(min, statedMax ?? DEFAULT_LIMITS.maxSeconds));
  return {
    seconds: Array.from({ length: max - min + 1 }, (_, i) => min + i),
    defaultSeconds: Math.min(max, Math.max(min, DEFAULT_LIMITS.seconds)),
    resolutions: limits?.resolutions?.length ? limits.resolutions : DEFAULT_LIMITS.resolutions,
    aspectRatios: limits?.aspect_ratios?.length ? limits.aspect_ratios : DEFAULT_LIMITS.aspectRatios,
    audio: limits?.audio ?? false,
    image: limits?.image ?? false,
  };
}

function aspectRatioLabel(value: string): string {
  return value === "adaptive" ? "Adaptive" : value;
}

/**
 * A failed POST /videos after which the clip may exist anyway: the answer was
 * lost or unreadable, and the gateway queues and holds the clip before it
 * answers. A typed error body (402, 503, ...) is a definite answer.
 */
function mayHaveBeenCreated(err: unknown): boolean {
  return (
    err instanceof VideoApiError &&
    (err.type === "network" ||
      err.type === "invalid_response" ||
      (err.status >= 500 && err.type === "http_error"))
  );
}

/** A failed POST /videos as the message shown to the user */
function createErrorMessage(err: unknown): string {
  if (!(err instanceof VideoApiError)) return "Something went wrong. Try again.";
  if (mayHaveBeenCreated(err)) {
    const reason = err.type === "network" ? "Could not reach the API." : err.message;
    return `${reason} The video may have been queued anyway: check Your videos (it can take a minute to show up) before trying again.`;
  }
  switch (err.status) {
    case 402:
      return "Not enough credits for this clip.";
    case 410:
      return "Video generation is turned off.";
    case 429:
      return "Too many video requests — wait a minute and try again.";
    case 503:
      return "This model is not available right now.";
    default:
      return err.message;
  }
}

/** prev with page merged in by id, newest first; the page's copy wins */
function mergeVideos(prev: Video[], page: Video[]): Video[] {
  const ids = new Set(page.map((v) => v.id));
  return [...prev.filter((v) => !ids.has(v.id)), ...page].sort((a, b) => b.created_at - a.created_at);
}

const STATUS_BADGES: Record<VideoStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground border-border" },
  in_progress: { label: "Rendering", className: "bg-amber-500/15 text-amber-400 border-amber-500/20" },
  completed: { label: "Ready", className: "bg-primary/15 text-primary border-primary/20" },
  failed: { label: "Failed", className: "bg-destructive/15 text-destructive border-destructive/20" },
};

function StatusBadge({ status }: { status: VideoStatus }) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.queued;
  return (
    <Badge variant="outline" className={cn("shrink-0 gap-1 font-medium", badge.className)}>
      {status === "in_progress" && <Loader2 className="h-3 w-3 animate-spin" />}
      {badge.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Clip card                                                             */
/* ------------------------------------------------------------------ */

type LinkResult = { url: string } | { error: unknown };

function VideoCard({
  video,
  apiKey,
  playing,
  onPlayRequest,
  onPlay,
  onStop,
}: {
  video: Video;
  apiKey: string;
  /** This card holds the page's one player */
  playing: boolean;
  /** Play was clicked: this card is now the latest one asking to play */
  onPlayRequest: () => void;
  /** The link arrived: false when another card was asked to play since */
  onPlay: () => boolean;
  onStop: () => void;
}) {
  // The player's source, set only while this card plays
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [loadingClip, setLoadingClip] = useState(false);
  const [clipError, setClipError] = useState<string | null>(null);
  const [linkExpired, setLinkExpired] = useState(false);
  // The last link from /content, and the request for one while it runs
  const linkRef = useRef<{ url: string; expiresAt: number | null } | null>(null);
  const requestRef = useRef<Promise<LinkResult> | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const showPlayer = playing && clipUrl !== null;

  // Stop a running request when the card goes away
  useEffect(() => () => controllerRef.current?.abort(), []);

  // One clip plays at a time: once another card plays, this one drops its player
  useEffect(() => {
    if (!playing) setClipUrl(null);
  }, [playing]);

  // Play unmounts its button, so focus moves to the player instead of <body>
  useEffect(() => {
    if (showPlayer) playerRef.current?.focus();
  }, [showPlayer]);

  /** The cached link while it is still valid */
  const cachedLink = (): string | null => {
    const link = linkRef.current;
    if (!link || (link.expiresAt !== null && link.expiresAt * 1000 <= Date.now())) return null;
    return link.url;
  };

  /** One /content request at a time, shared by a hover and the click that follows it */
  const requestLink = (): Promise<LinkResult> => {
    if (!requestRef.current) {
      const controller = new AbortController();
      controllerRef.current = controller;
      requestRef.current = getVideoLink(apiKey, video.id, controller.signal)
        .then((link): LinkResult => {
          linkRef.current = { url: link.url, expiresAt: link.expires_at };
          return { url: link.url };
        })
        .catch((error: unknown): LinkResult => ({ error }))
        .finally(() => {
          requestRef.current = null;
          controllerRef.current = null;
        });
    }
    return requestRef.current;
  };

  // Fetched as soon as the pointer or focus reaches Play or Download, so the
  // click usually finds the link ready and acts inside the user's gesture:
  // Safari blocks a new tab, and autoplay with sound, that come after an await.
  const prefetchLink = () => {
    if (!expired && !cachedLink()) void requestLink();
  };

  /** The link for a click; errors show under the buttons */
  const linkForClick = async (): Promise<string | null> => {
    setClipError(null);
    const cached = cachedLink();
    if (cached) return cached;
    setLoadingClip(true);
    const result = await requestLink();
    setLoadingClip(false);
    if ("url" in result) return result.url;
    const err = result.error;
    if (err instanceof VideoApiError && err.type === "aborted") return null;
    if (err instanceof VideoApiError && err.type === "video_expired") setLinkExpired(true);
    setClipError(err instanceof VideoApiError ? err.message : "Could not load the clip.");
    return null;
  };

  // The video host sends no CORS headers: the player loads the link itself
  const handlePlay = async () => {
    onPlayRequest();
    const url = await linkForClick();
    if (url && onPlay()) setClipUrl(url);
  };

  const handlePlayerError = () => {
    // Ask /content again next time: the host may have refused this link
    linkRef.current = null;
    setClipError("Could not play the clip. Try again, or use Download.");
    onStop();
  };

  // The page cannot fetch a file from a host without CORS, so the link opens
  // in a new tab. The host sends the clip as an attachment: the browser saves
  // it and closes that tab (a host that sends it inline plays it there). The
  // anchor stays out of the document, so the analytics click tracker never
  // records the link.
  const handleDownload = async () => {
    const url = await linkForClick();
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const running = video.status === "queued" || video.status === "in_progress";
  const expired = linkExpired || (video.expires_at !== null && video.expires_at * 1000 <= Date.now());
  const clipBlocked = expired || loadingClip;
  const clipName = video.prompt.length > 40 ? `${video.prompt.slice(0, 40)}…` : video.prompt;
  const created = new Date(video.created_at * 1000);
  const details = [
    `${video.seconds}s`,
    video.resolution,
    video.aspect_ratio && aspectRatioLabel(video.aspect_ratio),
    video.generate_audio && "sound",
  ].filter((detail): detail is string => Boolean(detail));

  return (
    <div className="flex flex-col gap-3 rounded border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words text-sm text-foreground line-clamp-2" title={video.prompt}>
          {video.prompt}
        </p>
        <StatusBadge status={video.status} />
      </div>

      {running && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress (approximate)</span>
            <span className="font-mono tabular-nums">{video.progress}%</span>
          </div>
          <Progress value={video.progress} aria-label="Progress (approximate)" className="h-1.5" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {details.map((detail) => (
          <span key={detail} className="font-mono">
            {detail}
          </span>
        ))}
        <span title={formatLocaleDateTime(created)}>{formatRelativeTime(created.toISOString())}</span>
      </div>

      {video.status === "failed" && (
        <p className="text-xs text-destructive">
          {video.error?.message || "The video could not be generated."}
        </p>
      )}

      {video.status === "completed" && (
        <div className="flex flex-col gap-3">
          {showPlayer && (
            <video
              ref={playerRef}
              src={clipUrl ?? undefined}
              controls
              autoPlay
              playsInline
              onError={handlePlayerError}
              aria-label={`Video: ${clipName}`}
              className="max-h-[70vh] w-full rounded border border-border bg-black object-contain"
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            {!showPlayer && (
              <Button
                size="sm"
                onClick={handlePlay}
                onPointerEnter={prefetchLink}
                onPointerDown={prefetchLink}
                onFocus={prefetchLink}
                disabled={clipBlocked}
                aria-label={`Play: ${clipName}`}
                data-analytics-action="play-video"
                data-analytics-label="Play video"
              >
                {loadingClip ? <Loader2 className="animate-spin" /> : <Play />}
                Play
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownload}
              onPointerEnter={prefetchLink}
              onPointerDown={prefetchLink}
              onFocus={prefetchLink}
              disabled={clipBlocked}
              aria-label={`Download: ${clipName}`}
              data-analytics-action="download-video"
              data-analytics-label="Download video"
            >
              <Download />
              Download
            </Button>
            <span className="text-xs text-muted-foreground">
              {expired
                ? "Link expired"
                : video.expires_at !== null &&
                  `Link valid until ${formatLocaleDateTime(new Date(video.expires_at * 1000), {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}`}
            </span>
          </div>
          {clipError && <p className="text-xs text-destructive">{clipError}</p>}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                        */
/* ------------------------------------------------------------------ */

export default function VideoPage() {
  const router = useRouter();
  const { success, error: showError } = useNotification();
  const { apiKeys, defaultApiKey } = useCognitoAuth();

  /* API key state */
  const [apiKey, setApiKey] = useState("");
  const [apiKeyPrefix, setApiKeyPrefix] = useState("");

  /* Model state */
  const [models, setModels] = useState<VideoModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsAttempt, setModelsAttempt] = useState(0);

  /* Form state */
  const [modelId, setModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [seconds, setSeconds] = useState(DEFAULT_LIMITS.seconds);
  const [resolution, setResolution] = useState(DEFAULT_LIMITS.resolutions[0]);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_LIMITS.aspectRatios[0]);
  const [generateAudio, setGenerateAudio] = useState(false);
  const [image, setImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [readingImage, setReadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<{ message: string; billing: boolean } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  /* Clips state */
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videosError, setVideosError] = useState<string | null>(null);
  // Bumped by Refresh and after a create whose answer was lost: re-reads the first page
  const [listAttempt, setListAttempt] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  // The card whose Play was clicked last
  const playRequestRef = useRef<string | null>(null);
  const videosRef = useRef<Video[]>([]);
  const listLoadedRef = useRef(false);

  /* ---------------------------------------------------------------- */
  /* Load API key from sessionStorage                                   */
  /* ---------------------------------------------------------------- */
  // Re-read when the auth context changes: the default key can be stored after mount
  useEffect(() => {
    setApiKey(sessionStorage.getItem("verified_api_key") || "");
    setApiKeyPrefix(sessionStorage.getItem("verified_api_key_prefix") || "");
  }, [apiKeys, defaultApiKey]);

  /* ---------------------------------------------------------------- */
  /* Models                                                              */
  /* ---------------------------------------------------------------- */
  /** Select a model and keep only the form values it accepts */
  const applyModel = useCallback((model: VideoModel | undefined) => {
    const choices = formChoices(model?.limits ?? null);
    setModelId(model?.id ?? "");
    setSubmitError(null);
    setSeconds((s) => (choices.seconds.includes(s) ? s : choices.defaultSeconds));
    setResolution((r) => (choices.resolutions.includes(r) ? r : choices.resolutions[0]));
    setAspectRatio((a) => (choices.aspectRatios.includes(a) ? a : choices.aspectRatios[0]));
    if (!choices.audio) setGenerateAudio(false);
    if (!choices.image) {
      setImage(null);
      setImageError(null);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingModels(true);
    listVideoModels(controller.signal)
      .then((list) => {
        setModels(list);
        setModelsError(null);
        applyModel(list[0]);
      })
      .catch((err) => {
        if (err instanceof VideoApiError && err.type === "aborted") return;
        setModelsError("Could not load the video models.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingModels(false);
      });
    return () => controller.abort();
  }, [applyModel, modelsAttempt]);

  const selectedModel = models.find((m) => m.id === modelId);
  const choices = useMemo(() => formChoices(selectedModel?.limits ?? null), [selectedModel]);

  /* ---------------------------------------------------------------- */
  /* Clips: first page, load more, polling                              */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    videosRef.current = videos;
  }, [videos]);

  useEffect(() => {
    if (!apiKey) return;
    const controller = new AbortController();
    setLoadingVideos(true);
    setVideosError(null);
    listVideos(apiKey, { limit: PAGE_SIZE }, controller.signal)
      .then((page) => {
        // Merged, not replaced: a clip created while this read ran is not on the page
        setVideos((prev) => mergeVideos(prev, page.data));
        // Only the first read sets the cursor. A later read of the first page
        // adds only newer clips, and Load more may already be further down.
        if (!listLoadedRef.current) {
          listLoadedRef.current = true;
          setCursor(page.last_id);
          setHasMore(page.has_more);
        }
      })
      .catch((err) => {
        if (err instanceof VideoApiError && err.type === "aborted") return;
        setVideosError(err instanceof VideoApiError ? err.message : "Could not load your videos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingVideos(false);
      });
    return () => controller.abort();
  }, [apiKey, listAttempt]);

  const handleLoadMore = async () => {
    if (!cursor || loadingVideos) return;
    setLoadingVideos(true);
    try {
      const page = await listVideos(apiKey, { after: cursor, limit: PAGE_SIZE });
      setVideos((prev) => mergeVideos(prev, page.data));
      setCursor(page.last_id);
      setHasMore(page.has_more);
    } catch (err) {
      showError(
        "Could Not Load Videos",
        err instanceof VideoApiError ? err.message : "Try again in a moment."
      );
    } finally {
      setLoadingVideos(false);
    }
  };

  // One interval for the whole page refreshes every running clip. It stops
  // while the tab is hidden. A clip that completes is not fetched until Play.
  // A rejected key stops it until Refresh; rounds that keep failing back off.
  useEffect(() => {
    if (!apiKey) return;
    const controller = new AbortController();
    let timer: number | undefined;
    let polling = false;
    let keyRejected = false;
    let failedRounds = 0;
    let skipTicks = 0;

    const poll = async () => {
      if (skipTicks > 0) {
        skipTicks -= 1;
        return;
      }
      const running = videosRef.current.filter(
        (v) => v.status === "queued" || v.status === "in_progress"
      );
      if (polling || running.length === 0) return;
      polling = true;
      const results = await Promise.allSettled(
        running.map((v) => getVideo(apiKey, v.id, controller.signal))
      );
      polling = false;
      if (controller.signal.aborted) return;

      const updates = new Map<string, Video>();
      const gone = new Set<string>();
      let keyError: string | null = null;
      let failed = false;
      for (const [i, result] of results.entries()) {
        if (result.status === "fulfilled") {
          updates.set(result.value.id, result.value);
          continue;
        }
        const status = result.reason instanceof VideoApiError ? result.reason.status : 0;
        if (status === 401) keyError = result.reason.message;
        // Unknown to the gateway for good: drop it instead of polling it forever
        else if (status === 404) gone.add(running[i].id);
        else failed = true;
      }
      if (keyError !== null) {
        keyRejected = true;
        stop();
        setVideosError(keyError);
        return;
      }
      if (updates.size > 0 || gone.size > 0) {
        setVideos((prev) => prev.filter((v) => !gone.has(v.id)).map((v) => updates.get(v.id) ?? v));
      }
      // Next round after 10 s, 20 s, 40 s, then every minute while nothing answers
      failedRounds = failed && updates.size === 0 ? failedRounds + 1 : 0;
      skipTicks = Math.min(2 ** failedRounds - 1, 11);
    };
    const start = () => {
      if (timer === undefined) timer = window.setInterval(poll, POLL_INTERVAL_MS);
    };
    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => (document.hidden || keyRejected ? stop() : start());

    onVisibilityChange();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      controller.abort();
    };
  }, [apiKey, listAttempt]);

  /* ---------------------------------------------------------------- */
  /* Form                                                                */
  /* ---------------------------------------------------------------- */
  const promptBytes = useMemo(() => new TextEncoder().encode(prompt.trim()).length, [prompt]);
  const promptTooLong = promptBytes > MAX_PROMPT_BYTES;
  // A first frame still being read would be left out of the request
  const canGenerate =
    !submitting && !readingImage && !!selectedModel && prompt.trim() !== "" && !promptTooLong;

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Let the same file be picked again after Remove
    event.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError("Use a JPEG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("The image must be 10 MB or smaller.");
      return;
    }
    setImageError(null);
    setReadingImage(true);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setImage({ name: file.name, dataUrl: reader.result });
    };
    reader.onerror = () => setImageError("Could not read the image.");
    reader.onloadend = () => setReadingImage(false);
    reader.readAsDataURL(file);
  };

  // No automatic retry: without an Idempotency-Key a second POST is a second clip
  const handleGenerate = async () => {
    if (!canGenerate || !selectedModel) return;
    setSubmitting(true);
    setSubmitError(null);
    const body: CreateVideoRequest = {
      model: selectedModel.id,
      prompt: prompt.trim(),
      duration_seconds: seconds,
      resolution,
      aspect_ratio: aspectRatio,
      ...(choices.audio ? { generate_audio: generateAudio } : {}),
      ...(choices.image && image ? { image_b64: image.dataUrl } : {}),
    };
    try {
      const video = await createVideo(apiKey, body);
      setVideos((prev) => [video, ...prev.filter((v) => v.id !== video.id)]);
      success("Video Queued", "It usually takes a few minutes.");
    } catch (err) {
      const failure = {
        message: createErrorMessage(err),
        billing: err instanceof VideoApiError && err.status === 402,
      };
      setSubmitError(failure);
      showError(
        "Video Request Failed",
        failure.message,
        failure.billing ? { actionLabel: "Go to Billing", actionUrl: "/billing" } : undefined
      );
      // A read, not a retry: show a clip the gateway queued before its answer was lost
      if (mayHaveBeenCreated(err)) setListAttempt((n) => n + 1);
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /* API key gate                                                        */
  /* ---------------------------------------------------------------- */
  if (!apiKey || !apiKeyPrefix) {
    return (
      <AuthenticatedLayout>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Key Required
              </CardTitle>
              <CardDescription>
                A Default API key must be set and verified before using
                Video. Go to API Keys to set your Default API Key.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => router.push("/api-keys")}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                data-analytics-action="go-to-api-keys"
                data-analytics-destination="/api-keys"
              >
                Go to API Keys
              </Button>
            </CardContent>
          </Card>
        </div>
      </AuthenticatedLayout>
    );
  }

  /* ---------------------------------------------------------------- */
  /* Render                                                              */
  /* ---------------------------------------------------------------- */
  return (
    <AuthenticatedLayout>
      <div className="container mx-auto space-y-6 p-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">Video</h1>
          <p className="text-muted-foreground">Generate short clips from a text prompt</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column - form */}
          <Card className="h-fit lg:col-span-1">
            <CardHeader>
              <CardTitle>New video</CardTitle>
              <CardDescription>Describe the clip, choose its format and generate it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Model */}
              <div className="space-y-2">
                <Label htmlFor="video-model">Model</Label>
                {loadingModels ? (
                  <Skeleton className="h-9 w-full" />
                ) : modelsError ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-destructive">{modelsError}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setModelsAttempt((n) => n + 1)}
                      data-analytics-action="retry-video-models"
                      data-analytics-label="Retry video models"
                    >
                      <RefreshCw />
                      Retry
                    </Button>
                  </div>
                ) : models.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No video models are available right now.</p>
                ) : (
                  <Select
                    value={modelId}
                    onValueChange={(id) => applyModel(models.find((m) => m.id === id))}
                  >
                    <SelectTrigger id="video-model">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem
                          key={model.id}
                          value={model.id}
                          data-analytics-action="select-video-model"
                          data-analytics-label={`Video model: ${model.id}`}
                          data-analytics-destination={`video-model:${model.id}`}
                        >
                          {model.id}
                          {!model.limits && (
                            <span className="ml-1.5 text-muted-foreground">· limits unavailable</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedModel && !selectedModel.limits && (
                  <p className="text-xs text-muted-foreground">
                    This model's limits are unavailable, so the form shows defaults. The API
                    rejects anything the model does not accept.
                  </p>
                )}
              </div>

              {/* Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="video-prompt">Prompt</Label>
                  <span
                    className={cn(
                      "text-xs font-mono tabular-nums",
                      promptTooLong ? "text-destructive" : "text-muted-foreground"
                    )}
                  >
                    {promptBytes} / {MAX_PROMPT_BYTES} bytes
                  </span>
                </div>
                <Textarea
                  id="video-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  required
                  aria-invalid={promptTooLong}
                  placeholder="A paper boat drifting down a rainy street, close-up, slow motion"
                />
                {promptTooLong && (
                  <p className="text-xs text-destructive">
                    The prompt is longer than {MAX_PROMPT_BYTES} bytes.
                  </p>
                )}
              </div>

              {/* Length, resolution, aspect ratio: stacked while the form column is narrow */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="video-length">Length</Label>
                  <Select value={String(seconds)} onValueChange={(v) => setSeconds(Number(v))}>
                    <SelectTrigger id="video-length">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.seconds.map((s) => (
                        <SelectItem key={s} value={String(s)}>
                          {s} s
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-resolution">Resolution</Label>
                  <Select value={resolution} onValueChange={setResolution}>
                    <SelectTrigger id="video-resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.resolutions.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="video-aspect-ratio">Aspect ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger id="video-aspect-ratio">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {choices.aspectRatios.map((a) => (
                        <SelectItem key={a} value={a}>
                          {aspectRatioLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Sound */}
              {choices.audio && (
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="video-audio">Generate sound</Label>
                  <Switch id="video-audio" checked={generateAudio} onCheckedChange={setGenerateAudio} />
                </div>
              )}

              {/* First frame */}
              {choices.image && (
                <div className="space-y-2">
                  <Label htmlFor="video-image">First frame</Label>
                  <input
                    ref={imageInputRef}
                    id="video-image"
                    type="file"
                    accept={IMAGE_TYPES.join(",")}
                    className="hidden"
                    onChange={handleImageChange}
                  />
                  {image ? (
                    <div className="flex items-center gap-3 rounded border border-border p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- a local data: URL, nothing to optimize */}
                      <img
                        src={image.dataUrl}
                        alt="First frame preview"
                        className="h-14 w-14 shrink-0 rounded object-cover"
                      />
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={image.name}>
                        {image.name}
                      </span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setImage(null)}>
                        <X />
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={readingImage}
                    >
                      {readingImage ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                      {readingImage ? "Reading image…" : "Add image"}
                    </Button>
                  )}
                  {imageError ? (
                    <p className="text-xs text-destructive">{imageError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, up to 10 MB.</p>
                  )}
                </div>
              )}

              {submitError && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {submitError.message}
                    {submitError.billing && (
                      <>
                        {" "}
                        <Link href="/billing" className="underline underline-offset-4">
                          Add credits
                        </Link>
                      </>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full"
                onClick={handleGenerate}
                disabled={!canGenerate}
                data-analytics-action="generate-video"
                data-analytics-label="Generate video"
              >
                {submitting && <Loader2 className="animate-spin" />}
                {submitting ? "Generating…" : "Generate"}
              </Button>
            </CardContent>
          </Card>

          {/* Right column - clips */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Your videos</CardTitle>
                <CardDescription>
                  Ready clips can be played or downloaded until their link expires.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setListAttempt((n) => n + 1)}
                disabled={loadingVideos}
                data-analytics-action="refresh-videos"
                data-analytics-label="Refresh videos"
              >
                <RefreshCw className={cn(loadingVideos && "animate-spin")} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {videosError && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{videosError}</AlertDescription>
                </Alert>
              )}
              {loadingVideos && videos.length === 0 ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)
              ) : videos.length === 0 ? (
                !videosError && (
                  <p className="text-sm text-muted-foreground">No videos yet. Generated clips show up here.</p>
                )
              ) : (
                videos.map((video) => (
                  <VideoCard
                    key={video.id}
                    video={video}
                    apiKey={apiKey}
                    playing={playingId === video.id}
                    onPlayRequest={() => {
                      playRequestRef.current = video.id;
                    }}
                    onPlay={() => {
                      // A slower link for an earlier click must not replace a later one
                      if (playRequestRef.current !== video.id) return false;
                      setPlayingId(video.id);
                      return true;
                    }}
                    onStop={() => setPlayingId((id) => (id === video.id ? null : id))}
                  />
                ))
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleLoadMore}
                  disabled={loadingVideos}
                  data-analytics-action="load-more-videos"
                  data-analytics-label="Load more videos"
                >
                  {loadingVideos && <Loader2 className="animate-spin" />}
                  Load more
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
