# Coinbase Commerce Environment Variable Issue (MOR-303)

## Problem
The Coinbase payment integration returns "Payment service not configured" on app.dev.mor.org but works correctly on localhost.

**Error Messages:**
- Console: `https://app.dev.mor.org/api/coinbase/charge 500 (Internal Server Error)`
- Response: `{"error":"Payment service not configured"}`

## Root Cause
The `COINBASE_COMMERCE_API_KEY` environment variable is not accessible to the Next.js API route in the AWS Amplify deployment, even though it may be configured locally.

## Common Causes & Solutions (AWS Amplify)

### 1. Environment Variable Not Configured in AWS Amplify Console

**Solution:**
1. Open AWS Amplify Console: https://console.aws.amazon.com/amplify/
2. Select your Morpheus Marketplace APP
3. Go to: **App settings** → **Environment variables**
4. Click **Manage variables** or **Add environment variable**
5. Add:
   - Variable name: `COINBASE_COMMERCE_API_KEY`
   - Value: Your 36-character API key
6. Ensure it's added for the correct branch (e.g., `dev` branch for app.dev.mor.org)
7. Click **Save**

### 2. Deployment Not Rebuilt After Adding Variable

Environment variables in AWS Amplify are baked into the build at build time.

**Solution:**
1. After adding/updating the environment variable in Amplify Console
2. AWS Amplify should auto-trigger a new build
3. OR manually trigger: Go to **Deployments** → **Redeploy this version**
4. Wait for build to complete (~5-10 minutes)
5. Monitor build logs for any errors

### 3. Variable Name Mismatch

AWS Amplify is case-sensitive for environment variable names.

**Solution:**
1. Verify the exact variable name matches: `COINBASE_COMMERCE_API_KEY`
2. No extra spaces, underscores, or typos
3. No `NEXT_PUBLIC_` prefix (this is a server-side only variable)

### 4. Branch-Specific Configuration

AWS Amplify configures environment variables per branch, not per environment type.

**Solution:**
1. Identify which branch deploys to `app.dev.mor.org` (likely `dev`)
2. Ensure the variable is configured for that specific branch
3. Each branch can have different environment variable values

## Diagnostic Steps

### Step 1: Check Diagnostic Endpoint
Visit: `https://app.dev.mor.org/api/coinbase/diagnostic`

This will show:
- Whether the API key is configured
- The length and prefix of the key (first 8 chars)
- Which environment variables are set

Expected output when working:
```json
{
  "coinbase_commerce": {
    "api_key_configured": true,
    "api_key_length": 36,
    "api_key_prefix": "xxxxxxxx..."
  }
}
```

### Step 2: Check Vercel Build Logs
1. Go to Vercel Dashboard → Deployments
2. Click on the latest deployment
3. Check the "Build Logs" tab
4. Search for any warnings about environment variables

### Step 3: Verify Variable Visibility
Create a temporary test endpoint (remove after testing):

```typescript
// src/app/api/test-env/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasKey: !!process.env.COINBASE_COMMERCE_API_KEY,
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
```

Visit: `https://app.dev.mor.org/api/test-env`

## Recommended Fix Process (AWS Amplify)

1. **Open AWS Amplify Console:**
   - Navigate to: https://console.aws.amazon.com/amplify/
   - Select: Morpheus Marketplace APP

2. **Configure Environment Variable:**
   - Go to: **App settings** → **Environment variables**
   - Click: **Manage variables** (or **Add environment variable**)
   - Add variable:
     ```
     Name: COINBASE_COMMERCE_API_KEY
     Value: [your 36-character API key]
     Branch: dev (or the branch that deploys to app.dev.mor.org)
     ```
   - Click **Save**

3. **Monitor Build:**
   - AWS Amplify will automatically trigger a new build
   - Go to: **Deployments** tab to monitor progress
   - Wait for build to complete (~5-10 minutes)
   - Check build logs for any errors

4. **Verify Fix:**
   - Visit: `https://app.dev.mor.org/api/coinbase/diagnostic`
   - Confirm `api_key_configured: true`
   - Test payment flow

**Alternative: Manual Redeploy**
If auto-build doesn't trigger:
- Go to: **Deployments** → Find latest deployment
- Click: **Redeploy this version**

## Prevention

Add this check to your CI/CD pipeline:

```yaml
# .github/workflows/check-env-vars.yml
name: Check Environment Variables
on: [push]
jobs:
  check-env:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Check required env vars
        run: |
          if [ -z "${{ secrets.COINBASE_COMMERCE_API_KEY }}" ]; then
            echo "❌ COINBASE_COMMERCE_API_KEY not set in GitHub secrets"
            exit 1
          fi
```

## AWS Amplify Specific Notes

### Environment Variable Visibility
- Variables **without** `NEXT_PUBLIC_` prefix are server-side only
- Server-side variables are available in API routes and `getServerSideProps`
- They are NOT exposed to the browser/client-side code

### Branch Configuration
- Each branch can have different environment variable values
- Common setup:
  - `main` branch → production environment
  - `dev` branch → development/staging (app.dev.mor.org)
  - Feature branches → can inherit from parent branch

### Build Process
1. AWS Amplify reads environment variables at build time
2. Variables are injected into the Next.js build
3. API routes access them via `process.env.*`
4. Changes require a rebuild to take effect

## Additional Resources

- [AWS Amplify Environment Variables Documentation](https://docs.aws.amazon.com/amplify/latest/userguide/environment-variables.html)
- [Next.js Environment Variables](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables)

## Related Issues
- Linear Issue: MOR-303
- Error Code: 500 Internal Server Error
- Component: `/api/coinbase/charge`
