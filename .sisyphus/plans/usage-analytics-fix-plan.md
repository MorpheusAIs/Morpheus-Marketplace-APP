# Usage Analytics Dashboard - Fix Plan

**Created:** January 22, 2026
**Status:** Ready for Implementation
**Priority:** High

---

## Executive Summary

The Usage Analytics page has diverged from the reference design in `/morpheus-billing/`. While the components exist, they're fragmented across tabs and the API integration is failing. This plan fixes the data flow and aligns the UI with the reference design while preserving the existing tab structure.

## Reference Design Analysis

**Source:** `/morpheus-billing/App.tsx` and `/morpheus-billing/components/UsageCharts.tsx`

### Target Layout (from reference)
```
[Time Filter: 24H | 7 Days | 30 Days | Custom]           [Export Data]

+------------------------+  +------------------------+
| Total Usage (24H)      |  | Estimated Cost (24H)   |
| 5.25M                  |  | $13.98                 |
| Total tokens processed |  | Staking: $X | Credits:$Y |
| DISTRIBUTION BY KEY    |  | DISTRIBUTION BY KEY    |
| - Development: 3.086M  |  | - Development: $8.38   |
| - Production: 2.165M   |  | - Production: $5.60    |
+------------------------+  +------------------------+

+----------------+ +------------------+ +------------------+
| Spend by       | | Spend by         | | Spend by         |
| API Key        | | Model Type       | | Token Type       |
| [PIE CHART]    | | [PIE CHART]      | | [PIE CHART]      |
| Legend...      | | Legend...        | | Legend...        |
+----------------+ +------------------+ +------------------+

[Filter: All API Keys v]

+--------+ +-------------+ +--------------+
| Spend  | | Input Tokens| | Output Tokens|
| (Daily)| | (Daily)     | | (Daily)      |
| Avg:$X | | Avg: X      | | Avg: X       |
| Min:$X | | Min: X      | | Min: X       |
| Max:$X | | Max: X      | | Max: X       |
+--------+ +-------------+ +--------------+

+--------------------------------------------+
| Daily Spend Breakdown [STACKED AREA CHART] |
+--------------------------------------------+

+--------------------------------------------+
| Daily Token Volume [STACKED BAR CHART]     |
+--------------------------------------------+
```

---

## Current Issues Identified

### Issue 1: API Error - "Failed to load usage data"
**Location:** `src/app/usage-analytics/page.tsx` line 99-110
**Symptoms:** 
- Error banner appears at top of page
- All data shows $0.00, 0 tokens
- Pie charts show "No data available"

**Root Cause Analysis:**
- The `useBillingUsage` hook is failing
- Could be: expired auth token, API timeout (30s), backend 422/500 error
- The error object exists but message extraction may be incomplete

**Evidence Needed:**
- Browser DevTools Network tab → `/billing/usage` request status
- Check if request is even being made
- Check response body for error details

### Issue 2: Tab Structure Fragments the View
**Current:**
- Overview tab: BillingOverview (pie charts, top cards)
- Detailed Analytics tab: UsageCharts (time series charts)
- Monthly Spending tab: MonthlySpendingChart
- Transactions tab: TransactionHistoryTable

**Problem:** 
- User must click between tabs to see all data
- Reference design shows everything on one page (Usage Analytics view)

### Issue 3: Component Content Mismatch
**BillingOverview.tsx currently has:**
- Total Usage card with Distribution by Key bars ✓
- Estimated Cost card with Staking/Credits breakdown ✓
- Three pie charts (API Key, Model Type, Token Type) ✓
- Daily Stats Cards (Spend, Input, Output) ✓
- Daily Spend Breakdown chart ✓
- Daily Token Volume chart ✓

**BUT:**
- It's only shown in "Overview" tab
- "Detailed Analytics" tab shows DUPLICATE charts via UsageCharts.tsx

### Issue 4: Conditional Rendering Hides Charts
**Location:** `BillingOverview.tsx` line 289, 408, 457, 506
```typescript
const hasData = filteredItems.length > 0;
// ...
{hasData && spendByKey.length > 0 ? ( ... ) : ( "No data available" )}
```
- If API fails, `usageData?.items` is undefined → everything hidden

---

## Implementation Plan

### Phase 1: Debug & Fix API Integration (Critical)

