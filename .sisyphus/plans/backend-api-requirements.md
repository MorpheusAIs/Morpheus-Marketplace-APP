# Backend API Requirements for Billing Dashboard

**Created:** January 22, 2026  
**Purpose:** Document all backend API endpoints required by the frontend billing dashboard  
**Frontend TypeScript Types:** `src/types/billing.ts` (API Version: v1.12.13-test)

---

## Summary of Required Changes

| Priority | Endpoint | Status | Action Needed |
|----------|----------|--------|---------------|
| CRITICAL | `GET /billing/usage` | ⚠️ FAILING | Debug why requests fail - returns "Failed to fetch" |
| CRITICAL | `POST /billing/credits/adjust` | ❓ UNKNOWN | Verify endpoint exists for Coinbase webhook |
| HIGH | `GET /billing/usage` | ⚠️ VERIFY | Check `api_key_id` field is included in response |
| MEDIUM | `GET /billing/settings/overage` | ❌ MISSING | Create endpoint for overage toggle |
| MEDIUM | `PUT /billing/settings/overage` | ❌ MISSING | Create endpoint to save overage preference |
| LOW | Stripe webhook support | ❌ MISSING | Add endpoint when Stripe is implemented |

---

## 1. BILLING ENDPOINTS

### 1.1 GET /billing/balance
**Status:** ✅ Assumed working (used on Billing page)

**Request:**
```http
GET /api/v1/billing/balance
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "paid": {
    "posted_balance": "12.50",
    "pending_holds": "0.00",
    "available": "12.50"
  },
  "staking": {
    "daily_amount": "20.00",
    "refresh_date": "2026-01-23T00:00:00Z",
    "available": "15.00"
  },
  "total_available": "27.50",
  "currency": "USD"
}
```

**Frontend Usage:** `src/lib/hooks/use-billing.ts` → `useBillingBalance()`

---

### 1.2 GET /billing/usage ⚠️ CRITICAL - CURRENTLY FAILING
**Status:** 🔴 FAILING - Frontend shows "Failed to fetch" error

**Request:**
```http
GET /api/v1/billing/usage?from=2026-01-01T00:00:00Z&to=2026-01-22T23:59:59Z&limit=100&offset=0
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from` | ISO datetime string | No | Start of date range |
| `to` | ISO datetime string | No | End of date range |
| `limit` | integer (max 100) | No | Number of records |
| `offset` | integer | No | Pagination offset |
| `model` | string | No | Filter by model name |

**Expected Response:**
```json
{
  "items": [
    {
      "id": "usage_123",
      "created_at": "2026-01-20T14:30:00Z",
      "model_name": "LMR-Hermes-3-Llama-3.1-8B",
      "model_id": "model_456",
      "endpoint": "/v1/chat/completions",
      "tokens_input": 150,
      "tokens_output": 200,
      "tokens_total": 350,
      "amount_paid": "0.0035",
      "amount_staking": "0.0020",
      "amount_total": "0.0055",
      "request_id": "req_789",
      "api_key_id": 42
    }
  ],
  "total": 1500,
  "limit": 100,
  "offset": 0,
  "has_more": true
}
```

**Frontend Usage:** `src/lib/hooks/use-billing.ts` → `useBillingUsage()`

**CRITICAL ISSUE:** This endpoint is returning errors. Frontend shows:
- "Failed to load usage data"
- "Failed to fetch"

**Debug Checklist for Backend Team:**
1. [ ] Is the endpoint accessible? Try: `curl -X GET "https://api.mor.org/api/v1/billing/usage" -H "Authorization: Bearer <token>"`
2. [ ] Are CORS headers configured correctly?
3. [ ] Is the JWT token being validated correctly?
4. [ ] Are the date parameters being parsed correctly?
5. [ ] Is there a database connection issue?
6. [ ] Check server logs for 500 errors or exceptions

