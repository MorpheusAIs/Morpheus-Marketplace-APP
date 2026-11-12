/**
 * Video generation types: the gateway's /api/v1/videos objects and the
 * VIDEO rows of /api/v1/models.
 */

export type VideoStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

/** A video job. It never carries the clip's URL: the clip comes from /content. */
export interface Video {
  id: string;
  object: 'video';
  model: string;
  status: VideoStatus;
  /** An estimate (0-100) that stays at 95 or below until the clip completes */
  progress: number;
  /** Unix seconds */
  created_at: number;
  completed_at: number | null;
  /** When the download link stops working (unix seconds) */
  expires_at: number | null;
  /** The clip length, as a string ("5") */
  seconds: string;
  /** "WxH" */
  size: string | null;
  prompt: string;
  /** Set when status is failed */
  error: { code: string | null; message: string | null } | null;
  resolution: string | null;
  aspect_ratio: string | null;
  generate_audio: boolean;
}

export interface VideoList {
  object: 'list';
  data: Video[];
  first_id: string | null;
  last_id: string | null;
  has_more: boolean;
}

/**
 * What every healthy provider of a VIDEO model accepts (the /models `video`
 * object). Any field the providers do not state is null.
 */
export interface VideoLimits {
  min_seconds: number | null;
  max_seconds: number | null;
  resolutions: string[] | null;
  aspect_ratios: string[] | null;
  audio: boolean;
  image: boolean;
}

export interface VideoModel {
  id: string;
  /** null when /models has no `video` object for the model ("limits unavailable") */
  limits: VideoLimits | null;
}

/** GET /videos/{id}/content?redirect=false: the clip's short-lived link at the video host */
export interface VideoContentLink {
  object: 'video.content';
  id: string;
  variant: string;
  url: string;
  /** When the link stops working (unix seconds) */
  expires_at: number | null;
}

/** POST /videos body (the Morpheus fields) */
export interface CreateVideoRequest {
  model: string;
  prompt: string;
  duration_seconds?: number;
  resolution?: string;
  aspect_ratio?: string;
  generate_audio?: boolean;
  /** A data URI: JPEG, PNG or WebP, at most 10 MiB */
  image_b64?: string;
}
