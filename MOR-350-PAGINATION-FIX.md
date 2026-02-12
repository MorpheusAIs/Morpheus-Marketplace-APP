# MOR-350 Pagination Fix

## Issue Summary

The Usage Analytics Transactions table was only displaying transactions from a single date, even when the user selected a date range spanning multiple days. This occurred because:

1. The table was fetching only the first 100 transactions from the API (`limit=100`, `offset=0`)
2. When there were more than 100 transactions on a single day, all 100 returned records came from that same day
3. The API response showed `has_more: true` and `total: 300+`, indicating more data existed but wasn't being fetched
4. Client-side pagination was applied to these 100 records, creating the illusion of pagination without actually fetching more data

## Root Cause

From aleksandr@titan.io's analysis:
- Frontend request: `limit=100&from=2026-01-12T22:00:00.000Z&to=2026-02-12T11:54:00.000Z`
- API response: `{ total: 300, limit: 100, offset: 0, has_more: true }`
- All 100 transactions in the response were from the same date
- This indicated the first page was filled entirely from that date, with 200+ transactions remaining on subsequent pages

## Solution

Changed from fetching only the first 100 transactions to fetching ALL transactions (up to 10,000 limit) using the existing `useBillingTransactionsAll` hook, which:

1. Automatically paginates through all API pages
2. Fetches all transactions within the date range
3. Ensures data spanning the full date range is displayed
4. Uses the same hook for both table display and CSV export (eliminating duplicate logic)

## Changes Made

### File: `src/components/billing/TransactionHistoryTable.tsx`

**Before:**
```typescript
// Only fetched first 100 transactions
const FETCH_LIMIT = 100;
const { data, isLoading, error } = useBillingTransactions({
  limit: FETCH_LIMIT,
  offset: 0, // Static offset - no pagination!
  entry_type: selectedType === 'all' ? undefined : selectedType,
  from: dateRange?.start.toISOString(),
  to: dateRange?.end.toISOString(),
});

// Separate hook for CSV export
const { data: allData, ... } = useBillingTransactionsAll(..., { enabled: shouldFetchAll });
```

**After:**
```typescript
// Fetch ALL transactions using the existing pagination hook
const { data, isLoading, error } = useBillingTransactionsAll({
  entry_type: selectedType === 'all' ? undefined : selectedType,
  from: dateRange?.start.toISOString(),
  to: dateRange?.end.toISOString(),
});

// CSV export uses the same data (already fetched)
const handleExportCSV = () => {
  // Use data from main query
  const aggregated = aggregateLedgerEntriesByDayKeyModel(data.items, apiKeysFormatted);
  // ... export logic
};
```

## Benefits

1. **Correct Data Display**: Users now see transactions spanning the full selected date range
2. **Simplified Code**: Single data fetch for both table and CSV export
3. **Better Performance**: No duplicate API calls for export
4. **User Experience**: Transactions load once and are immediately available for both viewing and export

## Technical Details

The `useBillingTransactionsAll` hook (already existed in `src/lib/hooks/use-billing.ts`) implements:
- Automatic pagination through all API pages
- Dual-condition pagination: `has_more || (allItems.length < total)`
- Safety limits: 10,000 items max, 100 pages max
- Proper error handling and retry logic
- Console logging for debugging

## Testing Recommendations

1. Select a date range with 300+ transactions
2. Verify table displays transactions from multiple dates
3. Navigate through pages - should see different dates
4. Export CSV - should contain all transactions within date range
5. Check browser console for pagination logs showing multiple pages fetched

## Related Issues

- MOR-350: Original issue about pagination
- MOR-333: Data isolation validation (unrelated, but same component)
- MOR-346: Staking refresh filter (already implemented, unchanged)
- MOR-337: Pagination fix for usage metrics (similar fix applied there)
