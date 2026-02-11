# Coinbase Payment Integration Issues

## Date: February 12, 2026
## Status: CRITICAL - Payments failing intermittently, balances not updating

---

## Issues Identified

### 1. **Missing user_id in webhook metadata** ❌

**Root Cause:**
- Frontend allows 'anonymous' payments when userId is undefined
- Backend webhook expects valid `cognito_user_id` to credit accounts
- 'anonymous' payments create charges but fail at webhook processing

**Code Location:**
- `src/components/billing/FundingSection.tsx:83`
```typescript
userId: userId || 'anonymous',  // ❌ Should not allow anonymous payments
```

- `src/app/api/webhooks/coinbase/route.ts:68-74`
```typescript
if (!userId) {
  console.error('No userId in charge metadata');  // ❌ Silent failure
  return;
}
```

**Impact:**
- Payments go through on Coinbase side
- User's account never gets credited
- Money is taken but credits not added

---

### 2. **Balance not updating after successful payment** ❌

**Root Cause:**
- Frontend only shows success message but doesn't refresh balance from backend
- `onBalanceUpdate(0)` doesn't actually fetch new balance

**Code Location:**
- `src/components/billing/FundingSection.tsx:36-42`
```typescript
if (payment === 'success') {
  setFlowState('stripe_success');
  window.history.replaceState({}, '', window.location.pathname);
  if (onBalanceUpdate) {
    onBalanceUpdate(0);  // ❌ This does nothing useful
  }
}
```

**Impact:**
- User completes payment successfully
- Credits are added to backend
- UI still shows old balance
- User thinks payment failed

---

### 3. **Using deprecated Coinbase Commerce API** ⚠️

**Current:**
- Using old `api.commerce.coinbase.com/charges` endpoint
- API version: `2018-03-22` (8 years old!)
- Coinbase has deleted old docs: https://docs.cdp.coinbase.com/commerce/api-arcitecture/webhooks-fields

**Should use:**
- New Payment Links API: https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/overview
- Migration guide: https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/migrate/overview

**Code Locations:**
- `src/app/api/coinbase/charge/route.ts:3`
- `src/app/api/coinbase/charge/route.ts:114-122`
- `src/app/api/webhooks/coinbase/route.ts`

---

### 4. **Coinbase webhook receives multiple events for single payment** ⚠️

**Observed from logs:**
```
POST /api/v1/webhooks/coinbase - 500 (multiple times)
POST /api/v1/webhooks/coinbase - 200 (eventually succeeds)
```

**Possible causes:**
- Coinbase retries failed webhooks
- Multiple event types sent for same payment
- Our webhook sometimes fails → Coinbase retries → eventually succeeds
- But first few failures might be due to missing user_id

---

### 5. **No webhook signature verification in production** 🔒

**Current state:**
```typescript
if (webhookSecret && signature) {
  // verify
} else if (webhookSecret && !signature) {
  return error
}
// ❌ If no webhookSecret set, accepts ANY webhook!
```

**Security risk:**
- If `COINBASE_COMMERCE_WEBHOOK_SECRET` is not set, accepts all webhooks
- Anyone can fake payment confirmations

---

## Evidence from Logs

### Multiple webhook attempts for same payment:
```
2026-02-11T22:19:16 - POST /api/v1/webhooks/coinbase - 500
{"error": "Missing user_id in metadata"}

2026-02-11T22:19:16 - POST /api/v1/webhooks/coinbase - 500  
{"error": "Missing user_id in metadata"}

2026-02-11T22:18:16 - POST /api/v1/webhooks/coinbase - 500
[Cached since 112.6s ago] ('K2V6CS3I', 'coinbase')
```

### Successful processing after retries:
```
2026-02-11T22:19:16 - Received legacy Commerce webhook
{"event": "Received legacy Commerce webhook event (Consider migrating to Payment Link API)"}
```

---

## Immediate Fixes Required

