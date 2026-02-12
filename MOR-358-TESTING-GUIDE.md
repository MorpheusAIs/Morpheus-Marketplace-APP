# MOR-358 Testing Guide

## Summary

This implementation solves MOR-358 by adding real-time payment notifications to the Morpheus Marketplace app. Users now see an animated toast notification immediately after completing a Coinbase payment, and their balance refreshes automatically without requiring a manual page reload.

## What Was Implemented

### 1. **Frontend Webhook Endpoint**
   - Path: `/api/webhooks/coinbase-notification`
   - Receives POST webhooks from Coinbase after payment confirmation
   - Stores notifications temporarily (5-minute TTL)
   - Provides GET endpoint for polling notifications

### 2. **Notification System**
   - Polls for new notifications every 3 seconds
   - Displays animated toast with spinning loader
   - Shows payment amount and currency
   - Automatically refreshes balance 1.5s after notification

### 3. **User Experience Improvements**
   - ✅ No more waiting for manual refresh
   - ✅ Visual feedback that payment was received
   - ✅ Animated spinner during processing
   - ✅ Works across all pages of the app

## Testing Steps

### Local Development Testing

#### 1. Start the Development Server

```bash
npm run dev
# or
pnpm dev
```

#### 2. Test Using the Script

```bash
# Test webhook endpoint locally
./scripts/test-webhook-notification.sh http://localhost:3000 your-cognito-user-id
```

Expected output:
```
Test 1: {"received":true}
Test 2: {"notifications":[{...}],"count":1}
Test 3: {"notifications":[],"count":0}
```

#### 3. Manual End-to-End Test

1. **Log in to the app**
   - Navigate to `http://localhost:3000`
   - Sign in with your Coinbase account

2. **Navigate to Billing Page**
   - Go to `/billing`
   - Note your current balance

3. **Create a Test Payment**
   - Enter amount (e.g., $5.00)
   - Click "Add Credits via Coinbase"
   - You'll be redirected to Coinbase Commerce

4. **Complete Payment on Coinbase**
   - Use test mode if available
   - Or use actual payment

5. **Return to App**
   - After payment, return to the app
   - You can be on any page (not just billing)

6. **Verify Notification Appears**
   - Within 3 seconds, you should see:
     - Toast notification in top-right
     - Spinning loader animation
     - "Payment Confirmed!" message
     - Amount and currency displayed

7. **Verify Balance Updates**
   - After 1.5 seconds, balance should refresh
   - Check billing page shows updated balance
   - No manual refresh required

### Production Testing

#### 1. Configure Webhook in Coinbase Commerce Dashboard

