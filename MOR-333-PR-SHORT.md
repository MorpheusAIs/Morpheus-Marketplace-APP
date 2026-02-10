# PR Title

Add defensive data isolation validation for billing endpoints (MOR-333)

---

# PR Description

## Summary

Implements client-side validation to detect and prevent display of cross-account data leaks in usage analytics, addressing MOR-333 where users reported seeing other users' API keys and transaction data.

## Changes

- Added `data-isolation-validator.ts` utility for detecting data anomalies
- Updated `MonthlySpendingChart` and `TransactionHistoryTable` with validation
- Added warning banners for detected anomalies and blocking for critical issues
- Comprehensive documentation and testing guide included

## Validation Checks

- Future dates in spending data
- Multiple user_ids in single response (cross-account leak)
- Pre-launch dates indicating test data
- Suspicious transaction volumes

## User Impact

Normal users see no changes. When anomalies are detected, users see warning banners with support reference. In production, critical issues block data display with security message.

## Important

This is a defensive frontend measure. Backend investigation and fixes are still required for proper data isolation at the API level.

## Testing

See `docs/MOR-333-testing-guide.md` for complete testing procedures.

Fixes MOR-333
