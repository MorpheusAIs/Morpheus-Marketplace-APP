# MOR-358: AWS Amplify Setup Guide

## Amplify-Optimized Configuration

The webhook system now **automatically detects** the app URL from incoming requests, making it perfect for AWS Amplify deployments. No manual configuration needed!

## How It Works

### Automatic URL Detection

The system uses a smart fallback chain to determine the app URL:

```typescript
// 1. Try origin header (most reliable)
const origin = request.headers.get('origin')

// 2. Fall back to referer header
|| request.headers.get('referer')?.split('/').slice(0, 3).join('/')

// 3. Fall back to environment variable (if set)
|| process.env.NEXT_PUBLIC_APP_URL

// 4. Final fallback
|| 'https://app.mor.org'
```

This means:
- ✅ Works automatically with **any Amplify URL**
- ✅ Works with **custom domains** without configuration
- ✅ Works with **preview branches** automatically
- ✅ Works with **production and development** simultaneously

### Example Scenarios

#### Scenario 1: Production Domain
```
Request from: https://app.mor.org
Webhook URL:  https://app.mor.org/api/webhooks/coinbase-notification
✅ Auto-detected - no config needed
```

#### Scenario 2: Development Domain
```
Request from: https://app.dev.mor.org
Webhook URL:  https://app.dev.mor.org/api/webhooks/coinbase-notification
✅ Auto-detected - no config needed
```

#### Scenario 3: Amplify Preview Branch
```
Request from: https://pr-123.d1234567890.amplifyapp.com
Webhook URL:  https://pr-123.d1234567890.amplifyapp.com/api/webhooks/coinbase-notification
✅ Auto-detected - even preview branches work!
```

#### Scenario 4: Custom Domain
```
Request from: https://custom.example.com
Webhook URL:  https://custom.example.com/api/webhooks/coinbase-notification
✅ Auto-detected - no config needed
```

## Amplify Setup Steps

### Step 1: Add Environment Variables in Amplify Console

1. Go to **AWS Amplify Console**
2. Select your app
3. Navigate to **App Settings > Environment variables**
4. Add the following variable:

#### Production Environment
```
Key:   COINBASE_COMMERCE_WEBHOOK_SECRET
Value: whsec_your_production_secret_here
```

#### Development/Branch Environment
```
Key:   COINBASE_COMMERCE_WEBHOOK_SECRET  
Value: whsec_your_development_secret_here
```

**Important Notes:**
- ✅ **DO NOT** set `NEXT_PUBLIC_APP_URL` - it's auto-detected!
- ✅ Each environment (prod/dev) should have its own webhook secret
- ✅ You can set different secrets per branch in Amplify

### Step 2: Configure Coinbase Commerce Webhooks

#### Production Webhook

