# Coinbase Payment Fixes - Corrected Architecture

## Critical Clarification

**Two separate systems:**

1. **Frontend (This Repo):** `Morpheus-Marketplace-APP` (Next.js)
   - Hosted at: `https://app.mor.org`
   - Creates payment charges
   - Displays UI and balance

2. **Backend API (Other Repo):** `morpheus-marketplace-api` (Python/FastAPI)
   - Hosted at: `https://api.mor.org` (prod) / `https://api.dev.mor.org` (dev)
   - Receives webhooks from Coinbase
   - Manages database and credits

---

## Webhook Configuration (CRITICAL)

### ✅ Correct Configuration

**Coinbase Developer Portal → Webhooks:**
```
Webhook URL: https://api.mor.org/api/v1/webhooks/coinbase
             ^^^^^^^^ BACKEND API, not frontend!

Dev/Staging: https://api.dev.mor.org/api/v1/webhooks/coinbase
```

### ❌ Wrong Configuration (DO NOT USE)

```
❌ https://app.mor.org/api/webhooks/coinbase
   ^^^^^^^^ This is the frontend, webhooks won't work!
   
❌ https://app.mor.org/api/v1/webhooks/coinbase
   ^^^^^^^^ Still wrong - no webhook handler in Next.js app
```

---

## Why This Matters

**What happens if webhook points to frontend:**
1. Coinbase sends webhook to `app.mor.org`
2. Next.js doesn't have the webhook handler
3. Returns 404 or error
4. Credits never added to user account
5. Coinbase keeps retrying
6. User's payment succeeds but balance doesn't update ❌

**What happens with correct configuration:**
1. Coinbase sends webhook to `api.mor.org`
2. Python backend receives it
3. Validates signature and user_id
4. Updates database
5. Returns 200 OK
6. User's balance updates ✅

---

## What I Fixed

### Frontend (Morpheus-Marketplace-APP) - ✅ Done

**Files:**
- `src/components/billing/FundingSection.tsx`
- `src/app/api/coinbase/charge/route.ts`

**Changes:**
1. Prevents anonymous payments (requires userId)
2. Refreshes balance after successful payment
3. Better validation and error messages

**Deploy:** Ready now!

### Backend (morpheus-marketplace-api) - ⚠️ Needs Work

**File:** Webhook handler (Python)
**Endpoint:** `/api/v1/webhooks/coinbase`

**Changes needed:**
1. Idempotency check (prevent double-crediting)
2. Better validation (handle missing user_id gracefully)
3. Enhanced logging (debugging)

**See:** `BACKEND_WEBHOOK_FIXES.md` for Python code

---

## Environment Variables - Correct Locations

### Frontend Environment Variables
```bash
# Morpheus-Marketplace-APP (.env.local)
COINBASE_COMMERCE_API_KEY=<key>     # For creating charges
NEXT_PUBLIC_API_BASE_URL=https://api.mor.org
NEXT_PUBLIC_APP_URL=https://app.mor.org
```

### Backend Environment Variables
```bash
# morpheus-marketplace-api
COINBASE_COMMERCE_WEBHOOK_SECRET=<secret>  # For verifying webhooks
ADMIN_API_SECRET=<secret>                   # For credit adjustments
DATABASE_URL=postgresql://...
```

---

## Complete Payment Flow (Corrected)

```
1. User clicks "Pay with Crypto" 
   → Frontend (app.mor.org)

2. Frontend creates charge
   → POST app.mor.org/api/coinbase/charge
   → Calls Coinbase Commerce API
   → Gets payment URL

3. User completes payment
   → Redirected to commerce.coinbase.com
   → Pays with crypto
   → Redirected back to app.mor.org/billing?payment=success

4. Coinbase sends webhook
   → POST api.mor.org/api/v1/webhooks/coinbase  ← BACKEND!
   → Backend validates and credits account
   → Returns 200 OK

5. Frontend refreshes
   → Page reloads after 2 seconds
   → Fetches new balance from api.mor.org/api/v1/billing/balance
   → Shows updated balance
```

---

## Webhook URL Checklist

Before deploying, verify in Coinbase dashboard:

**Legacy Commerce API webhooks:**
- [ ] URL is `https://api.mor.org/api/v1/webhooks/coinbase`
- [ ] NOT `app.mor.org` (frontend)
- [ ] Events: All charge.* events selected
- [ ] Secret matches `COINBASE_COMMERCE_WEBHOOK_SECRET` in backend

**Payment Links API webhooks (future):**
- [ ] Same URL: `https://api.mor.org/api/v1/webhooks/coinbase`
- [ ] Events: All payment_link.payment.* events selected  
- [ ] Secret matches `COINBASE_WEBHOOK_SECRET` in backend
- [ ] Backend handler auto-detects format (already implemented per OpenAPI spec)

---

## Quick Verification

```bash
# Check current webhook configuration
# In Coinbase dashboard: Settings → Webhooks

# Should show:
Endpoint URL: https://api.mor.org/api/v1/webhooks/coinbase
              ^^^^^^^^ api.mor.org (BACKEND)

# NOT:
Endpoint URL: https://app.mor.org/...
              ^^^^^^^^ app.mor.org (FRONTEND) ← WRONG!
```

---

## Files to Deploy

### This Repo (Morpheus-Marketplace-APP)
```bash
git add src/components/billing/FundingSection.tsx
git add src/app/api/coinbase/charge/route.ts
git commit -m "fix: prevent anonymous Coinbase payments, fix balance refresh"
git push origin main
```

### Other Repo (morpheus-marketplace-api)
```bash
# Apply Python code fixes from BACKEND_WEBHOOK_FIXES.md
# Then:
git add <webhook_handler_file>
git commit -m "fix: Coinbase webhook idempotency and validation"
git push origin main
```

---

## Summary

| Component | Location | Hostname | Responsibility |
|-----------|----------|----------|----------------|
| **Frontend** | This repo | app.mor.org | UI, charge creation |
| **Backend** | Other repo | api.mor.org | Webhooks, database, credits |
| **Webhooks point to** | → | **api.mor.org** | Backend handles webhooks! |

**Key takeaway:** Coinbase webhooks → Backend API, NOT frontend!

---

**Last updated:** February 12, 2026  
**All webhook references corrected:** ✅
