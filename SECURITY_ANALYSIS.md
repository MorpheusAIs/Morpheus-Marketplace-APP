# Security Analysis — Morpheus Marketplace App

**Date:** 2026-07-23
**Scope:** This repository (`Morpheus-Marketplace-APP`) — Next.js 15 App Router frontend + API routes, AWS Cognito authentication, Stripe & Coinbase payment integration, Web3 wallet connections, LLM playground.
**Frameworks applied:** OWASP Top 10 (2021), OWASP API Security Top 10 (2023), OWASP ASVS 4.0 (selected controls), OWASP Cheat Sheet Series, OAuth 2.0 Security BCP (RFC 9700), CWE, SCA (`npm audit`).
**Method:** Manual source review of all 6 API routes, auth library, client-side storage/rendering paths, build/deploy config; dependency audit (`npm audit --omit=dev`); secret/git history checks. Static analysis only — no dynamic testing was performed.

---

## 1. Executive Summary

The application is a management console for the Morpheus Inference API with real-money payment flows (Stripe + Coinbase) proxying to a backend at `api.mor.org` using a shared admin secret.

**The most serious issues are in the payment pipeline:**

1. **The Stripe webhook credits accounts without any idempotency check** — a genuine, validly-signed webhook event can be replayed to credit an account multiple times for a single payment.
2. **The Stripe checkout endpoint is unauthenticated and trusts client-supplied `userId`** — anyone can create checkout sessions attributing payment metadata to any user.
3. **The Coinbase payment-notification pipeline fails open** (accepts unsigned webhooks when the secret is unset) and exposes an unauthenticated polling endpoint keyed by a caller-supplied `userId`.
4. **The Coinbase payment-link status proxy attaches the server-side admin secret to requests made without requiring caller authentication.**

On the client side, Cognito tokens (including the long-lived **refresh token**) and user **passwords during signup** are stored in web storage, and the OAuth flow lacks **PKCE** with a **bypassable state check**.

The dependency tree carries **56 known vulnerabilities (1 critical, 11 high)**, including 3 high-severity Next.js CVEs fixed upstream in `15.5.21` (app is on `15.5.9`) and an RCE CVE in `next-mdx-remote`, which appears to be **installed but unused**.

**Positives (done well):** Stripe webhook signature verification with raw body; HMAC + `timingSafeEqual` + timestamp replay window on the Coinbase webhook (when configured); OAuth `state` generated via Web Crypto; `rel="noopener noreferrer"` on all `target="_blank"` links; no committed secrets found in git; safe JSON parsing with depth/size limits; geo-based consent gating for analytics; highlight.js output (escaped) used for `dangerouslySetInnerHTML` sinks.

---

## 2. Architecture & Trust Boundaries

```
Browser (React SPA)                Next.js server (Amplify SSR)              External
─────────────────                  ────────────────────────────              ────────
Cognito JWT (localStorage)  ──▶    /api/coinbase/payment-link  ──X-Admin-Secret──▶  api.mor.org (backend)
Morpheus API key (sessionStorage)  /api/stripe/create-checkout ──────────────▶  Stripe API
                                   /api/webhooks/stripe        ◀──────────────  Stripe (signed)
                                   /api/webhooks/coinbase-notification ◀─────  Coinbase (HMAC)
                                   /api/coinbase/diagnostic    (public)
                                   /api/status                 ──────────────▶  active.mor.org feed
```

Key trust-boundary observations:

- The frontend holds a **server-side `ADMIN_API_SECRET`** that grants privileged billing operations on the backend. Any endpoint that attaches it is a privilege-amplification proxy.
- Card data never touches the app (Stripe Checkout redirect) → PCI DSS **SAQ A** scope, provided no card fields are ever self-hosted.
- All 6 API routes implement their own (inconsistent) auth; there is **no middleware-level authn/authz, rate limiting, or security-header layer** (`src/middleware.ts` only handles maintenance mode).

---

## 3. Findings Summary

