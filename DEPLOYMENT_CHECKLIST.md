# Coinbase Payment Fixes - Deployment Checklist

## Pre-Deployment Verification

### 1. Verify Webhook Configuration in Coinbase Dashboard

**CRITICAL: Webhooks MUST point to backend API, not frontend!**

Login to: https://commerce.coinbase.com/dashboard/settings

**Check webhook endpoint:**
```
✅ Correct:
   Dev:  https://api.dev.mor.org/api/v1/webhooks/coinbase
   Prod: https://api.mor.org/api/v1/webhooks/coinbase

❌ Wrong (will break payments):
   https://app.mor.org/api/webhooks/coinbase
   https://app.mor.org/api/v1/webhooks/coinbase
```

If webhook points to `app.mor.org`, update it to `api.mor.org`!

### 2. Verify Environment Variables

**Frontend (Morpheus-Marketplace-APP):**
```bash
vercel env ls | grep COINBASE
# Should show: COINBASE_COMMERCE_API_KEY

vercel env ls | grep API_BASE
# Should show: NEXT_PUBLIC_API_BASE_URL=https://api.mor.org
```

**Backend (morpheus-marketplace-api):**
```bash
# Check in your deployment platform
COINBASE_COMMERCE_WEBHOOK_SECRET=<set>
ADMIN_API_SECRET=<set>
DATABASE_URL=<set>
```

### 3. Review Code Changes

**Frontend changes to deploy:**
```bash
git diff HEAD~1 src/components/billing/FundingSection.tsx
git diff HEAD~1 src/app/api/coinbase/charge/route.ts
```

**Backend changes to apply:**
- See `BACKEND_WEBHOOK_FIXES.md` for Python code

---

## Deployment Steps

### Step 1: Deploy Frontend (Low Risk)

```bash
# In Morpheus-Marketplace-APP repo

# 1. Create branch
git checkout -b fix/coinbase-payment-issues

# 2. Commit changes
git add src/components/billing/FundingSection.tsx
git add src/app/api/coinbase/charge/route.ts
git commit -m "fix: prevent anonymous Coinbase payments and fix balance refresh

- Require authentication for crypto payments (button disabled when logged out)
- Validate userId on both frontend and backend charge creation
- Auto-refresh balance after successful payment (2-second delay + reload)
- Better error messages for payment failures
- Fixes 'Missing user_id in metadata' webhook errors

Resolves #XXX"

# 3. Push and create PR
git push origin fix/coinbase-payment-issues

# 4. Test on preview deployment (Vercel creates automatically)
# - Test anonymous payment prevention
# - Test successful payment flow
# - Verify balance updates

# 5. Merge and deploy
gh pr merge --squash
# Or merge via GitHub UI
```

### Step 2: Deploy Backend (Medium Risk)

```bash
# In morpheus-marketplace-api repo

# 1. Apply fixes from BACKEND_WEBHOOK_FIXES.md
# Copy the Python code changes to your webhook handler

# 2. Create branch
git checkout -b fix/coinbase-webhook-validation

# 3. Commit changes
git add <webhook_handler_file>
git commit -m "fix: Coinbase webhook idempotency and validation

- Add idempotency check to prevent double-crediting
- Gracefully handle missing/invalid user_id (don't throw)
- Enhanced logging with structured context
- Validate amount is numeric and positive
- Security warnings for missing webhook secrets

Resolves #XXX"

# 4. Deploy to staging first
git push origin staging

# 5. Test webhook in staging
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -H "X-CC-Webhook-Signature: <test_signature>" \
  -d @test_webhook_payload.json

# 6. Make test payment in staging
# - Complete full payment flow
# - Verify webhook processed
# - Check balance updated

# 7. Deploy to production
git push origin main

# 8. Monitor logs for 2 hours
tail -f /var/log/api.log | grep "Coinbase Webhook"
```

---

## Post-Deployment Testing

### Test 1: Anonymous Payment Prevention (Frontend)

```bash
# Open incognito browser
open -a "Google Chrome" --args --incognito https://app.mor.org/billing

# Manual test:
1. Navigate to /billing
2. Check "Pay with Crypto" button
   ✅ Should be disabled
   ✅ Should show "Login required" text

3. Try clicking anyway
   ✅ Nothing should happen

4. Login
   ✅ Button should become enabled
   ✅ Should show "Powered by Coinbase Commerce"
```

### Test 2: Successful Payment Flow (End-to-End)

```bash
# Manual test:
1. Login as test user
2. Note current balance: $X.XX
3. Click "Pay with Crypto"
4. Enter amount: $1.00
5. Complete payment on Coinbase
6. Return to app (redirected automatically)
7. Wait 3 seconds
   ✅ Page should reload
   ✅ Balance should be $X.XX + $1.00

# Check backend logs
grep "charge:confirmed" /var/log/backend.log | tail -5
# Should show: "Account credited successfully"

# Check database
psql -d morpheus -c "SELECT * FROM credit_ledger WHERE description LIKE '%Coinbase%' ORDER BY created_at DESC LIMIT 1;"
# Should show latest transaction
```

### Test 3: Webhook Idempotency (Backend)

```bash
# Get a recent successful webhook from logs
grep "charge:confirmed" /var/log/backend.log | tail -1

# Copy the webhook payload
# Replay it manually
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -H "X-CC-Webhook-Signature: <signature>" \
  -d '<webhook_payload>'

# Check logs
grep "already processed" /var/log/backend.log | tail -1
# Should show: "Charge ABC123 already processed, skipping"

# Check balance didn't increase again
psql -d morpheus -c "SELECT COUNT(*) FROM credit_ledger WHERE description LIKE '%ABC123%';"
# Should be 1 (not 2)
```

