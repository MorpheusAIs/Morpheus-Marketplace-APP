# MOR-303 Fix Summary: Coinbase Commerce Environment Variable Issue (AWS Amplify)

## Issue Description
Coinbase payment integration works on `localhost` but fails on `app.dev.mor.org` with error:
```
Payment service not configured (500 Internal Server Error)
```

## Root Cause
The `COINBASE_COMMERCE_API_KEY` environment variable is properly set in your local `.env.local` file but is NOT accessible in the AWS Amplify deployment.

## Diagnostic Results
✅ **Localhost**: API key is configured (36 characters, prefix: `ade3369c...`)  
❌ **Deployed**: API key is not accessible to the Next.js API route

## Fix Steps for AWS Amplify

### Method 1: AWS Amplify Console (Recommended)

1. **Open AWS Amplify Console**
   - Go to: https://console.aws.amazon.com/amplify/
   - Select your Morpheus Marketplace APP

2. **Navigate to Environment Variables**
   - In the left sidebar, click **App settings** → **Environment variables**
   - Or go to the **Build settings** section

3. **Add or Update the Variable**
   - Click **Manage variables** (or **Add environment variable**)
   - Add the following:
     ```
     Variable name: COINBASE_COMMERCE_API_KEY
     Value: [your 36-character API key from .env.local]
     ```
   - **Important**: Make sure it's added to the correct branch environment (e.g., `dev` branch)

4. **Optional: Add Related Variables**
   If you use these in your code:
   ```
   COINBASE_COMMERCE_API_SECRET
   COINBASE_COMMERCE_WEBHOOK_SECRET
   ```

5. **Save and Redeploy**
   - Click **Save**
   - AWS Amplify will automatically trigger a new build
   - OR manually trigger: Go to **Deployments** → Click **Redeploy this version**
   - Wait for build to complete (~5-10 minutes)

6. **Verify Fix**
   - Once deployed, visit: https://app.dev.mor.org/api/coinbase/diagnostic
   - Should show: `"api_key_configured": true`
   - Test the payment flow

### Method 2: AWS Amplify CLI

If you have Amplify CLI configured:

```bash
# Configure environment variables
amplify env add

# Or update existing environment
amplify env update

# Push changes
amplify push

# Verify
curl https://app.dev.mor.org/api/coinbase/diagnostic
```

### Method 3: amplify.yml Configuration

You can also add environment variables in your `amplify.yml` file, but this is **NOT recommended for secrets**:

```yaml
# amplify.yml (DO NOT USE FOR SECRETS)
version: 1
frontend:
  phases:
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

**Note**: Never commit secrets to your repository. Always use the AWS Amplify Console for sensitive values.

## AWS Amplify Environment Variable Behavior

### Key Differences from Vercel:
1. **Branch-specific**: Environment variables are configured per branch
2. **Build-time**: Variables are baked into the build, requiring redeployment
3. **No separate environments**: Unlike Vercel's Preview/Production, Amplify uses branches
4. **Access**: Only variables without `NEXT_PUBLIC_` prefix are server-side only

### Current Configuration:
Your `dev` branch likely deploys to `app.dev.mor.org`, so ensure variables are set for the `dev` branch.

## Common Issues & Solutions

### Issue: Variable shows in Amplify Console but still doesn't work
**Solutions**:
1. Check you're viewing the correct branch configuration
2. Redeploy the application (new build required)
3. Check AWS Amplify build logs for variable warnings

### Issue: Build completes but variable still not accessible
**Cause**: Variable might only be visible to build process, not runtime
**Solution**: Ensure the variable name doesn't have `NEXT_PUBLIC_` prefix for server-side usage

### Issue: Can't find Environment Variables section
**Solution**: 
- Go to: App settings → Environment variables
- Or: Build settings → Environment variables section

## Verification Checklist

After fixing, verify these endpoints:

- [ ] AWS Amplify build completes successfully
- [ ] Diagnostic endpoint works: `https://app.dev.mor.org/api/coinbase/diagnostic`
- [ ] Shows: `"api_key_configured": true`
- [ ] API key length matches (should be 36 characters)
- [ ] Payment flow works: Click "Continue to Payment" in the app
- [ ] Coinbase Commerce checkout opens successfully

## Quick Test After Deployment

```bash
# Test the diagnostic endpoint
curl https://app.dev.mor.org/api/coinbase/diagnostic | jq

# Or use our test script
npx tsx scripts/test-coinbase-env.ts
```

Expected output:
```json
{
  "coinbase_commerce": {
    "api_key_configured": true,
    "api_key_length": 36,
    "api_key_prefix": "ade3369c..."
  }
}
```

## Technical Details

The error occurs in `src/app/api/coinbase/charge/route.ts` at line 90-97:

```typescript
const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
if (!apiKey) {
  console.error('COINBASE_COMMERCE_API_KEY not configured');
  return NextResponse.json(
    { error: 'Payment service not configured' },
    { status: 500 }
  );
}
```

In AWS Amplify (like Vercel), server-side environment variables are read at build time for static optimization and at runtime for API routes. A redeploy ensures the new variable is available.

## AWS Amplify Console Navigation

1. AWS Console → Services → AWS Amplify
2. Select your app: **Morpheus Marketplace APP**
3. Left sidebar:
   - **App settings** → **Environment variables** ← Go here
   - **Build settings** (shows amplify.yml)
   - **Deployments** (trigger redeployment)

## Related Files
- API Route: `src/app/api/coinbase/charge/route.ts`
- Diagnostic Endpoint: `src/app/api/coinbase/diagnostic/route.ts`
- Test Script: `scripts/test-coinbase-env.ts`
- Full Guide: `docs/troubleshooting/coinbase-env-var-issue.md`

## Status
- [x] Diagnostic tools created
- [x] Documentation added
- [ ] Environment variable configured in AWS Amplify
- [ ] Deployment completed
- [ ] Fix verified on app.dev.mor.org

## Next Steps
1. Open AWS Amplify Console
2. Go to App settings → Environment variables
3. Add `COINBASE_COMMERCE_API_KEY` with your API key value
4. Save (build will auto-trigger)
5. Wait for build to complete (~5-10 minutes)
6. Test diagnostic endpoint: `https://app.dev.mor.org/api/coinbase/diagnostic`
7. Test payment flow in the app
8. Close MOR-303 issue on Linear

## Additional Resources
- [AWS Amplify Environment Variables Docs](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Next.js Environment Variables](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables)
