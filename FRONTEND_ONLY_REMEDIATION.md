# Frontend-Only Remediation Plan — Morpheus Marketplace APP

**Date:** 2026-07-28
**Branch:** `security/frontend-only-hardening` (from `dev`)
**Basis:** `SECURITY_ANALYSIS.md` (F-01…F-20), `ATTACK_SCENARIOS.md` (FE/CB scenarios), `Morpheus-Marketplace-API/SECURITY_ANALYSIS.md` (B-01…B-23)
**Constraint:** Every fix here is achievable **entirely in this repo** — no changes to `Morpheus-Marketplace-API`, and **no change to any request payload, header set, or metadata contract sent to the backend** (or to Stripe metadata that the backend webhook consumes).

---

## 1. Payment Flow Topology — who actually calls Stripe and Coinbase

Verified against source on `dev`:

### Stripe — browser goes directly to Stripe; the Next.js routes are legacy dead code

```
LIVE FLOW (FundingSection.tsx:33,81-87):
  Browser ──window.open──▶ https://buy.stripe.com/...  (Stripe-hosted Payment Link)
                           ?client_reference_id=<userId> appended client-side
  Stripe ──webhook──▶ configured endpoint (backend /api/v1/webhooks/stripe is canonical per B-02)

LEGACY DEAD CODE (no callers anywhere in src/ — only in docs/billing-dashboard-remaining-tasks.md):
  POST /api/stripe/create-checkout  ──Stripe SDK (secret key)──▶ Stripe API
                                   (talks to Stripe DIRECTLY, never to the backend API)
  POST /api/webhooks/stripe         ◀── Stripe (if configured)
                                   ──X-Admin-Secret, NO Bearer──▶ backend /billing/credits/adjust (401s per B-02a)
```

**Answer for Stripe:** the app's Stripe *API* calls (in the dead `create-checkout` route) go **directly to Stripe**, not through the backend. The live checkout flow doesn't use a Next.js route at all — the browser opens a Stripe-hosted Payment Link. The only Next.js → backend call in the Stripe path is the legacy webhook's credit adjustment.

### Coinbase — everything is proxied through the Next.js routes to the backend

```
CREATE:  Browser ──Bearer──▶ POST /api/coinbase/payment-link (Next.js)
                             ──Bearer + X-Admin-Secret──▶ backend /api/v1/billing/coinbase/payment-links
                             backend ──▶ Coinbase CDP API
POLL:    Browser ──▶ GET /api/coinbase/payment-link?id=…  ──(same proxy)──▶ backend
NOTIFY:  Coinbase ──webhook──▶ POST /api/webhooks/coinbase-notification (Next.js, in-memory Map, toast-only)
         Browser ──▶ GET /api/webhooks/coinbase-notification?userId=… (polling, never touches backend)
```

