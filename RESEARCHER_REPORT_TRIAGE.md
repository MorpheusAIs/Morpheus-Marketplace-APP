# Researcher Report Triage — Coinbase Payment-Link BOLA (B-03 / FE-3)

**Date:** 2026-07-28
**Branch:** `security/frontend-only-hardening`
**Report:** External researcher disclosure — "Cross-user IDOR on Coinbase payment-link lookup leaks all users' payment records" (CVSS 6.5, Medium per researcher; **reassessed High here**, see section 3)
**Related audit findings:** `Morpheus-Marketplace-API/SECURITY_ANALYSIS.md` **B-03**; `SECURITY_ANALYSIS.md` **F-06**; `ATTACK_SCENARIOS.md` **FE-3** / **BE-5** (feeds **FE-2**, **CB-5**)

---

## 1. Verdict: related — this is the dynamic confirmation of B-03 / FE-3, with two material upgrades

The reported endpoint (`GET /api/v1/billing/coinbase/payment-links/{id}`, authenticated but not ownership-scoped) is exactly **B-03** (backend) and the backend half of **FE-3** (frontend proxy, F-06). The audits identified it statically; the researcher **confirmed it live in production** with two self-registered accounts. No new vulnerability class — but the report changes the severity math on two axes the audits had flagged as unknowns.

## 2. What the report adds beyond the audits

| # | New fact | Audit assumption it overrides |
|---|---|---|
| 1 | **IDs are sequential MongoDB ObjectIds** — 4-byte timestamp + per-instance machine segment + 3-byte counter incrementing by exactly 1 per link, drawn from one **shared Coinbase Business account**. Attacker creates one link to learn the counter, then walks it. | FE-3/B-03 treated IDs as "24-char hex — hard to guess, but leak via logs/analytics/referrers." Enumeration was hypothetical; it is now demonstrated and trivial. Single-record IDOR → **bulk leak of the entire payment-link population**. |
| 2 | **Live exploitation verified** against `api.mor.org` with two ordinary accounts (200 responses cross-account). | B-03/FE-3 were static findings; the precondition "know/learn a victim's ID" is gone entirely — any valid account suffices. |
| 3 | **Arbitrary custom metadata leaks** — the create endpoint accepts `additionalProperties: true` metadata, and records are returned verbatim (researcher stored/read `private_note`, `internal_ref` cross-account). | Audits noted `metadata` "may contain `user_id`"; actual exposure is whatever callers attach, plus free-text `description` (invoice/customer detail in practice). |
| 4 | The handler **proxies the caller-supplied ID straight to the shared Coinbase Business API** (`business.coinbase.com/api/v1/payment-links/{id}`). | Confirms the fix cannot be delegated to Coinbase-side scoping — ownership must be enforced in the backend handler (or a local ownership record). |
| 5 | The endpoint is **live and user-facing** (app.mor.org "Add Funds with Coinbase" flow), not a legacy path. | Consistent with the topology analysis in `FRONTEND_ONLY_REMEDIATION.md` section 1; removes any "dead code" deprioritization argument. |

## 3. Severity reassessment: Medium → High (for B-03 / FE-3 / BE-5)

- Researcher scored CVSS 6.5 (`AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N`) — already the top of Medium on a single-record reading.
- With **enumerability demonstrated**, the impact is a bulk, scriptable disclosure of every user's payment amounts, statuses, descriptions, custom metadata, live Coinbase URLs, and stable Cognito `sub`s. The `sub` harvest weaponizes **FE-2** (unauthenticated notification read/delete keyed by `sub`) and **CB-5** (confidence schemes quoting real amounts) at scale rather than per-victim.
- No integrity/availability impact and no money movement — so not Critical. **High** on this repo's scale: the preconditions have collapsed to "register a free account."
- `ATTACK_SCENARIOS.md` FE-3, BE-5, and the master table have been updated accordingly.

## 4. Fix status against the existing plan

| Layer | Fix | Status |
|---|---|---|
| Backend (**B-03**) | Scope lookup to `metadata.user_id == current_user.cognito_user_id`, return **404** on mismatch (the researcher's remediation matches the audit's exactly). | **The only complete fix. Escalate to High priority in the backend repo.** The researcher's further suggestion — store links locally keyed by `(user_id, payment_link_id)` — is a sound hardening on top. |
| Frontend proxy (**F-06**) | Require Bearer on the GET. | Already planned (P2 in `FRONTEND_ONLY_REMEDIATION.md`). **Necessary but not sufficient**: stops anonymous probing, does nothing against an authenticated enumerator. |
| Frontend proxy (new, defense-in-depth) | Strip `metadata` from the proxied response in the Next.js route (UI needs only `id`/`url`/`status`/`amount`/`currency`/`expires_at`). Constraint-safe — does not change the load sent to the backend. | Added to `FRONTEND_ONLY_REMEDIATION.md` F-06 section. Protects the frontend channel only; direct API callers are unaffected until B-03 lands. |
| Downstream (**FE-2 / CB-5**) | F-04/F-05 fixes (fail-closed webhook, authenticated notification polling). | Unchanged, but their priority is reinforced: they are the blast radius of the mass `sub` harvest this bug enables. |

## 5. Operational follow-ups

1. **Backend repo:** bump B-03 to High and prioritize; the priority list in `ATTACK_SCENARIOS.md` section 5 should slot B-03 alongside the P1 auth items.
2. **Access logs:** query backend logs for `GET .../payment-links/{id}` patterns consistent with counter-walking (sequential IDs, one token, many distinct IDs) — the researcher's PoC traffic (accounts cited as user ids 18527/18560) and any copycat enumeration should be identifiable.
3. **Disclosure response:** thank the researcher, confirm the finding maps to a known internally-tracked issue (B-03), share remediation timeline. The report is accurate, well-scoped, and used clean two-account methodology.
4. **Consider** dropping support for caller-supplied custom metadata on payment-link creation (or excluding it from GET responses) until B-03 ships — reduces leak content even while IDs remain enumerable.

## 6. What this report does NOT change

- No payment-integrity impact: crediting flows through the backend's own Coinbase webhook (fails closed, verified in the backend audit). This is a confidentiality bug, not theft.
- No new frontend-only Critical: the frontend-only plan's P0 (legacy Stripe route deletion) and P1 items are unaffected.
- CB-1/CB-2 latent statuses are unchanged.
