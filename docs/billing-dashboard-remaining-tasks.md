# Billing Dashboard: Remaining Implementation Tasks

**Last Updated:** January 22, 2026  
**Status:** 90% Complete - API Debugging Required

---

## Executive Summary

The billing and usage analytics dashboard is 90% complete with all core infrastructure, API integration, and most UI components implemented. However, there is a **critical issue** with the Usage Analytics page where the `/billing/usage` API endpoint is returning errors, causing all charts to show empty states.

**Major Achievements:**
- ✅ Web3 wallet connection (AppKit/Wagmi)
- ✅ Multiple wallet linking with signature verification
- ✅ Coinbase Commerce integration
- ✅ All billing API endpoints integrated (code exists)
- ✅ Monthly spending charts (working - uses `/billing/spending`)
- ✅ Usage analytics components exist (BillingOverview has all pie charts)
- ✅ CSV export functionality
- ✅ Staking widget with full wallet management
- ✅ Transaction history table (TransactionHistoryTable.tsx)

**Critical Issue:**
- ⚠️ `/billing/usage` API endpoint returning "Failed to fetch" error
- ⚠️ Overview tab shows "Failed to load overview data" 
- ⚠️ Pie charts (API Key, Model Type, Token Type) not rendering due to no data

**Remaining Work:**
- 🔴 Debug and fix `/billing/usage` API integration (CRITICAL)
- ⚠️ Consider consolidating Detailed Analytics tab into Overview
- Coinbase webhook backend integration
- Stripe real payment integration
- API key and model filtering (partially implemented)
- Overage settings toggle
- Polish and documentation

---

## Current UI Architecture (As Implemented)

The Usage Analytics page (`/usage-analytics`) has a **tabbed structure**:

| Tab | Component | Data Source | Status |
|-----|-----------|-------------|--------|
| Overview | BillingOverview | `/billing/usage` | ⚠️ ERROR - API failing |
| Detailed Analytics | UsageCharts | `/billing/usage` (same) | ⚠️ ERROR - API failing |
| Monthly Spending | MonthlySpendingChart | `/billing/spending` | ✅ WORKING |
| Transactions | TransactionHistoryTable | `/billing/transactions` | ✅ Needs verification |

**Note:** The Overview and Detailed Analytics tabs both use the same API endpoint and show similar charts. Consider consolidating into a single view matching the reference design in `/morpheus-billing/`.

### Reference Design Comparison

The reference project in `/morpheus-billing/` shows a **single unified view** without tabs:
- Time filter at top (24H | 7 Days | 30 Days | Custom)
- Total Usage card with Distribution by Key bars
- Estimated Cost card with Staking/Credits breakdown
- 3 pie charts in a row (API Key, Model Type, Token Type)
- Filter dropdown for API Keys
- Daily statistics grid
- Daily Spend Breakdown chart
- Daily Token Volume chart

Our `BillingOverview.tsx` component already has ALL of this - it just needs the API to work.

---

---

## API Debug Checklist (NEW - CRITICAL)

Before implementing new features, the `/billing/usage` API integration must be fixed.

### Debug Steps

1. **Check Browser DevTools → Network Tab**
   - Is the request to `/billing/usage` being made?
   - What's the HTTP status code? (401, 422, 500, etc.)
   - What's in the response body?

2. **Check Authentication**
   - Is the Bearer token present in request headers?
   - Is the token expired?
   - Add logging to `useBillingUsage` hook

3. **Check Request Parameters**
   - Are `from` and `to` ISO date strings valid?
   - Is `limit` within acceptable range (max 100)?

