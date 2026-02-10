#!/usr/bin/env tsx
/**
 * Test script to verify MOR-337 pagination fix
 * 
 * This script directly tests the pagination logic to ensure
 * all pages are fetched correctly.
 * 
 * Usage:
 *   npx tsx scripts/test-pagination.ts
 * 
 * Requirements:
 *   - Valid API token in environment or passed as argument
 *   - Backend API running and accessible
 */

interface UsageEntry {
  id: string;
  tokens_total: number | null;
  tokens_input: number | null;
  tokens_output: number | null;
  amount_total: string;
}

interface PaginatedResponse {
  items: UsageEntry[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

async function fetchUsagePage(
  baseUrl: string,
  token: string,
  offset: number,
  limit: number = 100
): Promise<PaginatedResponse> {
  const url = `${baseUrl}/billing/usage?limit=${limit}&offset=${offset}`;
  
  console.log(`📡 Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function testPagination(baseUrl: string, token: string) {
  console.log('🧪 Testing Pagination Fix (MOR-337)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const PAGE_SIZE = 100;
  const allItems: UsageEntry[] = [];
  let offset = 0;
  let pageCount = 0;
  let totalFromAPI = 0;

  try {
    // Fetch all pages
    let hasMore = true;
    while (hasMore) {
      pageCount++;
      const response = await fetchUsagePage(baseUrl, token, offset, PAGE_SIZE);
      
      console.log(`📄 Page ${pageCount}:`);
      console.log(`   Items: ${response.items.length}`);
      console.log(`   Total: ${response.total}`);
      console.log(`   Has More: ${response.has_more}`);
      console.log(`   Offset: ${response.offset}`);
      
      allItems.push(...response.items);
      totalFromAPI = response.total;
      
      // OLD LOGIC (would break if has_more is false too early):
      // hasMore = response.has_more;
      
      // NEW LOGIC (defensive - continues until we have all items):
      const shouldContinue = response.has_more || 
                           (allItems.length < response.total && response.items.length > 0);
      
      console.log(`   Decision: ${shouldContinue ? '✅ Continue' : '🛑 Stop'}`);
      console.log(`   Reason: ${
        response.has_more 
          ? 'has_more=true' 
          : allItems.length < response.total 
            ? `collected ${allItems.length} < total ${response.total}` 
            : 'all data collected'
      }`);
      console.log('');
      
      hasMore = shouldContinue;
      offset += PAGE_SIZE;
      
      // Safety checks
      if (offset > 10000) {
        console.warn('⚠️  Safety limit: offset > 10000');
        break;
      }
      if (pageCount > 200) {
        console.warn('⚠️  Safety limit: 200 pages');
        break;
      }
      if (response.items.length === 0) {
        console.log('✅ Empty page received, stopping');
        break;
      }
      
      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Calculate totals
    const totalTokensInput = allItems.reduce((sum, item) => sum + (item.tokens_input ?? 0), 0);
    const totalTokensOutput = allItems.reduce((sum, item) => sum + (item.tokens_output ?? 0), 0);
    const totalTokens = allItems.reduce((sum, item) => sum + (item.tokens_total ?? 0), 0);
    const totalCost = allItems.reduce((sum, item) => sum + parseFloat(item.amount_total), 0);

    // Results
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log(`Total Pages Fetched:    ${pageCount}`);
    console.log(`Total Items Collected:  ${allItems.length}`);
    console.log(`Total from API:         ${totalFromAPI}`);
    console.log(`Match:                  ${allItems.length === totalFromAPI ? '✅' : '❌'}`);
    console.log(`Discrepancy:            ${totalFromAPI - allItems.length}`);
    console.log('');
    console.log(`Input Tokens:           ${totalTokensInput.toLocaleString()}`);
    console.log(`Output Tokens:          ${totalTokensOutput.toLocaleString()}`);
    console.log(`Total Tokens:           ${totalTokens.toLocaleString()}`);
    console.log(`Total Cost:             $${totalCost.toFixed(4)}`);
    console.log('');

    // Validation
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ VALIDATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const tests = [
      {
        name: 'All records fetched',
        pass: allItems.length === totalFromAPI,
        actual: allItems.length,
        expected: totalFromAPI,
      },
      {
        name: 'At least 1 page fetched',
        pass: pageCount >= 1,
        actual: pageCount,
        expected: '≥ 1',
      },
      {
        name: 'Token totals calculated',
        pass: totalTokens > 0,
        actual: totalTokens,
        expected: '> 0',
      },
    ];

    tests.forEach(test => {
      const status = test.pass ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      console.log(`   Actual:   ${test.actual}`);
      console.log(`   Expected: ${test.expected}`);
      console.log('');
    });

    const allPassed = tests.every(t => t.pass);
    
    if (allPassed) {
      console.log('🎉 ALL TESTS PASSED! Pagination fix is working correctly.\n');
      process.exit(0);
    } else {
      console.log('❌ SOME TESTS FAILED. Check the results above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    process.exit(1);
  }
}

// Main execution
const baseUrl = process.env.API_BASE_URL || 'https://api.morpheus.example.com';
const token = process.env.API_TOKEN || process.argv[2];

if (!token) {
  console.error('❌ Error: No API token provided');
  console.error('');
  console.error('Usage:');
  console.error('  API_TOKEN=your_token npx tsx scripts/test-pagination.ts');
  console.error('  or');
  console.error('  npx tsx scripts/test-pagination.ts your_token');
  process.exit(1);
}

testPagination(baseUrl, token);
