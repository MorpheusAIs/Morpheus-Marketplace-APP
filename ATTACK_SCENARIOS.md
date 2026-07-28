# Attack Scenarios & Threat Model — Morpheus Marketplace (Frontend + Backend)

**Date:** 2026-07-23
**Basis:** `Morpheus-Marketplace-APP/SECURITY_ANALYSIS.md` (frontend, findings F-01…F-20) and `Morpheus-Marketplace-API/SECURITY_ANALYSIS.md` (backend, findings B-01…B-23). Finding references use those IDs throughout.
**Method:** Scenario construction from confirmed findings only — every scenario cites the findings that enable it. No hypothetical vulnerabilities were invented; where a scenario depends on a deployment condition (e.g. which Stripe webhook is configured), that condition is stated as a precondition.
**Audiences:** §1–§4 give each scenario in both plain and technical terms. §5 is the master table. §6 lists attacks that were tried and **failed** against the current defenses (so the team knows what not to over-fix).

---

## 0. Attacker Models

| Attacker | Access | Notes |
|---|---|---|
| **Anonymous** | Internet, no account | Can hit any unauthenticated endpoint on either service |
| **User** | A normal registered account (free, with signup bonus) | Holds a Cognito JWT and can mint API keys |
| **Paying user** | Has completed ≥1 real payment | Possesses genuine signed webhook artifacts (their own) |
| **Insider/config** | Can influence deployment config or has log/DB read access | Not a hacker — a mistake or a leak |

Severity scale: **Critical** = direct theft of money/credits at scale or full account compromise. **High** = material financial loss or account compromise with preconditions. **Medium** = limited financial/privacy impact, or high impact with strong preconditions. **Low** = hardening gap, minor abuse.

---

## 1. Frontend-Only Scenarios (attacker uses only the Next.js app)

### FE-1 — Mint unlimited Stripe Checkout sessions through your account — **High**

- **Findings:** F-02 (unauthenticated `create-checkout`, trusts client `userId`/`amount`/`email`), F-11 (no rate limiting), F-18 (no amount ceiling).
- **Preconditions:** None. Anonymous.
- **Plain language:** The "buy credits" button on the website doesn't check who is pressing it. Anyone on the internet can press it a million times, generating real Stripe payment pages under the Morpheus brand, for any amount, addressed to any email. Each one can carry *any* user ID, so a payment can be attributed to an account the payer doesn't own.
- **Technical:** `POST /api/stripe/create-checkout` accepts `{amount, userId, email}` with no Bearer token and forwards `userId` into Stripe session metadata. An attacker scripts session creation (Stripe API quota/cost burn, phishing-grade pages under the real Stripe account), and can attribute payments to arbitrary users — the mule/laundering primitive: pay with a stolen card, credit a third-party account, consume or resell the inference, leave the victim holding the dispute.
- **Consequences:** Stripe quota/cost abuse; brand-damaging phishing sessions; payment-attribution fraud that complicates every chargeback investigation.
- **Fix:** F-02 (require Cognito token, derive `userId` server-side), F-11 (rate limit), F-18 (amount ceiling).

### FE-2 — Read and delete other users' payment notifications — **Medium**

- **Findings:** F-05 (unauthenticated notification polling keyed by `userId`).
- **Preconditions:** Know a victim's Cognito `sub` (not a secret — leaks via B-03's payment-link metadata, analytics, logs, JWTs).
- **Plain language:** The little "payment received!" popup on the site can be polled by anyone who knows a user's ID. An attacker can watch what other people paid and — worse — delete those notifications before the victim sees them.
- **Technical:** `GET /api/webhooks/coinbase-notification?userId=<sub>` returns and **deletes** pending notifications with no auth. Amount/currency disclosure + denial-of-notification.
- **Consequences:** Privacy leak of payment activity; confusion/social-engineering leverage ("we never got your payment — see, no notification").
- **Fix:** F-05 (Bearer auth; key by token `sub`, ignore query param).

### FE-3 — Probe payment links through your privileged proxy — **High** (upgraded 2026-07-28 — see `RESEARCHER_REPORT_TRIAGE.md`)

