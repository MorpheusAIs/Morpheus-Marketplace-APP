# MOR-354: Usage Analytics Pagination Fix

## Issue Summary

Usage analytics were showing significantly fewer API requests and tokens than actually consumed, particularly on high-volume accounts. The discrepancy was approximately 55% of data missing.

## Root Cause

The `useBillingUsageAll` hook in `src/lib/hooks/use-billing.ts` had a safety limit that stopped pagination at **offset > 10,000**, which translates to approximately **10,100 records** (101 pages × 100 items per page).

### Evidence from Console Logs

```
[useBillingUsageAll] Pagination decision:
  collected: 10100
  total: 22468
  backendHasMore: true
  calculatedHasMore: true
  shouldContinue: true
  
⚠️ [useBillingUsageAll] Safety limit reached (offset > 10000). Breaking pagination loop.
```

**Result**: Only 10,100 of 22,468 records were fetched, missing **12,368 records (55% data loss)**.

## Observed Symptoms

### High-Volume Account (tb.morpheusai+devpw@gmail.com)
- **Before load test**: API Requests showed 10,100 (suspicious static number)
- **After load test** (added 800 requests): Still showed 10,100 
- **Token discrepancy**: ~2,570 shown vs 27,539 actual (10x undercount)
- **Input tokens**: ~1,540 shown vs 17,600 actual (10x undercount)  
- **Output tokens**: ~1,030 shown vs 9,939 actual (10x undercount)

### Low-Volume Account
- **API Requests**: 731 shown vs 800 actual (69 missing, ~8.6% undercount)
- **Tokens**: Much closer to actual values (still slightly off due to pagination cutoff)

**Pattern**: The issue becomes more severe as accounts accumulate more usage history because the 10,000-record safety limit cuts off a larger percentage of recent data.

## The Fix

### Code Changes

**File**: `src/lib/hooks/use-billing.ts`

#### `useBillingUsageAll` (Primary Fix for MOR-354)
1. **Increased offset safety limit**: 10,000 → **1,000,000** (100x increase)
2. **Increased page count limit**: 200 → **10,000 pages** (50x increase)
3. **Added warning for large datasets** (>50,000 records)
4. **Changed to error logging** when safety limits are hit (indicates backend issue)
5. **Updated documentation** to explain safety limit rationale

#### `useBillingTransactionsAll` (Consistency Update)
1. **Increased MAX_ITEMS**: 10,000 → **1,000,000** (100x increase)
2. **Increased page count limit**: 100 → **1,000 pages** (10x increase)
3. **Added warning for large datasets** (>50,000 records)
4. **Changed to error logging** when safety limits are hit
5. **Note**: This hook uses PAGE_SIZE=1000 (vs 100 for usage)

### Before:
```typescript
// Safety limits
if (offset > 10000) {
  console.warn('[useBillingUsageAll] Safety limit reached (offset > 10000). Breaking pagination loop.');
  break;
}

if (pageCount > 200) {
  console.warn('[useBillingUsageAll] Safety limit reached (200 pages). Breaking pagination loop.');
  break;
}
```

### After:
```typescript
// Safety limits
// MOR-354: Increased from 10,000 to 1,000,000 to handle extreme high-volume scenarios
// At 100 items per page, this allows up to 1,000,000 records (10,000 pages)
// 
// Why keep safety limits at all?
// 1. Prevent infinite loops if backend has_more flag is buggy (always returns true)
// 2. Prevent browser crashes from memory exhaustion (1M records ≈ 100-200MB)
// 3. Prevent users from waiting indefinitely (10k pages ≈ 30+ minutes)
// 4. Detect data anomalies (1M+ records in 30 days = data issue)
//
// The dual-condition pagination (has_more OR length < total) + empty page check
// should naturally stop pagination, but this acts as a final safety net.
if (offset > 1000000) {
  console.error('[useBillingUsageAll] SAFETY LIMIT REACHED: offset > 1,000,000');
  console.error('[useBillingUsageAll] This indicates a backend issue or data anomaly.');
  console.error('[useBillingUsageAll] Collected:', allItems.length, 'Expected total:', total);
  console.error('[useBillingUsageAll] Please investigate backend pagination or implement server-side aggregation.');
  break;
}

// MOR-354: Increased from 200 to 10,000 pages to match new offset limit
if (pageCount > 10000) {
  console.error('[useBillingUsageAll] SAFETY LIMIT REACHED: 10,000 pages fetched');
  console.error('[useBillingUsageAll] This is extremely unusual and likely indicates a backend issue.');
  break;
}
```

## What Each Hook Affects

### `useBillingUsageAll` (Primary Issue - MOR-354)
**Affects:**
- **Overview tab**: All graphs and statistics
- Token counts (total, input, output)
- API request counts
- Cost calculations
- Daily usage charts
- Model type breakdown
- API key breakdown

**Used by:** `src/app/usage-analytics/page.tsx` (main page)

### `useBillingTransactionsAll` (Consistency Update)
**Affects:**
- **Transactions tab**: Transaction history table
- CSV exports
- Ledger entries display

**Used by:** `src/components/billing/TransactionHistoryTable.tsx`

## Expected Behavior After Fix

1. **All records fetched**: Pagination will continue until `has_more: false` or all records are collected
2. **Accurate metrics**: Token counts, API request counts, and costs will reflect actual usage
3. **Safety preserved**: Still protected against infinite loops with 1,000,000-record limit
4. **Console verification**: Logs will show:
   ```
   [useBillingUsageAll] Pagination complete:
     totalPages: 225
     totalItemsFetched: 22468
     expectedTotal: 22468
     match: true
     discrepancy: 0
   ```

