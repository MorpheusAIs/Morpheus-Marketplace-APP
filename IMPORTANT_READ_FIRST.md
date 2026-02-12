# 🚨 IMPORTANT - Read This First

## Critical Corrections

### 1. Authentication System (CORRECTED)

**What I initially said (WRONG):**
```bash
❌ Permissions: onramp:payment_links:create, onramp:payment_links:read
❌ COINBASE_API_KEY=simple_string
❌ COINBASE_API_SECRET=simple_string
```

**What's actually correct:**
```bash
✅ Permission: "View" scope (includes all Payment Links API access)
✅ COINBASE_CDP_KEY_NAME=organizations/{org_id}/apiKeys/{key_id}
✅ COINBASE_CDP_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
```

**Why the confusion:**
- I incorrectly assumed OAuth2-style granular permissions
- Coinbase actually uses a simpler 3-tier system: View/Trade/Transfer
- Payment Links API uses JWT Bearer tokens, not API key headers

**See:** `COINBASE_AUTH_CORRECTION.md` for details

---

### 2. Webhook Architecture (CORRECTED)

**Webhooks point to BACKEND, not frontend:**

✅ **Correct:**
```
https://api.mor.org/api/v1/webhooks/coinbase          (Production)
https://api.dev.mor.org/api/v1/webhooks/coinbase      (Dev)
```

❌ **Wrong:**
```
https://app.mor.org/api/webhooks/coinbase            (Frontend - NO!)
```

**Why this matters:**
- Webhooks must hit the Python backend (morpheus-marketplace-api)
- Backend has database access to credit accounts
- Frontend (Next.js) cannot handle webhooks properly

---

## What You Need to Do

### Immediate (Today):

1. **Deploy frontend fixes** (this repo)
   - Already applied to FundingSection.tsx and charge/route.ts
   - Prevents anonymous payments
   - Fixes balance refresh
   
2. **Apply backend webhook fixes** (other repo)
   - See: `BACKEND_WEBHOOK_FIXES.md`
   - Add idempotency
   - Better validation
   - Enhanced logging

3. **Verify webhook URL** in Coinbase dashboard
   - Should be: `https://api.mor.org/api/v1/webhooks/coinbase`
   - NOT: `https://app.mor.org/...`

### Short-term (This Month):

4. **Plan Payment Links API migration**
   - Get CDP API credentials (with "View" permission)
   - Implement JWT generation (backend)
   - Test in sandbox
   - See: `COINBASE_MIGRATION_GUIDE.md`

---

## What's Working Now (After Frontend Fixes)

✅ **Anonymous payments blocked**
- Button disabled when not logged in
- Server-side validation in charge creation
- User sees clear "Login required" message

✅ **Balance refresh working**
- Page reloads 2 seconds after payment success
- Fetches latest balance from backend
- User sees updated credits

⚠️ **Webhook reliability** (needs backend fixes)
- Currently: Some webhooks fail with "Missing user_id"
- After fixes: All webhooks should succeed
- Idempotency prevents double-crediting

---

## Files Status

### Frontend (Morpheus-Marketplace-APP) - ✅ Fixed
```
✅ src/components/billing/FundingSection.tsx
✅ src/app/api/coinbase/charge/route.ts
✅ .env.example
```

### Backend (morpheus-marketplace-api) - ⚠️ Needs Updates
```
⚠️ Webhook handler at /api/v1/webhooks/coinbase
   (Apply Python code from BACKEND_WEBHOOK_FIXES.md)
```

---

## Documentation Guide

**Start here:**
1. This file (you're reading it!)
2. `README_COINBASE_FIXES.md` - Overview
3. `ARCHITECTURE.md` - System diagram

**For deployment:**
4. `QUICKSTART_DEPLOYMENT.md` - Fast deployment steps
5. `DEPLOYMENT_CHECKLIST.md` - Verification checklist

**For backend team:**
6. `BACKEND_WEBHOOK_FIXES.md` - Python code to apply

**For future migration:**
7. `COINBASE_AUTH_CORRECTION.md` - Authentication details (CORRECTED)
8. `COINBASE_MIGRATION_GUIDE.md` - Payment Links API migration

**Reference:**
9. `COINBASE_PAYMENT_ISSUES.md` - Original bug report
10. `COINBASE_FIXES_SUMMARY.md` - Technical details

---

## Quick Test

After deploying both frontend and backend fixes:

```bash
# Test 1: Anonymous payment blocked
1. Logout or open incognito
2. Go to /billing
3. "Pay with Crypto" button should be DISABLED ✅

# Test 2: Payment works
1. Login
2. Pay $1 with crypto
3. Complete payment on Coinbase
4. Wait 5 seconds
5. Balance should increase by $1 ✅

# Test 3: No duplicate credits
1. Check database: Only 1 ledger entry per payment ✅
2. Check logs: "already processed, skipping" on duplicate webhooks ✅
```

---

## Questions?

**Authentication confusion?** → Read `COINBASE_AUTH_CORRECTION.md`  
**Webhook not working?** → Check webhook points to `api.mor.org` not `app.mor.org`  
**Balance not updating?** → Frontend fixes should resolve (page reload after 2s)  
**Double credits?** → Backend needs idempotency fix  

**Still stuck?** File GitHub issue with logs and error messages.

---

**Last updated:** February 12, 2026  
**Status:** Frontend ready, backend needs updates  
**Priority:** High - blocks payments for some users
