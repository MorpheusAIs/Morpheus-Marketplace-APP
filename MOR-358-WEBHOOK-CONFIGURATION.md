# MOR-358: Webhook Configuration Guide

## Multi-Environment Support

The webhook system is designed to work with both production and development environments:

- **Production**: `https://app.mor.org`
- **Development**: `https://app.dev.mor.org`

## Webhook URL Configuration

### Automatic Environment Detection

The webhook URL is automatically configured based on the `NEXT_PUBLIC_APP_URL` environment variable:

```bash
# Production
NEXT_PUBLIC_APP_URL=https://app.mor.org

# Development
NEXT_PUBLIC_APP_URL=https://app.dev.mor.org
```

When a charge is created, the system automatically sets:
```
notification_url: ${NEXT_PUBLIC_APP_URL}/api/webhooks/coinbase-notification
```

## Coinbase Commerce Webhook Events

### Events We Handle

The webhook is configured to process the following Coinbase Commerce events:

#### 1. `charge:confirmed` ✅
**When**: Payment has been successfully confirmed on the blockchain
**Action**: 
- Shows success toast notification
- Displays: "Payment Confirmed! {CURRENCY} {AMOUNT} has been added to your account"
- Triggers automatic balance refresh after 1.5s

**User Experience**:
```
User completes payment → Within 3s: Green toast with spinner →
"Payment Confirmed! USD 5.00 has been added to your account" →
Balance auto-refreshes
```

#### 2. `charge:failed` ✅
**When**: Payment has failed (insufficient payment, expired, cancelled, etc.)
**Action**:
- Shows error toast notification
- Displays: "Payment Failed - There was an issue processing your payment"
- No balance refresh triggered

**User Experience**:
```
Payment fails → Within 3s: Red toast →
"Payment Failed - There was an issue processing your payment"
```

### Events We Ignore (But Receive)

The following events are received but ignored (return `{received: true}` without creating notifications):

#### `charge:created`
- Fired when charge is first created
- **Why ignore**: User hasn't paid yet, no notification needed

#### `charge:pending`
- Fired when payment is detected but not yet confirmed
- **Why ignore**: Too early to notify, might be false positive
- **Future use**: Could show "Processing payment..." toast

#### `charge:delayed`
- Fired when payment confirmation is delayed
- **Why ignore**: Rare edge case, user will see confirmed eventually

#### `charge:resolved`
- Fired when previously delayed charge is resolved
- **Why ignore**: Covered by `charge:confirmed` event

### Full Event Lifecycle Example

```
1. charge:created          → Ignored (charge just created)
2. charge:pending          → Ignored (payment detected, confirming...)
3. charge:confirmed        → ✅ Show success toast + refresh balance
   OR
3. charge:failed           → ✅ Show error toast
   OR
3. charge:delayed          → Ignored (waiting for confirmation)
4. charge:resolved         → Ignored (eventually becomes confirmed/failed)
```

## Configuration Steps

### Step 1: Set Environment Variables

#### Production Environment
```bash
# In production .env or hosting platform
NEXT_PUBLIC_APP_URL=https://app.mor.org
COINBASE_COMMERCE_WEBHOOK_SECRET=your_production_webhook_secret
```

#### Development Environment
```bash
# In development .env.local
NEXT_PUBLIC_APP_URL=https://app.dev.mor.org
COINBASE_COMMERCE_WEBHOOK_SECRET=your_dev_webhook_secret
```

### Step 2: Configure Coinbase Commerce Dashboard

You need to create **separate webhook endpoints** for each environment:

#### Production Webhook

