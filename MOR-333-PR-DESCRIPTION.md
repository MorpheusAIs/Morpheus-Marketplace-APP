# Add defensive data isolation validation for billing endpoints (MOR-333)

## Problem

Users are reporting cross-account data leaks in the usage analytics dashboard (MOR-333):
- Usage data and API keys from other accounts appearing in authenticated user's view
- Future dates in spending data (Jan-Feb 2026 showing in Feb 2026)
- Transaction counts not matching user's actual usage
- Evidence suggests backend data isolation bug in billing API endpoints

## Solution

This PR implements defensive client-side validation to detect and prevent display of potentially leaked data while the backend team investigates the root cause.

### Key Changes

**New validation utility** (`data-isolation-validator.ts`):
- Validates monthly spending data for future dates and anomalies
- Validates transaction ledger entries for consistent user_id
- Logs diagnostic information for backend investigation
- Blocks display of suspicious data in production

**Updated components**:
- `MonthlySpendingChart`: Integrated validation with warning banners and blocking for critical issues
- `TransactionHistoryTable`: Added user_id consistency checks and data isolation verification

**Validation checks**:
- Detects future dates (impossible spending data for months that haven't occurred)
- Detects multiple user_ids in single API response (proves cross-account leak)
- Detects pre-launch dates (data before 2024 indicates test data contamination)
- Detects suspicious transaction volumes (>100k transactions per month)

### User Experience

- **Normal users**: No visible changes, works as before
- **Data anomalies detected**: Warning banner with details and support reference
- **Critical issues (production)**: Data blocked with security message
- **Development mode**: Full diagnostic logging to console

## Important Notes

This is a defensive frontend measure only. The backend must still be fixed:
- Audit all `/billing/*` endpoints for proper user_id filtering
- Review JWT token to user_id mapping logic
- Add backend integration tests for data isolation
- Verify SQL queries include user-specific WHERE clauses

## Testing

See `docs/MOR-333-testing-guide.md` for complete testing procedures covering:
- 9 test scenarios with expected results
- Console logging verification
- Performance impact validation
- Cross-browser compatibility testing

## Documentation

- `MOR-333-REVIEW-SUMMARY.md`: Complete issue assessment and fix overview
- `docs/MOR-333-data-isolation-fix.md`: Technical deep dive and backend requirements
- `docs/MOR-333-testing-guide.md`: Testing procedures and success criteria

## Files Changed

- `src/lib/utils/data-isolation-validator.ts` (new, 231 lines)
- `src/components/billing/MonthlySpendingChart.tsx` (modified)
- `src/components/billing/TransactionHistoryTable.tsx` (modified)
- Documentation files (850+ lines)

## Related Issues

- Fixes MOR-333
- Related to billing data isolation and user privacy