#### Task 1.1: Add Better Error Logging
**File:** `src/app/usage-analytics/page.tsx`

Add console logging to understand what's failing:
```typescript
// Around line 37-46
const {
  data: usageData,
  isLoading,
  error,
} = useBillingUsage({
  from: dateRange.start.toISOString(),
  to: dateRange.end.toISOString(),
  limit: 100,
});

// ADD: Debug logging
useEffect(() => {
  console.log('[UsageAnalytics] Query state:', {
    isLoading,
    hasError: !!error,
    errorMessage: error?.message,
    hasData: !!usageData,
    itemCount: usageData?.items?.length,
    dateRange: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    }
  });
}, [isLoading, error, usageData, dateRange]);
```

#### Task 1.2: Verify Authentication Token
**File:** `src/lib/hooks/use-billing.ts`

Check if token is being retrieved:
```typescript
// In useBillingUsage, add logging
queryFn: async () => {
  const token = await getValidToken();
  console.log('[useBillingUsage] Token retrieved:', token ? 'YES' : 'NO');
  if (!token) throw new Error('Not authenticated');
  return getUsage(token, params);
},
```

#### Task 1.3: Handle API Errors Gracefully
**File:** `src/lib/api/billing.ts`

Enhance error handling in `getUsage`:
```typescript
export async function getUsage(
  token: string,
  params?: GetUsageParams
): Promise<UsageListResponse> {
  const queryParams = new URLSearchParams();
  // ... existing param building ...
  
  const url = buildApiUrl(`/billing/usage${queryParams.toString() ? `?${queryParams.toString()}` : ''}`);
  
  console.log('[getUsage] Requesting:', url);
  
  try {
    const result = await request(apiGet<UsageListResponse>(url, token));
    console.log('[getUsage] Success, items:', result?.items?.length);
    return result;
  } catch (error) {
    console.error('[getUsage] Failed:', error);
    throw error;
  }
}
```

### Phase 2: Consolidate Tab Content

#### Task 2.1: Merge Overview and Detailed Analytics
**Decision:** Keep BillingOverview as the main component (it already has everything)
**Action:** Remove UsageCharts from Detailed Analytics tab, or merge them

**Option A (Recommended):** Remove "Detailed Analytics" tab entirely
- BillingOverview already contains all charts
- The duplicate UsageCharts component is redundant

**Option B:** Rename tabs for clarity
- "Overview" → "Usage Statistics" (shows pie charts + stats)
- "Detailed Analytics" → "Daily Trends" (shows time series)

**Implementation (Option A):**
```typescript
// src/app/usage-analytics/page.tsx
// Remove TabsContent for "detailed" OR merge content

<Tabs defaultValue="overview" className="space-y-6">
  <TabsList>
    <TabsTrigger value="overview">Overview</TabsTrigger>
    {/* REMOVE: <TabsTrigger value="detailed">Detailed Analytics</TabsTrigger> */}
    <TabsTrigger value="monthly">Monthly Spending</TabsTrigger>
    <TabsTrigger value="transactions">Transactions</TabsTrigger>
  </TabsList>
  
  {/* BillingOverview now shows EVERYTHING */}
  <TabsContent value="overview" className="space-y-6">
    <BillingOverview 
      usageData={usageData}
      isLoading={isLoading}
      error={error instanceof Error ? error : error ? new Error(String(error)) : null}
      timeRangeLabel={...}
    />
  </TabsContent>
  
  {/* REMOVE the detailed TabsContent entirely */}
</Tabs>
```

#### Task 2.2: Remove UsageCharts Import (if removing tab)
**File:** `src/app/usage-analytics/page.tsx`
```typescript
// REMOVE this import if not needed:
// import { UsageCharts } from '@/components/billing/UsageCharts';
```

### Phase 3: UI Alignment with Reference Design

#### Task 3.1: Match Top Cards Layout
**Current:** Cards show token count and cost
**Reference:** Cards show tokens with "Distribution by Key" progress bars

The current BillingOverview already has this! Just need to ensure data flows correctly.

#### Task 3.2: Ensure Pie Charts Render with Empty State
**File:** `src/components/billing/BillingOverview.tsx`

Current conditional:
```typescript
{hasData && spendByKey.length > 0 ? (
  // Render chart
) : (
  <div>No data available</div>
)}
```

