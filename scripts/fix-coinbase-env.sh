#!/bin/bash
# Script to diagnose and fix Coinbase Commerce environment variable issues
# Usage: ./scripts/fix-coinbase-env.sh

set -e

echo "🔍 Coinbase Commerce Environment Variable Diagnostic Tool"
echo "=========================================================="
echo ""

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Install it with: npm i -g vercel"
    exit 1
fi

echo "✅ Vercel CLI found"
echo ""

# Check if project is linked
if [ ! -d ".vercel" ]; then
    echo "❌ Project not linked to Vercel"
    echo "Run: vercel link"
    exit 1
fi

echo "✅ Project linked to Vercel"
echo ""

# List environment variables
echo "📋 Listing environment variables..."
echo ""
vercel env ls

echo ""
echo "🔍 Checking for COINBASE_COMMERCE_API_KEY..."
echo ""

# Check if the variable exists
if vercel env ls | grep -q "COINBASE_COMMERCE_API_KEY"; then
    echo "✅ COINBASE_COMMERCE_API_KEY is configured in Vercel"
    echo ""
    echo "Checking which environments it's enabled for:"
    vercel env ls | grep "COINBASE_COMMERCE_API_KEY"
else
    echo "❌ COINBASE_COMMERCE_API_KEY not found in Vercel"
    echo ""
    echo "To add it, run:"
    echo "  vercel env add COINBASE_COMMERCE_API_KEY"
    echo ""
    echo "Make sure to enable it for the correct environment:"
    echo "  - Preview (for branches/PRs like app.dev.mor.org)"
    echo "  - Production (for main branch deployments)"
    exit 1
fi

echo ""
echo "🔧 Next Steps:"
echo "1. Verify the variable is enabled for the correct environment"
echo "2. If you just added/updated it, redeploy: vercel --prod"
echo "3. Test the diagnostic endpoint: curl https://app.dev.mor.org/api/coinbase/diagnostic"
echo ""
echo "📖 For detailed troubleshooting, see: docs/troubleshooting/coinbase-env-var-issue.md"