**Answer for Coinbase:** the browser **never** talks to Coinbase. Next.js routes proxy to the backend API (`X-Admin-Secret` attached server-side), and the backend calls Coinbase. The notification webhook/polling route is self-contained in Next.js (crediting is done by the backend's own Coinbase webhook).

---

## 2. Serious Issues Fixable Frontend-Only (within the constraint)

### P0 — Delete the legacy Stripe payment routes (removes F-01, F-02, F-14-stripe, F-18; kills the frontend half of FE-1, CB-1, CB-2, CB-7)

**Why this is the fix instead of patching them:**

- The routes have **zero callers** — the live flow is the Stripe-hosted Payment Link + the backend's canonical webhook (B-02 fix #1 explicitly recommends deleting the frontend webhook + `creditUserAccount`).
- The alternative (adding auth to `create-checkout`, deriving `userId` server-side) would change Stripe session metadata — which the backend webhook reads (B-02b contract) — violating the no-payload-change constraint and risking the crediting contract.
- F-01's proper fix (durable idempotency) can't be done in serverless Next.js without new infra, and B-01 (the backend half) is out of scope by constraint. Deletion removes the attack surface entirely: no replayable crediting endpoint (CB-1's chain is severed at F-01/F-02), no double-crediting namespace (CB-2), no anonymous checkout minting (FE-1), no attribution fraud (CB-7).

**Precondition (operational, not code):** confirm in the Stripe dashboard that the only registered webhook endpoint is the backend's `/api/v1/webhooks/stripe`. If the frontend endpoint is currently registered, point Stripe at the backend first (dashboard change, not a backend code change), then delete. After deletion, a misconfigured Stripe endpoint gets 404s — loud and safe, and Stripe's own retry/alerting surfaces it.

**Files:** delete `src/app/api/stripe/create-checkout/route.ts`, `src/app/api/webhooks/stripe/route.ts`; remove `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` from env provisioning (Amplify) once unused.

### P1 — Auth-flow hardening (F-08, F-09) — kills FE-6, shrinks FE-5

- **F-08 PKCE + fail-closed state.** Implement S256 PKCE in `initiateSocialLogin`/`exchangeCodeForTokens` (`src/lib/auth/cognito-direct-auth.ts`) and change `src/app/auth/callback/page.tsx:34-38` to `if (!state || !storedState || state !== storedState) throw`. This changes only the browser↔Cognito exchange — nothing sent to the Morpheus backend changes. Closes login-CSRF/session-fixation (FE-6).
- **F-09 password in sessionStorage.** Keep the pending password in memory/React state only (or re-prompt on the confirm page); clear on all failure paths (`CognitoAuthContext.tsx:442-444`, `confirm-registration/page.tsx`). Pure client-side.

### P1 — XSS blast-radius reduction (F-10, F-13) — shrinks FE-5 / CB-3 to near-zero

These two are the highest-value *conditional-High* fixes available without touching token storage (see §3 for why F-07 itself is out of scope):

- **F-13 geo-header validation** (`src/app/layout.tsx:57-68`, `src/lib/utils/region.ts`): validate `country`/`region` against `/^[A-Z]{2}$/` before embedding, and escape `</` as `<\/` in the serialized JSON. Closes the reflected-XSS primitive.
- **F-10 security headers** in `next.config.ts`: `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin` (also stops `session_id`/`client_reference_id` leakage in billing URLs), `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS, and a report-only→enforced CSP (`script-src 'self'` + the exact third-party origins needed: Cognito, Stripe, Coinbase, Umami — no `unsafe-inline` for scripts). Even with tokens remaining in `localStorage`, a strict CSP removes the injection vector that makes F-07 exploitable.

### P1 — Coinbase notification pipeline (F-04, F-05) — kills FE-2, FE-4, most of CB-5

This route is **entirely self-contained in Next.js** (in-memory Map; never calls the backend), so both fixes are constraint-safe:

- **F-04 fail closed:** if `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET` is unset, return 500 instead of accepting unsigned webhooks (`coinbase-notification/route.ts:101-114`).
- **F-05 authenticated polling:** require the Cognito Bearer token on the GET, verify it against Cognito JWKS server-side (e.g. `jose`), and key notifications by the verified `sub` — ignore the query param. The client hook (`use-coinbase-notifications.tsx`) already has the token; it just needs to send it. No backend involvement.

### P2 — Payment-link GET proxy auth (F-06) — kills FE-3's frontend half

Require the Bearer token on `GET /api/coinbase/payment-link` (mirror the POST at lines 86-92) and return 401 when absent. When a token *is* present, the exact same headers are forwarded to the backend as today — **the load sent to the backend is unchanged**. (The backend's B-03 ownership-scoping gap remains and needs its own fix, but the frontend stops being an anonymous privileged oracle.)

### P2 — Dependencies (F-03) — High

- `pnpm update next@15.5.21` (fixes 3 high Next.js CVEs incl. request-smuggling in rewrites; also pulls fixed `sharp`).
- `pnpm remove next-mdx-remote axios` (both verified unused in `src/` and `scripts/`).
- `pnpm audit fix` for transitives (`ws`, `lodash-es`, `h3`, `form-data`, `fast-xml-parser`, …); add `pnpm audit --audit-level=high` as a CI gate.

### P2 — Quick hygiene wins (F-12, F-15, F-16, F-17, F-19 subset)

- **F-12:** delete `src/app/api/coinbase/diagnostic/route.ts` (publicly reveals which secrets are configured — including the F-04 fail-open condition).
- **F-15:** Umami recorder → `data-mask-level="strict"`, exclude `/api-keys`, `/billing`, `/chat` from replay.
- **F-16:** gate verbose client-side logging behind a debug flag; strip auth headers/bodies.
- **F-17:** add `.env.production` to `.gitignore`.
- **F-19:** delete legacy `src/lib/auth/AuthContext.tsx`; drop one lockfile; re-enable the lint gate; remove the unused `SKIP_WEBHOOK_VERIFICATION` from `.env.example`.
- **F-11 (partial):** bound the in-memory notification Map (max N entries per user) — cheap DoS containment while real rate limiting stays an infra/WAF item.

---

## 3. What Is NOT Fixable Under the Constraint (and why)

| Finding | Blocker |
|---|---|
| **F-01 idempotent Stripe crediting (keep-the-route variant)** | Needs durable storage (serverless in-memory is insufficient) and pairs with backend B-01. Superseded by the P0 deletion. |
| **F-02 server-derived `userId`** | Changing Stripe metadata alters the contract the backend webhook reads (B-02b). Superseded by deletion. |
| **F-07 token storage (BFF/HttpOnly cookies)** | The full fix changes the auth load sent to the backend (cookies instead of Bearer) and walks into the **CB-4 trap**: backend CORS (B-13) allows any HTTPS origin *with credentials*, so cookie auth must not ship before the backend's B-13 fix. Out of scope by constraint — mitigated instead via F-10/F-13 above. |
| **F-11 real rate limiting** | Needs AWS WAF/edge config (infra) or backend — not app code. |
| **F-20 durable notification store** | Needs new shared infra (Redis/DynamoDB); acceptable to defer (availability, not theft). |
| **B-01…B-23, CB-4, and the backend halves of FE-3/CB-1/CB-2** | Backend repo — out of scope by definition. The P0 deletion still removes this repo's contribution to CB-1/CB-2. |

## 4. Suggested execution order

1. P0 route deletion (after Stripe dashboard check) — biggest risk reduction per line changed.
2. F-08 + F-09 (auth flow).
3. F-13 + F-10 headers (start CSP report-only).
4. F-04 + F-05 (Coinbase notification route).
5. F-06 GET auth.
6. F-03 dependency sweep + CI audit gate.
7. Hygiene batch (F-12/F-15/F-16/F-17/F-19, notification map bound).

**Verification:** `rg "create-checkout|webhooks/stripe" src/` → no hits; login CSRF attempt (drop `state`) → error page; signup abandonment → no password in web storage; `securityheaders.com` scan → A; unsigned Coinbase webhook with unset secret → 500; notification poll without token → 401; payment-link GET without token → 401; `pnpm audit` → zero high/critical.
