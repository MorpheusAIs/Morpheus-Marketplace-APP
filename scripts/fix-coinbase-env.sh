#!/bin/bash
# Script to diagnose Coinbase Commerce environment variable issues
# For AWS Amplify deployments
# Usage: ./scripts/fix-coinbase-env.sh

set -e

echo "🔍 Coinbase Commerce Environment Variable Diagnostic Tool"
echo "==========================================================="
echo "Deployment Platform: AWS Amplify"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI not found (optional)"
    echo "   You can still fix this via AWS Amplify Console"
    echo ""
else
    echo "✅ AWS CLI found"
    echo ""
fi

# Check local environment first
if [ -f ".env.local" ]; then
    echo "✅ Local .env.local file found"
    if grep -q "COINBASE_COMMERCE_API_KEY" .env.local; then
        echo "✅ COINBASE_COMMERCE_API_KEY exists in .env.local"
        # Get the length without showing the actual key
        KEY_LENGTH=$(grep "COINBASE_COMMERCE_API_KEY" .env.local | cut -d'=' -f2 | tr -d ' ' | wc -c)
        echo "   Length: $KEY_LENGTH characters"
    else
        echo "❌ COINBASE_COMMERCE_API_KEY not found in .env.local"
    fi
    echo ""
else
    echo "⚠️  .env.local file not found"
    echo ""
fi

# Test localhost
echo "🧪 Testing localhost configuration..."
if curl -s http://localhost:3000/api/coinbase/diagnostic > /dev/null 2>&1; then
    RESPONSE=$(curl -s http://localhost:3000/api/coinbase/diagnostic)
    if echo "$RESPONSE" | grep -q '"api_key_configured":true'; then
        echo "✅ Localhost: API key is configured"
    else
        echo "❌ Localhost: API key NOT configured"
    fi
else
    echo "⚠️  Localhost server not running (start with: npm run dev)"
fi
echo ""

# Test deployed environment
echo "🌐 Testing deployed environment (app.dev.mor.org)..."
if curl -s https://app.dev.mor.org/api/coinbase/diagnostic > /dev/null 2>&1; then
    RESPONSE=$(curl -s https://app.dev.mor.org/api/coinbase/diagnostic)
    if echo "$RESPONSE" | grep -q '"api_key_configured":true'; then
        echo "✅ Deployed: API key is configured"
        echo ""
        echo "🎉 Everything looks good! The issue should be resolved."
    else
        echo "❌ Deployed: API key NOT configured"
        echo ""
        echo "🔧 To Fix:"
        echo "1. Open AWS Amplify Console: https://console.aws.amazon.com/amplify/"
        echo "2. Select: Morpheus Marketplace APP"
        echo "3. Go to: App settings → Environment variables"
        echo "4. Add or verify: COINBASE_COMMERCE_API_KEY"
        echo "5. Ensure it's configured for the 'dev' branch"
        echo "6. Save and wait for automatic rebuild (~5-10 minutes)"
        echo "7. Re-run this script to verify"
    fi
else
    echo "❌ Cannot reach deployed endpoint"
    echo "   Either the diagnostic endpoint hasn't been deployed yet,"
    echo "   or there's a network/deployment issue"
fi

echo ""
echo "📖 For detailed guide, see: docs/MOR-303-fix-summary.md"
echo "📖 Full troubleshooting: docs/troubleshooting/coinbase-env-var-issue.md"
echo ""

# If AWS CLI is available, offer to open the console
if command -v aws &> /dev/null; then
    echo "💡 Quick actions:"
    echo "   - Open AWS Amplify Console in browser"
    echo "   - Or manually navigate to: AWS Console → Amplify → Your App → Environment variables"
fi
