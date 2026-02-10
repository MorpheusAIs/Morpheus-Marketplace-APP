# Coinbase Commerce Environment Variable Issue (MOR-303)

## Problem
The Coinbase payment integration returns "Payment service not configured" on app.dev.mor.org but works correctly on localhost.

**Error Messages:**
- Console: `https://app.dev.mor.org/api/coinbase/charge 500 (Internal Server Error)`
- Response: `{"error":"Payment service not configured"}`

## Root Cause
The `COINBASE_COMMERCE_API_KEY` environment variable is not accessible to the Next.js API route in the Vercel deployment, even though it's configured in Vercel's dashboard.

## Common Causes & Solutions

### 1. Environment Variable Not Set for Correct Environment

Vercel has three environment types:
- **Production**: For production deployments (main/master branch)
- **Preview**: For PR deployments and preview branches
- **Development**: For local development with `vercel dev`

**Solution:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Find `COINBASE_COMMERCE_API_KEY`
3. Check the environments it's enabled for:
   - If you're deploying to `app.dev.mor.org`, this is likely a **Preview** or **Production** deployment
   - Ensure the variable is checked for the correct environment(s)
4. Save changes

### 2. Deployment Not Rebuilt After Adding Variable

Environment variables are baked into the build at build time for server-side variables.

**Solution:**
1. After adding/updating the environment variable in Vercel
2. Go to Deployments tab
3. Find the latest deployment
4. Click the three dots (...) → "Redeploy"
5. OR push a new commit to trigger a fresh build

### 3. Variable Name Mismatch

Vercel is case-sensitive for environment variable names.

**Solution:**
1. Verify the exact variable name in Vercel matches: `COINBASE_COMMERCE_API_KEY`
2. No extra spaces, underscores, or typos

### 4. Missing from .env.production (if using)

If you have a `.env.production` file that overrides Vercel's variables:

**Solution:**
1. Check if `.env.production` exists in your repo
2. If it does, ensure it includes `COINBASE_COMMERCE_API_KEY=`
3. Note: This is rare and not recommended

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

## Recommended Fix Process

1. **Verify in Vercel Dashboard:**
   ```bash
   # If you have Vercel CLI linked:
   vercel env ls
   
   # Check for COINBASE_COMMERCE_API_KEY
   # Should show which environments it's active in
   ```

2. **Update Environment Variable:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Click on `COINBASE_COMMERCE_API_KEY`
   - Ensure "Preview" is checked (if deploying to `app.dev.mor.org`)
   - Click "Save"

3. **Redeploy:**
   ```bash
   # Option A: Through CLI
   vercel --prod  # for production
   # or
   vercel  # for preview
   
   # Option B: Through Dashboard
   # Go to Deployments → Click (...) → Redeploy
   ```

4. **Verify Fix:**
   - Visit: `https://app.dev.mor.org/api/coinbase/diagnostic`
   - Confirm `api_key_configured: true`
   - Test payment flow

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

## Additional Resources

- [Vercel Environment Variables Documentation](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables)

## Related Issues
- Linear Issue: MOR-303
- Error Code: 500 Internal Server Error
- Component: `/api/coinbase/charge`