Keep this but add better empty state messaging:
```typescript
{hasData && spendByKey.length > 0 ? (
  // Render chart
) : (
  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
    <PieChart className="h-12 w-12 mb-4 opacity-20" />
    <p className="text-sm">No usage data for this period</p>
    <p className="text-xs mt-1">Try selecting a different time range</p>
  </div>
)}
```

#### Task 3.3: Match Color Scheme
**Reference Colors:**
```typescript
const COLORS = ['#00FF85', '#20DC8E', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];
const MODEL_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#00FF85'];
const TOKEN_TYPE_COLORS = ['#3b82f6', '#8b5cf6']; // Blue for Input, Purple for Output
```

**Current (BillingOverview.tsx line 34):**
```typescript
const COLORS = ['#00FF85', '#20DC8E', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];
```
Already matches! No change needed.

### Phase 4: Update Documentation

#### Task 4.1: Update Remaining Tasks Doc
**File:** `docs/billing-dashboard-remaining-tasks.md`

Update status of tasks completed:
- Mark "Real Data Integration in BillingOverview" as truly complete (it's connected but API may be failing)
- Add new section: "API Debug Checklist"
- Update "Detailed Analytics" task status based on decisions

---

## Implementation Order

1. **Phase 1.1** - Add debug logging (30 min)
2. **Phase 1.2** - Verify auth token flow (30 min)
3. **Phase 1.3** - Enhance API error handling (30 min)
4. **TEST** - Run app, check browser console, identify actual failure
5. **Phase 2.1** - Consolidate tabs (1 hour)
6. **Phase 3.2** - Improve empty states (30 min)
7. **Phase 4.1** - Update documentation (30 min)

**Total Estimated Time:** 4 hours

---

## Testing Checklist

### API Integration
- [ ] Browser DevTools shows `/billing/usage` request
- [ ] Request includes valid `Authorization: Bearer <token>` header
- [ ] Request has correct `from` and `to` query params
- [ ] Response is 200 OK with `items` array
- [ ] Console shows item count > 0

### UI Display
- [ ] No error banner at top of page
- [ ] Total Usage card shows token count (not $0.00)
- [ ] Estimated Cost card shows cost breakdown
- [ ] Distribution by Key bars render inside cards
- [ ] All 3 pie charts render with legends
- [ ] Daily Spend Breakdown chart renders
- [ ] Daily Token Volume chart renders

### Time Range Filter
- [ ] Clicking "24 Hours" fetches 24h data
- [ ] Clicking "7 Days" fetches 7d data
- [ ] Clicking "30 Days" fetches 30d data
- [ ] Custom date picker works

### Tabs (if kept)
- [ ] Overview tab shows complete BillingOverview
- [ ] Monthly Spending tab shows MonthlySpendingChart
- [ ] Transactions tab shows TransactionHistoryTable

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/usage-analytics/page.tsx` | Add debug logging, possibly remove Detailed tab |
| `src/lib/hooks/use-billing.ts` | Add token debug logging |
| `src/lib/api/billing.ts` | Enhance error logging |
| `src/components/billing/BillingOverview.tsx` | Improve empty states |
| `docs/billing-dashboard-remaining-tasks.md` | Update task statuses |

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| API is actually broken on backend | High | Check API directly with curl/Postman first |
| Auth token expires during session | Medium | Check token refresh logic in CognitoAuthContext |
| Large dataset causes timeout | Medium | Reduce default limit, add pagination |
| Removing "Detailed Analytics" tab loses functionality | Low | BillingOverview has all the same charts |

---

## Success Criteria

1. **Data Loads Successfully:** User sees real token counts and costs
2. **Pie Charts Render:** All 3 pie charts display with data
3. **UI Matches Reference:** Layout similar to `/morpheus-billing` screenshots
4. **No Console Errors:** Clean browser console (no uncaught errors)
5. **Documentation Updated:** Remaining tasks doc reflects actual state

---

## Notes

- The Monthly Spending tab uses a DIFFERENT API endpoint (`/billing/spending`) and appears to be working (shows $0.0065 in Image 4)
- The main issue is the `/billing/usage` endpoint failing
- Once the API is fixed, BillingOverview should render correctly since the component logic is sound
