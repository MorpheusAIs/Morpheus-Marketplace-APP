/**
 * Script to test Coinbase Commerce environment variable configuration
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
  coinbase_commerce: {
    api_key_configured: boolean;
    api_key_length: number;
    api_key_prefix: string;
    api_secret_configured: boolean;
    webhook_secret_configured: boolean;
  };
  all_env_vars: Record<string, string>;
}

async function testEndpoint(url: string, name: string): Promise<void> {
  console.log(`\n🔍 Testing ${name}...`);
  console.log(`   URL: ${url}/api/coinbase/diagnostic`);
  
  try {
    const response = await fetch(`${url}/api/coinbase/diagnostic`);
    
    if (!response.ok) {
      console.log(`   ❌ HTTP ${response.status}: ${response.statusText}`);
      return;
    }
    
    const data: DiagnosticResponse = await response.json();
    
    console.log(`   ✅ Response received`);
    console.log(`   Environment: ${data.environment}`);
    console.log(`   Vercel Env: ${data.vercel.env}`);
    console.log(`   Region: ${data.vercel.region}`);
    console.log('');
    console.log('   Coinbase Configuration:');
    console.log(`   - API Key: ${data.coinbase_commerce.api_key_configured ? '✅' : '❌'} Configured`);
    
    if (data.coinbase_commerce.api_key_configured) {
      console.log(`   - Length: ${data.coinbase_commerce.api_key_length} characters`);
      console.log(`   - Prefix: ${data.coinbase_commerce.api_key_prefix}`);
    } else {
      console.log('   ⚠️  API KEY NOT CONFIGURED');
    }
    
    console.log(`   - API Secret: ${data.coinbase_commerce.api_secret_configured ? '✅' : '❌'}`);
    console.log(`   - Webhook Secret: ${data.coinbase_commerce.webhook_secret_configured ? '✅' : '❌'}`);
    
    if (Object.keys(data.all_env_vars).length > 0) {
      console.log('');
      console.log('   Environment Variables:');
      Object.entries(data.all_env_vars).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function main() {
  console.log('🔍 Coinbase Commerce Environment Variable Diagnostic');
  console.log('=====================================================');
  
  // Test deployed environment
  await testEndpoint(DEPLOYED_URL, 'Deployed (app.dev.mor.org)');
  
  // Test localhost (if running)
  console.log('\n📌 Testing localhost (if server is running)...');
  await testEndpoint(LOCAL_URL, 'Localhost');
  
  console.log('\n');
  console.log('📋 Summary:');
  console.log('If deployed shows ❌ but localhost shows ✅:');
  console.log('  → Environment variable not set in Vercel or deployment not rebuilt');
  console.log('');
  console.log('Next Steps:');
  console.log('1. Verify in Vercel Dashboard:');
  console.log('   Settings → Environment Variables → COINBASE_COMMERCE_API_KEY');
  console.log('2. Ensure "Preview" environment is checked');
  console.log('3. Redeploy: vercel --prod or trigger new deployment');
  console.log('');
  console.log('📖 Full guide: docs/troubleshooting/coinbase-env-var-issue.md');
}

main().catch(console.error);