### Priority 1: Prevent anonymous payments
- [ ] Remove 'anonymous' fallback from FundingSection
- [ ] Require authentication before showing payment options
- [ ] Add proper error handling when userId is missing

### Priority 2: Fix balance refresh
- [ ] Actually fetch new balance from backend after payment
- [ ] Show loading state during balance refresh
- [ ] Handle refresh errors gracefully

### Priority 3: Improve webhook reliability  
- [ ] Add idempotency to prevent double-crediting
- [ ] Store charge IDs to track processed payments
- [ ] Add better error logging with charge details
- [ ] Gracefully handle 'anonymous' without failing

### Priority 4: Migrate to Payment Links API
- [ ] Update charge creation to use new API
- [ ] Update webhook handler for new event format
- [ ] Test with sandbox/test environment
- [ ] Deploy and monitor

---

## Migration Path to Payment Links API

### Current (Old Commerce API):
```typescript
POST https://api.commerce.coinbase.com/charges
Headers: X-CC-Api-Key, X-CC-Version: 2018-03-22
```

### New (Payment Links API):
```typescript
POST https://api.coinbase.com/api/v3/onramp/payment-links
Headers: Authorization: Bearer <access_token>
```

**Key differences:**
- Different authentication (OAuth vs API key)
- Different webhook signature header names
- Different event payload structure
- Different redirect URL handling

**Migration guide:**
https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/migrate/overview#migration-summary

---

## Testing Checklist

- [ ] Test with valid logged-in user
- [ ] Test with missing userId (should block payment)
- [ ] Test balance refresh after payment success
- [ ] Test webhook idempotency (send same webhook twice)
- [ ] Test webhook signature verification
- [ ] Test Coinbase payment with small amount ($1)
- [ ] Verify credits appear in backend database
- [ ] Verify credits appear in frontend UI
- [ ] Test redirect back to app after payment
- [ ] Test cancel flow

---

## Environment Variables Required

```bash
# Old API (current)
COINBASE_COMMERCE_API_KEY=<key>
COINBASE_COMMERCE_WEBHOOK_SECRET=<secret>

# New API (after migration)
COINBASE_API_KEY=<new_key>
COINBASE_API_SECRET=<new_secret>
COINBASE_WEBHOOK_SECRET=<new_webhook_secret>
```

---

## Next Steps

1. **Immediate (Today):**
   - Apply Priority 1 & 2 fixes
   - Deploy to production
   - Monitor webhook logs

2. **This Week:**
   - Apply Priority 3 fixes
   - Add comprehensive logging
   - Set up alerts for failed webhooks

3. **Next Sprint:**
   - Plan Payment Links API migration
   - Set up test environment
   - Implement and test new integration
   - Deploy with feature flag

---

## Related Files

### Morpheus-Marketplace-APP (Frontend - This Repo)
- `src/components/billing/FundingSection.tsx` - Payment UI and flow
- `src/app/api/coinbase/charge/route.ts` - Charge creation via Coinbase API

### morpheus-marketplace-api (Backend - Other Repo)
- `/api/v1/webhooks/coinbase` - Webhook handler (Python/FastAPI)
- Database models for credit_ledger, user_balances
- `/api/v1/billing/credits/adjust` - Admin endpoint for crediting accounts

**Webhook URL Configuration:**
- Dev: `https://api.dev.mor.org/api/v1/webhooks/coinbase`
- Prod: `https://api.mor.org/api/v1/webhooks/coinbase`

---

## Backend API Schema

The backend expects:
```json
POST /api/v1/billing/credits/adjust
Headers: {
  "X-Admin-Secret": "<secret>",
  "Content-Type": "application/json"
}
Body: {
  "cognito_user_id": "uuid",
  "amount_usd": 10.00,
  "description": "Coinbase payment: ..."
}
```

**Important:** Uses `cognito_user_id` not `user_id`!
