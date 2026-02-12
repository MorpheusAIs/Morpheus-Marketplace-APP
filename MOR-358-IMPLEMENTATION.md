# MOR-358: Coinbase Payment Notification System

## Overview

This implementation adds a real-time notification system for Coinbase payments. When a payment is confirmed, users receive an animated toast notification and their balance is automatically refreshed without requiring a manual page reload.

## Architecture

### 1. Frontend Webhook Endpoint

**File:** `src/app/api/webhooks/coinbase-notification/route.ts`

This Next.js API route serves two purposes:

#### POST - Receive Webhooks from Coinbase
- Receives webhook notifications from Coinbase Commerce after payment confirmation
- Verifies webhook signature using HMAC-SHA256
- Stores notifications temporarily in memory (TTL: 5 minutes)
- Supports both Commerce API and Payment Links API formats
- Only processes `charge:confirmed` events

#### GET - Poll for Notifications
- Allows authenticated users to poll for their pending notifications
- Returns all pending notifications and clears them
- Requires `userId` query parameter

### 2. Notification Polling Hook

**File:** `src/lib/hooks/use-coinbase-notifications.ts`

Custom React hook that:
- Polls the notification endpoint every 3 seconds when user is authenticated
- Displays toast notifications using Sonner when payments are confirmed
- Shows animated spinner during notification display
- Automatically refreshes billing balance and transactions after 1.5s delay
- Tracks shown notifications to prevent duplicates
- Cleans up on user logout

### 3. Notification Listener Component

**File:** `src/components/CoinbaseNotificationListener.tsx`

Lightweight component that:
- Runs the notification polling hook
- Doesn't render any UI
- Added to root layout for app-wide coverage

### 4. Updated Charge Creation

**File:** `src/app/api/coinbase/charge/route.ts`

Enhanced to include:
- `notification_url` parameter pointing to the frontend webhook endpoint
- Ensures Coinbase sends webhooks to the new endpoint

## Flow Diagram

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   User      │         │   Coinbase   │         │  Frontend   │
│  Browser    │         │   Commerce   │         │   Server    │
└─────┬───────┘         └──────┬───────┘         └──────┬──────┘
      │                        │                        │
      │  1. Create payment     │                        │
      ├────────────────────────┼───────────────────────>│
      │                        │                        │
      │  2. Open hosted URL    │                        │
      ├───────────────────────>│                        │
      │                        │                        │
      │  3. Complete payment   │                        │
      │<───────────────────────┤                        │
      │                        │                        │
      │                        │  4. Webhook POST       │
      │                        │  (charge:confirmed)    │
      │                        ├───────────────────────>│
      │                        │                        │
      │                        │  5. Store notification │
      │                        │  (in-memory, 5min TTL) │
      │                        │<───────────────────────┤
      │                        │                        │
      │  6. Poll for notifications (every 3s)           │
      ├────────────────────────┼───────────────────────>│
      │                        │                        │
      │  7. Return pending notification                 │
      │<────────────────────────┼────────────────────────┤
      │                        │                        │
      │  8. Show toast + spinner                        │
      │  "Payment Confirmed!"  │                        │
      │                        │                        │
      │  9. Refresh balance (after 1.5s)                │
      │────────────────────────┼───────────────────────>│
      │                        │                        │
      │  10. Updated balance   │                        │
      │<────────────────────────┼────────────────────────┤
      │                        │                        │
```

## Features

### ✅ Real-time Notifications
- Toast appears within 3 seconds of payment confirmation
- No manual refresh required
- Works across all pages of the app

### ✅ Animated Feedback
- Spinning loader icon during notification
- Success/error states with appropriate colors
- 5-second display duration

### ✅ Automatic Balance Refresh
- Balance updates automatically 1.5s after notification
- Ensures backend has time to process payment
- Invalidates both balance and transaction queries

### ✅ Security
- Webhook signature verification using HMAC-SHA256
- Only processes webhooks with valid signatures
- User-specific notifications (userId-based)

### ✅ Deduplication
- Tracks shown notifications to prevent duplicates
- Handles webhook retries gracefully
- Cleans up old notification references

## Configuration

### Environment Variables

```bash
# Required for webhook signature verification
COINBASE_COMMERCE_WEBHOOK_SECRET=your_webhook_secret

# App URL for webhook endpoint
NEXT_PUBLIC_APP_URL=https://app.mor.org
```

### Webhook URL Setup in Coinbase

When creating a charge, the system automatically sets:
```
notification_url: https://app.mor.org/api/webhooks/coinbase-notification
```

Alternatively, configure this in Coinbase Commerce Dashboard:
1. Go to Settings > Webhooks
2. Add webhook endpoint: `https://app.mor.org/api/webhooks/coinbase-notification`
3. Copy webhook secret to `COINBASE_COMMERCE_WEBHOOK_SECRET`

## Testing

### 1. Test Webhook Endpoint

