# Coinbase Payment Integration Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│  (Morpheus-Marketplace-APP - Next.js Frontend)                  │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 │ 1. Create Charge
                 ├──────────────────────────────────────────┐
                 │                                          │
                 ▼                                          │
┌─────────────────────────────────┐                        │
│  /api/coinbase/charge (Next.js) │                        │
│  - Validates userId             │                        │
│  - Creates Coinbase charge      │                        │
│  - Returns hosted_url           │                        │
└────────────────┬────────────────┘                        │
                 │                                          │
                 │ 2. POST to Coinbase Commerce API        │
                 ▼                                          │
┌─────────────────────────────────┐                        │
│     Coinbase Commerce API       │                        │
│  - Creates charge               │                        │
│  - Returns payment page URL     │                        │
└────────────────┬────────────────┘                        │
                 │                                          │
                 │ 3. Opens payment page                   │
                 └─────────────────────────────────►       │
                                                            │
                 ┌──────────────────────────────────────── │
                 │ 4. User completes payment              │
                 ▼                                          │
┌─────────────────────────────────┐                        │
│     Coinbase Commerce API       │                        │
│  - Processes payment            │                        │
│  - Confirms transaction         │                        │
└────────────────┬────────────────┘                        │
                 │                                          │
                 │ 5. Webhook: charge:confirmed            │
                 ▼                                          │
┌─────────────────────────────────────────────────────┐    │
│  Backend API (morpheus-marketplace-api - Python)    │    │
│  /api/v1/webhooks/coinbase                          │    │
│  - Verifies signature                               │    │
│  - Validates user_id in metadata                    │    │
│  - Credits user account in database                 │    │
│  - Returns 200 OK                                   │    │
└────────────────┬────────────────────────────────────┘    │
                 │                                          │
                 │ 6. Database updated                     │
                 ▼                                          │
┌─────────────────────────────────┐                        │
│       PostgreSQL Database       │                        │
│  - User credits updated         │                        │
│  - Transaction logged           │                        │
└────────────────┬────────────────┘                        │
                 │                                          │
                 │ 7. Redirect to success page             │
                 └─────────────────────────────────────────►
                 ▼
┌─────────────────────────────────────────────────────────┐
│             /billing?payment=success                     │
│  - Shows success message                                │
│  - Refreshes balance from backend API                   │
│  - Displays new credits                                 │
└─────────────────────────────────────────────────────────┘
```

---

## Repository Structure

### Morpheus-Marketplace-APP (Next.js Frontend)

**Location:** `/Users/prometheus/Documents/Morpheus/Morpheus-Marketplace-APP`

**Responsibilities:**
- User interface
- Payment initiation
- Charge creation (proxy to Coinbase)
- Success/failure page display
- Balance display (fetched from backend)

**Coinbase-related files:**
```
src/
├── components/billing/
│   └── FundingSection.tsx           # Payment UI, initiates payment flow
├── app/
│   ├── api/coinbase/
│   │   ├── charge/route.ts          # Creates charges via Coinbase API
│   │   └── diagnostic/route.ts      # Config diagnostics
│   └── billing/
│       └── page.tsx                 # Billing dashboard
```

**Does NOT handle:**
- ❌ Webhooks from Coinbase
- ❌ Database updates
- ❌ Credit balance modifications

---

### morpheus-marketplace-api (Python Backend)

**Location:** [Separate repository]

**Responsibilities:**
- Database management
- User authentication (Cognito)
- Credit balance management
- Webhook processing
- Payment verification

**Coinbase-related endpoints:**
```
Backend API (FastAPI/Python)
├── /api/v1/webhooks/coinbase        # Receives webhooks from Coinbase
│   - Validates signature
│   - Extracts user_id from metadata
│   - Credits user account
│   - Logs transaction
│
├── /api/v1/billing/balance          # Returns user's current balance
├── /api/v1/billing/transactions     # Returns transaction history
└── /api/v1/billing/credits/adjust   # Admin endpoint to adjust credits
```

**Webhook URL:**
- **Dev:** `https://api.dev.mor.org/api/v1/webhooks/coinbase`
- **Prod:** `https://api.mor.org/api/v1/webhooks/coinbase`

---

## Data Flow Detail

### Step 1: User Initiates Payment

```typescript
// Frontend: FundingSection.tsx
const openCoinbaseCheckout = async (amount: string) => {
  if (!userId) {
    setError('You must be logged in to make a payment');
    return;
  }

  const response = await fetch('/api/coinbase/charge', {
    method: 'POST',
    body: JSON.stringify({
      amount: amount,
      currency: 'USD',
      userId: userId,  // Cognito user ID (UUID)
      description: 'Morpheus AI Credits Purchase'
    })
  });
  
  const data = await response.json();
  window.open(data.charge.hosted_url, '_blank');
};
```