4. **Test API Directly**
   ```bash
   curl -X GET "https://api.mor.org/api/v1/billing/usage?from=2026-01-01T00:00:00Z&to=2026-01-22T23:59:59Z&limit=100" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

5. **Check Console Logs**
   - Add `console.log` statements in hooks and API functions
   - Look for error messages

### Common Causes

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| 401 Unauthorized | Token expired/invalid | Refresh token, re-login |
| 422 Unprocessable Entity | Invalid date format or params | Check ISO date strings |
| 500 Internal Server Error | Backend issue | Contact backend team |
| CORS Error | Missing CORS headers | Check backend CORS config |
| Network Error | API unreachable | Check API_BASE_URL env var |

---

## What's Already Implemented

### Core Infrastructure (100% Complete)

#### API Integration
**File:** `src/lib/api/billing.ts`

All endpoints from OpenAPI v1.12.13-test are integrated:
- `GET /billing/balance` - Current balance (paid + staking)
- `GET /billing/usage` - Paginated usage entries
- `GET /billing/transactions` - Transaction/ledger history
- `GET /billing/spending` - Monthly spending aggregates
- `GET /auth/wallet/` - Wallet status and staking info
- `POST /auth/wallet/nonce` - Generate signature nonce
- `POST /auth/wallet/link` - Link wallet with signature
- `DELETE /auth/wallet/{id}` - Unlink wallet
- `GET /auth/wallet/check/{address}` - Check wallet availability

#### React Query Hooks
**File:** `src/lib/hooks/use-billing.ts`

All data fetching hooks with caching and auto-refresh:
- `useBillingBalance()` - Auto-refresh every 30s
- `useUsage()` - Paginated usage with filters
- `useBillingUsageForMonth()` - Month-specific usage
- `useBillingTransactions()` - Transaction history
- `useBillingSpending()` - Monthly spending data
- `useWalletStatus()` - Wallet and staking status
- `useGenerateWalletNonce()` - Wallet linking flow
- `useLinkWallet()` - Link wallet mutation
- `useUnlinkWallet()` - Unlink wallet mutation

#### Type Definitions
**File:** `src/types/billing.ts`

Complete TypeScript types for:
- Balance (PaidBalanceInfo, StakingBalanceInfo, BalanceResponse)
- Usage (UsageEntryResponse, UsageListResponse)
- Transactions (LedgerEntryResponse, LedgerListResponse)
- Spending (MonthlySpending, MonthlySpendingResponse)
- Wallets (WalletLinkResponse, WalletStatusResponse, NonceResponse)
- Client-side aggregations (DailyAggregation, ApiKeyBreakdown, ModelBreakdown)

#### Utility Functions
**File:** `src/lib/utils/billing-utils.ts`

Helper functions for:
- `formatCurrency()` - Money formatting
- `formatLargeNumber()` - Token count formatting
- `formatChartDate()` - Date formatting for charts
- `generateUsageCSV()` - CSV file generation
- `downloadCSV()` - File download trigger

### UI Components (95% Complete)

#### Pages
1. **Billing Page** - `src/app/billing/page.tsx`
   - Balance cards (paid + staking)
   - Funding section with payment methods
   - Staking widget
   - Responsive layout

2. **Usage Analytics Page** - `src/app/usage-analytics/page.tsx`
   - Three tabs: Overview, Detailed Analytics, Monthly Spending
   - Time range filters with Calendar component
   - Export data button
   - Empty states and error handling

3. **Export Data Page** - `src/app/usage-analytics/export-data/page.tsx`
   - Full data table with search
   - Pagination (50 items per page)
   - CSV export with filtered data
   - Back navigation

#### Components

1. **StatCard** - `src/components/billing/StatCard.tsx`
   - Reusable metric display
   - Icon support
   - Trend indicators

2. **UsageCharts** - `src/components/billing/UsageCharts.tsx`
   - Daily cost breakdown (area chart)
   - Token usage trends (bar chart)
   - Token type distribution (pie chart)
   - Responsive with Recharts

3. **BillingOverview** - `src/components/billing/BillingOverview.tsx`
   - Total usage and cost overview cards
   - Three pie charts:
     - Spend by API Key
     - Spend by Model Type
     - Spend by Token Type
   - Daily statistics cards
   - Daily spend breakdown chart
   - Daily token volume chart
   - **Note:** Currently uses mock data (needs real data integration)

4. **MonthlySpendingChart** - `src/components/billing/MonthlySpendingChart.tsx`
   - 4 stat cards (total, average, peak, trend)
   - Bar chart for all 12 months
   - Line chart for trend visualization
   - Monthly breakdown table
   - Uses real API data

5. **TimeRangeFilter** - `src/components/billing/TimeRangeFilter.tsx`
   - Preset buttons (24H, 7D, 30D)
   - Custom date range with shadcn Calendar popover
   - Date constraints (no future dates)
   - Apply button for custom ranges

6. **FundingSection** - `src/components/billing/FundingSection.tsx`
   - Pay with Card (Stripe) - Mock UI
   - Pay with Crypto (Coinbase Commerce) - Real API integration
   - State-based interactive payment flows
   - QR code display for crypto payments
   - Payment status polling
   - **Note:** Coinbase webhook needs backend integration

7. **StakingWidget** - `src/components/billing/StakingWidget.tsx`
   - Web3 wallet connection via AppKit
   - Multiple wallet linking with EIP-191 signatures
   - Display staked amounts from blockchain
   - Unlink wallet functionality
   - Refresh status button
   - Integration with Base network

8. **DataExport** - `src/components/billing/DataExport.tsx`
   - CSV generation
   - Date range selection
   - Download functionality

### Web3 Integration (100% Complete)

#### Configuration
**Files:** 
- `src/config/appkit.tsx` - AppKit configuration
- `src/context/AppKitProvider.tsx` - React context provider

**Features:**
- Reown AppKit (formerly WalletConnect) integration
- Wagmi hooks for wallet interactions
- Support for MetaMask, Coinbase Wallet, Rabby
- Base network connection
- Cookie-based session storage
- EIP-6963 wallet detection
- Featured wallet IDs for better UX

#### Wallet Linking Flow
1. User clicks "Connect Wallet" in StakingWidget
2. AppKit modal opens with wallet options
3. User connects wallet (MetaMask, Coinbase, etc.)
4. Frontend requests nonce from backend
5. User signs message with nonce
6. Frontend sends signature to backend for verification
7. Backend verifies signature and links wallet to user account
8. Staking amounts fetched from blockchain via Builders API
9. Daily staking credits calculated and displayed

### Payment Integration

#### Coinbase Commerce (90% Complete)
**Files:**
- `src/app/api/coinbase/charge/route.ts` - Charge creation
- `src/app/api/webhooks/coinbase/route.ts` - Webhook handler

**Features:**
- Create payment charges
- Generate QR codes for crypto payment
- Support for USDC on multiple networks (Base, Ethereum, Polygon)
- Webhook signature verification
- Payment status polling
- Redirect URLs for success/cancel

**Remaining:**
- Line 82 in webhook handler has TODO to call backend API to credit user account
- Need to implement actual balance crediting

#### Stripe (Mock Only)
**File:** `src/components/billing/FundingSection.tsx`

**Current Status:**
- Mock UI for card input
- Simulated checkout flow
- No real Stripe integration yet

**Needs:**
- Stripe checkout session creation API route
- Webhook handler for payment confirmation
- Stripe API keys configuration

---

## Remaining Tasks

### CRITICAL PRIORITY

#### 0. Fix /billing/usage API Integration

**Status:** 🔴 BROKEN - Showing "Failed to fetch" error
**File:** `src/app/usage-analytics/page.tsx`, `src/lib/hooks/use-billing.ts`
**Estimated Effort:** 2-4 hours (debugging)

**Symptoms:**
- "Failed to load usage data" error banner at top of page
- Overview tab shows "Failed to load overview data"
- All stats show $0.00, 0 tokens
- Pie charts show "No data available"

**Debug Plan:**
1. Add console logging to trace the request
2. Check browser Network tab for actual API response
3. Verify authentication token is valid
4. Check if backend endpoint is accessible

**See:** API Debug Checklist section above

---

### HIGH PRIORITY

#### 1. Transaction History View

**Status:** ✅ Complete (UI exists)
**API Support:** ✅ Ready (`GET /billing/transactions`)
**Hook:** ✅ Ready (`useBillingTransactions()`)
**Estimated Effort:** Completed

**Implementation Details:**
- Created `src/components/billing/TransactionHistoryTable.tsx`
- Added to `/usage-analytics` as "Transactions" tab
- Implemented filters for Entry Type
- Implemented pagination and CSV export

**Note:** Needs verification that API actually returns data.

---

#### 2. Real Data Integration in BillingOverview

**Status:** ⚠️ Partially Complete - Code exists but API failing
**File:** `src/components/billing/BillingOverview.tsx`
**Estimated Effort:** Code done, needs API fix

**Implementation Details:**
- ✅ Refactored component to accept `usageData` prop
- ✅ Updated `usage-analytics/page.tsx` to pass real API data
- ✅ Fixed TypeScript errors in charts
- ✅ Updated default time range to 30d
- ⚠️ Data not displaying because `/billing/usage` returns error

**Components in BillingOverview (all exist but show empty):**
- Total Usage card with Distribution by Key bars
- Estimated Cost card with Staking/Credits breakdown
- Spend by API Key pie chart
- Spend by Model Type pie chart
- Spend by Token Type pie chart
- Daily Stats Cards (Spend, Input, Output)
- Daily Spend Breakdown area chart
- Daily Token Volume bar chart

---

#### 3. Coinbase Webhook Backend Integration

**Status:** ✅ Complete (Frontend Logic)
**File:** `src/app/api/webhooks/coinbase/route.ts`
**Estimated Effort:** Completed

**Implementation Details:**
- Implemented `handleChargeConfirmed`
- Added call to internal backend endpoint (`/api/v1/billing/credit`)
- Added error handling and retry logic
- Requires `INTERNAL_API_SECRET` env var

---

### MEDIUM PRIORITY

#### 3.5 Consolidate Tabs (UI Architecture Decision)

**Status:** ⏳ Pending Decision
**File:** `src/app/usage-analytics/page.tsx`
**Estimated Effort:** 1-2 hours

**Current State:**
The page has 4 tabs: Overview, Detailed Analytics, Monthly Spending, Transactions

**Issue:**
- "Overview" and "Detailed Analytics" tabs show SIMILAR charts from SAME data
- BillingOverview.tsx (Overview tab) already has ALL the charts
- UsageCharts.tsx (Detailed tab) duplicates some charts

**Recommendation:**
Remove "Detailed Analytics" tab. BillingOverview already contains:
- 3 pie charts (API Key, Model Type, Token Type)
- Daily Spend Breakdown chart
- Daily Token Volume chart
- Daily statistics grid

This matches the reference design in `/morpheus-billing/` which has ONE unified view.

**Implementation:**
```typescript
// Remove from TabsList:
<TabsTrigger value="detailed">Detailed Analytics</TabsTrigger>

