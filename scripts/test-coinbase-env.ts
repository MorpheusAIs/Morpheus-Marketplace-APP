/**
 * Script to test Coinbase Business Payment Link environment variable configuration
 * Tests both localhost and deployed environment
 *
 * Usage:
 *   npx tsx scripts/test-coinbase-env.ts
 */

const DEPLOYED_URL = 'https://app.dev.mor.org';
const LOCAL_URL = 'http://localhost:3000';

interface DiagnosticResponse {
  timestamp: string;
  environment: string;
  vercel: {
    env: string;
    region: string;
  };
  coinbase_business: {
    admin_secret_configured: boolean;
    api_base_url_configured: boolean;
    api_base_url: string;
    webhook_secret_configured: boolean;
  };
  legacy_commerce: {
    api_key_configured: boolean;
    webhook_secret_configured: boolean;
    note: string;
  };
  all_env_vars: Record<string, string>;
}

async function testEndpoint(url: string, name: string): Promise<void> {
  console.log(`\n Testing ${name}...`);
  console.log(`   URL: ${url}/api/coinbase/diagnostic`);

  try {
    const response = await fetch(`${url}/api/coinbase/diagnostic`);

    if (!response.ok) {
      console.log(`   HTTP ${response.status}: ${response.statusText}`);
      return;
    }

    const data: DiagnosticResponse = await response.json();

    console.log(`   Response received`);
    console.log(`   Environment: ${data.environment}`);
    console.log(`   Vercel Env: ${data.vercel.env}`);
    console.log(`   Region: ${data.vercel.region}`);
    console.log('');
    console.log('   Coinbase Business Configuration:');
    console.log(`   - Admin Secret: ${data.coinbase_business.admin_secret_configured ? 'OK' : 'MISSING'}`);
    console.log(`   - API Base URL: ${data.coinbase_business.api_base_url_configured ? 'OK' : 'MISSING'} (${data.coinbase_business.api_base_url})`);
    console.log(`   - Webhook Secret: ${data.coinbase_business.webhook_secret_configured ? 'OK' : 'MISSING'}`);

    if (data.legacy_commerce.api_key_configured) {
      console.log('');
      console.log('   WARNING: Legacy Commerce vars still present:');
      console.log(`   - ${data.legacy_commerce.note}`);
    }

    if (Object.keys(data.all_env_vars).length > 0) {
      console.log('');
      console.log('   Environment Variables:');
      Object.entries(data.all_env_vars).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
    }
  } catch (error) {
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function main() {
  console.log('Coinbase Business Payment Link - Environment Diagnostic');
  console.log('=======================================================');

  // Test deployed environment
  await testEndpoint(DEPLOYED_URL, 'Deployed (app.dev.mor.org)');

  // Test localhost (if running)
  console.log('\nTesting localhost (if server is running)...');
  await testEndpoint(LOCAL_URL, 'Localhost');

  console.log('\n');
  console.log('Required environment variables:');
  console.log('  ADMIN_API_SECRET           - Secret for backend admin API auth');
  console.log('  NEXT_PUBLIC_API_BASE_URL   - Backend API base URL');
  console.log('  COINBASE_PAYMENT_LINK_WEBHOOK_SECRET - Webhook signature verification');
  console.log('');
  console.log('NOTE: CDP API keys are configured on the backend (Morpheus-Marketplace-API),');
  console.log('not on the frontend. The frontend uses ADMIN_API_SECRET to authenticate.');
}

main().catch(console.error);