### Step 2: Frontend Creates Charge

```typescript
// Frontend: /api/coinbase/charge/route.ts
export async function POST(request: NextRequest) {
  const { amount, currency, userId, description } = await request.json();
  
  // Validation
  if (!userId || userId === 'anonymous') {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }
  
  // Create charge via Coinbase API
  const response = await fetch('https://api.commerce.coinbase.com/charges', {
    method: 'POST',
    headers: {
      'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY,
      'X-CC-Version': '2018-03-22'
    },
    body: JSON.stringify({
      name: 'Morpheus AI Credits',
      pricing_type: 'fixed_price',
      local_price: { amount, currency },
      metadata: { userId },  // Critical: Used by webhook
      redirect_url: 'https://app.mor.org/billing?payment=success',
      cancel_url: 'https://app.mor.org/billing?payment=cancelled'
    })
  });
  
  const chargeData = await response.json();
  return NextResponse.json({
    success: true,
    charge: {
      hosted_url: chargeData.data.hosted_url,
      // ... other fields
    }
  });
}
```

### Step 3: User Pays on Coinbase

User is redirected to Coinbase Commerce payment page:
- Selects cryptocurrency
- Sends payment from wallet
- Waits for blockchain confirmation

### Step 4: Coinbase Sends Webhook

```json
POST https://api.dev.mor.org/api/v1/webhooks/coinbase
Headers:
  X-CC-Webhook-Signature: <hmac_signature>
  Content-Type: application/json

Body:
{
  "id": "webhook-event-id",
  "event": {
    "type": "charge:confirmed",
    "data": {
      "code": "ABC123",
      "id": "charge-uuid",
      "metadata": {
        "userId": "cognito-user-uuid"  ← Critical!
      },
      "payments": [{
        "value": {
          "local": {
            "amount": "5.00",
            "currency": "USD"
          }
        }
      }]
    }
  }
}
```

### Step 5: Backend Processes Webhook

```python
# Backend: morpheus-marketplace-api
# /api/v1/webhooks/coinbase

@router.post("/api/v1/webhooks/coinbase")
async def handle_coinbase_webhook(request: Request):
    # 1. Verify signature
    signature = request.headers.get('x-cc-webhook-signature')
    body = await request.body()
    verify_signature(body, signature)
    
    # 2. Parse event
    event_data = await request.json()
    event_type = event_data['event']['type']
    charge_data = event_data['event']['data']
    
    if event_type == 'charge:confirmed':
        # 3. Extract data
        user_id = charge_data['metadata']['userId']
        amount = charge_data['payments'][0]['value']['local']['amount']
        
        # 4. Validate
        if not user_id or user_id == 'anonymous':
            logger.error("Missing user_id in metadata")
            return {"received": True}  # Don't retry
        
        # 5. Credit account
        await db.execute(
            """
            INSERT INTO credit_ledger (user_id, amount, source)
            VALUES (:user_id, :amount, 'coinbase')
            """,
            {'user_id': user_id, 'amount': amount}
        )
        
        # 6. Update balance cache
        await db.execute(
            """
            UPDATE user_balances 
            SET paid_balance = paid_balance + :amount
            WHERE cognito_user_id = :user_id
            """,
            {'user_id': user_id, 'amount': amount}
        )
        
        logger.info(f"Credited ${amount} to user {user_id}")
    
    return {"received": True}
```

### Step 6: Frontend Shows Success

```typescript
// Frontend: /billing?payment=success
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    setFlowState('stripe_success');
    
    // Refresh balance after 2 seconds (webhook processing time)
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }
}, []);
```

---

## Critical Data Fields

### 1. userId (Cognito User ID)

**Format:** UUID (e.g., `a1b2c3d4-e5f6-7890-1234-567890abcdef`)
**Source:** Frontend authentication (AWS Cognito)
**Flow:**
1. Frontend gets from auth context
2. Passes to charge creation endpoint
3. Stored in Coinbase charge metadata
4. Returned in webhook
5. Used to identify user in database

**Critical:** Must never be 'anonymous' or missing!

### 2. charge_code

**Format:** Short alphanumeric (e.g., `ABC123`)
**Purpose:** Human-readable charge identifier
**Used for:** Logging, support, idempotency

### 3. charge_id

**Format:** UUID
**Purpose:** Unique charge identifier
**Used for:** Database references, Coinbase API lookups

### 4. amount

**Format:** String decimal (e.g., `"5.00"`)
**Currency:** USD (configurable)
**Validation:** Must be > 0, numeric

---

## Environment Variables

### Frontend (Morpheus-Marketplace-APP)