- **Findings:** F-06 (payment-link status GET attaches `X-Admin-Secret` without requiring caller auth), B-03 (backend lookup not token-scoped either). **Dynamically confirmed in production by an external researcher.**
- **Preconditions:** Any valid account. The original "IDs are hard to guess" mitigation is **void**: the researcher demonstrated link IDs are sequential MongoDB ObjectIds from one shared Coinbase Business account — create one link to learn the counter, then walk it to enumerate every user's records.
- **Plain language:** The website has a "check payment status" feature that uses the company's master key to answer — but it never checks who's asking. Worse than first thought: the ID numbers are effectively sequential, so any signed-up user can flip through *everyone's* payment records like pages in a book — amounts, statuses, custom notes, and each owner's internal user ID.
- **Technical:** `GET /api/coinbase/payment-link?id=…` proxies to the backend with the server-side admin secret attached; the backend's own endpoint (`billing/coinbase.py:78`) likewise doesn't scope to the caller and proxies the ID straight to the shared Coinbase Business account. Response includes amount, status, arbitrary custom metadata (backend accepts `additionalProperties: true`), live `payments.coinbase.com` URLs, and the owner's Cognito `sub` — which feeds FE-2 and CB-5 at scale.
- **Consequences:** Bulk disclosure of all users' payment activity (CVSS 6.5 per researcher); enumeration oracle; mass-harvests the user IDs that make FE-2 and targeted phishing practical.
- **Fix:** B-03 (ownership-scoped lookup, 404 on mismatch) is the only complete fix — F-06 (require Bearer at the frontend proxy) stops anonymous probing but does nothing against an *authenticated* enumerator.

### FE-4 — Forge "payment confirmed" popups — **Medium**

