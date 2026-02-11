# BACKEND BUG: /billing/transactions Date Filter Not Working

## Issue Summary
The `/billing/transactions` API endpoint is **ignoring the `from` and `to` query parameters** and only returning transactions from the current day, regardless of the requested date range.

## Evidence

### Test Case 1: 24 Hours Filter
**Frontend Request:**
- `from`: `2026-02-10T08:00:00.000Z`
- `to`: `2026-02-11T08:00:00.000Z`
- Expected: Transactions from both 2026-02-10 AND 2026-02-11

**Backend Response:**
- ❌ Only returned transactions from `2026-02-11`
- All 100 transactions have `created_at` date of `2026-02-11`

### Test Case 2: 30 Days Filter
**Frontend Request:**
- `from`: `2026-01-11T00:00:00.000Z`
- `to`: `2026-02-11T08:00:00.000Z`
- Expected: Transactions spanning ~30 days (Jan 11 - Feb 11)

**Backend Response:**
- ❌ Only returned transactions from `2026-02-11`
- All 100 transactions have `created_at` date of `2026-02-11`

## Impact

1. **Users cannot view historical transaction data** - The time range filter appears to do nothing
2. **Token counts are incorrect** - The aggregated token counts only reflect today's usage, not the full requested period
3. **CSV exports are incomplete** - Exports only contain today's data regardless of filter
4. **Analytics are broken** - Users cannot analyze spending patterns over time

## Current Behavior

User selects any date range → Backend always returns only today's transactions

## Expected Behavior

User selects date range → Backend returns all transactions where `created_at` is between `from` and `to` parameters

## Technical Details

### API Endpoint
```
GET /billing/transactions?from={ISO_DATE}&to={ISO_DATE}&limit=100&offset=0
```

### Current Query Parameters Being Sent
```javascript
{
  limit: 100,
  offset: 0,
  entry_type: undefined, // or specific type
  from: "2026-01-11T00:00:00.000Z",
  to: "2026-02-11T08:00:00.000Z"
}
```

### Expected SQL-like Behavior
```sql
SELECT * FROM ledger_entries
WHERE created_at >= @from 
  AND created_at <= @to
  AND user_id = @authenticated_user
ORDER BY created_at DESC
LIMIT 100 OFFSET 0
```

## Frontend Implementation Status
✅ Frontend is correctly:
- Calculating date ranges based on user selection
- Converting dates to ISO format
- Sending `from` and `to` as query parameters
- Displaying the requested date range to the user
- Logging all API requests with parameters

## Console Output Example
```
[TransactionHistoryTable] Date range updated: {
  from: "2026-01-11T00:00:00.000Z",
  to: "2026-02-11T08:00:00.000Z",
  label: "30 Days"
}

[BillingAPI] Fetching transactions: {
  url: "https://api.../billing/transactions?limit=100&offset=0&from=2026-01-11T00:00:00.000Z&to=2026-02-11T08:00:00.000Z",
  params: {
    limit: 100,
    offset: 0,
    entry_type: undefined,
    from: "2026-01-11T00:00:00.000Z",
    to: "2026-02-11T08:00:00.000Z"
  }
}

[TransactionHistoryTable] Data fetched: {
  totalItems: 100,
  requestedDateRange: {
    fromDate: "2026-01-11",
    toDate: "2026-02-11"
  },
  actualDatesInResponse: ["2026-02-11"], // ❌ ONLY ONE DATE!
  uniqueDateCount: 1
}

⚠️ [BACKEND BUG] All transactions from single date: 2026-02-11
⚠️ Expected date range: 2026-01-11 to 2026-02-11
⚠️ This suggests the backend is ignoring the from/to parameters!
```

## Backend Action Required

### Immediate Fix Needed
1. **Verify date parameter handling** in the `/billing/transactions` endpoint
2. **Check if `from` and `to` parameters are being read** from the request
3. **Ensure WHERE clause includes date filtering** in the database query
4. **Test with various date ranges** to confirm filtering works

### Possible Root Causes
- Date parameters not being parsed from query string
- Date comparison logic missing or incorrect in the SQL query
- Timezone conversion issues causing dates to be rejected
- Default behavior falling back to "today" when date parsing fails
- WHERE clause not including the date filter

### Testing Checklist
- [ ] Verify request receives `from` and `to` parameters
- [ ] Confirm dates are parsed correctly
- [ ] Check SQL query includes `WHERE created_at BETWEEN @from AND @to`
- [ ] Test with 24h, 7d, 30d ranges
- [ ] Verify returned transactions span the requested date range
- [ ] Check pagination still works with date filtering

## Related Frontend Changes
- Branch: `feature/mor-350-additional-fixes`
- Commits:
  - Fix Transaction History table not respecting time range filter
  - Add explicit date range display and better empty state messaging
  - Add backend date filter bug detection and warning

## User-Facing Workaround
None available. Users must wait for backend fix to view historical transactions.

## Priority
**HIGH** - Core feature is non-functional, blocking users from viewing their transaction history and analyzing usage patterns.

---

**Reported by:** Frontend team via MOR-350 implementation
**Date:** 2026-02-11
**Status:** Awaiting backend fix