| # | Severity | Finding | Primary mapping |
|---|----------|---------|-----------------|
| F-01 | **High** | Stripe webhook: no idempotency → replay = duplicate credit | API6:2023, CWE-770 |
| F-02 | **High** | `create-checkout` unauthenticated, trusts client `userId`/`amount`/`email` | API2:2023, A07:2021 |
| F-03 | **High** | Vulnerable dependencies incl. 3 high Next.js CVEs, RCE in (unused) `next-mdx-remote` | A06:2021 |
| F-04 | **Medium** | Coinbase webhook fails open when secret unset | A07:2021, CWE-345 |
| F-05 | **Medium** | Unauthenticated notification polling endpoint (IDOR by `userId`) | API1:2023 (BOLA), A01:2021 |
| F-06 | **Medium** | Payment-link status proxy attaches admin secret without requiring auth | API2:2023, CWE-306 |
| F-07 | **Medium** | Cognito tokens incl. refresh token in `localStorage` | A07:2021, Cheat Sheet: HTML5 |
| F-08 | **Medium** | OAuth flow: no PKCE; state check bypassable when params absent | RFC 9700, CWE-352 |
| F-09 | **Medium** | User password persisted in `sessionStorage` during signup flow | A04:2021, CWE-312 |
| F-10 | **Medium** | No security headers (CSP, frame-ancestors, HSTS, etc.) | A05:2021 |
| F-11 | **Medium** | No rate limiting on any API route | API4:2023 |
| F-12 | **Low** | Public diagnostic endpoint discloses environment topology | A05:2021, CWE-200 |
| F-13 | **Low** | Conditional XSS via geo headers in consent bootstrap script | A03:2021, CWE-79 |
| F-14 | **Low** | Stripe/internal error details returned to client | CWE-209 |
| F-15 | **Low** | Session-replay recorder on billing/API-key pages; third-party scripts w/o SRI | Privacy, supply chain |
| F-16 | **Low** | Verbose client-side logging incl. request/response bodies | CWE-532 |
| F-17 | **Low** | CI writes secrets to `.env.production`; file not covered by `.gitignore` | CWE-538 |
| F-18 | **Low** | No upper bound on payment amounts | Business logic |
| F-19 | **Info** | Dead/legacy code & config: `AuthContext.tsx`, `SKIP_WEBHOOK_VERIFICATION`, dual lockfiles, legacy Coinbase secrets, disabled lint gate | Hygiene |
| F-20 | **Info** | In-memory webhook notification store is broken on multi-instance/serverless | Availability/design |

Severity reflects impact in this deployment context (real-money crediting, serverless hosting), not just CVSS-style scoring.

---

## 4. Detailed Findings & Recommendations

### F-01 — HIGH — Stripe webhook: no idempotency → replay yields duplicate credit

**Evidence:** `src/app/api/webhooks/stripe/route.ts` (entire `POST`). On `checkout.session.completed` it reads `userId`/`amount` from `session.metadata` and calls `creditUserAccount()` unconditionally. There is no record of processed `session.id` / `event.id`.

```
if (event.type === 'checkout.session.completed') {
  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId;
  const amount = session.metadata?.amount;
  if (userId && amount) {
    await creditUserAccount(userId, amount, session.id);
```

**Impact:** Signature verification proves an event is genuine, not that it's *new*. An attacker who completes one legitimate $X checkout captures the exact signed payload Stripe sent to the webhook and re-POSTs it N times → N×$X credited for one payment. Stripe's own at-least-once delivery can also cause benign double-crediting.

**Mappings:** OWASP API6:2023 (Unrestricted Access to Sensitive Business Flows), CWE-770 (Allocation of Resources Without Limits), CWE-841 (Improper Enforcement of Behavioral Workflow).

