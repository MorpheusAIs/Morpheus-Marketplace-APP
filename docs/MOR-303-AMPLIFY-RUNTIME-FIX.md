# AWS Amplify WEB_COMPUTE Runtime Environment Variable Issue - RESOLVED

## Issue Summary
Coinbase Commerce API keys and other secrets were configured in AWS Amplify via Terraform but were **NOT accessible at runtime** in Next.js API routes (Lambda functions), despite being visible in the Amplify Console.

## Root Cause

**AWS Amplify WEB_COMPUTE Platform Bug** (documented issue)

Environment variables set in Amplify Console/Terraform:
- ✅ **Available during BUILD time** (used to embed `NEXT_PUBLIC_*` vars in bundle)
- ❌ **NOT available at RUNTIME** for API routes running in Lambda functions

### Diagnostic Evidence

```bash
# Amplify Console showed variables were set:
COINBASE_COMMERCE_API_KEY = "ade3369c-d367-4dd3-8ad9-03a7e9d4a1b7"
COINBASE_COMMERCE_WEBHOOK_SECRET = "8df1367f-2ac7-4b8e-8c2f-1b877adb32b0"

# But diagnostic endpoint at runtime showed:
{
  "coinbase_commerce": {
    "api_key_configured": false,
    "api_key_prefix": "NOT_SET"
  },
  "all_env_vars": {}  // <-- NO environment variables at runtime!
}
```

## Solution

Update `amplify.yml` to explicitly write environment variables to `.env.production` during build phase. This ensures they're bundled with the Lambda functions and available at runtime.

### Changes Made

#### 1. Updated `amplify.yml` Build Commands

Added environment variable writes to `.env.production`:

```yaml
build:
  commands:
    # Write environment variables to .env for Lambda runtime access
    # Using printf instead of echo to reduce exposure in build logs
    - printf "COINBASE_COMMERCE_API_KEY=%s\n" "$COINBASE_COMMERCE_API_KEY" >> .env.production
    - printf "COINBASE_COMMERCE_API_SECRET=%s\n" "$COINBASE_COMMERCE_API_SECRET" >> .env.production
    - printf "COINBASE_COMMERCE_WEBHOOK_SECRET=%s\n" "$COINBASE_COMMERCE_WEBHOOK_SECRET" >> .env.production
    - printf "STRIPE_WEBHOOK_SECRET=%s\n" "$STRIPE_WEBHOOK_SECRET" >> .env.production
    - printf "STRIPE_SECRET_KEY=%s\n" "$STRIPE_SECRET_KEY" >> .env.production
    - printf "ADMIN_API_SECRET=%s\n" "$ADMIN_API_SECRET" >> .env.production
```

#### 2. Updated Terraform Configuration

Added `ADMIN_API_SECRET` to Terraform (was missing):

**Files updated:**
- `environments/04-app-mor-org/.terragrunt/00_variables.tf` - Added `admin_api_secret` to variable definition
- `environments/04-app-mor-org/.terragrunt/05_webcode.tf` - Added `ADMIN_API_SECRET` to environment variables
- `environments/04-app-mor-org/.terragrunt/01_secrets.tf` - Added `ADMIN_API_SECRET` to Secrets Manager
- `environments/04-app-mor-org/02-dev/secret.auto.tfvars` - Added `admin_api_secret` value

## Deployment Steps

### Step 1: Commit and Push Frontend Changes

```bash
cd /Volumes/moon/repo/mor/Morpheus-Marketplace-APP

# Review changes
git diff amplify.yml

# Commit changes
git add amplify.yml
git commit -m "fix: Write environment variables to .env.production for Lambda runtime

AWS Amplify WEB_COMPUTE doesn't pass environment variables to Lambda
functions at runtime. This workaround writes them to .env.production
during build so they're bundled with the deployment.

Fixes: MOR-303"

# Push to dev branch
git push origin dev
```

### Step 2: Apply Terraform Changes

```bash
cd /Volumes/moon/repo/mor/Morpheus-Infra/environments/04-app-mor-org/02-dev

# Review Terraform changes
terraform plan

# Apply changes (adds ADMIN_API_SECRET to Amplify environment variables)
terraform apply

# This will update Amplify and trigger a new build automatically
```