```bash
# Coinbase (charge creation only)
COINBASE_COMMERCE_API_KEY=<api_key>

# Backend API (for balance checks)
NEXT_PUBLIC_API_BASE_URL=https://api.mor.org

# App URL (for redirects)
NEXT_PUBLIC_APP_URL=https://app.mor.org
```

### Backend (morpheus-marketplace-api)

```bash
# Coinbase (webhook verification)
COINBASE_COMMERCE_WEBHOOK_SECRET=<webhook_secret>

# Admin (for manual credit adjustments)
ADMIN_API_SECRET=<admin_secret>

# Database
DATABASE_URL=postgresql://...

# Cognito
AWS_COGNITO_USER_POOL_ID=...
AWS_COGNITO_CLIENT_ID=...
```

---

## Webhook Configuration

**Configure in Coinbase Developer Portal:**

1. Go to: https://commerce.coinbase.com/dashboard/settings
2. Navigate to: Webhooks
3. Add webhook endpoint:
   - **URL:** `https://api.mor.org/api/v1/webhooks/coinbase`
   - **Events:** Select all charge events
   - **Secret:** Copy to `COINBASE_COMMERCE_WEBHOOK_SECRET`

**Events to subscribe:**
- ✅ `charge:created`
- ✅ `charge:confirmed` ← Most important!
- ✅ `charge:failed`
- ✅ `charge:delayed`
- ✅ `charge:pending`
- ✅ `charge:resolved`

---

## Error Handling

### Frontend Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| "Authentication required" | No userId | User must log in |
| "Payment service not configured" | Missing API key | Set `COINBASE_COMMERCE_API_KEY` |
| "Failed to create payment charge" | Coinbase API error | Check API key, try again |

### Backend Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| "Missing user_id in metadata" | Frontend sent anonymous/null | Fixed in frontend validation |
| "Invalid signature" | Wrong webhook secret | Verify `COINBASE_COMMERCE_WEBHOOK_SECRET` |
| "Failed to credit account" | Database error | Check DB connection, logs |

---

## Deployment Checklist

### Frontend (Morpheus-Marketplace-APP)

- [ ] Set `COINBASE_COMMERCE_API_KEY` in Vercel
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` in Vercel
- [ ] Deploy to staging first
- [ ] Test payment flow end-to-end
- [ ] Deploy to production

### Backend (morpheus-marketplace-api)

- [ ] Set `COINBASE_COMMERCE_WEBHOOK_SECRET`
- [ ] Set `ADMIN_API_SECRET`
- [ ] Apply webhook handler fixes
- [ ] Deploy to staging first
- [ ] Test webhook with Coinbase
- [ ] Monitor logs for errors
- [ ] Deploy to production

### Coinbase Dashboard

- [ ] Webhook URL points to backend (not frontend!)
- [ ] All charge events enabled
- [ ] Webhook secret matches environment variable
- [ ] Test webhook delivery

---

## Monitoring

### Frontend Metrics

```bash
# Payment initiation rate
grep "openCoinbaseCheckout" /var/log/frontend.log

# Authentication failures
grep "Authentication required" /var/log/frontend.log
```

### Backend Metrics

```bash
# Webhook processing
grep "Coinbase Webhook" /var/log/backend.log

# Success rate
grep "Account credited successfully" /var/log/backend.log | wc -l

# Failures (should be 0)
grep "Missing user_id" /var/log/backend.log
grep "Failed to credit account" /var/log/backend.log
```

---

## Troubleshooting

### Payment completed but balance not updated

**Symptoms:** User paid on Coinbase, balance still shows old amount

**Check:**
1. Backend webhook logs - did webhook arrive?
2. Database - was transaction recorded?
3. Frontend - did page refresh to fetch new balance?

**Fix:**
```bash
# Check backend logs
grep "charge:confirmed" /var/log/backend.log

# Manual credit (if webhook missed)
curl -X POST https://api.mor.org/api/v1/billing/credits/adjust \
  -H "X-Admin-Secret: $ADMIN_SECRET" \
  -d '{"cognito_user_id": "user-uuid", "amount_usd": 5.0}'
```

### Webhook fails with "Missing user_id"

**Symptoms:** Backend logs show "Missing user_id in metadata"

**Cause:** Frontend sent charge with userId=null or 'anonymous'

**Fix:** Deploy frontend fixes from this repo

### Multiple webhook attempts

**Symptoms:** Same charge processed multiple times in logs

**Cause:** Webhook failed initially, Coinbase retrying

**Fix:**
1. Fix root cause (missing user_id, database error)
2. Implement idempotency in backend
3. Coinbase will stop retrying after ~24 hours

---

**Last updated:** February 12, 2026  
**Architecture owner:** [Your team]  
**Questions:** See BACKEND_WEBHOOK_FIXES.md or open GitHub issue