**Fix:**
1. Persist processed `event.id` (Stripe events) or `session.id` in a durable store with a unique constraint; skip already-seen IDs. (In-memory `Set` is insufficient on serverless.)
2. Additionally verify `session.payment_status === 'paid'` and credit `session.amount_total / 100` rather than trusting `metadata.amount` alone (defense in depth — metadata is currently server-set, but amount_total is the authoritative paid value).
3. The backend `/billing/credits/adjust` should itself be idempotent on `transactionId` (`Stripe payment: <session.id>`) — confirm or add a unique constraint there.

---

### F-02 — HIGH — `/api/stripe/create-checkout` is unauthenticated and trusts client claims

**Evidence:** `src/app/api/stripe/create-checkout/route.ts:13-20` — accepts `{ amount, userId, email }` from the request body with no Bearer token check (contrast with `src/app/api/coinbase/payment-link/route.ts:86-92`, which does require one). `userId` flows into session metadata → the webhook (F-01) credits whatever `userId` the caller supplied.

**Impact:**
- Anyone on the internet can mint Stripe Checkout sessions through this deployment (Stripe API quota/cost abuse, phishing-flavored sessions under your Stripe account branding).
- Payments can be attributed to arbitrary user IDs (credit a victim's account — enables money-laundering/mule patterns and complicates refund disputes).
- Combined with F-01, an attacker self-attributes, pays once, replays the webhook, and multiplies their own balance.

**Mappings:** OWASP API2:2023 (Broken Authentication), A07:2021 (Identification & Authentication Failures).

**Fix:**
1. Require the Cognito Bearer token (same pattern as the payment-link POST) and derive `userId` **server-side from the verified token**, never from the body.
2. Add a sane amount ceiling (e.g. $10k) alongside the existing $0.50 floor.
3. Rate-limit per user/IP (F-11).

---

### F-03 — HIGH — Known-vulnerable dependencies (56: 1 critical, 11 high, 41 moderate, 3 low)

**Evidence:** `npm audit --omit=dev` (2026-07-23). Highest-impact items:

| Package | Severity | Advisory | Status |
|---|---|---|---|
| `next@15.5.9` | High | DoS via Image Optimizer `remotePatterns`; RSC request deserialization DoS; **HTTP request smuggling in rewrites** | Fixed in **15.5.21** (non-breaking) |
| `next-mdx-remote@5` | High | **Arbitrary code execution** rendering untrusted MDX | Fixed in 6.0.0; **no usage found in `src/` — uninstall instead** |
| `axios` | High | NO_PROXY SSRF bypass; auth bypass via prototype pollution | Fixed ≥1.15.1; **no usage found in `src/` or `scripts/` — uninstall instead** |
| `fast-xml-parser` (via `@aws-sdk/xml-builder`) | **Critical** | DoS via numeric entities; entity-encoding bypass; entity expansion | `npm audit fix`; client-side Cognito calls only, so practical exposure is low, but patch |
| `ws` | High | Uninitialized memory disclosure; memory-exhaustion DoS | `npm audit fix` (transitive: viem, walletconnect) |
| `sharp` | High | libvips CVE-2026-33327/33328/35590/35591 | Fixed via `next@15.5.21` |
| `lodash-es` | High | Code injection via `_.template`; prototype pollution | `npm audit fix` (transitive: mermaid/chevrotain) |
| `h3` | High | Path traversal in `serveStatic`; SSE injection | `npm audit fix` (transitive) |
| `form-data`, `defu`, `picomatch`, `socket.io-parser` | High | CRLF injection / proto pollution / method injection / unbounded attachments | `npm audit fix` (transitive) |
| `dompurify` | Moderate | XSS bypasses | `npm audit fix` |
| `follow-redirects` | Moderate | Leaks auth headers to cross-domain redirects | `npm audit fix` |

**Mappings:** A06:2021 (Vulnerable & Outdated Components).

**Fix (in order):**
1. `pnpm remove next-mdx-remote axios` (both appear unused — verify once more before removing).
2. `pnpm update next@15.5.21` (also pulls fixed `sharp`).
3. `pnpm audit fix` for the transitive remainder; re-audit in CI (add `pnpm audit --audit-level=high` as a pipeline gate).
4. Commit to a monthly dependency-review cadence; consider Dependabot/Renovate.

---

### F-04 — MEDIUM — Coinbase webhook fails open when secret is unset

**Evidence:** `src/app/api/webhooks/coinbase-notification/route.ts:101-114`:

```
if (webhookSecret && signatureHeader) {
  ...verify...
} else if (!webhookSecret) {
  console.warn('... No webhook secret configured - accepting unverified webhook');
}
```

If `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET` is missing (misconfig, failed deploy, Amplify env drift), the endpoint silently accepts **unsigned** events and stores "payment confirmed" notifications.

**Impact:** Forged "payment confirmed" toasts to users (social-engineering/confusion); today crediting happens backend-side so direct theft is limited, but the pattern is one config slip away from worse. The HMAC verifier itself is correct (HMAC-SHA256 over `t.payload`, `timingSafeEqual`, 5-minute replay window).

**Mappings:** A07:2021, CWE-345 (Insufficient Verification of Data Authenticity).

**Fix:** Fail closed — return 500/401 when the secret is absent in production (`if (!webhookSecret) return 500`). Keep a loud startup check. (Note: `.env.example`'s `SKIP_WEBHOOK_VERIFICATION` flag is not referenced in code — remove it or wire it explicitly for dev only.)

---

### F-05 — MEDIUM — Unauthenticated notification polling endpoint (IDOR)

**Evidence:** `GET /api/webhooks/coinbase-notification?userId=xxx` (`route.ts:175-200`) returns **and deletes** a user's pending payment notifications. No auth; the client polls with the Cognito `sub` (`src/lib/hooks/use-coinbase-notifications.tsx:37`).

**Impact:** Anyone who learns a victim's Cognito `sub` (not a secret — appears in logs, JWTs, analytics) can read payment amounts/currencies and **delete** the victim's notifications (denial of notification). Small data, but a textbook BOLA.

**Mappings:** API1:2023 (Broken Object Level Authorization), A01:2021, CWE-639.

**Fix:** Require the Bearer token on the GET and use the token's `sub` as the key, ignoring the query param. Long-term, move notifications to a durable authenticated store (the current in-memory `Map` also breaks on multi-instance serverless — see F-20).

---

### F-06 — MEDIUM — Payment-link status proxy attaches admin secret without requiring auth

**Evidence:** `GET /api/coinbase/payment-link?id=xxx` (`src/app/api/coinbase/payment-link/route.ts:185-237`) — `extractBearerToken()` is called but absence is **not** rejected (unlike the POST at lines 86-92). The proxy always adds `X-Admin-Secret` (`buildBackendHeaders`, lines 23-33) and returns link status, amount, and `metadata` (which may contain `user_id`).

**Impact:** Unauthenticated callers query arbitrary payment-link IDs through your privileged channel — information disclosure and an oracle for ID enumeration (mitigated if backend IDs are unguessable UUIDs; not verified here).

**Mappings:** API2:2023, CWE-306 (Missing Authentication for Critical Function).

**Fix:** Require the Bearer token (mirror the POST) and have the backend scope the lookup to the token's user.

---

### F-07 — MEDIUM — Cognito access/ID/**refresh** tokens in `localStorage`

**Evidence:** `src/lib/auth/cognito-direct-auth.ts:219-221, 353-355` — `localStorage.setItem('cognito_access_token' | 'cognito_id_token' | 'cognito_refresh_token', ...)`. A second legacy context duplicates the pattern (`src/lib/auth/AuthContext.tsx:39-65`, unused — F-19). Refresh tokens are valid ~30 days (per code comment at `apiService.ts:246`).

**Impact:** Any successful XSS (or any third-party script running on the page — e.g. the session-replay recorder, wallet SDKs) can exfiltrate a month-long session credential. `localStorage` is accessible to all JS on the origin and survives tab close.

**Mappings:** A07:2021; OWASP Cheat Sheet (HTML5 Security / Token Storage); ASVS 3.5.

**Fix (defense in depth, in order of value):**
1. Prefer Cognito Hosted-UI cookie sessions or a BFF pattern (HttpOnly, Secure, SameSite=Lax cookies set by the Next.js server; tokens never touch JS).
2. Shorten refresh-token TTL in the Cognito app client; enable refresh-token rotation (partially implemented — `revokeRefreshToken` on logout exists at `CognitoAuthContext.tsx:490-492`).
3. Eliminate XSS sinks and add a strict CSP (F-10/F-13) to reduce exploitability of the storage exposure.
4. Keep tokens in memory only where feasible (trade-off: refresh on reload).

---

### F-08 — MEDIUM — OAuth flow: no PKCE; bypassable `state` check

**Evidence:**
- `src/lib/auth/cognito-direct-auth.ts:459-475` — `exchangeCodeForTokens` sends only `client_id` (public client) with **no `code_verifier`**; `initiateSocialLogin` (lines 507-533) sets no `code_challenge`. No PKCE anywhere in the codebase.
- `src/app/auth/callback/page.tsx:34-38`:

```
if (state && storedState && state !== storedState) {
  throw new Error('Invalid state parameter. Possible CSRF attack.');
}
```

If either `state` or `storedState` is absent, validation is **skipped** instead of failing.

**Impact:** Missing PKCE on a public client exposes the flow to authorization-code interception (RFC 9700 §4.5 mandates PKCE for all clients). The weak state check permits login-CSRF (session fixation into an attacker's account → victim enters API keys/payment details into attacker-controlled session).

**Mappings:** RFC 9700 (OAuth 2.0 Security BCP), CWE-352 (CSRF), A07:2021.

**Fix:**
1. Implement PKCE (S256): generate `code_verifier` in `initiateSocialLogin`, send `code_challenge`, verify in `exchangeCodeForTokens`.
2. Fail closed: `if (!state || !storedState || state !== storedState) throw`.
3. Minor: `generateState()`'s server-side branch uses `Math.random()` (`cognito-direct-auth.ts:495-497`) — replace with `crypto.randomUUID()`/Web Crypto or delete the dead branch.

---

### F-09 — MEDIUM — Password persisted in `sessionStorage` during signup

**Evidence:** `src/lib/auth/CognitoAuthContext.tsx:442-444` — `sessionStorage.setItem('pending_signup_password', password)`; read back by `src/app/confirm-registration/page.tsx:55-58, 96-98` and cleared at `CognitoAuthContext.tsx:467-469` only on the success path.

**Impact:** The user's plaintext password sits in web storage between pages — readable by any injected JS, by other tabs' error telemetry, and left behind if the flow is abandoned (until tab close). Passwords must never be persisted client-side.

**Mappings:** A04:2021 (Insecure Design), CWE-312 (Cleartext Storage of Sensitive Information); ASVS 2.1/8.2.

**Fix:** Keep the password in React state/memory only (single-page flow or in-memory store), or have the confirm page re-prompt. Also clear on all failure paths.

---

### F-10 — MEDIUM — No HTTP security headers

**Evidence:** `next.config.ts` defines no `headers()`; nothing sets them in middleware. Absent: `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`.

**Impact:** No defense-in-depth against XSS (critical given F-07's token storage), clickjacking of billing/API-key pages, MIME sniffing, referrer leakage of URLs that carry query params (e.g. `?payment=success&session_id=cs_...` on `/billing`).

**Mappings:** A05:2021 (Security Misconfiguration); ASVS 14.4.

**Fix:** Add to `next.config.ts` (start with report-only CSP, then enforce):

```ts
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      // CSP: allow self + Cognito domain + Stripe/Coinbase checkout + Umami; no unsafe-inline for scripts
    ],
  }];
}
```

---

### F-11 — MEDIUM — No rate limiting / abuse controls on API routes

**Evidence:** None of the 6 routes implement throttling; middleware has none.

**Impact:** `create-checkout` (unauthenticated, F-02) can be hammered to generate Stripe sessions (cost/quota); webhook endpoints can be flooded (the in-memory notification `Map` grows unboundedly per userId until the 5-min TTL sweep); payment-link proxy amplifies requests to the backend under your admin credential.

**Mappings:** API4:2023 (Unrestricted Resource Consumption).

**Fix:** Edge/Amplify-level rate limiting (AWS WAF on the CloudFront distribution), plus per-user quotas server-side. Bound the notification map (max N entries per user).

---

### F-12 — LOW — Public diagnostic endpoint discloses environment topology

**Evidence:** `src/app/api/coinbase/diagnostic/route.ts` — unauthenticated GET returns `NODE_ENV`, Vercel env/region, which secrets are configured, and an enumeration of all env var **names** matching `COINBASE|CDP|ADMIN_API` with set/unset status.

**Impact:** Values are not leaked, but the endpoint confirms attack surface (which integrations exist, what's misconfigured — e.g. reveals F-04's fail-open condition) and aids targeted attacks.

**Mappings:** A05:2021, CWE-200.

**Fix:** Delete the route, or gate it behind the admin secret / an auth check and return 404 unauthenticated.

---

### F-13 — LOW — Conditional XSS via geo headers in consent bootstrap

**Evidence:** `src/app/layout.tsx:57-68` injects `window.MorpheusConsent=${JSON.stringify({mode, country, region})}` via `dangerouslySetInnerHTML`. `country`/`region` come from CDN headers (`src/lib/utils/region.ts:47-58`). `JSON.stringify` does **not** escape `</script>`.

**Impact:** Behind CloudFront/Vercel/Cloudflare these headers are platform-set (2-letter codes) → not exploitable. On any deployment path where the client can supply them (direct origin access, misconfigured proxy, dev), a header like `cloudfront-viewer-country: </script><script>…</script>` yields reflected XSS — which, given F-07, means full account takeover.

**Mappings:** A03:2021 (Injection), CWE-79.

**Fix:** Validate before embedding: `const safe = /^[A-Z]{2}$/.test(v) ? v : null`, and/or replace `</` with `<\\/` in the serialized JSON. Also restrict origin access to CDN-only at the network layer.

---

### F-14 — LOW — Internal error details returned to clients

**Evidence:** `create-checkout/route.ts:79` returns `error.message` (Stripe internals) in the 500 response; `payment-link/route.ts:155-160` proxies backend error bodies through as `details`.

**Mappings:** CWE-209 (Generation of Error Message Containing Sensitive Information).

**Fix:** Return generic messages to the client; log details server-side only.

---

### F-15 — LOW — Session-replay recorder on sensitive pages; third-party scripts without SRI

**Evidence:** `src/app/layout.tsx:71-86` loads Umami `script.js` **and `recorder.js`** (session replay, 15% sampling, `data-mask-level="moderate"`) from a Railway-hosted domain, on every page — including API-key management (full keys are displayed/decrypted in this UI) and billing.

**Impact:** "Moderate" masking may still capture API key prefixes, billing data, and chat content; a compromise of the third-party analytics host = script injection into your origin (no SRI/CSP to constrain it).

**Fix:** Set `data-mask-level="strict"`, exclude `/api-keys`, `/billing`, `/chat` from replay, pin/self-host the recorder, and enforce CSP `script-src` (F-10).

---

### F-16 — LOW — Verbose client-side logging

**Evidence:** `src/lib/api/apiService.ts:200-203` logs response status/headers/bodies for every API call; `cognito-direct-auth.ts:352,373-375` logs refresh-token fingerprints; `result.request.headers` (incl. `Authorization`) is retained in response objects consumed by the playground UI.

**Mappings:** CWE-532.

**Fix:** Gate behind `DEBUG` env; never log auth headers or response bodies in production builds.

---

### F-17 — LOW — CI writes secrets to `.env.production`; not git-ignored

**Evidence:** `amplify.yml:37-43` writes `STRIPE_SECRET_KEY`, `ADMIN_API_SECRET`, etc. to `.env.production` via `printf`. `.gitignore` covers `.env.production.local` but **not** `.env.production`. (Verified: only `.env.example` is currently tracked — no leak today.)

**Impact:** Build-time file is discarded in CI, but anyone replicating the build locally can commit real secrets. Also note `COINBASE_COMMERCE_*` legacy secrets are still provisioned in the Amplify environment (deprecated integration — remove).

**Fix:** Add `.env.production` to `.gitignore`; prefer Amplify's native SSR environment-variable support over file-based injection; remove legacy Coinbase Commerce vars from Amplify.

---

### F-18 — LOW — No payment amount ceiling

**Evidence:** `create-checkout` enforces only ≥ $0.50; `payment-link` only ≥ 1. No upper bound, no per-user velocity checks.

**Fix:** Cap amounts (e.g. $10,000) and add velocity limits; flag anomalous top-ups for review.

---

### F-19 — INFO — Dead code & misleading configuration

- `src/lib/auth/AuthContext.tsx` — legacy, unmounted (only `CognitoAuthProvider` is used, `layout.tsx:90`); stores tokens in localStorage. **Delete.**
- `.env.example:90` `SKIP_WEBHOOK_VERIFICATION` — not referenced in code. Remove or wire explicitly for dev.
- Two lockfiles committed (`pnpm-lock.yaml` + `package-lock.json`); CI uses pnpm. Keep one to prevent dependency drift.
- `next.config.ts:4` `eslint.ignoreDuringBuilds: true` — re-enable so lint gates the build.
- `stripe` API version pinned via `'2025-01-27.acacia' as any` casts (both Stripe routes) — update SDK/pin properly.

### F-20 — INFO — In-memory webhook notification store is architecturally broken

**Evidence:** `coinbase-notification/route.ts:18-34` — module-level `Map` + `setInterval` cleanup. On Amplify WEB_COMPUTE (Lambda), instances are ephemeral and non-shared: the poller often hits a different instance than the webhook did → notifications silently lost (availability), and per-instance memory grows under flood (F-11).

**Fix:** Move to a durable shared store (Redis/DynamoDB) or have the client poll the backend directly with auth.

---

## 5. Framework Checklist Results

### OWASP Top 10 (2021)

| Category | Status | Notes |
|---|---|---|
| A01 Broken Access Control | ⚠️ | F-05 (IDOR), F-06 |
| A02 Cryptographic Failures | ✅/⚠️ | TLS everywhere; HMAC + `timingSafeEqual` on Coinbase webhook; token storage F-07 |
| A03 Injection | ⚠️ | F-13 (conditional XSS); markdown rendering uses escaped highlighters & React escaping; no SQL/ORM in scope |
| A04 Insecure Design | ⚠️ | F-01, F-02, F-09, F-20 |
| A05 Security Misconfiguration | ⚠️ | F-04 (fail-open), F-10 (headers), F-12, F-17, disabled lint gate |
| A06 Vulnerable Components | ❌ | F-03 (56 advisories) |
| A07 AuthN Failures | ⚠️ | F-02, F-07, F-08 |
| A08 Software/Data Integrity | ⚠️ | Webhook signature checks good (when configured); third-party scripts w/o SRI (F-15); dual lockfiles |
| A09 Logging & Monitoring | ⚠️ | Server-side `console.log` only; no alerting on failed webhook verification; F-16 (over-logging client-side) |
| A10 SSRF | ✅ | Outbound URLs are constants or env-configured; `request.nextUrl.origin` fallback is server-derived; no user-controlled fetch targets found |

### OWASP API Security Top 10 (2023)

| Category | Status | Notes |
|---|---|---|
| API1 BOLA | ⚠️ | F-05 |
| API2 Broken Authentication | ❌ | F-02, F-06 |
| API3 Broken Object Property Level Authorization | ✅ | Responses are allow-listed field picks |
| API4 Unrestricted Resource Consumption | ⚠️ | F-11; unbounded in-memory map |
| API5 Broken Function Level Authorization | ✅ | No admin-function exposure found beyond F-06 |
| API6 Sensitive Business Flows | ❌ | F-01, F-02 (payment crediting) |
| API7 SSRF | ✅ | Fixed upstream URLs |
| API8 Security Misconfiguration | ⚠️ | F-04, F-10, F-12 |
| API9 Improper Inventory Management | ⚠️ | F-12 diagnostic route; legacy Coinbase endpoints/secrets |
| API10 Unsafe Consumption of APIs | ✅ | Backend responses parsed with depth-limited safe JSON; non-JSON handled |

### OAuth 2.0 Security BCP (RFC 9700)

| Control | Status |
|---|---|
| PKCE for all clients | ❌ absent (F-08) |
| `state` CSRF protection | ⚠️ present but bypassable (F-08) |
| Exact redirect-uri matching | ✅ (Cognito-side config — verify in pool settings) |
| Refresh-token rotation & revocation | ⚠️ revocation on logout; rotation unverified |
| Sender-constrained tokens (DPoP/mTLS) | ❌ not implemented (acceptable for this tier; note as future hardening) |

### Other relevant guidance

- **PCI DSS:** Card data never touches the app (Stripe Checkout/Payment Links) → SAQ A scope. Keep it that way; do not embed Stripe Elements without reassessing.
- **Secrets management (OWASP Secrets Management Cheat Sheet):** No committed secrets; env-based config good; CI file-injection (F-17) and legacy secret cleanup are the gaps.
- **Privacy (GDPR et al.):** Geo-based consent gating (`strict`/`opt-out`/`implied`) with fail-closed default is a strong pattern. Gap: session replay coverage of sensitive pages (F-15).

---

## 6. Prioritized Remediation Plan

**P0 — this week (payment integrity):**
1. F-01: idempotency on Stripe webhook (+ verify `payment_status`, credit `amount_total`).
2. F-02: require auth on `create-checkout`; derive `userId` from token.
3. F-04: fail closed when Coinbase webhook secret is absent.
4. F-03: upgrade `next` → 15.5.21; `pnpm audit fix`; add CI audit gate.

**P1 — this month (auth hardening):**
5. F-08: PKCE + fail-closed `state` check.
6. F-05/F-06: require Bearer auth on both GET endpoints.
7. F-09: stop persisting passwords in sessionStorage.
8. F-10: security headers incl. report-only CSP.
9. Remove `next-mdx-remote` and `axios` (unused).

**P2 — this quarter (structural):**
10. F-07: migrate to HttpOnly cookie sessions / BFF; shorten refresh TTL.
11. F-11: WAF rate limiting; bound notification map.
12. F-20: durable notification store.
13. F-12/F-14/F-15/F-16/F-17: diagnostic route, error hygiene, replay masking, log gating, CI secret handling.
14. F-19 hygiene sweep (dead code, single lockfile, lint gate, legacy secrets).

**Verification per fix:** replay a signed Stripe event twice → single credit; hit `create-checkout` without a token → 401; unset webhook secret in staging → 5xx; run `pnpm audit` → zero high/critical; securityheaders.com scan → A.

---

## 7. Limitations

- Static review only; no dynamic/authenticated testing, fuzzing, or WAF/CDN config review.
- The backend (`Morpheus-Marketplace-API`) is out of scope — several fixes (idempotent credit adjustment, token-scoped lookups) require backend changes that should be audited separately.
- `[INFERENCE]` Streamdown/react-markdown default URL sanitization (blocks `javascript:` links) was relied upon for chat-message rendering safety; not explicitly verified against the installed `streamdown@1.4.0` version — confirm `urlTransform` defaults and that no caller overrides them via the `{...props}` spread in `src/components/ai-elements/message.tsx:116-126`.