## Testing Instructions

1. Deploy the updated code to dev/staging
2. Navigate to Usage Analytics page (https://app.dev.mor.org/usage-analytics)
3. Select "30 Days" filter
4. Open browser console (F12 → Console)
5. Look for logs showing:
   - Number of pages fetched
   - Total items collected
   - Match between collected and expected total
6. Verify UI displays accurate counts matching actual usage

### Test with High-Volume Account

Use account `tb.morpheusai+devpw@gmail.com` (user_id=34) which has 22,468+ records.

**Expected Results**:
- API Requests: Should show all requests, not capped at 10,100
- Token counts: Should accurately reflect all token usage
- Console logs should show: `totalItemsFetched: 22468` (or actual total)
- No early safety limit warnings

## Related Issues

- **MOR-337**: Added dual-condition pagination logic (has_more OR calculated)
- **MOR-354**: This fix (increased safety limits for high-volume accounts)

## Performance Considerations

### Loading Times (Approximate)

| Records | Pages | Estimated Time | Memory Usage |
|---------|-------|----------------|--------------|
| 1,000 | 10 | ~2 seconds | ~1 MB |
| 10,000 | 100 | ~20 seconds | ~10 MB |
| 22,000 | 220 | ~45 seconds | ~20 MB |
| 50,000 | 500 | ~2 minutes | ~50 MB |
| 100,000 | 1,000 | ~3-5 minutes | ~100 MB |
| 1,000,000 | 10,000 | ~30-50 minutes | ~1 GB |

*Based on ~200ms per API request including network latency*

### Optimizations

- **React Query**: Using `keepPreviousData` to show stale data while refetching
- **Caching**: Data stays fresh for 1 minute (`staleTime: 60_000`)
- **Warnings**: Console shows warning for datasets >50,000 records
- **Batching**: Fetches 100 items per page (maximum allowed by API)

## Safety Limits Philosophy

### Why Keep Safety Limits at All?

Even with robust pagination logic (dual-condition checking, empty page detection), safety limits are essential for:

**1. Backend Bug Protection**
- If `has_more` is buggy and always returns `true`, we'd loop forever
- If `total` is incorrect (e.g., always returns 999999), pagination would never stop
- Acts as a circuit breaker for backend issues

**2. Browser Stability**
- 1,000,000 records ≈ 100-200MB in browser memory
- Prevents browser crashes on low-memory devices
- Prevents UI freezing during data processing

**3. User Experience**
- 10,000 pages ≈ 30+ minutes of loading (at ~200ms per request)
- Users shouldn't wait indefinitely for data
- Error messaging helps identify issues faster

**4. Data Anomaly Detection**
- 1M+ usage records in 30 days = ~33,000 requests/day (unusual)
- Likely indicates a data issue, runaway process, or attack
- Early detection helps debugging

### Natural Stopping Conditions (Primary)

Pagination should stop naturally through:
1. `has_more === false` (backend signals no more data)
2. `allItems.length >= total` (collected all expected records)
3. `response.items.length === 0` (empty page received)

Safety limits are the **last resort** and should rarely be hit in normal operation.

## Safety Limits Rationale

The 1,000,000-record limit (10,000 pages × 100 items) should accommodate:
- Very high-volume development/testing accounts
- Production accounts with many months of intensive usage
- Repeated load testing scenarios
- Any reasonable usage pattern for a 30-day window

### If Account Exceeds 1,000,000 Records

If any account hits the 1M safety limit (extremely rare):

1. **Console errors** will show:
   ```
   ❌ SAFETY LIMIT REACHED: offset > 1,000,000
   ❌ This indicates a backend issue or data anomaly.
   ❌ Collected: X, Expected total: Y
   ❌ Please investigate backend pagination or implement server-side aggregation.
   ```

2. **Immediate Actions**:
   - **Investigate backend**: Check if `has_more` and `total` are being calculated correctly
   - **Check data integrity**: Is the database returning duplicate records?
   - **Look for runaway processes**: Is something creating excessive usage entries?
   - **Review time range**: Are records from outside the date range being included?

3. **Long-term Solutions**:
   - **Backend aggregation**: Pre-aggregate metrics by day/hour in the backend
   - **Database optimization**: Index usage tables properly, add pagination cursors
   - **Time filtering**: Use shorter time ranges (7 days, 24 hours) by default
   - **Data archival**: Move old usage data to cold storage
   - **Rate limiting**: Prevent excessive API usage that creates this many records

4. **What 1M records means**:
   - ~33,000 requests per day over 30 days
   - ~1,375 requests per hour (24/7)
   - ~23 requests per minute (24/7)
   - This is either legitimate high-volume production use OR a data anomaly

## Deployment Notes

- **Breaking**: No, backward compatible
- **Database**: No migrations required  
- **Cache**: May want to invalidate React Query cache for billing data
- **Monitoring**: Watch for increased API response times during initial load

## Verification Checklist

- [ ] Code changes deployed
- [ ] Console logs show complete pagination (no early cutoff)
- [ ] UI displays accurate request counts
- [ ] UI displays accurate token counts  
- [ ] No safety limit warnings for accounts with <50k records
- [ ] Thomas verifies with load test results
- [ ] Update Linear issue MOR-354 with resolution