// Remove TabsContent for "detailed"
```

---

#### 4. API Key & Model Breakdown Filtering

**Status:** ⚠️ Partial (filter UI exists but not fully functional)  
**File:** `src/components/billing/BillingOverview.tsx`  
**Estimated Effort:** 1 day

**Current State:**
- API key filter dropdown exists (line 228)
- `selectedKeyId` state exists but doesn't filter all charts
- No model filter exists

**Required Implementation:**

1. **Make API Key Filter Functional:**
   - Update all charts to use filtered data based on `selectedKeyId`
   - Filter should affect:
     - All three pie charts
     - Daily spend breakdown chart
     - Daily token volume chart
     - Summary statistics

2. **Add Model Filter:**
```typescript
const [selectedModelName, setSelectedModelName] = useState<string>('all');

// Get unique models from usage data
const availableModels = useMemo(() => {
  if (!usageData?.items) return [];
  const models = new Set(usageData.items.map(e => e.model_name).filter(Boolean));
  return ['all', ...Array.from(models)];
}, [usageData]);

// Filter dropdown
<Select value={selectedModelName} onValueChange={setSelectedModelName}>
  <SelectTrigger className="w-[200px]">
    <SelectValue placeholder="Filter by Model" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="all">All Models</SelectItem>
    {availableModels.map(model => (
      <SelectItem key={model} value={model}>{model}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

3. **Apply Both Filters:**
```typescript
const filteredData = useMemo(() => {
  if (!usageData?.items) return [];
  
  return usageData.items.filter(entry => {
    const keyMatch = selectedKeyId === 'all' || 
                     entry.api_key_id?.toString() === selectedKeyId;
    const modelMatch = selectedModelName === 'all' || 
                       entry.model_name === selectedModelName;
    return keyMatch && modelMatch;
  });
}, [usageData, selectedKeyId, selectedModelName]);
```

4. **Add Clear Filters Button:**
```typescript
const hasActiveFilters = selectedKeyId !== 'all' || selectedModelName !== 'all';

<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    setSelectedKeyId('all');
    setSelectedModelName('all');
  }}
  disabled={!hasActiveFilters}
>
  <X className="h-4 w-4 mr-2" />
  Clear Filters
</Button>
```

5. **Show Active Filter Count:**
```typescript
<div className="flex items-center gap-2">
  <Filter className="h-4 w-4 text-green-500" />
  <span className="text-sm text-muted-foreground">
    {hasActiveFilters && `${activeFilterCount} filter(s) active`}
  </span>
</div>
```

---

#### 5. Stripe Real Integration

**Status:** ❌ Mock Only  
**File:** `src/components/billing/FundingSection.tsx`  
**Estimated Effort:** 2-3 days  
**Blocker:** Requires Stripe API keys

**Required Steps:**

1. **Get Stripe API Keys:**
   - Create Stripe account or get existing keys
   - Add to `.env.local`:
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

2. **Install Stripe SDK:**
```bash
pnpm add stripe @stripe/stripe-js
```

3. **Create Checkout Session API Route:**

Create `src/app/api/stripe/create-checkout/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

export async function POST(request: NextRequest) {
  try {
    const { amount, userId } = await request.json();

    if (!amount || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Morpheus AI Credits',
              description: `Account credit top-up of $${amount}`,
            },
            unit_amount: Math.round(parseFloat(amount) * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing?payment=cancelled`,
      metadata: {
        userId: userId.toString(),
        amount: amount,
      },
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

4. **Create Stripe Webhook Handler:**

Create `src/app/api/webhooks/stripe/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutComplete(session);
      break;
    
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      console.log('Payment succeeded:', paymentIntent.id);
      break;
    
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object as Stripe.PaymentIntent;
      console.error('Payment failed:', failedPayment.id);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  const amount = session.metadata?.amount;

  if (!userId || !amount) {
    console.error('Missing metadata in checkout session');
    return;
  }

  // Credit user account (similar to Coinbase webhook)
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/billing/credit`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': process.env.INTERNAL_API_SECRET!,
        },
        body: JSON.stringify({
          userId,
          amount,
          currency: 'USD',
          paymentSource: 'stripe',
          externalTransactionId: session.id,
          metadata: {
            stripe_session_id: session.id,
            stripe_payment_intent: session.payment_intent,
          },
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to credit account');
    }
  } catch (error) {
    console.error('Error crediting account:', error);
  }
}
```

5. **Update FundingSection Component:**

Replace mock Stripe flow in `FundingSection.tsx`:
```typescript
const handleStripePay = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsProcessingStripe(true);

  try {
    const response = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: depositAmount,
        userId: userId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    const { url } = await response.json();
    
    // Redirect to Stripe Checkout
    window.location.href = url;
  } catch (error) {
    console.error('Error:', error);
    setError('Failed to initiate payment. Please try again.');
    setIsProcessingStripe(false);
  }
};
```

6. **Handle Return from Stripe:**

Add to billing page to handle success/cancel:
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');
  const sessionId = params.get('session_id');

  if (payment === 'success' && sessionId) {
    toast.success('Payment successful! Your balance will be updated shortly.');
    // Clean URL
    window.history.replaceState({}, '', '/billing');
    // Refetch balance
    refetchBalance();
  } else if (payment === 'cancelled') {
    toast.info('Payment cancelled');
    window.history.replaceState({}, '', '/billing');
  }
}, [refetchBalance]);
```