- **Findings:** F-04 (Coinbase webhook fails open when secret unset on the frontend).
- **Preconditions:** The deployment is missing `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET` (a config slip — exactly what F-12's public diagnostic endpoint can confirm to an attacker).
- **Plain language:** If one configuration value is missing, the website will believe any "payment confirmed" message sent to it — no signature checked. An attacker can make the site tell users their payment went through when it didn't.
- **Technical:** `coinbase-notification/route.ts:101-114` accepts unsigned webhooks with a warning when the secret is unset, and stores "payment confirmed" notifications. (The backend's own Coinbase webhook fails **closed** — B-audit verified — so actual crediting is not affected today; this is a deception primitive, not direct theft.)
- **Consequences:** Social-engineering ammo (fake confirmations shown to support/user), user confusion; one config change away from worse if crediting ever moves frontend-side.
- **Fix:** F-04 (fail closed: 500 when secret unset), F-12 (remove the diagnostic endpoint that reveals the condition).

### FE-5 — Steal accounts through a script that shouldn't be able to see them — **High (conditional)**

- **Findings:** F-13 (conditional XSS via geo headers in the consent bootstrap), F-07 (access + **refresh** tokens in `localStorage`), F-10 (no CSP), F-15 (third-party session-replay recorder on all pages, no SRI), F-09 (password in `sessionStorage` during signup).
- **Preconditions:** One of: (a) a deployment path where the client can influence geo headers (direct origin access / misconfigured proxy — **not** exploitable behind correctly-configured CloudFront/Vercel), or (b) compromise of the third-party analytics host serving `recorder.js`, or (c) any future XSS anywhere in the app.
- **Plain language:** The site keeps the keys to a user's account — including the 30-day "stay logged in" key — in a place any script on the page can read. One injected script (through a header bug, a compromised analytics provider, or any future bug) empties the vault: full account takeover for a month, plus the user's password if they were mid-signup.
- **Technical:** `localStorage` holds `cognito_access_token` / `id_token` / **`refresh_token`** (`cognito-direct-auth.ts:219-221`); `pending_signup_password` sits in `sessionStorage`. No CSP, no SRI on third-party scripts, recorder on billing/API-key pages. Exfiltration of the refresh token = 30-day session from anywhere.
- **Consequences:** Full account takeover at scale; stolen API keys and billing data (recorder captures the pages where full keys are displayed); passwords harvested mid-signup.
- **Fix:** F-13 (validate/escape), F-10 (CSP), F-15 (strict masking, exclude sensitive pages), F-09 (memory-only), F-07 (BFF/HttpOnly cookies — note the B-13 interaction in CB-4 before doing this).

### FE-6 — Trick users into an attacker's account (login CSRF) — **Medium**

- **Findings:** F-08 (no PKCE; state check bypassable when either value is absent).
- **Plain language:** The login system's "prove you started this login" check can be skipped by simply not providing the proof. An attacker can land a victim logged into the *attacker's* account; anything the victim then types — API keys, payment details — belongs to the attacker.
- **Technical:** `callback/page.tsx:34-38` — `if (state && storedState && state !== storedState) throw` skips validation when either is absent; no `code_verifier`/`code_challenge` anywhere (public client without PKCE, contrary to RFC 9700 §4.5).
- **Consequences:** Session-fixation data capture; also weakens authorization-code interception resistance.
- **Fix:** F-08 (PKCE S256; fail closed on missing state).

---

## 2. Backend-Only Scenarios (attacker talks to the API directly)

### BE-1 — The master off-switch for all authentication — **Critical (config-dependent)**

- **Findings:** B-08 (`LOCAL_TESTING_MODE` + `BYPASS_COGNITO_AUTH`, raw env, no production guard), compounded by B-20 ops hygiene (dev env files set both `true`; deploy tooling defaults to the prod AWS profile).
- **Preconditions:** Both env vars reach a production deployment (misconfig, copied env file, task-definition drift). Not attacker-triggerable — an accident waiting to be weaponized.
- **Plain language:** The API has a "just testing, let everyone in" switch meant for developers' laptops. Nothing stops that switch from being flipped on in production by mistake. If it ever is, every account becomes accessible to everyone, no password needed — and nothing would alarm except one log line at startup.
- **Technical:** When both flags are true, `get_current_user`, `get_api_key_auth`, and `get_user_jwt_or_api_key` return a shared test user without credentials (`dependencies.py:52-57, 277-299, 629-631`). Every user-scoped endpoint is anonymous; identity collapses to one shared user.
- **Consequences:** Total confidentiality/integrity loss for the duration of the misconfig; free inference billed to the shared test user.
- **Fix:** B-08 (startup hard-fail when flags set outside local/test; wire through `Settings`).

### BE-2 — Overdraw the meter: inference you never pay for — **High**

- **Findings:** B-04 (capture can exceed hold; no balance floor), B-06 (disconnect voids hold; $0 finalize on missing usage), B-05 (stale-hold reaper voids in-flight holds).
- **Preconditions:** A normal account with a small positive balance (the $1 signup bonus suffices — see BE-5).
- **Plain language:** Before answering, the system puts a hold on your wallet based on how long an answer you *said* you wanted. Ask for "one word" (tiny hold), then make the model write an essay anyway. The system charges the real cost afterward — but by then your wallet is empty, and it just goes negative. Repeat forever. Other flavors: hang up mid-stream and the hold is refunded even though you consumed the answer; keep the request alive past the one-hour "stale" timer and the hold vanishes entirely.
- **Technical:** Hold sized by client `max_tokens` (`token_estimation_service.py:90-95`); sufficiency checked against the estimate only; `finalize_usage` recomputes from actual provider tokens and applies the delta with no cap vs hold and no re-check (`billing_service.py:429-478`); no DB constraint against negative balances (`credits.py:196-199`). Streaming disconnect → void despite partial delivery (`chat_streaming.py:383-391, 248-264`); holds pending > `HOLD_MAX_PENDING_SECONDS` (3600 s) are voided while `finalize_usage` ignores `voided` status.
- **Consequences:** Direct revenue loss = attacker's inference consumption; scalable via scripting; invisible in per-request logs (each request "settles").
- **Fix:** B-04 (cap capture at hold / re-lock balance; DB floor), B-05 (finalize rejects voided holds; in-flight leases), B-06 (finalize partial on disconnect).

### BE-3 — Legacy API keys: the displayed prefix *is* the password — **High**

- **Findings:** B-09 (legacy keys authenticate on 9-char prefix only).
- **Preconditions:** Learn a legacy key's prefix (shown in dashboards, support screenshots, logs — including B-14's verbose logging).
- **Plain language:** Older API keys work like a hotel where showing the room number gets you in — no key card needed. The "prefix" that's printed in the UI to *identify* the key is enough to *use* it.
- **Technical:** When `encrypted_key IS NULL`, auth succeeds after lookup by `sk-xxxxxx` prefix with no hash verification (`dependencies.py:355-370, 458-471`). Modern keys verify SHA-256 correctly.
- **Consequences:** Full API access as the key's owner: inference spend on their balance, their data.
- **Fix:** B-09 (force-rotate legacy keys; reject prefix-only rows).

### BE-4 — Farm the signup bonus at scale — **Medium**

- **Findings:** B-17 (IP guard trusts spoofable `X-Forwarded-For`), B-13 (direct-access posture lets clients reach the app and supply the header), B-15 (rate limiting fails open under Redis outage, removing throttle during an attack).
- **Plain language:** New accounts get a $1 welcome credit, limited to one per internet address. But the system asks *the visitor* what their address is and believes the answer. An attacker invents a new address for each new account and collects the bonus forever — then spends it all through BE-2's free-inference tricks.
- **Technical:** `billing/index.py:56-60` reads the first `X-Forwarded-For` hop verbatim; `credits.py:650-656` enforces one bonus per IP per window on that value. The per-user guard (`signup_bonus:{user_id}` idempotency key) is solid — only the IP dimension fails.
- **Consequences:** Unbounded free credits; bonus budget drained; sybil accounts pollute every per-user metric.
- **Fix:** B-17 (trusted-proxy IP resolution).

### BE-5 — Snoop other users' payment links — **High** (upgraded 2026-07-28 — see `RESEARCHER_REPORT_TRIAGE.md`)

- **Findings:** B-03 (backend payment-link GET not token-scoped) — same defect as FE-3 one layer down; an authenticated user can skip the frontend entirely. **Dynamically confirmed in production by an external researcher; IDs are sequential MongoDB ObjectIds, so the whole payment-link population is enumerable by walking the counter.**
- **Plain language:** Any logged-in user can ask the API about any payment link by ID and see who it belongs to and how much it was for.
- **Fix:** B-03 (scope to `metadata.user_id == current_user.cognito_user_id`, 404 on mismatch).

### BE-6 — "Deactivated" users keep walking in — **Medium**

- **Findings:** B-10 (JWT path never checks `is_active`).
- **Plain language:** Disabling a user in the database doesn't actually lock them out. Until their login token expires (and while their 30-day refresh token still works), a deactivated user keeps using the service.
- **Technical:** `get_current_user` returns the (cached) user with no `is_active` check; user cache TTL 600 s; Cognito access tokens ≤ 60 min; refresh extends further. The API-key path *does* check — so this only affects JWT holders.
- **Consequences:** Access-revocation delay for banned/former users; support/ops actions that don't take effect.
- **Fix:** B-10 (check + cache invalidation on deactivation).

### BE-7 — One default string decrypts every stored API key — **Critical (config-dependent)**

- **Findings:** B-12 (`ENCRYPTION_SECRET_KEY` defaults to `encryption_secret_change_me`), B-19 (AES-CBC, no integrity).
- **Preconditions:** Any environment ran without the env var set **and** attacker obtains ciphertext (DB dump, backup leak, insider).
- **Plain language:** The secret key that encrypts everyone's stored API keys has a factory default that's printed in the public source code. If any server ever ran with that default, a stolen database backup unlocks every user's key with a password the whole world knows.
- **Consequences:** Mass API-key compromise → downstream abuse of every user's Morpheus spend and any provider keys stored.
- **Fix:** B-12 (no default; fail startup), B-19 (AES-GCM), rotation audit.

---

## 3. Combined Scenarios (frontend + backend chained)

### CB-1 — The money printer: pay once, replay the receipt forever — **Critical (currently latent)**

- **Findings:** F-02 → F-01 → B-01 (and see the B-02 caveat below).
- **Preconditions:** A credit-crediting path from the frontend webhook to the backend that actually succeeds (see "latent" note).
- **Plain language:** An attacker buys $10 of credits once, using a checkout page that lets them name *their own* account. They save the digital receipt Stripe sends to the website. Then they photocopy that receipt and hand it in a thousand times. The website never checks whether it's seen this receipt before — and the backend never does either, because every top-up request gets a fresh "definitely new" stamp. Result: $10 becomes $10,000 of inference credits.
- **Technical:** Attacker creates a checkout via the unauthenticated endpoint with their own `userId` (F-02). On completion, Stripe's signed `checkout.session.completed` payload is captured from the attacker's own webhook delivery (or any copy). Re-POSTing it N times passes signature verification every time (F-01 — the frontend stores no processed-event IDs). Each replay calls `POST /billing/credits/adjust`, whose service generates `f"adjust:{user}:{now}:{uuid4()}"` as the idempotency key (B-01) — unique per call, so the DB's unique constraint never dedupes. N replays = N credits. The ledger's idempotency machinery exists and works for the *backend* webhook path; the frontend path simply never uses it.
- **LATENT STATUS [verified statically]:** Today this chain is *accidentally blocked* — the frontend's credit call sends no Bearer token, so the backend 401s every attempt (B-02a). The exploit is one "helpful" bugfix away: anyone who makes that credit path work (adds a token, or relaxes the endpoint) without also fixing F-01/B-01 turns this Critical **live**. Fix B-01 *before* or *with* any B-02 repair.
- **Consequences:** Unbounded credit creation = direct financial loss capped only by detection time.
- **Fix:** B-01 (idempotency key on adjust, pass `stripe:{session.id}`), F-01 (persist processed event IDs), F-02 (auth + server-derived user).

### CB-2 — Double-crediting by configuration — **High**

- **Findings:** B-02c (two parallel Stripe webhook implementations, disjoint idempotency namespaces), F-01.
- **Preconditions:** Stripe dashboard has **both** the frontend (`/api/webhooks/stripe`) and backend (`/api/v1/webhooks/stripe`) endpoints registered — plausible during the frontend→backend migration.
- **Plain language:** Two different systems are both listening for "payment complete" messages, and both put money in the user's account. They keep separate guest lists, so neither realizes the other already let this payment in. Every real payment credits twice. And if the frontend listener were ever repaired (see CB-1), replays on top would credit without limit.
- **Technical:** Backend dedupes on `stripe:{event_id}:{type}` + external transaction ID; frontend path has no dedupe and credits through the random-keyed adjust endpoint. No shared keyspace → no cross-detection.
- **Consequences:** Systematic 2× overcrediting on all Stripe revenue; books won't reconcile; disputes when corrected.
- **Fix:** B-02 (one canonical webhook — the backend's; delete the frontend path; alert on error streaks).

### CB-3 — Full account takeover, end to end — **High**

- **Findings:** F-13/F-15 (XSS vectors, conditional) → F-07 (refresh token in localStorage) → B-13 (permissive CORS irrelevant — the token works from the attacker's own machine) → B-10 (deactivation doesn't cut access).
- **Preconditions:** Any one XSS primitive (F-13's header path, a compromised recorder host, or any future XSS).
- **Plain language:** One bad script on the site steals the victim's 30-day login key. The attacker uses it from their own computer — no phishing, no password. Even after support "disables" the account in the database, the attacker keeps walking in until the stolen month runs out, because the API never checks the "disabled" flag for token holders.
- **Technical:** XSS exfiltrates `cognito_refresh_token` from `localStorage`; attacker refreshes access tokens offline and calls the API directly (Bearer auth is origin-independent; CORS posture B-13 would additionally allow browser-based abuse from any HTTPS origin). `is_active` is unchecked on the JWT path (B-10), and the user cache (600 s TTL) further delays revocation.
- **Consequences:** 30-day persistent takeover: spend victim's balance, read/decrypt their API keys (the `GET /keys/default/decrypted` endpoint), change overage settings (potentially running paid-bucket spend).
- **Fix:** F-07 (BFF/cookies — but see CB-4), B-10 (is_active check), F-10 (CSP to shrink the XSS surface).

### CB-4 — The fix that opens the door: cookie auth + wide-open CORS — **High (architectural trap)**

- **Findings:** F-07's *recommended remediation* (move tokens to HttpOnly cookies) × B-13 (CORS allows **any HTTPS origin with credentials**).
- **Plain language:** The planned security upgrade — moving login tokens into browser cookies so scripts can't read them — has a trap attached. The API currently tells every browser "yes, any website can send requests here *with* cookies." The day tokens move into cookies, every malicious website on the internet can make logged-in requests as any visiting user. The upgrade must fix the door policy at the same time as moving the keys.
- **Technical:** `cors_middleware.py:188-196` + `main.py:82` reflect any `https://` origin with `Access-Control-Allow-Credentials: true`. Today auth is Bearer (non-ambient), so impact is latent; with cookie-based sessions it becomes instant CSRF + credentialed read primitive from any origin.
- **Consequences:** If shipped naively: site-wide CSRF and cross-origin data reads for every user — a regression from Medium token-theft risk to Critical ambient-authority exposure.
- **Fix:** B-13 **before/with** F-07: `allow_direct_access=False` in prod, explicit origin allowlist.

### CB-5 — Confidence schemes with real numbers: fake confirmations + snooped payments — **Medium**

- **Findings:** F-04 (forged confirmations when secret unset) + F-06/B-03 (payment-link snooping leaks amounts + Cognito subs) + F-05 (delete the victim's real notification).
- **Plain language:** An attacker learns what a victim actually paid, deletes the real "payment received" popup before the victim sees it, then injects a fake one — or contacts the victim pretending to be support quoting the real amount. Every lie is backed by true figures.
- **Consequences:** Targeted phishing/social engineering with high success probability; support-load and dispute confusion.
- **Fix:** F-04, F-05, F-06/B-03.

### CB-6 — Industrial free-inference farm — **High**

- **Findings:** BE-4 (B-17 bonus farming) × BE-2 (B-04/B-05/B-06 overdraw & void tricks) × B-15 (limits fail open) × F-02 (unauthenticated checkout for cover traffic).
- **Plain language:** Combine the three backend leaks into a business: script thousands of accounts, each collecting the $1 bonus (spoofed addresses), each account then overdrawing its wallet with the "one-word request, essay answer" trick and the hang-up refund trick — all while any Redis hiccup silently switches off the speed limits. The attacker resells the harvested inference or runs their own workloads for free.
- **Consequences:** Direct COGS bleed at scale; capacity starvation for paying users; every abuse control defeated by a different finding, so no single alert fires.
- **Fix:** B-17, B-04/B-05/B-06, B-15 — plus aggregate-level anomaly detection (per-IP account creation, negative-balance events, void rates).

### CB-7 — Laundry day: stolen cards → credited strangers → disputed chaos — **High**

- **Findings:** F-02 (checkout attributes payment to *any* userId) + CB-1's crediting path + no velocity controls (F-11/F-18).
- **Plain language:** A carder buys credits with stolen cards but puts *other people's* account IDs on the payments. Those strangers suddenly have credits they never bought. When the real cardholders dispute the charges, the paper trail points at innocent users — refunds, bans, and support chaos land on victims while the attacker already consumed or sold the inference.
- **Consequences:** Chargeback losses + Stripe account risk (excessive disputes can terminate the merchant account — existential for a payments business); wrongful bans; forensic mess.
- **Fix:** F-02 (server-derived userId), F-11/F-18 (velocity + ceilings), B-02 (single canonical crediting path with alerting).

---

## 4. Master Table

| ID | Scenario | Vector | Severity | Plain-language summary | Technical summary |
|----|----------|--------|----------|------------------------|-------------------|
| FE-1 | Unlimited checkout minting & attribution fraud | Frontend | High | Anyone can create real payment pages under your brand, in unlimited amounts, credited to anyone. | Unauthenticated `create-checkout` trusts body `userId`/`amount`/`email` (F-02); no rate limit (F-11) or ceiling (F-18); metadata drives crediting. |
| FE-2 | Notification snooping/deletion | Frontend | Medium | Strangers can see and erase your "payment received" popups. | Unauthenticated GET keyed by query `userId`; read+delete (F-05); IDOR via known Cognito sub. |
| FE-3 | Payment-link snooping via admin proxy | Frontend | **High** (researcher-confirmed; sequential ObjectIds → bulk enumeration) | Any signed-up user can flip through everyone's payment records — amounts, notes, and internal user IDs. | GET attaches `X-Admin-Secret` without caller auth (F-06); backend unscoped (B-03) and IDs enumerable; leaks amounts, custom metadata, Cognito subs. |
| FE-4 | Forged payment confirmations | Frontend | Medium | One missing config value and the site believes any fake "paid!" message. | Webhook accepts unsigned events when secret unset (F-04); condition discoverable via public diagnostic (F-12). |
| FE-5 | Account theft via script access to tokens | Frontend | High (cond.) | The site's vault of login keys is readable by any script; one injection empties it for 30 days. | Refresh token in localStorage (F-07), no CSP (F-10), conditional XSS (F-13), recorder w/o SRI (F-15), password in sessionStorage (F-09). |
| FE-6 | Login CSRF / session fixation | Frontend | Medium | Users can be silently logged into an attacker's account and type their secrets into it. | State check skipped when params absent; no PKCE (F-08). |
| BE-1 | Auth master off-switch | Backend | Critical (cfg) | A developer "let everyone in" switch can reach production silently; then no login is needed for anything. | Dual env flags bypass all auth deps (B-08); no environment guard; dev examples ship flags on. |
| BE-2 | Free inference via overdraw/void tricks | Backend | High | Say "one word," get an essay, pay nothing — the meter goes negative and nobody stops it. | Client `max_tokens` sizes hold; capture uncapped vs hold; no balance floor (B-04); disconnect voids (B-06); stale reaper voids in-flight (B-05). |
| BE-3 | Legacy key prefix = password | Backend | High | For old keys, the short ID printed in the UI is enough to use the key. | `encrypted_key IS NULL` → prefix-only auth, no hash check (B-09). |
| BE-4 | Signup-bonus farming | Backend | Medium | The one-bonus-per-address rule asks visitors for their address and believes them. | First XFF hop trusted (B-17); reachable directly (B-13); limits fail open (B-15). |
| BE-5 | Payment-link BOLA (direct API) | Backend | **High** (researcher-confirmed; enumerable) | Any logged-in user can look up — and sequentially enumerate — everyone's payment link details. | `GET /coinbase/payment-links/{id}` no ownership check (B-03); sequential ObjectIds + shared Coinbase Business account make it a bulk leak. |
| BE-6 | Deactivation doesn't revoke | Backend | Medium | Disabled users keep access until their stolen/held tokens age out. | No `is_active` check on JWT path; 600 s user cache (B-10). |
| BE-7 | Default key decrypts all stored keys | Backend | Critical (cfg) | A factory-default password from the public repo may protect every stored API key. | `ENCRYPTION_SECRET_KEY` default in source (B-12); AES-CBC no integrity (B-19). |
| CB-1 | Pay once, replay receipt forever | Combined | Critical (latent) | One real $10 payment + a photocopied receipt = unlimited credits; a blocking bug is the only thing currently stopping it. | F-02 self-attribution → F-01 no event dedupe → B-01 random idempotency key; currently 401-blocked by B-02a — fix B-01 before repairing the path. |
| CB-2 | Double-credit via dual webhooks | Combined | High | Two systems both listen for "paid" and both credit — every payment counts twice. | Frontend + backend webhook implementations, disjoint idempotency keyspaces (B-02c, F-01). |
| CB-3 | End-to-end account takeover | Combined | High | One bad script steals a 30-day key; even disabling the account doesn't stop the thief. | XSS (F-13/F-15) → localStorage refresh token (F-07) → direct API use; `is_active` unchecked (B-10). |
| CB-4 | Cookie upgrade + open CORS trap | Combined | High (trap) | The planned token-security upgrade becomes a hole unless the API's "any site may send cookies" policy is fixed first. | B-13 any-HTTPS-origin credentialed CORS × F-07 BFF/cookie remediation; ambient authority from any origin. |
| CB-5 | Real-number confidence schemes | Combined | Medium | Attackers quote your real payments, delete real confirmations, inject fake ones. | F-06/B-03 snooping → F-05 deletion → F-04 forgery. |
| CB-6 | Industrial free-inference farm | Combined | High | Bonus farming + meter tricks + self-disabling speed limits = a free compute business on your bill. | B-17 sybil × B-04/05/06 overdraw/void × B-15 fail-open; no single alert fires. |
| CB-7 | Stolen-card laundering via attribution | Combined | High | Stolen cards buy credits for innocent strangers; chargebacks hit victims and your merchant account. | F-02 arbitrary `userId` + crediting path + no velocity caps (F-11/F-18); dispute/termination risk. |

---

## 5. Priority Reading Order (if you only fix ten things)

1. **CB-1 chain** — B-01 idempotency *first*, then B-02 canonical webhook, then F-01/F-02. (Order matters: repairing the 401-ing credit path before B-01 activates the Critical.)
2. **B-08** — startup guard on auth-bypass flags.
3. **B-12** — remove encryption-key default; rotation audit.
4. **BE-2 cluster** — B-04/B-05/B-06 billing integrity.
5. **B-13** — CORS direct-access off in prod (unblocks safe F-07 work).
6. **F-02** — auth + server-derived userId on checkout.
7. **B-09** — legacy key rotation.
8. **F-07/F-10/F-13** — token storage + CSP + geo-header validation (shrinks CB-3 to near-zero).
9. **B-10** — is_active check.
10. **B-14** — stop logging request bodies (limits every other scenario's blast radius).

## 6. Attacks That Currently FAIL (verified defenses — don't over-fix)

- **Replay against the backend's own webhooks:** two-level idempotency (event ID + transaction ID) backed by a unique constraint; concurrent duplicate deliveries die on `IntegrityError` and roll back. Stripe credits `amount_total`, not client metadata. ✔
- **Forging backend webhooks:** Stripe SDK signature verification and Coinbase HMAC-SHA256 + `compare_digest` + 5-min replay window; both fail **closed** (503) when secrets are unset. ✔
- **SQL injection:** no raw/f-string SQL anywhere; ORM + bound parameters. ✔
- **Cross-user reads on chat history, wallets, API keys, billing reads:** all scoped to `current_user.id`; wrong-owner operations return 404. ✔
- **Wallet-linking hijack:** EIP-191 signature + server nonce verified. ✔
- **Admin secret brute force / timing:** `secrets.compare_digest`; 503 when unset. ✔
- **Signup bonus double-grant per user:** unique `signup_bonus:{user_id}` key (only the per-IP dimension is weak — BE-4). ✔
- **Race conditions on holds:** `SELECT … FOR UPDATE` on the hot path; advisory lock on the reconciliation reaper. ✔ (The *policies* around capture/void are what's broken — B-04/B-05 — not the locking.)

---

## 7. Limitations

- Scenarios are built from statically-confirmed findings; runtime states (Stripe endpoint configuration, env values per environment, WAF/ALB rules) determine which conditional scenarios are live. CB-1/CB-2 especially need the Stripe dashboard + webhook attempt logs to resolve.
- No exploit was executed; "latent" labels reflect static certainty about blocking conditions (e.g. the missing Bearer token), not runtime testing.
- The proxy-router, Cognito pool configuration, and third-party analytics host are out of scope; several scenarios (FE-5, CB-5) inherit their risk.
