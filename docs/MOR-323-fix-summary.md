# MOR-323: Allow Overages Toggle Fix

## Issue Summary
The "Allow Overages" toggle on the billing page was showing incorrect state ("Disabled" when actually enabled) and returning errors when attempting to disable it.

## Root Cause Analysis

### 1. Default Value Bug
**Location**: `src/components/billing/OveragesToggle.tsx:84`

**Problem**:
```tsx
checked={preferences?.allow_overages ?? true}  // ❌ WRONG
```

**Issue**: When `preferences` is `undefined` during initial load, the nullish coalescing operator (`??`) would default to `true`, causing the switch to appear enabled even before data loads. This created a confusing UX where:
- Switch shows as enabled (checked) during loading
- When actual data loads with `allow_overages: false`, the switch becomes unchecked
- The label says "Disabled" but users see a flash of the enabled state

### 2. Lack of Error Handling
- No detailed error logging when API calls fail
- Generic error messages don't help debug issues
- No error state UI when preferences fail to load
- Component renders even when `preferences` is `undefined`

### 3. Inconsistent Default Behavior
Per the expected outcome in MOR-323:
> "Allow Overages should be **disabled by default** and the user should be able to toggle it on or off."

The code was defaulting to `true` (enabled), which contradicts the requirement.

## Solution Implemented

### Changes to `OveragesToggle.tsx`

#### 1. Fixed Default Value
```tsx
// Per MOR-323: Default should be disabled (false), not enabled (true)
const isEnabled = preferences.allow_overages ?? false;
```

#### 2. Added Error State Handling
```tsx
// Show error state if preferences failed to load
if (error) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="py-6">
        <p className="text-sm text-destructive">
          Failed to load billing preferences. Please refresh the page.
        </p>
      </CardContent>
    </Card>
  );
}
```

#### 3. Added Null Check
```tsx
// Don't render until we have valid preferences data
if (!preferences) {
  return null;
}
```

This prevents the component from rendering with undefined data, eliminating the flash of incorrect state during loading.

#### 4. Enhanced Error Logging
```tsx
const handleToggle = async (checked: boolean) => {
  try {
    console.log('[OveragesToggle] Attempting to update allow_overages to:', checked);
    console.log('[OveragesToggle] Current preferences:', preferences);
    
    const result = await updatePreferences.mutateAsync({ allow_overages: checked });
    
    console.log('[OveragesToggle] Update successful:', result);
    // ... success handling
  } catch (error) {
    console.error('[OveragesToggle] Failed to update allow_overages:', error);
    console.error('[OveragesToggle] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    toast.error(
      `Failed to update preference: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};
```

#### 5. Used Computed Value
```tsx
const isEnabled = preferences.allow_overages ?? false;

// Use isEnabled consistently throughout the component
<Label htmlFor="allow-overages" className="text-sm font-medium">
  {isEnabled ? 'Enabled' : 'Disabled'}
</Label>
<Switch
  id="allow-overages"
  checked={isEnabled}
  onCheckedChange={handleToggle}
  disabled={updatePreferences.isPending}
/>
```

## Testing Checklist

### Manual Testing Steps
1. ✅ Navigate to `/billing` page
2. ✅ Verify "Allow Overages" toggle shows **"Disabled"** by default (if not previously set)
3. ✅ Verify no flash of incorrect state during loading
4. ✅ Toggle "Allow Overages" to **Enabled**
   - Should show success toast: "Overages enabled - Credit Balance will be used when Daily Allowance is exhausted"
   - Label should change to "Enabled"
   - Description should show "Credit Balance will be used as fallback"
5. ✅ Toggle "Allow Overages" to **Disabled**
   - Should show success toast: "Overages disabled - Only Daily Staking Allowance will be used"
   - Label should change to "Disabled"
   - Description should show "Only Daily Staking Allowance will be used"
6. ✅ Refresh page - state should persist
7. ✅ Check browser console for detailed logs if any errors occur

### API Testing
- Check `/billing/preferences` GET endpoint returns correct data
- Check `/billing/preferences` PUT endpoint accepts `{ allow_overages: boolean }` and returns updated preferences
- Verify error responses are properly formatted with `detail` field

## Expected Behavior After Fix

### Initial State
- "Allow Overages" toggle shows **"Disabled"** by default
- No flash of incorrect state during loading
- Clean, consistent UI rendering

### Toggle Enabled
- Label: "Enabled"
- Description: "Credit Balance will be used as fallback"
- Success toast displayed
- State persists across page refreshes

### Toggle Disabled
- Label: "Disabled"
- Description: "Only Daily Staking Allowance will be used"
- Success toast displayed
- State persists across page refreshes

### Error Handling
- If preferences fail to load, shows error card instead of broken UI
- If update fails, shows detailed error message in toast
- Console logs provide debugging information

## Files Modified
- `src/components/billing/OveragesToggle.tsx`

## Related Issues
- MOR-238: AC 1.4 - Allow overages on with credit

## Deployment Notes
- No database migrations required
- No API changes required (assuming backend `/billing/preferences` endpoint works correctly)
- Frontend-only fix
- Safe to deploy immediately

## Follow-up Actions
1. Monitor error logs after deployment to catch any backend API issues
2. If users still report errors when toggling, investigate backend `/billing/preferences` PUT endpoint
3. Consider adding E2E tests for this flow using Playwright