1. Go to [Coinbase Commerce Dashboard](https://commerce.coinbase.com/dashboard/settings)
2. Navigate to **Settings > Webhooks**
3. Click **Add an endpoint**
4. Enter webhook URL:
   ```
   https://app.mor.org/api/webhooks/coinbase-notification
   ```
5. Copy the **Shared Secret**
6. Add to environment variables:
   ```bash
   COINBASE_COMMERCE_WEBHOOK_SECRET=your_shared_secret
   ```

#### 2. Test Real Payment Flow

1. Deploy the feature branch to staging/dev environment
2. Log in to the app
3. Create a real payment ($5.00 minimum recommended)
4. Complete payment on Coinbase
5. Return to app and verify notification appears
6. Check balance updates automatically

#### 3. Monitor Logs

```bash
# Check webhook receipt
grep "Notification stored for user" /var/log/app.log

# Check notification polling
grep "Coinbase Notifications" /var/log/app.log

# Check for errors
grep "ERROR" /var/log/app.log | grep -i coinbase
```

## Expected Behavior

### Success Flow

```
User completes payment on Coinbase
  ↓
Coinbase sends webhook to /api/webhooks/coinbase-notification
  ↓
Webhook stored with user ID
  ↓
Frontend polls every 3 seconds
  ↓
Notification found
  ↓
Toast appears: "Payment Confirmed! USD 5.00 has been added to your account"
  ↓
After 1.5s: Balance refreshes automatically
  ↓
User sees updated balance without manual refresh
```

### Edge Cases

1. **User Not Logged In**
   - Notification polling stops
   - No toasts shown
   - Balance updates when user logs back in

2. **Multiple Browser Tabs**
   - Each tab polls independently
   - Each tab shows notification (deduplication per tab)
   - This is expected behavior

3. **Network Error During Polling**
   - Silent failure
   - Retries on next poll (3s later)
   - No user-facing error

4. **Webhook Arrives After 5 Minutes**
   - Notification expired from memory
   - User won't see toast
   - Balance still updates via backend webhook
   - This is acceptable (unlikely scenario)

## Troubleshooting

### Problem: Toast notification not appearing

**Possible Causes:**
1. User not logged in
2. Webhook not received by frontend
3. Webhook signature verification failed
4. Incorrect user ID in metadata

**How to Debug:**
```bash
# 1. Check if webhook was received
curl "http://localhost:3000/api/webhooks/coinbase-notification?userId=YOUR_USER_ID"

# 2. Check browser console for errors
# Open DevTools > Console
# Look for "[Coinbase Notifications]" logs

# 3. Check network tab
# Look for failed requests to /api/webhooks/coinbase-notification

# 4. Check server logs
grep "Coinbase Webhook" logs/development.log
```

### Problem: Balance not refreshing

**Possible Causes:**
1. React Query invalidation not working
2. Backend hasn't processed payment yet
3. Network error during balance refetch

**How to Debug:**
```bash
# 1. Check React Query DevTools
# Look for ['billing', 'balance'] query status

# 2. Check network tab for balance refetch
# Should see GET request to /api/balance after notification

# 3. Manually refresh page
# Balance should be updated even without auto-refresh
```

### Problem: Multiple duplicate notifications

**Possible Causes:**
1. Coinbase webhook retries
2. Multiple browser tabs open
3. Deduplication logic not working

**How to Debug:**
```bash
# Check notification key tracking
# Open DevTools > Console
# Look for "Notification already shown" logs

# Expected: Only one toast per payment, even with retries
```

## Configuration Checklist

- [ ] `COINBASE_COMMERCE_WEBHOOK_SECRET` set in environment
- [ ] `NEXT_PUBLIC_APP_URL` points to correct domain
- [ ] Webhook endpoint added in Coinbase Commerce Dashboard
- [ ] Frontend can receive HTTPS requests (required by Coinbase)
- [ ] User authentication working (Cognito)
- [ ] React Query setup correctly

## Deployment Checklist

### Before Merging

- [ ] Test locally with script
- [ ] Test manual end-to-end flow
- [ ] Check no TypeScript errors
- [ ] Check no linting errors
- [ ] Review code changes
- [ ] Update environment variables documentation

### After Merging to Dev

- [ ] Configure webhook URL in Coinbase
- [ ] Add webhook secret to environment
- [ ] Test with real payment
- [ ] Monitor logs for 24 hours
- [ ] Verify no performance degradation
- [ ] Check polling doesn't cause excessive load

### Before Production

- [ ] Test on staging environment
- [ ] Load test polling endpoint
- [ ] Configure production webhook URL
- [ ] Update production environment variables
- [ ] Plan rollback strategy if issues arise

## Performance Considerations

### Current Implementation

- **Polling Frequency**: Every 3 seconds
- **Storage**: In-memory (5-minute TTL)
- **Request Size**: ~100 bytes per poll
- **Concurrent Users**: Handles thousands (in-memory store scales vertically)

### Expected Load

For 1,000 concurrent users:
- Polling requests: ~333 requests/second
- Memory usage: Minimal (~1MB for 10,000 notifications)
- CPU usage: Negligible (simple GET requests)

### Future Optimizations

If scaling issues arise:

1. **Increase polling interval** to 5 seconds
2. **Use Redis** instead of in-memory storage
3. **Implement Server-Sent Events (SSE)** for push notifications
4. **Add request rate limiting** per user
5. **Use WebSockets** for real-time bidirectional communication

## Next Steps

1. **Merge to Dev**
   ```bash
   git push origin feature/mor-358-coinbase-webhook-notifications
   # Create pull request on GitHub
   ```

2. **Test on Dev Environment**
   - Deploy to dev
   - Configure webhook URL
   - Test with real payment

3. **Monitor for Issues**
   - Check error rates
   - Monitor performance
   - Gather user feedback

4. **Plan Production Rollout**
   - Schedule deployment window
   - Prepare rollback plan
   - Update documentation

5. **Consider Future Enhancements**
   - Push notifications for mobile
   - Notification history panel
   - Sound effects on payment
   - Multi-currency formatting

## Related Documentation

- **Implementation Details**: See `MOR-358-IMPLEMENTATION.md`
- **Backend Webhook**: See `BACKEND_WEBHOOK_FIXES.md`
- **Coinbase Commerce API**: https://docs.cloud.coinbase.com/commerce/docs

## Questions or Issues?

If you encounter any issues during testing:

1. Check the troubleshooting section above
2. Review browser console logs
3. Check server logs
4. Verify webhook configuration
5. Test with the provided script

For additional help, contact the development team or create a GitHub issue.