### Test 4: Invalid Payload Handling (Backend)

```bash
# Send webhook with missing user_id
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "charge:confirmed",
      "data": {
        "code": "TEST123",
        "metadata": {},
        "payments": [{"value": {"local": {"amount": "5.00"}}}]
      }
    }
  }'

# Check logs
grep "TEST123" /var/log/backend.log
# Should show: "Missing or invalid user_id in metadata"
# Should return: 200 OK (not 500, to prevent retries)
```

---

## Rollback Procedures

### If Frontend Issues

```bash
# Quick rollback (< 2 minutes)
cd Morpheus-Marketplace-APP
git revert HEAD~1
git push origin main --force

# Verify old version deployed
curl https://app.mor.org/api/coinbase/charge
```

### If Backend Issues

```bash
# Quick rollback (< 2 minutes)
cd morpheus-marketplace-api
git revert HEAD~1
git push origin main --force

# Verify webhook still works
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -d @test_payload.json
```

### Emergency Webhook Disable

If webhooks are causing issues:

```bash
# In Coinbase dashboard
# Settings → Webhooks → Disable webhook

# Payments will still work, but credits won't be added automatically
# You'll need to manually credit using:
curl -X POST https://api.mor.org/api/v1/billing/credits/adjust \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"cognito_user_id": "user-uuid", "amount_usd": 5.0, "description": "Manual credit for charge ABC123"}'
```

---

## Monitoring Dashboard

### Key Metrics (First 24 Hours)

**Frontend:**
```bash
# Payment attempts
grep "openCoinbaseCheckout" /var/log/frontend.log | wc -l

# Authentication errors (should be low)
grep "must be logged in" /var/log/frontend.log | wc -l

# Successful charge creations
grep "Coinbase charge creation" /var/log/frontend.log | grep -c "success"
```

**Backend:**
```bash
# Webhooks received
grep "Coinbase Webhook" /var/log/backend.log | wc -l

# Successfully processed (should match webhooks received)
grep "Account credited successfully" /var/log/backend.log | wc -l

# Errors (should be ZERO or near-zero)
grep "Missing user_id" /var/log/backend.log | wc -l
grep "Failed to credit account" /var/log/backend.log | wc -l

# Idempotency working
grep "already processed" /var/log/backend.log | wc -l
```

### Alert Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Webhook failures | > 5 per hour | Investigate immediately |
| Missing user_id | > 0 per day | Check frontend deployed |
| Balance not updating | > 1 report | Check webhook logs |
| Double crediting | > 0 | Emergency rollback |

---

## Success Criteria

**Deployment is successful when:**

- [x] Frontend deployed without errors
- [x] Backend deployed without errors
- [ ] Test payment completes end-to-end
- [ ] Balance updates within 5 seconds
- [ ] Webhook logs show "Account credited successfully"
- [ ] No "Missing user_id" errors in 2 hours
- [ ] No duplicate credits in database
- [ ] Button disabled for logged-out users
- [ ] Error messages clear and helpful

**Sign-off required from:**
- [ ] Frontend engineer (verified UI changes)
- [ ] Backend engineer (verified webhook changes)
- [ ] QA (verified test payment flow)
- [ ] Product manager (approved for deployment)

---

## Verification URLs

**Check deployments:**
- Frontend: https://app.mor.org/billing
- Backend API: https://api.mor.org/health
- OpenAPI docs: https://api.mor.org/api/v1/openapi.json

**Webhook endpoint:**
- Dev: https://api.dev.mor.org/api/v1/webhooks/coinbase
- Prod: https://api.mor.org/api/v1/webhooks/coinbase

**Coinbase dashboard:**
- https://commerce.coinbase.com/dashboard/settings

---

## Contact & Support

**If something breaks:**

1. **Check logs first:**
   - Frontend: Vercel dashboard → Logs
   - Backend: Your logging platform (CloudWatch, Datadog, etc.)

2. **Quick diagnosis:**
   ```bash
   # Is webhook reaching backend?
   grep "Coinbase Webhook" /var/log/backend.log | tail -10
   
   # Is credit being applied?
   grep "Account credited" /var/log/backend.log | tail -10
   
   # Any errors?
   grep "ERROR" /var/log/backend.log | grep -i coinbase | tail -10
   ```

3. **Rollback if needed:**
   - See "Rollback Procedures" above
   - Can be done in < 2 minutes

4. **Get help:**
   - Slack: #payments-team
   - GitHub: File issue with logs
   - Docs: See README_COINBASE_FIXES.md

---

## Related Documentation

| Document | Purpose | Audience |
|----------|---------|----------|
| **README_COINBASE_FIXES.md** | Start here | Everyone |
| **CORRECTED_README.md** | Architecture clarification | Everyone |
| **ARCHITECTURE.md** | System diagram | Engineers |
| **BACKEND_WEBHOOK_FIXES.md** | Python code fixes | Backend team |
| **COINBASE_PAYMENT_ISSUES.md** | Original bug report | Engineers/PM |
| **COINBASE_MIGRATION_GUIDE.md** | Future migration | Engineers |

---

**Deployment ready:** ✅ Yes  
**Estimated time:** 10 minutes (frontend + backend)  
**Risk level:** Low (adds validation, improves reliability)  
**Rollback time:** < 2 minutes  

🚀 **Ready to deploy!**
