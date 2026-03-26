# Coinbase Payment Links API Migration Guide

## Overview

This guide walks through migrating from the deprecated Coinbase Commerce API to the modern Payment Links API.

**Status:** Frontend migration COMPLETE - ready for integration testing
**Target completion:** March 31, 2026 (Commerce API shutdown deadline)
**Risk level:** Medium (payment processing critical)

> **MIGRATION COMPLETED:** The frontend has been updated to use the Coinbase Business
> Payment Link API via the backend admin endpoints. The old Commerce API charge route
> has been removed. See backend PR #225 in Morpheus-Marketplace-API for the corresponding
> backend changes.
>
> **Architecture change:** The frontend no longer calls Coinbase APIs directly. Instead,
> it calls the backend admin endpoint (`POST /admin/payment-links`) which handles JWT
> authentication with Coinbase and auto-injects `user_id` metadata.
>
> **Key frontend changes:**
> - `src/app/api/coinbase/charge/route.ts` → REMOVED
> - `src/app/api/coinbase/payment-link/route.ts` → NEW (calls backend admin API)
> - Webhook handler updated for `X-Hook0-Signature` and `payment_link.payment.*` events
> - UI updated: USDC on Base instead of multi-currency, faster confirmation messaging
> - Environment: Uses `ADMIN_API_SECRET` + `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET`

---

## Changes Summary

### What's Fixed (Immediate Patches - Already Applied ✅)

1. **Frontend validation** - No more anonymous payments
2. **Balance refresh** - Page reloads after successful payment to show new balance
3. **Webhook robustness** - Better error handling, idempotency, logging
4. **Security** - Proper signature verification enforced

### What's New (Migration - Implemented in this repo)

1. **Backend Payment Links API integration** in morpheus-marketplace-api
2. **Frontend payment-link creation** using the new API format
3. **Modern Coinbase integration** following 2024 best practices

**Note:** Payment Links API migration requires changes in BOTH repositories:
- **morpheus-marketplace-api** (backend) - webhook handler updates
- **Morpheus-Marketplace-APP** (frontend) - payment-link creation and confirmation UX updates

---

## Migration Steps

### Phase 1: Immediate Deployment (Fixes)

**Files changed in Morpheus-Marketplace-APP:**
- ✅ `src/components/billing/FundingSection.tsx`
- ✅ `src/app/api/coinbase/payment-link/route.ts`
- ✅ `src/app/api/webhooks/coinbase-notification/route.ts`

**Files that need fixing in morpheus-marketplace-api:**
- ⚠️ Backend webhook handler (see BACKEND_WEBHOOK_FIXES.md)

**Deploy these changes immediately** to fix the current issues:
- Missing user_id errors
- Balance not updating
- Better webhook reliability

**Testing checklist:**
```bash
# 1. Verify no anonymous payments possible
- [ ] Try to pay without logging in → Should show "Login required"
- [ ] Try with userId=null → Should get 401 error

# 2. Test payment flow
- [ ] Log in as test user
- [ ] Click "Pay with Crypto"
- [ ] Enter $5 amount
- [ ] Complete payment on Coinbase
- [ ] Verify webhook received (check backend logs)
- [ ] Verify balance updates after 2 seconds
- [ ] Check database: credits should be added

# 3. Test idempotency
- [ ] Manually trigger same webhook twice
- [ ] Verify credits only added once
```

**Rollback plan:**
```bash
git revert HEAD~1  # If issues occur
```

---

### Phase 2: Payment Links API Setup (New Integration)

#### Step 1: Get Coinbase API Credentials