```bash
# Create a test charge
curl -X POST http://localhost:3000/api/coinbase/charge \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "currency": "USD",
    "userId": "test-user-123"
  }'

# Simulate Coinbase webhook (replace with your signature)
curl -X POST http://localhost:3000/api/webhooks/coinbase-notification \
  -H "Content-Type: application/json" \
  -H "X-CC-Webhook-Signature: your-hmac-signature" \
  -d '{
    "event": {
      "type": "charge:confirmed",
      "data": {
        "id": "test-charge-id",
        "code": "TESTCODE",
        "metadata": {
          "user_id": "test-user-123"
        },
        "payments": [{
          "value": {
            "local": {
              "amount": "5.00",
              "currency": "USD"
            }
          }
        }]
      }
    }
  }'

# Poll for notifications (as user)
curl "http://localhost:3000/api/webhooks/coinbase-notification?userId=test-user-123"
```

### 2. Test End-to-End

1. Open the app and log in
2. Navigate to `/billing`
3. Create a test payment
4. Complete payment on Coinbase
5. Return to the app (any page)
6. Within 3 seconds, you should see:
   - Toast notification with spinning animation
   - "Payment Confirmed!" message
   - Amount added to account
7. After 1.5 seconds, balance should refresh automatically

### 3. Test Notification Deduplication

1. Trigger the same webhook twice (Coinbase retries on failure)
2. Should only show one toast notification
3. Check browser console for "Notification already shown" log

## Improvements for Production

### Current Limitations

1. **In-Memory Storage**: Notifications are stored in memory with 5-minute TTL
   - **Issue**: Lost on server restart or in multi-instance deployments
   - **Solution**: Use Redis with same TTL and user-keyed storage

2. **Polling Interval**: Polls every 3 seconds
   - **Issue**: Slight delay + unnecessary requests
   - **Solution**: Implement Server-Sent Events (SSE) or WebSockets for instant push

3. **No Retry Logic**: Frontend polling doesn't retry on failure
   - **Issue**: Missed notifications on network errors
   - **Solution**: Add exponential backoff retry logic

### Recommended Production Setup

```typescript
// Use Redis for notification storage
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store notification
await redis.setex(
  `coinbase:notification:${userId}:${chargeId}`,
  300, // 5 minutes
  JSON.stringify(notification)
);

// Get all notifications for user
const keys = await redis.keys(`coinbase:notification:${userId}:*`);
const notifications = await Promise.all(
  keys.map(key => redis.get(key).then(JSON.parse))
);

// Clean up after retrieval
await Promise.all(keys.map(key => redis.del(key)));
```

## Monitoring

### Key Metrics to Track

1. **Webhook Delivery**: How many webhooks are received vs expected
2. **Notification Latency**: Time from payment to toast display
3. **Polling Frequency**: Number of poll requests per user
4. **Failed Verifications**: Invalid webhook signatures

### Logs to Monitor

```bash
# Successful webhook processing
grep "Notification stored for user" /var/log/app.log

# Failed signature verification
grep "Invalid signature" /var/log/app.log

# Notification polling
grep "Coinbase Notifications" /var/log/app.log
```

## Backend Integration

This frontend webhook endpoint complements the existing backend webhook at:
```
/api/v1/webhooks/coinbase (in morpheus-marketplace-api)
```

**Key Difference:**
- Backend webhook: Credits user account in database
- Frontend webhook: Notifies user in real-time via UI

Both should be configured to receive the same Coinbase webhooks.

## Troubleshooting

### Issue: Notifications not appearing

**Check:**
1. Is user logged in? (`user.sub` exists)
2. Is webhook endpoint reachable? (Check network tab)
3. Is webhook signature valid? (Check server logs)
4. Is userId in metadata correct? (Should match Cognito user ID)

### Issue: Multiple duplicate notifications

**Check:**
1. Notification deduplication logic (check `hasShownNotificationRef`)
2. Webhook retry behavior (Coinbase retries failed webhooks)
3. Multiple browser tabs open (each tab polls independently)

### Issue: Balance not refreshing

**Check:**
1. React Query invalidation working? (Check network tab for balance refetch)
2. 1.5s delay elapsed? (Check timing in browser DevTools)
3. Backend processed payment? (Check backend logs for account credit)

## Files Changed

- ✅ `src/app/api/webhooks/coinbase-notification/route.ts` (new)
- ✅ `src/lib/hooks/use-coinbase-notifications.ts` (new)
- ✅ `src/components/CoinbaseNotificationListener.tsx` (new)
- ✅ `src/app/layout.tsx` (modified)
- ✅ `src/app/api/coinbase/charge/route.ts` (modified)
- ✅ `MOR-358-IMPLEMENTATION.md` (this file)

## Related Issues

- **MOR-358**: Add real-time payment notification system
- **BACKEND_WEBHOOK_FIXES.md**: Backend webhook improvements needed

## Future Enhancements

1. **Push Notifications**: Add browser push API support for background notifications
2. **Sound Effects**: Play notification sound on payment confirmation
3. **Notification History**: Show recent payment notifications in a panel
4. **Multi-currency Support**: Format amounts based on currency
5. **Error Recovery**: Retry failed notification fetches with exponential backoff
6. **Analytics**: Track notification delivery success rate