1. Go to [Coinbase Commerce Dashboard](https://commerce.coinbase.com/dashboard/settings)
2. Navigate to **Settings > Webhooks**
3. Click **Add an endpoint**
4. Enter webhook URL:
   ```
   https://app.mor.org/api/webhooks/coinbase-notification
   ```
5. Select events to receive:
   - ✅ `charge:created` (optional, currently ignored)
   - ✅ `charge:confirmed` **(required)**
   - ✅ `charge:failed` **(required)**
   - ✅ `charge:pending` (optional, currently ignored)
   - ✅ `charge:delayed` (optional, currently ignored)
   - ✅ `charge:resolved` (optional, currently ignored)

6. Click **Create**
7. Copy the **Webhook Shared Secret**
8. Add to production environment:
   ```bash
   COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
   ```

#### Development Webhook

Repeat the same steps with the dev URL:

1. Add webhook endpoint:
   ```
   https://app.dev.mor.org/api/webhooks/coinbase-notification
   ```
2. Select the same events
3. Copy the **different** webhook secret (each endpoint has its own)
4. Add to development environment:
   ```bash
   COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_yyyyyyyyyyyyyy
   ```

### Step 3: Test Each Environment

#### Test Production
```bash
# Create a test payment on production
curl -X POST https://app.mor.org/api/coinbase/charge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": "5.00",
    "currency": "USD",
    "userId": "your-user-id"
  }'

# Complete payment on Coinbase
# Check if webhook is received in production logs
grep "Coinbase Webhook" /var/log/production.log
```

#### Test Development
```bash
# Create a test payment on dev
curl -X POST https://app.dev.mor.org/api/coinbase/charge \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": "5.00",
    "currency": "USD",
    "userId": "your-user-id"
  }'

# Complete payment on Coinbase
# Check if webhook is received in dev logs
grep "Coinbase Webhook" /var/log/dev.log
```

## Webhook Payload Examples

### charge:confirmed Event

```json
{
  "event": {
    "type": "charge:confirmed",
    "data": {
      "id": "f765421f-7252-4572-a2b8-f5c6d3c5f3c5",
      "code": "ABC123XY",
      "name": "Morpheus AI Credits",
      "description": "Account credit top-up of USD 5.00",
      "pricing_type": "fixed_price",
      "metadata": {
        "user_id": "cognito-user-uuid-here"
      },
      "payments": [
        {
          "value": {
            "local": {
              "amount": "5.00",
              "currency": "USD"
            },
            "crypto": {
              "amount": "0.00008123",
              "currency": "BTC"
            }
          },
          "status": "CONFIRMED"
        }
      ],
      "timeline": [
        { "status": "NEW", "time": "2024-01-15T10:00:00Z" },
        { "status": "PENDING", "time": "2024-01-15T10:05:00Z" },
        { "status": "CONFIRMED", "time": "2024-01-15T10:10:00Z" }
      ]
    }
  }
}
```

### charge:failed Event

```json
{
  "event": {
    "type": "charge:failed",
    "data": {
      "id": "f765421f-7252-4572-a2b8-f5c6d3c5f3c5",
      "code": "ABC123XY",
      "metadata": {
        "user_id": "cognito-user-uuid-here"
      },
      "timeline": [
        { "status": "NEW", "time": "2024-01-15T10:00:00Z" },
        { "status": "EXPIRED", "time": "2024-01-15T11:00:00Z" }
      ]
    }
  }
}
```

## Webhook Security

### Signature Verification

Every webhook is verified using HMAC-SHA256:

```typescript
// Webhook signature verification
function verifyCoinbaseWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

**Security Headers**:
- `X-CC-Webhook-Signature` - Contains HMAC-SHA256 signature
- Must match computed signature using webhook secret

**If verification fails**:
- Returns 401 Unauthorized
- Logs error with details
- Prevents processing malicious webhooks

## Monitoring & Debugging

### Check Webhook Receipt

#### Production
```bash
# Check if webhook was received
grep "Coinbase Webhook" /var/log/production.log

# Check specific event types
grep "charge:confirmed" /var/log/production.log
grep "charge:failed" /var/log/production.log

# Check notification storage
grep "Notification stored for user" /var/log/production.log
```

#### Development
```bash
# Local development logs
npm run dev
# Look for console output: [Coinbase Webhook] ...

# Or check logs if deployed
grep "Coinbase Webhook" /var/log/dev.log
```

### Coinbase Commerce Dashboard

1. Go to **Settings > Webhooks**
2. Click on your webhook endpoint
3. View **Recent deliveries**
4. Check delivery status:
   - ✅ Success (200 response)
   - ❌ Failed (4xx/5xx response)
5. Click on individual delivery to see:
   - Request payload
   - Response received
   - Retry attempts

### Test Webhook Delivery

Coinbase Commerce provides a **Send test webhook** button:

1. Go to webhook settings
2. Click **Send test webhook**
3. Select event type (e.g., `charge:confirmed`)
4. Click **Send**
5. Check your logs for webhook receipt

## Troubleshooting

### Webhook Not Received

**Check**:
1. Is webhook URL correct in Coinbase dashboard?
   - Production: `https://app.mor.org/api/webhooks/coinbase-notification`
   - Dev: `https://app.dev.mor.org/api/webhooks/coinbase-notification`

2. Is webhook secret configured correctly?
   ```bash
   echo $COINBASE_COMMERCE_WEBHOOK_SECRET
   # Should output: whsec_xxxxx...
   ```

3. Is endpoint reachable?
   ```bash
   curl -X POST https://app.mor.org/api/webhooks/coinbase-notification \
     -H "Content-Type: application/json" \
     -d '{"test": "data"}'
   # Should return: {"received":true} or 401 (signature error is OK here)
   ```

4. Check Coinbase delivery logs for errors

### Webhook Signature Verification Failed

**Symptoms**: Returns 401, logs show "Invalid signature"

**Fix**:
1. Verify webhook secret is correct
2. Check if secret matches the endpoint in Coinbase dashboard
3. Ensure secret includes `whsec_` prefix
4. Regenerate webhook secret if needed

### Notification Not Showing

**Symptoms**: Webhook received, but toast doesn't appear

**Check**:
1. Is user logged in? (Check `user.sub` exists)
2. Is user ID in metadata correct?
   ```bash
   # Should match Cognito user ID
   grep "user_id" /var/log/app.log
   ```
3. Is notification polling working?
   ```bash
   # Check browser network tab for:
   GET /api/webhooks/coinbase-notification?userId=xxx
   ```
4. Check browser console for errors

### Wrong Environment Receiving Webhooks

**Symptoms**: Production webhooks going to dev, or vice versa

**Fix**:
1. Check `NEXT_PUBLIC_APP_URL` in each environment
   ```bash
   # Production should be:
   NEXT_PUBLIC_APP_URL=https://app.mor.org
   
   # Dev should be:
   NEXT_PUBLIC_APP_URL=https://app.dev.mor.org
   ```

2. Verify webhook URLs in Coinbase dashboard
3. Make sure each environment has its own webhook endpoint
4. Check charge creation logs:
   ```bash
   # Should show correct notification_url
   grep "notification_url" /var/log/app.log
   ```

## Advanced Configuration

### Custom Event Handling

To add handling for additional events, update the webhook handler:

```typescript
// src/app/api/webhooks/coinbase-notification/route.ts

// Add new event type to relevant events array
const relevantEvents = [
  'charge:confirmed',
  'charge:failed',
  'charge:pending',  // Add pending notifications
];

// Add status mapping
const statusMap: Record<string, 'confirmed' | 'failed' | 'pending'> = {
  'charge:confirmed': 'confirmed',
  'charge:failed': 'failed',
  'charge:pending': 'pending',
};

const status = statusMap[eventType] || 'confirmed';
```

Then update the notification hook to handle the new status:

```typescript
// src/lib/hooks/use-coinbase-notifications.ts

if (notification.status === 'pending') {
  toast.info(
    <div className="flex items-center gap-3">
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      <div>
        <div className="font-semibold">Payment Processing</div>
        <div className="text-sm text-muted-foreground">
          Your payment is being confirmed...
        </div>
      </div>
    </div>,
    { duration: 5000 }
  );
}
```

### Webhook Retry Logic

Coinbase automatically retries failed webhooks:
- **Retry schedule**: Exponential backoff
- **Max retries**: 10 attempts
- **Retry interval**: 15s, 30s, 1m, 2m, 5m, 10m, 30m, 1h, 3h, 6h

**To prevent duplicate notifications**:
- Our implementation tracks shown notifications
- Same notification ID won't trigger multiple toasts
- Backend also has idempotency checks

## Summary

### Events Handled
- ✅ `charge:confirmed` - Shows success toast + refreshes balance
- ✅ `charge:failed` - Shows error toast

### Events Ignored
- `charge:created` - Ignored (no user action needed)
- `charge:pending` - Ignored (too early, might be false positive)
- `charge:delayed` - Ignored (rare edge case)
- `charge:resolved` - Ignored (covered by confirmed/failed)

### Environment Support
- ✅ Production: `https://app.mor.org/api/webhooks/coinbase-notification`
- ✅ Development: `https://app.dev.mor.org/api/webhooks/coinbase-notification`

### Configuration Required
1. Set `NEXT_PUBLIC_APP_URL` for each environment
2. Set `COINBASE_COMMERCE_WEBHOOK_SECRET` for each environment
3. Add webhook endpoint in Coinbase dashboard for each environment
4. Test webhook delivery in each environment

### Next Steps
1. Configure production webhook in Coinbase dashboard
2. Configure development webhook in Coinbase dashboard
3. Add secrets to environment variables
4. Test webhook delivery in both environments
5. Monitor logs for successful webhook processing