1. Log into [Coinbase Developer Portal](https://portal.cdp.coinbase.com/projects/api-keys)
2. Click "Create API key"
3. Configure the API key:
   - **Nickname:** "Morpheus Marketplace Payment Links"
   - **API restrictions:** Enable **View** permission
     - This grants access to Payment Links API (create, update, manage)
   - **IP allowlist:** (Optional but recommended) Add your server IPs
   - **Signature algorithm:** Select **ECDSA** (recommended)
4. Click "Create API key"
5. **Save these securely** (shown only once):
   - API Key Name (e.g., `organizations/{org_id}/apiKeys/{key_id}`)
   - Private Key (multi-line EC private key)

**Permission details:**
- **View** permission includes Payment Links API access
- You do NOT need "Trade" or "Transfer" permissions for payment links
- See [Coinbase API Key docs](https://docs.cdp.coinbase.com/coinbase-business/authentication-authorization/api-key-authentication)

#### Step 2: Update Environment Variables

**Important:** In the current architecture, JWT Bearer tokens generated from CDP API keys are handled in `morpheus-marketplace-api`, not in this frontend repo.

Add to `.env.local` (development):
```bash
# Frontend runtime
ADMIN_API_SECRET=your_admin_secret
NEXT_PUBLIC_API_BASE_URL=https://api.mor.org
COINBASE_PAYMENT_LINK_WEBHOOK_SECRET=your_new_webhook_secret_here
```

Add to backend environment variables:
```bash
# In morpheus-marketplace-api
COINBASE_CDP_KEY_NAME=organizations/{org_id}/apiKeys/{key_id}
COINBASE_CDP_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----\n"
COINBASE_PAYMENT_LINK_WEBHOOK_SECRET=your_webhook_secret
```

**Note:** The frontend calls the backend API only; CDP credential handling and JWT generation live in `morpheus-marketplace-api`.

#### Step 3: Configure Webhooks

1. In Coinbase Developer Portal:
   - Go to Webhooks settings
   - Add new webhook endpoint (or update existing):
     - **URL:** `https://api.mor.org/api/v1/webhooks/coinbase`
     - **Events:** Select all `payment_link.payment.*` events (new API)
     - **Note:** Same endpoint handles both old and new API formats!
    - Save webhook secret to frontend environment variables as `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET`

2. Test webhook:
```bash
# Test in dev environment first
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -H "X-Hook0-Signature: test" \
  -d '{"event_type":"payment_link.payment.success","data":{"metadata":{"user_id":"test-uuid"}}}'

# Production
curl -X POST https://api.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -H "X-Hook0-Signature: test" \
  -d '{"event_type":"payment_link.payment.success","data":{"metadata":{"user_id":"test-uuid"}}}'
```

**Important:** The backend webhook handler already auto-detects API version based on signature header:
- `X-CC-Webhook-Signature` → Legacy Commerce API
- `X-Hook0-Signature` → Payment Links API

#### Step 4: Test New Implementation

Create test payment link:
```typescript
// In browser console or API testing tool
fetch('/api/coinbase/payment-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    amount: '5.00',
    currency: 'USDC',
    userId: 'YOUR_COGNITO_USER_ID',
    description: 'Test payment'
  })
})
.then(r => r.json())
.then(data => console.log(data))
```

Expected response:
```json
{
  "success": true,
  "payment_link": {
    "id": "69163c762331ed43dc64a6ef",
    "url": "https://pay.coinbase.com/...",
    "expires_at": "2026-02-12T12:00:00Z",
    "metadata": {
      "user_id": "..."
    }
  }
}
```

---

### Phase 3: Frontend Validation and Rollout

The old charge route is already removed in this repo. Frontend rollout now focuses on validating the current payment-link flow against the completed backend migration.

Checklist:

1. Verify the app only calls `/api/coinbase/payment-link`
2. Verify the backend returns `payment_link.url` and 24-char hex IDs
3. Verify the billing redirect flow shows success and confirmation messaging
4. Verify the frontend notification bridge receives `payment_link.payment.*` events

---

### Phase 4: Cleanup

After successful migration:

1. **Remove remaining legacy references from docs/config:**
```bash
# In Morpheus-Marketplace-APP repo
# Remove old Coinbase Commerce references from docs and deployment config
```

2. **Update backend:**
```bash
# In morpheus-marketplace-api repo
# Remove legacy Commerce API support from webhook handler
# Keep only Payment Links API logic
```

3. **Update references:**
- Update FundingSection to only use new endpoint
- Remove feature flags
- Update documentation

3. **Remove old environment variables:**
```bash
# Delete from Vercel/production
COINBASE_COMMERCE_API_KEY
COINBASE_COMMERCE_WEBHOOK_SECRET
```

4. **Disable old webhook:**
- In Coinbase dashboard, disable old webhook endpoint
- Keep for 30 days in case of rollback needed

---

## Rollback Plan

If issues occur after migration:

### Immediate Rollback (< 5 minutes)
```bash
# 1. Redeploy the previous frontend build

# 2. Verify the billing page loads and the previous payment-link flow is restored
curl https://app.mor.org/api/coinbase/payment-link?id=test
```

### Extended Rollback (< 1 hour)
```bash
# 1. Revert git commits
git revert HEAD~3  # Revert last 3 commits

# 2. Redeploy
git push origin main

# 3. Update webhook URL in Coinbase dashboard
# Back to: /api/webhooks/coinbase
```

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Payment success rate**
   - Old API baseline: [Record current %]
   - New API target: ≥ baseline
   - Alert if: < 95%

2. **Webhook processing time**
   - Old API baseline: [Record current avg]
   - New API target: < 2 seconds
   - Alert if: > 5 seconds

3. **Failed webhooks**
   - Target: 0 failures
   - Alert if: > 5 failures in 1 hour

4. **Balance update latency**
   - Target: < 10 seconds from payment to balance update
   - Alert if: > 30 seconds

### Log Queries

**Check for webhook failures:**
```bash
# In your logging system (e.g., Vercel logs)
"[Payment Link Webhook] Error" OR "[Coinbase Webhook] Error"
```

**Check for missing user_id:**
```bash
"Missing or invalid user_id"
```

**Check for duplicate processing:**
```bash
"already processed"
```

---

## Testing Checklist

### Pre-deployment
- [ ] All environment variables set
- [ ] Webhook endpoint configured in Coinbase dashboard
- [ ] Test payment link creation succeeds
- [ ] Test webhook signature verification works
- [ ] Code reviewed by 2+ team members
- [ ] Rollback plan documented and tested

### Post-deployment
- [ ] Make test payment ($1) and verify:
  - [ ] Payment link opens
  - [ ] Payment completes on Coinbase
  - [ ] Webhook received and processed
  - [ ] Credits added to account
  - [ ] Balance updates in UI
  - [ ] Transaction appears in history
- [ ] Monitor logs for 1 hour
- [ ] Check error rates
- [ ] Verify no duplicate credits

### Load Testing
- [ ] 10 concurrent payments
- [ ] 100 payments in 1 minute
- [ ] Verify all processed correctly
- [ ] No duplicate credits
- [ ] No missed webhooks

---

## Troubleshooting

### Issue: "Payment service not configured"
**Cause:** Missing `ADMIN_API_SECRET`, `NEXT_PUBLIC_API_BASE_URL`, or `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET`  
**Fix:** Add environment variables and redeploy

### Issue: "Invalid signature" on webhooks
**Cause:** Wrong `COINBASE_PAYMENT_LINK_WEBHOOK_SECRET` or signature verification logic error  
**Fix:** Verify secret matches Coinbase dashboard, check signature algorithm

### Issue: Webhook received but no credits added
**Cause:** Backend API call failing  
**Fix:** Check `ADMIN_API_SECRET` and `NEXT_PUBLIC_API_BASE_URL` are correct

### Issue: Balance not updating after payment
**Cause:** Webhook processed but UI not refreshing  
**Fix:** Already fixed in Phase 1 patches - deploy those first

### Issue: Double crediting
**Cause:** Idempotency check not working  
**Fix:** Already implemented - `processedPayments` Set tracks processed payment IDs

---

## Support & Resources

### Documentation
- [Payment Links API Docs](https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/overview)
- [Migration Guide](https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/migrate/overview)
- [Webhook Guide](https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/webhooks)

### Internal
- Bug report: `COINBASE_PAYMENT_ISSUES.md`
- Architecture: `ARCHITECTURE.md`
- Backend fixes: `BACKEND_WEBHOOK_FIXES.md`
- Frontend code: `src/app/api/coinbase/payment-link/route.ts`
- Backend webhook: `morpheus-marketplace-api` repo (Python)

### Coinbase Support
- Developer support: https://developer.coinbase.com/support
- Status page: https://status.coinbase.com/

---

## Timeline Estimate

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1 (Immediate fixes) | 1 day | Low |
| Phase 2 (Setup new API) | 2-3 days | Medium |
| Phase 3 (Feature flag rollout) | 2-4 weeks | Low |
| Phase 4 (Cleanup) | 1 day | Low |
| **Total** | **3-5 weeks** | **Medium** |

---

## Success Criteria

Migration is complete when:
- ✅ 0 "missing user_id" errors in last 7 days
- ✅ 100% of payments using Payment Links API
- ✅ Balance updates within 5 seconds of payment
- ✅ Payment success rate ≥ 99%
- ✅ Old API code removed
- ✅ Old webhooks disabled
- ✅ Documentation updated
- ✅ Team trained on new system

---

## Sign-off

- [ ] Engineering lead approval
- [ ] Product manager approval  
- [ ] Security team approval
- [ ] QA sign-off
- [ ] Production deployment approval

---

**Last updated:** February 12, 2026  
**Document owner:** [Your name]  
**Status:** Ready for Phase 1 deployment
