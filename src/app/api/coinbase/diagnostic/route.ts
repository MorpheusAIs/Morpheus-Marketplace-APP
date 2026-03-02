import { NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check Coinbase Commerce configuration
 * Returns safe information about environment variable status without exposing secrets
 */
export async function GET() {
  const apiKey = process.env.COINBASE_COMMERCE_API_KEY;
  const apiSecret = process.env.COINBASE_COMMERCE_API_SECRET;
  const webhookSecret = process.env.COINBASE_COMMERCE_WEBHOOK_SECRET;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    vercel: {
      env: process.env.VERCEL_ENV || 'not-vercel',
      region: process.env.VERCEL_REGION || 'unknown',
    },
    coinbase_commerce: {
      api_key_configured: !!apiKey,
      api_key_length: apiKey ? apiKey.length : 0,
      api_key_prefix: apiKey ? apiKey.substring(0, 8) + '...' : 'NOT_SET',
      api_secret_configured: !!apiSecret,
      webhook_secret_configured: !!webhookSecret,
    },
    all_env_vars: Object.keys(process.env)
      .filter(key => key.includes('COINBASE') || key.includes('NEXT_PUBLIC'))
      .reduce((acc, key) => {
        acc[key] = process.env[key] ? '✓ SET' : '✗ NOT SET';
        return acc;
      }, {} as Record<string, string>),
  });
}