7. **Testing:**
   - Use Stripe test mode
   - Test card: 4242 4242 4242 4242
   - Test successful payment
   - Test failed payment (4000 0000 0000 0002)
   - Test webhook delivery
   - Verify account crediting

---

#### 6. Overage Settings Toggle

**Status:** ❌ Not Implemented  
**Location:** Should be on billing page  
**Estimated Effort:** 0.5 day

**Description:**
Add a toggle to allow users to enable/disable automatic overages when they run out of credits.

**Component to Create:**
`src/components/billing/OverageToggle.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

interface OverageToggleProps {
  initialValue?: boolean;
  onToggle?: (enabled: boolean) => void;
}

export function OverageToggle({ initialValue = false, onToggle }: OverageToggleProps) {
  const [enabled, setEnabled] = useState(initialValue);
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsLoading(true);
    
    try {
      // TODO: Call API to persist setting
      // Option 1: Use automation settings endpoint as workaround
      // Option 2: Wait for dedicated overage settings endpoint
      
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setEnabled(checked);
      
      if (onToggle) {
        onToggle(checked);
      }
      
      toast.success(
        checked 
          ? 'Overages enabled. You can now exceed your balance.' 
          : 'Overages disabled. API calls will stop when balance reaches $0.'
      );
    } catch (error) {
      console.error('Failed to update overage setting:', error);
      toast.error('Failed to update setting. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Overage Settings</span>
          <Info className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
        <CardDescription>
          Control what happens when your balance reaches $0
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="overage-toggle" className="text-base">
              Allow Overages
            </Label>
            <p className="text-sm text-muted-foreground">
              Continue using the API even when balance is $0
            </p>
          </div>
          <Switch
            id="overage-toggle"
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={isLoading}
          />
        </div>

        {enabled && (
          <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-sm">
              When enabled, you may incur charges beyond your current balance. 
              Make sure to monitor your usage and add credits as needed.
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg bg-muted p-4 text-sm space-y-2">
          <p className="font-medium">How it works:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>
              <strong>Disabled:</strong> API calls will be rejected when balance is $0
            </li>
            <li>
              <strong>Enabled:</strong> API calls continue and create a negative balance
            </li>
            <li>
              You can add credits anytime to maintain positive balance
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Integration:**
Add to `src/app/billing/page.tsx`:
```typescript
import { OverageToggle } from '@/components/billing/OverageToggle';

