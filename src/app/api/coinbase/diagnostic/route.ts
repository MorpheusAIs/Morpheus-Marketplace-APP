import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check Coinbase Business Payment Link configuration
 * Returns safe information about environment variable status without exposing secrets
 */
export async function GET() {
  const adminSecret = process.env.ADMIN_API_SECRET;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  const webhookSecret = process.env.COINBASE_PAYMENT_LINK_WEBHOOK_SECRET;

  // Legacy vars (should be removed after migration)
  const legacyApiKey = process.env.COINBASE_COMMERCE_API_KEY;
  const legacyWebhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: {
      env: process.env.VERCEL_ENV || 'not-vercel',
      region: process.env.VERCEL_REGION || 'unknown',
    },
    coinbase_business: {
      admin_secret_configured: !!adminSecret,
      api_base_url_configured: !!apiBaseUrl,
      api_base_url: apiBaseUrl || 'NOT_SET',
      webhook_secret_configured: !!webhookSecret,
    },
    legacy_commerce: {
      api_key_configured: !!legacyApiKey,
      webhook_secret_configured: !!legacyWebhookSecret,
      note: legacyApiKey ? 'LEGACY: Should be removed after migration' : 'Clean - already removed',
    },
    all_env_vars: Object.keys(process.env)
      .filter(key => key.includes('COINBASE') || key.includes('CDP') || key.includes('ADMIN_API'))
      .reduce((acc, key) => {
        acc[key] = process.env[key] ? '✓ SET' : '✗ NOT SET';
        return acc;
      }, {} as Record<string, string>),
  });
}
