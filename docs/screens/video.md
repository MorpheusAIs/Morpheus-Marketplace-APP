# Video Screen

## Overview
A screen for generating short video clips from a text prompt through the gateway's `/api/v1/videos` API. Users pick a video model, write a prompt, choose the clip's length and format, and generate it. Clips render in the background; the screen lists them, refreshes the running ones, and plays or downloads the finished ones.

- **Route**: `/video` (`src/app/video/page.tsx`)
- **Sidebar**: "Video" in the Build group, right after "Playground". Disabled, with a tooltip, until a Default API key is set.
- **API client**: `src/lib/api/videos.ts`; types in `src/lib/types/videos.ts`.

## Component Structure

### Root Layout
- **Component**: `AuthenticatedLayout` (sidebar, auth gate, age verification)
- **Container**: `div`
  - **Props**: `className: "container mx-auto space-y-6 p-6"`

### API Key Gate
Shown when sessionStorage is missing `verified_api_key` or `verified_api_key_prefix`, as on the Playground. The same "API Key Required" `Card` as the Playground, with a "Go to API Keys" button to `/api-keys`.

### Header Section
- **Title**: `h1`, `className: "text-3xl font-bold text-foreground"`, content `"Video"`
- **Subtitle**: `p`, `className: "text-muted-foreground"`

### Body
- **Container**: `div`, `className: "grid gap-6 lg:grid-cols-3"`. One column on mobile, the form on the left and the clips on the right from `lg`.

#### Form Card (left, `lg:col-span-1`)
- **Model**: `Select` with the VIDEO rows of `GET /models`, sorted by id; the first is selected. A model without a `video` object is marked "limits unavailable". With no VIDEO models: "No video models are available right now." When `/models` fails, its error shows with a Retry button.
- **Prompt**: `Textarea`, required, at most 4000 bytes (UTF-8, trimmed, counted with `TextEncoder`), with a `n / 4000 bytes` counter.
- **Length / Resolution / Aspect ratio**: three `Select`s in a `grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 2xl:grid-cols-3`: side by side when the form is wide enough, stacked in the narrow `lg`/`xl` form column. Length lists every whole second from `min_seconds` to `max_seconds`. The aspect ratio `adaptive` shows as "Adaptive".
- **Generate sound**: `Switch`, only when the model's `video.audio` is true.
- **First frame**: an image picker, only when `video.image` is true. JPEG, PNG or WebP up to 10 MiB, read with `FileReader.readAsDataURL` and sent as `image_b64`. Shows a thumbnail with Remove; other files get an inline message. While the file is read, the picker shows "Reading image…" and Generate is disabled, so the clip is never sent without it.
- **Error**: `Alert` (destructive) above the button, cleared when another model is picked.
- **Generate**: `Button`, full width. Disabled while the request is in flight (then shows "Generating…"), when the prompt is empty or too long, or when no model is selected.

When `/models` has no `video` object for a model, or leaves a field out, the form uses these defaults: 4–12 s (default 5), 480p and 720p, 16:9, 9:16 and 1:1, no sound, no first frame. The API's 400 stays the final word.

#### Your Videos Card (right, `lg:col-span-2`)
A Refresh button in the header re-reads the first page and merges it into the list. A list error (the first page failed, or polling hit a rejected key) shows as a destructive `Alert` above the items, and Refresh is its retry.

One bordered item per clip:
- the prompt, cut to two lines, with the full text in `title`;
- a status badge: Queued, Rendering (with a spinner), Ready, Failed;
- for queued and rendering clips, a `Progress` bar (`aria-label` "Progress (approximate)") with the `progress` %;
- the length, resolution, aspect ratio and "sound" when set, and the created time, relative;
- for a failed clip, its error message;
- for a ready clip, Play and Download buttons (their `aria-label` adds the start of the prompt) and "Link valid until <local time>", or "Link expired" once `expires_at` has passed. An expired link disables both buttons.

"Load more" appears while `has_more` is true.

