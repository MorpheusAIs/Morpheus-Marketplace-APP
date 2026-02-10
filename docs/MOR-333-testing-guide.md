# MOR-333: Testing Guide for Data Isolation Fix

## Overview

This guide helps testers verify that the data isolation validation is working correctly.

## Prerequisites

- Access to `app.dev.mor.org`
- Multiple test accounts (to test cross-account scenarios)
- Browser developer console open

## Test Scenarios

### Test 1: Normal User with Valid Data ✅

**Goal:** Verify that users with legitimate data see no warnings.

**Steps:**
1. Log in with a normal account that has real usage data
2. Navigate to **Usage Analytics** page
3. Click on **Monthly Spending** tab

**Expected Results:**
- ✅ No warning banners displayed
- ✅ Charts and data render normally
- 🔍 In console (dev mode): `[DataIsolationValidator] Validation passed`

**Pass Criteria:**
- No visual warnings
- Data displays correctly
- No console errors

---

### Test 2: Detect Future Date Anomaly ⚠️

**Goal:** Verify warning appears for impossible future dates.

**Setup Required:**
- Backend needs to return data with future months (for testing only)
- OR use a test account that has this issue

**Steps:**
1. Log in with affected account
2. Navigate to **Usage Analytics** → **Monthly Spending**
3. Check for data with future months

**Expected Results:**
- ⚠️ Yellow warning banner appears:
  ```
  ⚠️ Data Anomalies Detected
  • Future spending data detected: 2026-03, 2026-04
  If this data doesn't look right, contact support. Reference: MOR-333
  ```
- ✅ Data still displayed (not blocked)
- 🔍 Console warning with details

**Pass Criteria:**
- Warning banner shows correct future months
- Data remains visible
- Reference code (MOR-333) is clickable/visible

---

### Test 3: Detect Ancient Data ⚠️

**Goal:** Verify warning for data before service launch.

**Expected Future Date Pattern:**
- Data from 2023 or earlier (before service existed)

**Steps:**
1. Log in with test account that has pre-2024 data
2. Navigate to **Usage Analytics** → **Monthly Spending**

**Expected Results:**
- ⚠️ Warning banner:
  ```
  ⚠️ Data Anomalies Detected
  • Data from before service launch detected: 2023-12
  ```

---

### Test 4: Critical - Multiple User IDs 🚨

**Goal:** Verify blocking behavior for cross-account data.

**Setup:**
- This would require a backend bug or test endpoint
- Simulates the reported MOR-333 issue

**Steps:**
1. Log in with account
2. Navigate to **Usage Analytics** → **Transactions**
3. Backend returns ledger entries with different `user_id` values

**Expected Results (Production):**
- ❌ Data completely blocked
- 🛡️ Security message displayed:
  ```
  🛡️ Data Validation Failed
  We detected potential data integrity issues and have hidden
  this information for your security.
  Reference: MOR-333
  ```
- 🚨 Error logged to monitoring service

**Expected Results (Development):**
- ⚠️ Warning displayed
- ✅ Data shown (for debugging)
- 🔍 Console error with details

**Pass Criteria:**
- Production: Data is completely hidden
- Development: Data shown with clear warnings
- Console logs include all user_ids found

---

### Test 5: Transaction Count Anomaly ⚠️

**Goal:** Detect suspiciously high transaction counts.

**Trigger:**
- Month with >100,000 transactions

**Steps:**
1. Check monthly breakdown table
2. Look for any month with unusually high transaction count

**Expected Results:**
- ⚠️ Warning banner if count > 100k:
  ```
  ⚠️ Data Anomalies Detected
  • Unusually high transaction counts detected.
    This may indicate aggregated test data or a data isolation issue.
  ```

---

### Test 6: Cross-Browser Testing

**Browsers to Test:**
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**For Each Browser:**
1. Test Scenario 1 (Normal user)
2. Check console logs work
3. Verify warning banners render correctly
4. Test responsive design (mobile view)

---

### Test 7: Console Logging Validation 🔍

**Goal:** Verify diagnostic logging works.

**Steps:**
1. Open browser console
2. Navigate to Usage Analytics
3. Check for validation logs

**Expected Console Output:**
```javascript
[DataIsolationValidator] Monthly spending validation: {
  year: 2026,
  mode: 'gross',
  monthCount: 12,
  cognitoSub: 'abc-123-xyz',
  userEmail: 'test@example.com',
  dataRange: '2026-1 to 2026-12',
  timestamp: '2026-02-10T12:34:56.789Z'
}
```

**Verify:**
- ✅ Logs include user context (sub, email)
- ✅ Logs include data summary
- ✅ Timestamps are correct
- ✅ No sensitive data exposed (passwords, tokens)

---

### Test 8: Performance Impact

**Goal:** Ensure validation doesn't slow down the UI.

**Steps:**
1. Use browser Performance tab
2. Record loading Usage Analytics page
3. Measure validation overhead

**Acceptance Criteria:**
- Validation adds < 50ms to page load
- No UI blocking/freezing
- Smooth scrolling and interactions

---

### Test 9: Multiple Accounts

**Goal:** Verify each user only sees their own data.