// In component
<OverageToggle 
  initialValue={false} 
  onToggle={(enabled) => console.log('Overage setting:', enabled)}
/>
```

**Backend Requirements:**
- Endpoint to get overage setting: `GET /billing/settings/overage`
- Endpoint to update overage setting: `PUT /billing/settings/overage`
- Or use automation settings as temporary workaround

---

### LOW PRIORITY

#### 7. Polish & UX Improvements

**Estimated Effort:** Ongoing

**Loading States:**
- [ ] Add skeleton loaders to all charts
- [ ] Add loading spinners to buttons
- [ ] Show progress indicators for long operations

**Empty States:**
- [ ] Better empty state messages
- [ ] Helpful suggestions when no data
- [ ] CTA buttons to get started

**Error Handling:**
- [ ] Add error boundaries to catch React errors
- [ ] Graceful degradation when API fails
- [ ] Retry buttons for failed requests
- [ ] Better error messages

**Mobile Responsiveness:**
- [ ] Test all charts on mobile
- [ ] Optimize table layouts for small screens
- [ ] Touch-friendly controls
- [ ] Responsive navigation

**Accessibility:**
- [ ] Add ARIA labels to interactive elements
- [ ] Keyboard navigation support
- [ ] Focus management in modals
- [ ] Screen reader friendly

**Performance:**
- [ ] Optimize chart rendering
- [ ] Implement virtual scrolling for large tables
- [ ] Debounce filter changes
- [ ] Lazy load chart components

**Visual Polish:**
- [ ] Consistent spacing and alignment
- [ ] Smooth transitions and animations
- [ ] Hover states on all interactive elements
- [ ] Better color contrast for readability

---

#### 8. Documentation

**Estimated Effort:** 1 day

**Files to Update:**

1. **BILLING_IMPLEMENTATION_SUMMARY.md**
   - Update status to 100% complete
   - Document all new features
   - Update testing checklist

2. **Component Documentation:**
   - Add JSDoc comments to all components
   - Document props and usage examples
   - Add inline code comments

3. **User Guide:**
   Create `docs/user-guide-billing.md` with:
   - How to add credits
   - How to connect wallet for staking
   - How to view usage analytics
   - How to export data
   - How to manage overage settings
   - Understanding transaction history
   - FAQ section

4. **Developer Guide:**
   Create `docs/developer-guide-billing.md` with:
   - Architecture overview
   - API integration details
   - Component hierarchy
   - State management patterns
   - Testing strategies
   - Deployment considerations

5. **Webhook Setup Guide:**
   Create `docs/webhook-setup.md` with:
   - Coinbase Commerce webhook configuration
   - Stripe webhook configuration
   - Testing webhooks locally
   - Troubleshooting common issues

---

## Implementation Timeline

### Week 1: Core Features (3-4 days)
**Day 1-2:**
- ✅ Transaction History View
  - Create TransactionHistoryTable component
  - Add filters and pagination
  - Integrate with existing hook
  - Add to Usage Analytics page

**Day 3:**
- ✅ Real Data Integration
  - Replace all mock data in BillingOverview
  - Test with real API
  - Fix any issues

**Day 4:**
- ✅ API Key & Model Filtering
  - Make filters functional
  - Add model filter
  - Test filtering logic

### Week 2: Payment Integration (3-4 days)
**Day 1:**
- ✅ Coinbase Webhook Backend
  - Implement account crediting
  - Add error handling
  - Test end-to-end

**Day 2-3:**
- ✅ Stripe Integration
  - Set up Stripe account
  - Create checkout session endpoint
  - Create webhook handler
  - Update FundingSection component

**Day 4:**
- ✅ Overage Toggle
  - Create component
  - Integrate with backend (or workaround)
  - Test functionality

### Week 3: Polish & Documentation (2-3 days)
**Day 1-2:**
- ✅ UX Improvements
  - Loading states
  - Error handling
  - Mobile optimization
  - Accessibility

**Day 3:**
- ✅ Documentation
  - Update all docs
  - Write user guide
  - Write developer guide
  - JSDoc comments

**Total Estimated Time:** 8-11 days

---

## Testing Strategy

### Unit Testing
- Component rendering
- Hook functionality
- Utility functions
- CSV export

### Integration Testing
- API endpoint integration
- Webhook handling
- Payment flows
- Data aggregation

### E2E Testing
- Full user flows
- Payment scenarios
- Export functionality
- Wallet connection

### Manual Testing Checklist

**Billing Page:**
- [ ] Balance cards display correct amounts
- [ ] Funding section shows payment options
- [ ] Coinbase Commerce flow works
- [ ] Stripe flow works (when implemented)
- [ ] Staking widget displays correctly
- [ ] Wallet connection works
- [ ] Multiple wallets can be linked
- [ ] Overage toggle works

**Usage Analytics Page:**
- [ ] Overview tab shows real data
- [ ] Monthly tab shows correct spending
- [ ] Detailed tab shows charts
- [ ] Time range filter works
- [ ] Custom date picker works
- [ ] Export button navigates correctly
- [ ] API key filter works
- [ ] Model filter works

**Transaction History:**
- [ ] All transactions display
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Search functionality works
- [ ] Export to CSV works
- [ ] Transaction details show

**Export Data Page:**
- [ ] Table displays all usage data
- [ ] Search filters results
- [ ] Pagination works
- [ ] CSV export includes all filtered data
- [ ] Back button works

**Mobile Responsiveness:**
- [ ] All pages work on mobile
- [ ] Charts are readable
- [ ] Tables scroll horizontally
- [ ] Buttons are touch-friendly

---

## Questions for Backend Team

1. **Billing Credit Endpoint:**
   - Does `POST /billing/credit` endpoint exist?
   - What's the exact schema?
   - What authentication is required?

2. **Overage Settings:**
   - Is there a dedicated endpoint for overage settings?
   - Or should we use automation settings as workaround?
   - What's the expected behavior when overage is disabled?

3. **Stripe Integration:**
   - Are Stripe API keys available?
   - Should we use Stripe Checkout or Payment Intents?
   - Any specific webhook events to handle?

4. **Transaction History:**
   - Any specific requirements for transaction display?
   - Should certain transaction types be hidden?
   - Any additional metadata to show?

---

## Success Criteria

### Functional Completeness
- ✅ All high priority tasks completed
- ✅ All medium priority tasks completed
- ✅ Real data displayed throughout
- ✅ Payment flows working end-to-end

### Quality Metrics
- ✅ Zero TypeScript errors
- ✅ Zero ESLint warnings
- ✅ All tests passing
- ✅ Lighthouse score > 90

### User Experience
- ✅ Fast page loads (< 2 seconds)
- ✅ Smooth interactions
- ✅ Clear error messages
- ✅ Responsive on all devices

### Documentation
- ✅ All components documented
- ✅ User guide complete
- ✅ Developer guide complete
- ✅ Webhook setup guide complete

---

## Risk Mitigation

### Technical Risks
- **Risk:** API endpoint doesn't exist
  - **Mitigation:** Check with backend team early
  
- **Risk:** Large datasets cause performance issues
  - **Mitigation:** Implement pagination and virtual scrolling

- **Risk:** Stripe integration issues
  - **Mitigation:** Use test mode extensively before production

### Business Risks
- **Risk:** Users confused by billing features
  - **Mitigation:** Clear documentation and tooltips

- **Risk:** Payment failures not handled properly
  - **Mitigation:** Comprehensive error handling and retry logic

### Security Risks
- **Risk:** Webhook signature verification fails
  - **Mitigation:** Proper signature validation and logging

- **Risk:** Sensitive data exposed in logs
  - **Mitigation:** Sanitize logs, don't log payment details

---

## Resources

### Documentation
- Stripe Documentation: https://stripe.com/docs
- Coinbase Commerce API: https://docs.cloud.coinbase.com/commerce/docs
- Recharts Documentation: https://recharts.org
- shadcn/ui Components: https://ui.shadcn.com

### Internal References
- OpenAPI Spec: https://api.dev.mor.org/api/v1/openapi.json
- Linear Issues: MOR-230, MOR-232
- Reference Implementation: `morpheus-billing/` folder
- Implementation Plan: `.cursor/plans/billing_dashboard_implementation_*.plan.md`

---

**Last Updated:** January 20, 2026  
**Next Review:** After completing high priority tasks