## Flow
1. **Load**: `GET /models` (public) for the model list, and `GET /videos?limit=20&order=desc` with the API key for the first page of clips.
2. **Generate**: `POST /videos` with `{ model, prompt, duration_seconds, resolution, aspect_ratio, generate_audio?, image_b64? }`. On 200 the queued clip is put at the top of the list, the form keeps its values, and a toast says the video is queued and usually takes a few minutes. The request is never retried automatically: the gateway's CORS does not allow `Idempotency-Key`, so a second POST would be a second clip. The gateway queues and holds the clip before it answers, so when the answer is lost or unreadable (a network failure, an unreadable 200, or a 5xx without an error body) the screen re-reads the first page of `/videos` to show the clip, and the message asks the user to check Your videos before trying again.
3. **Polling**: one interval for the whole screen. Every 5 s, each queued or in-progress clip is refreshed with `GET /videos/{id}`. The interval stops while the tab is hidden and is cleared on unmount. A failed clip comes back as a 200 with status `failed`, so the status is checked on every poll. A 401 stops polling and shows the key error until Refresh; a 404 drops the clip from the list; when a whole round fails, the next ones wait 10 s, 20 s, 40 s, then a minute.
4. **Play / Download**: the screen asks `GET /videos/{id}/content?variant=video&redirect=false` with the API key for the clip's short-lived link at the video host (`{ url, expires_at }`; only an `https` link is accepted). The video hosts send no CORS headers, so the page cannot read the clip with `fetch`; a media element and a browser tab load it without CORS.
   - **Play** puts the link in `<video controls src>`. Only one clip plays at a time: playing another closes the previous player. If the player cannot load the clip, the item says "Could not play the clip. Try again, or use Download."
   - **Download** opens the link in a new tab through an anchor kept out of the document (`target="_blank"`, `rel="noopener noreferrer"`); the `download` attribute is ignored for another site's link. BytePlus sends the clip with `Content-Disposition: attachment`, so the browser saves it under the host's file name and closes the tab; a host that sends it inline plays it in that tab.
   - The link is requested as soon as the pointer or focus reaches Play or Download, and kept until its `expires_at`. The click then usually finds it ready and acts inside the user's gesture: Safari blocks a new tab, and autoplay with sound, that come after an `await`. Each item runs one request at a time, shared by the hover and the click.
   - When Play is clicked on one item and then on another, only the last click opens its player, even if the first link arrives later.

Every `/videos` call uses a raw `fetch` with `Authorization: Bearer <API key>`, not `apiRequest`, so a 401 from a stale key does not log the user out. The key and the clip's link are never logged or stored; the link lives only in the playing item's state. Play and Download are buttons, and the download anchor is never added to the document, so the analytics click tracker never sees the link.

## Errors
Shown inline above the Generate button and as a toast.

| Status | Message |
|--------|---------|
| 402 | "Not enough credits for this clip." with a link to `/billing` |
| 429 | "Too many video requests — wait a minute and try again." |
| 503 | "This model is not available right now." |
| 400 | The server's message |
| 410 | "Video generation is turned off." |
| Network failure | "Could not reach the API." plus a note that the video may have been queued anyway: check Your videos (it can take a minute to show up) before trying again. The list's first page is re-read. |
| Unreadable 200, or 5xx without an error body | The same note after the error text, and the same re-read |
| Other (413, 415, 401, ...) | The server's message |

Play and Download show their error under the buttons: 409 (not ready), 410 (link expired, which also marks the item "Link expired"), 404, a network failure, or a player that could not load the clip.

## Known Limits
- **No in-page save.** The video hosts (BytePlus storage was checked) send no CORS headers, so the page cannot fetch the file or choose its name; Download goes through a new tab instead, and the file keeps the host's name.
- **Links expire.** Vendor links live about 24 h (`expires_at`); after that `/content` answers 410.
- **Progress is an estimate.** It stays at 95 % or below until the clip completes.
- **429 has no wait time.** The gateway's CORS does not expose `Retry-After`.
- **CSP.** The Report-Only policy allows `media-src 'self' https:` for the player. Its `connect-src` does not list the API host, so enforcing it as is would block these calls.