**⚠️ IMPORTANT:** The `api_key_id` field MUST be included in each usage entry for the "Spend by API Key" pie chart to work. Verify this field is being returned.

---

### 1.3 GET /billing/usage/month
**Status:** ✅ Assumed working

**Request:**
```http
GET /api/v1/billing/usage/month?year=2026&month=1&limit=100&offset=0
Authorization: Bearer <jwt_token>
```

**Expected Response:** Same schema as `/billing/usage`

---

### 1.4 GET /billing/transactions
**Status:** ✅ Assumed working (TransactionHistoryTable uses this)

**Request:**
```http
GET /api/v1/billing/transactions?limit=50&offset=0&entry_type=purchase
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `limit` | integer (max 250) | No | Number of records |
| `offset` | integer | No | Pagination offset |
| `entry_type` | enum | No | Filter by type |
| `from` | ISO datetime | No | Start date |
| `to` | ISO datetime | No | End date |

**Valid `entry_type` values:**
- `purchase`
- `staking_refresh`
- `usage_hold`
- `usage_charge`
- `refund`
- `adjustment`

**Expected Response:**
```json
{
  "items": [
    {
      "id": "ledger_123",
      "user_id": 456,
      "currency": "USD",
      "status": "posted",
      "entry_type": "purchase",
      "amount_paid": "10.00",
      "amount_staking": "0.00",
      "amount_total": "10.00",
      "idempotency_key": "coinbase_abc123",
      "related_entry_id": null,
      "payment_source": "coinbase",
      "external_transaction_id": "tx_xyz",
      "payment_metadata": { "network": "base", "charge_code": "ABC123" },
      "request_id": null,
      "api_key_id": null,
      "model_name": null,
      "model_id": null,
      "endpoint": null,
      "tokens_input": null,
      "tokens_output": null,
      "tokens_total": null,
      "input_price_per_million": null,
      "output_price_per_million": null,
      "failure_code": null,
      "failure_reason": null,
      "description": "Coinbase payment: ABC123 (base)",
      "created_at": "2026-01-20T10:00:00Z",
      "updated_at": "2026-01-20T10:00:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0,
  "has_more": false
}
```

---

### 1.5 GET /billing/spending
**Status:** ✅ WORKING (Monthly Spending tab shows data)

**Request:**
```http
GET /api/v1/billing/spending?year=2026&mode=gross
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `year` | integer | No | Year (defaults to current) |
| `mode` | enum | No | `gross` or `net` |

**Expected Response:**
```json
{
  "year": 2026,
  "mode": "gross",
  "months": [
    { "year": 2026, "month": 1, "amount": "0.0065", "transaction_count": 15 },
    { "year": 2026, "month": 2, "amount": "0.00", "transaction_count": 0 }
  ],
  "total": "0.0065",
  "currency": "USD"
}
```

---

### 1.6 POST /billing/credits/adjust ❓ VERIFY EXISTS
**Status:** ❓ UNKNOWN - Required for Coinbase webhook

**Purpose:** Credit user's account after successful Coinbase payment

**Request:**
```http
POST /api/v1/billing/credits/adjust
Content-Type: application/json
X-Admin-Secret: <admin_secret>

{
  "user_id": "123",
  "amount_usd": 10.00,
  "description": "Coinbase payment: ABC123 (base)"
}
```

**Expected Response:**
```json
{
  "success": true,
  "new_balance": "22.50",
  "transaction_id": "ledger_456"
}
```

**Authentication:** Uses `X-Admin-Secret` header (NOT user JWT)

**Frontend Usage:** `src/app/api/webhooks/coinbase/route.ts` line 90

**ACTION NEEDED:** 
1. Verify this endpoint exists at `/api/v1/billing/credits/adjust`
2. If not, create it with admin-only authentication
3. Ensure it creates a `purchase` entry in the ledger

---

## 2. WALLET ENDPOINTS

### 2.1 GET /auth/wallet/
**Status:** ✅ Working (StakingWidget uses this)

**Request:**
```http
GET /api/v1/auth/wallet/
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "has_wallets": true,
  "wallet_count": 2,
  "total_staked": "5000.00",
  "wallets": [
    {
      "id": 1,
      "wallet_address": "0x1234...abcd",
      "staked_amount": "3000.00",
      "linked_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T12:00:00Z"
    }
  ],
  "stakers": [
    {
      "id": "staker_1",
      "address": "0x1234...abcd",
      "staked": "3000.00",
      "lastStake": "2026-01-10T08:00:00Z",
      "projectName": "Morpheus"
    }
  ]
}
```

---

### 2.2 POST /auth/wallet/nonce/{wallet_address}
**Status:** ✅ Working

**Request:**
```http
POST /api/v1/auth/wallet/nonce/0x1234567890abcdef1234567890abcdef12345678
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "nonce": "abc123xyz",
  "message_template": "Sign this message to link your wallet to Morpheus: {nonce}",
  "expires_in": 300
}
```

---

### 2.3 POST /auth/wallet/link
**Status:** ✅ Working

**Request:**
```http
POST /api/v1/auth/wallet/link
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "signature": "0x...",
  "message": "Sign this message to link your wallet to Morpheus: abc123xyz",
  "nonce": "abc123xyz",
  "timestamp": "2026-01-22T12:00:00Z"
}
```

**Expected Response:**
```json
{
  "id": 1,
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "staked_amount": "3000.00",
  "linked_at": "2026-01-22T12:00:00Z",
  "updated_at": "2026-01-22T12:00:00Z"
}
```

---

### 2.4 DELETE /auth/wallet/{wallet_id}
**Status:** ✅ Working

**Request:**
```http
DELETE /api/v1/auth/wallet/1
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "message": "Wallet unlinked successfully",
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
}
```

---

### 2.5 GET /auth/wallet/check/{wallet_address}
**Status:** ✅ Working

**Request:**
```http
GET /api/v1/auth/wallet/check/0x1234567890abcdef1234567890abcdef12345678
```

**Note:** This endpoint may be public (no Authorization header)

**Expected Response:**
```json
{
  "wallet_address": "0x1234567890abcdef1234567890abcdef12345678",
  "is_available": true
}
```

---

## 3. MISSING ENDPOINTS ❌

### 3.1 GET /billing/settings/overage ❌ NOT IMPLEMENTED
**Purpose:** Get user's overage preference (allow negative balance or not)

**Request:**
```http
GET /api/v1/billing/settings/overage
Authorization: Bearer <jwt_token>
```

**Expected Response:**
```json
{
  "allow_overages": false,
  "max_overage_amount": null
}
```

**Frontend Location:** `src/components/billing/OverageToggle.tsx` (component spec in remaining-tasks doc)

---

### 3.2 PUT /billing/settings/overage ❌ NOT IMPLEMENTED
**Purpose:** Update user's overage preference

**Request:**
```http
PUT /api/v1/billing/settings/overage
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "allow_overages": true
}
```

**Expected Response:**
```json
{
  "allow_overages": true,
  "updated_at": "2026-01-22T12:00:00Z"
}
```

---

### 3.3 POST /billing/stripe/create-checkout ❌ NOT IMPLEMENTED
**Purpose:** Create Stripe checkout session for card payments

**When Needed:** When Stripe integration is implemented

**Request:**
```http
POST /api/v1/billing/stripe/create-checkout
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount_usd": 10.00,
  "success_url": "https://app.mor.org/billing?payment=success",
  "cancel_url": "https://app.mor.org/billing?payment=cancelled"
}
```

**Expected Response:**
```json
{
  "checkout_session_id": "cs_test_abc123",
  "checkout_url": "https://checkout.stripe.com/pay/cs_test_abc123"
}
```

---

## 4. FIELD REQUIREMENTS

### 4.1 UsageEntryResponse MUST Include `api_key_id`

The frontend "Spend by API Key" pie chart requires each usage entry to have an `api_key_id` field that maps to the user's API keys.

**Current Type Definition:**
```typescript
export interface UsageEntryResponse {
  id: string;
  created_at: string;
  model_name: string | null;
  model_id: string | null;
  endpoint: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  tokens_total: number | null;
  amount_paid: string;
  amount_staking: string;
  amount_total: string;
  request_id: string | null;
  // ⚠️ THIS FIELD IS REQUIRED BUT MAY BE MISSING FROM BACKEND
}
```

**Backend Code Location:** The BillingOverview component expects `api_key_id` at:
- `src/components/billing/BillingOverview.tsx` line 170, 185-186

**ACTION:** Add `api_key_id: number | null` to the `/billing/usage` response if not already present.

---

## 5. AUTHENTICATION REQUIREMENTS

### User Endpoints (JWT Bearer Token)
All `/billing/*` and `/auth/wallet/*` endpoints require:
```http
Authorization: Bearer <jwt_token>
```

The JWT is obtained from AWS Cognito and managed by `src/lib/auth/CognitoAuthContext.tsx`.

### Admin Endpoints (Secret Header)
The `/billing/credits/adjust` endpoint requires:
```http
X-Admin-Secret: <admin_secret>
```

This secret is stored in `ADMIN_API_SECRET` environment variable.

---

## 6. ERROR RESPONSE FORMAT

Backend should return errors in a consistent format that the frontend can parse:

### FastAPI Validation Error (422)
```json
{
  "detail": [
    {
      "loc": ["query", "from"],
      "msg": "invalid datetime format",
      "type": "value_error"
    }
  ]
}
```

### General Error (4xx/5xx)
```json
{
  "detail": "User not found"
}
```

OR

```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

The frontend error handler at `src/lib/api/billing.ts` line 23-51 handles all these formats.

---

## 7. CORS CONFIGURATION

Ensure the backend allows requests from:
- `https://app.mor.org` (production)
- `https://app.dev.mor.org` (development)
- `http://localhost:3000` (local development)

Required headers:
```http
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Admin-Secret
Access-Control-Allow-Credentials: true
```

---

## 8. IMMEDIATE ACTIONS FOR BACKEND TEAM

### Priority 1: Debug `/billing/usage` Endpoint
1. Check server logs for errors when this endpoint is called
2. Verify the endpoint returns data when called with valid JWT
3. Check if CORS is blocking the request
4. Test with curl: 
   ```bash
   curl -v "https://api.mor.org/api/v1/billing/usage?from=2026-01-01T00:00:00Z&to=2026-01-22T23:59:59Z&limit=10" \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### Priority 2: Verify `/billing/credits/adjust` Exists
1. Confirm this endpoint exists for Coinbase webhook
2. If not, implement it with admin authentication

### Priority 3: Add `api_key_id` to Usage Response
1. Ensure each usage entry includes the `api_key_id` field
2. This should match the ID from `/auth/keys` endpoint

---

## Appendix: Frontend File References

| Frontend File | Backend Endpoint(s) Used |
|---------------|-------------------------|
| `src/lib/api/billing.ts` | All billing endpoints |
| `src/lib/hooks/use-billing.ts` | All billing hooks |
| `src/app/usage-analytics/page.tsx` | `/billing/usage` |
| `src/components/billing/BillingOverview.tsx` | `/billing/usage` (via props) |
| `src/components/billing/MonthlySpendingChart.tsx` | `/billing/spending` |
| `src/components/billing/TransactionHistoryTable.tsx` | `/billing/transactions` |
| `src/components/billing/StakingWidget.tsx` | `/auth/wallet/*` |
| `src/app/api/webhooks/coinbase/route.ts` | `/billing/credits/adjust` |
