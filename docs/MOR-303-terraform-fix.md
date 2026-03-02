# MOR-303 Terraform Fix: Coinbase Commerce Environment Variable

## Issue
The Terraform configuration shows that `COINBASE_COMMERCE_API_KEY` is defined, but it's reading from `var.frontend_secrets.coinbase_commerce_api_key`, which is likely not set or empty.

## Your Current Terraform Configuration

From your screenshot, the environment variables are defined in Terraform:

```hcl
resource "aws_amplify_branch" "frontend" {
  environment_variables = {
    # ... other variables ...
    
    # Private variables (server-side only, used by API routes in Lambda)
    COINBASE_COMMERCE_API_KEY = var.frontend_secrets.coinbase_commerce_api_key
    COINBASE_COMMERCE_API_SECRET = var.frontend_secrets.coinbase_commerce_api_secret
    COINBASE_COMMERCE_WEBHOOK_SECRET = var.frontend_secrets.coinbase_commerce_webhook_secret
    STRIPE_WEBHOOK_SECRET = var.frontend_secrets.stripe_webhook_secret
    STRIPE_SECRET_KEY = var.frontend_secrets.stripe_secret_key
  }
}
```

## The Problem

The variable `var.frontend_secrets.coinbase_commerce_api_key` is either:
1. Not defined in your Terraform variables
2. Set to an empty string
3. Not properly passed to the Terraform configuration

## Solution Options

### Option 1: Set via Terraform Variables File (Recommended)

In your **infrastructure repository**, find or create the Terraform variables file:

**File: `terraform.tfvars` or `dev.tfvars`**

```hcl
frontend_secrets = {
  coinbase_commerce_api_key      = "your-36-character-api-key-here"
  coinbase_commerce_api_secret   = "your-api-secret-here"
  coinbase_commerce_webhook_secret = "your-webhook-secret-here"
  stripe_webhook_secret          = "your-stripe-webhook-secret"
  stripe_secret_key              = "your-stripe-secret-key"
  next_public_project_id         = "your-project-id"
}
```

**Important**: 
- Never commit secrets to git
- Add `*.tfvars` to `.gitignore`
- Use the actual values from your local `.env.local` file

### Option 2: Set via Terraform Cloud/Enterprise Variables

If you're using Terraform Cloud or Terraform Enterprise:

1. Go to your workspace in Terraform Cloud
2. Navigate to: **Variables** section
3. Add Terraform variables (or HCL):

```hcl
# Variable: frontend_secrets
# Type: HCL

{
  coinbase_commerce_api_key = "your-36-character-api-key-here"
  coinbase_commerce_api_secret = "your-api-secret-here"
  coinbase_commerce_webhook_secret = "your-webhook-secret-here"
  stripe_webhook_secret = "your-stripe-webhook-secret"
  stripe_secret_key = "your-stripe-secret-key"
  next_public_project_id = "your-project-id"
}
```

Mark as **Sensitive** to hide the values.

### Option 3: Set via AWS Secrets Manager (Most Secure)

If your infrastructure is set up to read from AWS Secrets Manager:

```bash
# Store the secret in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "/morpheus/dev/coinbase-commerce-api-key" \
  --secret-string "your-36-character-api-key-here" \
  --region us-east-2

# Update your Terraform to read from Secrets Manager
# (This requires Terraform code changes)
```

### Option 4: Environment Variables (CI/CD)

If running Terraform in CI/CD (GitHub Actions, GitLab CI, etc.):

```bash
# Set as environment variable in CI/CD
export TF_VAR_frontend_secrets='{"coinbase_commerce_api_key":"your-key-here",...}'
```

## Apply the Changes

After setting the variables:

```bash
# Navigate to your infrastructure repo
cd /path/to/infrastructure-repo

# Initialize Terraform (if needed)
terraform init

# Review the changes
terraform plan

# Apply the changes
terraform apply

# Terraform will:
# 1. Update the AWS Amplify environment variables
# 2. Trigger a new build automatically
# 3. The new build will have the correct API key
```

## Verification Steps

1. **Check Terraform State**
   ```bash
   # In your infrastructure repo
   terraform show | grep COINBASE_COMMERCE_API_KEY
   
   # Should show:
   # COINBASE_COMMERCE_API_KEY = "ade3369c..." (first 8 chars)
   ```

2. **Check AWS Amplify Console**
   - Go to: AWS Amplify Console → Your App → App settings → Environment variables
   - You should see `COINBASE_COMMERCE_API_KEY` with a value (first few chars visible)

3. **Wait for Build**
   - Terraform will trigger a new Amplify build
   - Wait ~5-10 minutes for completion

4. **Test the Diagnostic Endpoint**
   ```bash
   curl https://app.dev.mor.org/api/coinbase/diagnostic
   
   # Should return:
   # "api_key_configured": true
   # "api_key_length": 36
   ```

5. **Test Payment Flow**
   - Visit app.dev.mor.org
   - Try "Continue to Payment"
   - Should open Coinbase Commerce

## Finding Your API Key

Your local `.env.local` file has the correct value. Copy it from there:

```bash
# In this frontend repo
grep COINBASE_COMMERCE_API_KEY .env.local

# Copy the value (should be 36 characters)
```

## Common Issues

### Issue: "Variable not declared"
**Error**: `Variable "frontend_secrets" is not declared`

**Solution**: Add variable definition to your Terraform:

```hcl
# variables.tf
variable "frontend_secrets" {
  description = "Sensitive configuration for frontend"
  type = object({
    coinbase_commerce_api_key       = string
    coinbase_commerce_api_secret    = string
    coinbase_commerce_webhook_secret = string
    stripe_webhook_secret           = string
    stripe_secret_key               = string
    next_public_project_id          = string
  })
  sensitive = true
}
```

### Issue: "Cannot convert null to string"
**Error**: `Cannot convert null to string`

**Solution**: The variable is defined but not set. Provide a value in `terraform.tfvars`.

### Issue: Changes applied but still not working
**Solution**: 
1. Check AWS Amplify build logs for errors
2. Ensure the build completed successfully
3. Clear browser cache and test again

## Infrastructure Repository Location

You need to apply these changes in your **infrastructure repository**, not this frontend repository. 

The screenshot shows this is the Terraform file, but it's not in this codebase. Ask your team:
- Where is the infrastructure/Terraform repository?
- Who has access to apply Terraform changes?
- Are you using Terraform Cloud or local Terraform?

## Security Best Practices

1. ✅ Never commit `.tfvars` files with secrets to git
2. ✅ Use Terraform Cloud variables or AWS Secrets Manager
3. ✅ Mark sensitive variables in Terraform
4. ✅ Use separate tfvars files per environment (dev.tfvars, prod.tfvars)
5. ✅ Rotate API keys regularly

## Summary

Since your infrastructure is managed with Terraform:
1. You **cannot** fix this via AWS Amplify Console UI
2. You **must** update the Terraform variables
3. Then run `terraform apply` to push the changes
4. Amplify will automatically rebuild with the new variables

## Related Files
- Terraform config: (separate infrastructure repo)
- Local env file: `.env.local` (this repo - has the correct values)
- Diagnostic endpoint: `https://app.dev.mor.org/api/coinbase/diagnostic`
