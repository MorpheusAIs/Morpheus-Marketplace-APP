# MOR-333: Usage Analytics Data Isolation Fix

## Issue Summary

**Priority:** Urgent (P1)  
**Status:** In Progress  
**Environment:** api.dev.mor.org  
**Linear Issue:** [MOR-333](https://linear.app/morpheus-ai/issue/MOR-333)

### Problem Description

A user reported seeing usage analytics and transaction data that does not belong to their account:

1. **Future/placeholder data**: Usage logs dated January-February 2026 (before dashboard availability)
2. **Cross-account data leak**: API keys and activity logs from other accounts appearing in authenticated user's dashboard
3. **Transaction count anomalies**: Seeing 37 transactions in Jan 2026 and 1,513 in Feb 2026 that don't match user's actual usage

### Root Cause Analysis

The issue suggests a **backend data isolation bug** where:
- The `/billing/spending` or `/billing/transactions` API endpoints are returning data for the wrong user
- Authentication token is being correctly sent but not properly validated on the backend
- Test/mock data may be leaking into production accounts

**Why this is critical:**
- This is a data privacy and security issue
- Users can see other users' API keys, usage patterns, and spending
- Violates data isolation principles and user trust

## Technical Analysis

### Authentication Flow
```
Frontend (Cognito sub) → JWT Token → Backend API → Database Query (user_id)
```

### The Problem
The frontend sends a valid JWT token with the user's Cognito `sub` (UUID), but the backend either:
1. Incorrectly maps the token to a different `user_id`
2. Fails to filter database queries by `user_id`
3. Returns cached/test data instead of user-specific data

### Evidence from Code

**MonthlySpendingResponse** (from `/billing/spending`):
```typescript
export interface MonthlySpendingResponse {
  year: number;
  mode: SpendingModeEnum;
  months?: MonthlySpending[];
  total: string;
  currency?: string;
  // ❌ MISSING: No user_id field to validate ownership
}
```

**LedgerEntryResponse** (from `/billing/transactions`):
```typescript
export interface LedgerEntryResponse {
  id: string;
  user_id: number;  // ✅ Has user_id but frontend can't validate it
  // ... other fields
}
```

**The gap:** Frontend only knows `user.sub` (Cognito UUID), but backend uses numeric `user_id`. There's no way for the frontend to validate the data belongs to the logged-in user.

## Solution: Defense-in-Depth Approach

Since this requires backend fixes (outside our scope), we've implemented **defensive frontend measures** to:
1. **Detect** data isolation issues early
2. **Alert** users when suspicious data is detected
3. **Block** display of potentially leaked data in production
4. **Log** diagnostic information for debugging

### Components Changed

#### 1. New Utility: `data-isolation-validator.ts`

Location: `src/lib/utils/data-isolation-validator.ts`

**Functions:**
- `validateLedgerEntries()` - Validates transaction data consistency
- `validateMonthlySpending()` - Detects anomalies in spending data
- `reportValidationIssues()` - Logs validation failures
- `shouldDisplayData()` - Determines if data is safe to show

**Validation Checks:**

For **Ledger Entries**:
- ✅ All entries have the same `user_id` (no mixing of users)
- ⚠️ Test accounts with production data patterns
- 🔍 Logs `user_id` for correlation with backend logs

For **Monthly Spending**:
- ❌ **Future dates** (e.g., months in 2026 when we're in Feb 2026)
- ⚠️ Data before service launch (pre-2024)
- ⚠️ Suspiciously high transaction counts (>100k/month)
- 🔍 Logs date ranges and user context

#### 2. Updated Component: `MonthlySpendingChart.tsx`

**Changes:**
- Added validation using `validateMonthlySpending()`
- Shows warning banner if anomalies detected
- Blocks display in production if critical issues found
- Logs validation results in development mode

**User Experience:**
```
┌─────────────────────────────────────────────┐
│ ⚠️  Data Anomalies Detected                 │
│                                             │
│ • Future spending data detected: 2026-01    │
│ • Data from before service launch           │
│                                             │
│ If this data doesn't look right, please     │
│ contact support. Reference: MOR-333         │
└─────────────────────────────────────────────┘
```

If critical issues detected in production:
```
┌─────────────────────────────────────────────┐
│        🛡️  Data Validation Failed           │
│                                             │
│ We detected potential data integrity        │
│ issues and have hidden this information     │
│ for your security. Please contact support.  │
│                                             │
│ Reference: MOR-333                          │
└─────────────────────────────────────────────┘
```

#### 3. Updated Component: `TransactionHistoryTable.tsx`

**Changes:**
- Added validation using `validateLedgerEntries()`
- Shows warning banner if multiple `user_id`s found
- Blocks table display in production if critical issues
- Logs validation results with user context

### Validation Logic

```typescript
// Example validation flow
const validationResult = validateMonthlySpending(spendingData, {
  cognitoSub: user?.sub,
  userEmail: user?.email,
});

if (validationResult.issues.length > 0) {
  // Critical issue: Block display in production
  console.error('[DataIsolationValidator] CRITICAL:', validationResult);
  // Send to Sentry/monitoring service
}

if (validationResult.warnings.length > 0) {
  // Non-critical: Show warning banner
  console.warn('[DataIsolationValidator] Warnings:', validationResult);
}
```

## Detection Patterns

### Pattern 1: Future Dates
```typescript
// Detects spending data for months that haven't occurred yet
const now = new Date(); // 2026-02-10
const futureMonth = { year: 2026, month: 3 }; // March 2026

// ❌ This is invalid - we can't have data for the future
```

### Pattern 2: Pre-Launch Dates
```typescript
const SERVICE_LAUNCH = new Date('2024-01-01');
const ancientMonth = { year: 2023, month: 12 }; // Dec 2023

// ⚠️ Warning: Data before service existed (likely test data)
```

### Pattern 3: Mixed User IDs
```typescript
const entries = [
  { user_id: 123, amount: 10 },
  { user_id: 456, amount: 20 }, // ❌ Different user!
];

// ❌ CRITICAL: Multiple user_ids in single response
// This proves a backend data isolation bug
```

### Pattern 4: Impossible Transaction Volumes
```typescript
const month = { 
  month: 1, 
  year: 2026, 
  transaction_count: 150000 // 150k transactions
};

// ⚠️ Warning: Unusually high for a single user account
// May indicate aggregated test data or data leak
```

## Logging & Monitoring

### Development Mode
All validation results logged to console with full context:
```javascript
[DataIsolationValidator] Monthly spending validation: {
  year: 2026,
  mode: 'gross',
  monthCount: 12,
  cognitoSub: 'abc-123-xyz',
  userEmail: 'user@example.com',
  dataRange: '2026-1 to 2026-12',
  timestamp: '2026-02-10T12:00:00.000Z'
}
```

### Production Mode
Only critical issues logged, with integration points for:
- **Sentry** (error tracking)
- **DataDog** (monitoring)
- **Custom analytics**

```typescript
// TODO: Add in production
if (process.env.NODE_ENV === 'production') {
  Sentry.captureException(new Error('Data isolation violation'), {
    extra: {
      component: 'MonthlySpendingChart',
      cognitoSub: user?.sub,
      issues: validationResult.issues,
    }
  });
}
```

## Testing the Fix

### Scenario 1: Normal User (No Issues)
**Expected:**
- ✅ No warnings displayed
- ✅ Data renders normally
- 🔍 Console logs validation passed (dev mode)

### Scenario 2: User with Future Data
**Expected:**
- ⚠️ Warning banner shown
- ⚠️ "Future spending data detected: 2026-03"
- ✅ Data still displayed (with warning)
- 🔍 Console warning logged

### Scenario 3: Critical Issue (Multiple user_id)
**Expected in Production:**
- ❌ Data blocked completely
- 🛡️ "Data Validation Failed" message shown
- 🚨 Error sent to monitoring service

**Expected in Development:**
- ⚠️ Warning banner with details
- ✅ Data displayed (for debugging)
- 🔍 Full diagnostic logs in console

## Required Backend Fixes

⚠️ **This frontend fix is defensive only. The backend MUST be fixed.**

### Backend TODO:
1. **Audit all billing endpoints:**
   ```
   GET /billing/balance
   GET /billing/usage
   GET /billing/transactions
   GET /billing/spending
   ```

2. **Verify SQL queries include user filtering:**
   ```sql
   -- ❌ BAD: No user filter
   SELECT * FROM ledger_entries WHERE year = 2026;

   -- ✅ GOOD: User-specific query
   SELECT * FROM ledger_entries 
   WHERE user_id = ? AND year = 2026;
   ```

3. **Add user_id to all response types:**
   ```typescript
   // MonthlySpendingResponse should include:
   {
     user_id: number;  // ← ADD THIS
     year: number;
     months: MonthlySpending[];
   }
   ```

4. **Add API integration tests:**
   - Test with User A token → should not see User B data
   - Test with expired token → should fail
   - Test with malformed token → should fail

5. **Add backend validation logs:**
   ```python
   logger.info(f"Fetching spending data for user_id={user_id}, token_sub={token_sub}")
   ```

## Rollout Plan

### Phase 1: Deploy Frontend Fix ✅
- [x] Create validation utility
- [x] Integrate into MonthlySpendingChart
- [x] Integrate into TransactionHistoryTable
- [ ] Deploy to dev environment
- [ ] Monitor for validation failures
- [ ] Collect diagnostic data

### Phase 2: Backend Investigation
- [ ] Review backend logs for MOR-333 occurrences
- [ ] Identify which endpoints are affected
- [ ] Audit user_id filtering in SQL queries
- [ ] Review JWT token validation logic
- [ ] Check for caching issues

### Phase 3: Backend Fix
- [ ] Implement proper user_id filtering
- [ ] Add user_id to all response types
- [ ] Add integration tests
- [ ] Deploy to dev
- [ ] Verify no validation warnings in frontend
- [ ] Deploy to production

### Phase 4: Monitoring
- [ ] Set up alerts for validation failures
- [ ] Track metrics: validation_errors_count
- [ ] Weekly review of validation logs
- [ ] Gradual removal of defensive measures (after 30 days clean)

## Success Criteria

✅ **Fixed when:**
1. No validation warnings in production for 30 days
2. No reports of cross-account data leaks
3. All ledger entries have consistent `user_id`
4. No future dates in spending data
5. Backend logs show correct user_id filtering

## References

- Linear Issue: [MOR-333](https://linear.app/morpheus-ai/issue/MOR-333)
- Related Code:
  - `src/lib/utils/data-isolation-validator.ts`
  - `src/components/billing/MonthlySpendingChart.tsx`
  - `src/components/billing/TransactionHistoryTable.tsx`
  - `src/lib/hooks/use-billing.ts`
  - `src/lib/api/billing.ts`

## Contact

For questions about this fix:
- **Frontend:** This implementation
- **Backend:** Needs backend team investigation
- **Security:** Report to security team if data leak confirmed