**Setup:**
- Account A: Has usage data
- Account B: Has different usage data
- Account C: Has no usage data

**Steps for Each Account:**
1. Log in
2. Navigate to Usage Analytics
3. Verify displayed data matches account's actual usage
4. Check transaction list shows only that user's API keys

**Expected:**
- Each account sees only their own data
- No warnings for cross-account leakage
- No `user_id` mismatches in console

---

## Regression Tests

### Existing Functionality Must Still Work:

1. **Time Range Filtering**
   - 24h, 7d, 30d filters work
   - Custom date range picker works
   - Charts update correctly

2. **Chart Interactions**
   - Bar charts render
   - Line charts render
   - Tooltips show correct data
   - Legends toggle series

3. **Export Functionality**
   - CSV export includes all data
   - Filename is correct
   - Data format matches old exports

4. **Pagination**
   - Transaction table pagination works
   - Page numbers correct
   - Next/Previous buttons work

5. **Filtering**
   - Transaction type filter works
   - API key filter works
   - Status filter works

---

## Manual Testing Checklist

Before marking MOR-333 as resolved:

- [ ] Test 1: Normal user - no warnings
- [ ] Test 2: Future dates - warning shown
- [ ] Test 3: Ancient data - warning shown
- [ ] Test 4: Multiple user_ids - data blocked (prod) or warning (dev)
- [ ] Test 5: High transaction count - warning shown
- [ ] Test 6: All major browsers tested
- [ ] Test 7: Console logging works
- [ ] Test 8: Performance acceptable
- [ ] Test 9: Multi-account isolation verified
- [ ] Regression: All existing features work

---

## Automated Test Coverage

### Unit Tests Needed:

```typescript
// src/lib/utils/__tests__/data-isolation-validator.test.ts

describe('validateMonthlySpending', () => {
  it('should pass validation for current month data', () => {
    const data = {
      year: 2026,
      mode: 'gross' as const,
      months: [{ year: 2026, month: 2, amount: '10.00', transaction_count: 5 }],
      total: '10.00',
    };
    const result = validateMonthlySpending(data, {});
    expect(result.isValid).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('should detect future dates', () => {
    const data = {
      year: 2026,
      mode: 'gross' as const,
      months: [{ year: 2026, month: 5, amount: '10.00', transaction_count: 5 }], // May 2026 (future)
      total: '10.00',
    };
    const result = validateMonthlySpending(data, {});
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(expect.stringContaining('Future spending data'));
  });

  it('should detect ancient data', () => {
    const data = {
      year: 2023,
      mode: 'gross' as const,
      months: [{ year: 2023, month: 12, amount: '10.00', transaction_count: 5 }],
      total: '10.00',
    };
    const result = validateMonthlySpending(data, {});
    expect(result.warnings).toContain(expect.stringContaining('before service launch'));
  });
});

describe('validateLedgerEntries', () => {
  it('should pass validation for consistent user_id', () => {
    const entries = [
      { user_id: 123, id: '1', /* ... */ },
      { user_id: 123, id: '2', /* ... */ },
    ];
    const result = validateLedgerEntries(entries, {});
    expect(result.isValid).toBe(true);
  });

  it('should detect multiple user_ids', () => {
    const entries = [
      { user_id: 123, id: '1', /* ... */ },
      { user_id: 456, id: '2', /* ... */ },
    ];
    const result = validateLedgerEntries(entries, {});
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(expect.stringContaining('Multiple user_ids'));
  });
});
```

---

## Reporting Issues

If you find a validation failure during testing:

1. **Take Screenshots:**
   - Warning banner (if shown)
   - Console logs
   - Network tab (API responses)

2. **Gather Context:**
   - Account email (or test account ID)
   - Timestamp
   - Browser and version
   - Environment (dev/staging/prod)

3. **Log Information:**
   ```javascript
   // In console, run:
   localStorage.getItem('userContext');
   // Copy the output
   ```

4. **Create Report:**
   - Update Linear issue MOR-333
   - Attach screenshots
   - Paste console logs
   - Describe expected vs actual behavior

---

## Success Metrics

Track these metrics to measure fix effectiveness:

| Metric | Target |
|--------|--------|
| Validation errors per day | < 1 |
| False positive rate | < 5% |
| User reports of wrong data | 0 |
| Backend data isolation bugs | 0 (after backend fix) |
| Average validation time | < 50ms |

---

## Rollback Plan

If validation causes issues:

1. **Feature Flag:**
   ```typescript
   const ENABLE_VALIDATION = process.env.NEXT_PUBLIC_ENABLE_DATA_VALIDATION !== 'false';
   
   if (ENABLE_VALIDATION) {
     // Run validation
   }
   ```

2. **Quick Disable:**
   - Set env var `NEXT_PUBLIC_ENABLE_DATA_VALIDATION=false`
   - Redeploy

3. **Partial Rollback:**
   - Keep logging (for diagnostics)
   - Disable blocking behavior
   - Remove warning banners

---

## Contact

Questions about testing?
- **Tech Lead:** Review this document
- **QA Team:** Execute test plan
- **Backend Team:** Investigate validation failures
- **Security Team:** Escalate if data leak confirmed