1. Go to [Coinbase Commerce Dashboard](https://commerce.coinbase.com/dashboard/settings)
2. Navigate to **Settings > Webhooks**
3. Click **Add an endpoint**
4. Enter webhook URL:
   ```
   https://app.mor.org/api/webhooks/coinbase-notification
   ```
5. Select events:
   - ✅ `charge:confirmed` (required)
   - ✅ `charge:failed` (required)
6. Click **Create**
7. Copy the **Webhook Shared Secret**
8. Add it to Amplify production environment variables

#### Development Webhook

Repeat for development:

1. Add webhook endpoint:
   ```
   https://app.dev.mor.org/api/webhooks/coinbase-notification
   ```
2. Select same events
3. Copy the webhook secret
4. Add it to Amplify development environment variables

### Step 3: Test the Setup

#### Test Production

1. Log in to `https://app.mor.org`
2. Navigate to `/billing`
3. Create a test payment ($5.00)
4. Complete payment on Coinbase
5. Return to app
6. Verify toast notification appears within 3 seconds
7. Verify balance updates automatically

#### Test Development

1. Log in to `https://app.dev.mor.org`
2. Repeat the same test process
3. Verify notifications work

#### Test Preview Branch (Optional)

1. Create a PR that triggers Amplify preview build
2. Get the preview URL: `https://pr-123.dxxxxx.amplifyapp.com`
3. Log in to the preview URL
4. Create test payment
5. Verify webhook auto-detects the preview URL in logs

## Logging & Verification

### Check URL Detection

After creating a charge, check the logs to see which URL was detected:

```bash
# Look for this log entry
[Coinbase Charge] Creating charge with webhook URL: {
  origin: 'https://app.mor.org',
  webhookUrl: 'https://app.mor.org/api/webhooks/coinbase-notification',
  userId: 'cognito-user-uuid'
}
```

### Verify Webhook Receipt

Check if webhooks are being received:

```bash
# In Amplify logs or CloudWatch
[Coinbase Webhook] Received event: {
  type: 'charge:confirmed',
  chargeId: 'xxx',
  chargeCode: 'ABC123'
}
```

## Benefits of Auto-Detection

### 1. Zero Configuration
- No need to set `NEXT_PUBLIC_APP_URL` in Amplify
- Works out of the box for all environments
- No risk of misconfiguration

### 2. Preview Branch Support
- Every PR automatically works with webhooks
- No need to create Coinbase webhooks for each preview
- Great for testing payment flows in PRs

### 3. Multi-Domain Support
- Works with custom domains automatically
- No config changes when adding new domains
- Easier domain migrations

### 4. Simplified Deployment
- One less environment variable to manage
- Fewer deployment errors
- Easier to replicate across environments

## Troubleshooting

### Issue: Webhook URL shows wrong domain

**Symptoms**: Logs show unexpected URL in webhook URL

**Check**:
```bash
# Look at the request headers in logs
origin: <value>
referer: <value>
```

**Solution**:
If auto-detection isn't working correctly, you can override it:
```bash
# Add to Amplify environment variables
NEXT_PUBLIC_APP_URL=https://your-correct-domain.com
```

### Issue: Preview branches not receiving webhooks

**This is expected!** Preview branches won't receive real Coinbase webhooks because:
- Coinbase doesn't know about your preview URL
- Preview URLs are temporary
- You'd need to create a webhook for each preview (not practical)

**Workarounds**:
1. Test webhook flow on dev/staging environments
2. Use the test script to simulate webhooks locally
3. Mock webhook responses in preview branches

### Issue: Different webhook secrets per environment

**This is correct!** Each environment should have its own webhook secret:
- Production: Different secret for `app.mor.org`
- Development: Different secret for `app.dev.mor.org`

Configure them separately in Amplify environment variables.

## Migration from Manual Configuration

If you previously set `NEXT_PUBLIC_APP_URL`, you can remove it:

### Before (Manual Configuration)
```bash
# Amplify environment variables
NEXT_PUBLIC_APP_URL=https://app.mor.org
COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_xxxxx
```

### After (Auto-Detection)
```bash
# Amplify environment variables
COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_xxxxx
# NEXT_PUBLIC_APP_URL removed - auto-detected!
```

**Steps to migrate:**
1. Remove `NEXT_PUBLIC_APP_URL` from Amplify environment variables
2. Redeploy the app
3. Test that webhooks still work
4. Check logs to verify correct URL is detected

## Advanced: Override Auto-Detection

If you need to force a specific URL (rare cases):

```bash
# Amplify environment variables
NEXT_PUBLIC_APP_URL=https://your-custom-url.com
```

Use cases for override:
- Testing webhooks against a different domain
- Routing webhooks through a proxy
- Using a CDN URL instead of origin URL

## Summary

### What You Need to Set in Amplify

**Production:**
```bash
COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_prod_secret
```

**Development:**
```bash
COINBASE_COMMERCE_WEBHOOK_SECRET=whsec_dev_secret  
```

### What You DON'T Need to Set

```bash
# Not needed - auto-detected!
# NEXT_PUBLIC_APP_URL=...
```

### Configuration Checklist

- [ ] Add `COINBASE_COMMERCE_WEBHOOK_SECRET` to Amplify production environment
- [ ] Add `COINBASE_COMMERCE_WEBHOOK_SECRET` to Amplify development environment
- [ ] Configure production webhook in Coinbase: `https://app.mor.org/api/webhooks/coinbase-notification`
- [ ] Configure development webhook in Coinbase: `https://app.dev.mor.org/api/webhooks/coinbase-notification`
- [ ] Test payment on production
- [ ] Test payment on development
- [ ] Verify logs show correct auto-detected URLs
- [ ] Remove `NEXT_PUBLIC_APP_URL` if previously set (optional cleanup)

### Expected Behavior

When a user creates a payment:
1. Frontend calls `/api/coinbase/charge`
2. System reads request origin header
3. Dynamically sets webhook URL based on origin
4. Coinbase sends webhook to the correct environment
5. Frontend polls and shows notification
6. Balance refreshes automatically

All without any manual URL configuration! 🎉