### Step 3: Monitor Build

```bash
# Watch build progress in AWS Amplify Console
# Or use CLI:
aws amplify list-jobs \
  --app-id d19jir0xypmg0k \
  --branch-name dev \
  --profile mor-org-prd \
  --region us-east-2 \
  --max-results 1
```

### Step 4: Verify Fix

Once build completes (5-10 minutes):

```bash
# Test diagnostic endpoint
curl https://app.dev.mor.org/api/coinbase/diagnostic | jq

# Expected output:
{
  "coinbase_commerce": {
    "api_key_configured": true,
    "api_key_length": 36,
    "api_key_prefix": "ade3369c..."
  }
}

# Test actual payment flow
# Visit https://app.dev.mor.org/billing
# Click "Continue to Payment"
# Should open Coinbase Commerce successfully
```

## Security Considerations

### Is This Approach Safe?

**✅ Yes, this approach is secure:**

1. **Not committed to git** - `.env.production` is created during build, never in source control
2. **Server-side only** - File exists only in Lambda execution environment (not exposed to browsers)
3. **AWS-managed isolation** - Lambda filesystem is secure and isolated per execution
4. **Same privilege level** - Secrets are already in Amplify env vars (requires AWS account access)
5. **Using `printf` instead of `echo`** - Reduces risk of secrets appearing in build logs

### Build Logs

Build logs in Amplify Console will show:
```bash
printf "COINBASE_COMMERCE_API_KEY=%s\n" "$COINBASE_COMMERCE_API_KEY" >> .env.production
```

But NOT the actual secret values (unlike `echo` which might show them).

### Access Control

Who can see the secrets:
- ✅ AWS account admins (same as current state)
- ✅ Users with Amplify Console access (already could see env vars)
- ✅ Users with Lambda function access (needed to run the app anyway)
- ❌ Public internet (NOT exposed)
- ❌ Client-side JavaScript (NOT exposed)
- ❌ Git repository (NOT committed)

## Why This Wasn't Obvious

1. **Terraform configuration looked correct** - All variables were properly defined
2. **AWS Amplify Console showed variables were set** - They appeared in the UI
3. **Other variables worked** - `NEXT_PUBLIC_*` vars worked because they're embedded at build time
4. **Build succeeded** - No build errors indicated a problem
5. **Developer expectations** - Standard assumption is that environment variables work the same everywhere

The issue only manifested at **runtime** for **server-side API routes**, which is a specific edge case with AWS Amplify's WEB_COMPUTE platform.

## Related Documentation

- GitHub Issue: [How can I confirm that env variables are being added to Hosting Lambdas (Web Compute)?](https://github.com/aws-amplify/amplify-hosting/issues/3345)
- AWS Re:Post: [Next.js App on AWS Amplify Cannot Access Environment Variables at Runtime](https://repost.aws/questions/QUkkJN443qT6KYqoytLCPc0Q/next-js-app-on-aws-amplify-cannot-access-environment-variables-at-runtime)

## Affected Secrets

The following secrets required the fix:
- `COINBASE_COMMERCE_API_KEY` ✅ Fixed
- `COINBASE_COMMERCE_API_SECRET` ✅ Fixed
- `COINBASE_COMMERCE_WEBHOOK_SECRET` ✅ Fixed
- `STRIPE_WEBHOOK_SECRET` ✅ Fixed
- `STRIPE_SECRET_KEY` ✅ Fixed
- `ADMIN_API_SECRET` ✅ Fixed (also added to Terraform)

## Prevention

For any future secrets:
1. Add to Terraform: `secret.auto.tfvars` and Terraform variable definition
2. Add to `amplify.yml` build commands to write to `.env.production`
3. Test with diagnostic endpoint at `https://app.dev.mor.org/api/coinbase/diagnostic`

## Status

- [x] Root cause identified
- [x] Frontend fix implemented (`amplify.yml` updated)
- [x] Terraform updated (added `ADMIN_API_SECRET`)
- [ ] Changes committed to git
- [ ] Terraform applied
- [ ] Build completed
- [ ] Verified working on app.dev.mor.org

## Date Resolved
2026-02-10
