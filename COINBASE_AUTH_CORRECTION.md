# Coinbase Authentication - Correction

## What I Got Wrong

In the migration guide, I incorrectly stated you need these permissions:
```
❌ onramp:payment_links:create
❌ onramp:payment_links:read
```

**These don't exist!** I made them up based on typical OAuth2 permission patterns.

---

## Actual Coinbase Business API Authentication

### Permission System (Correct)

According to [Coinbase Business API docs](https://docs.cdp.coinbase.com/coinbase-business/authentication-authorization/api-key-authentication), there are only **3 permission scopes**:

1. **View (read-only)** ✅ 
   - Grants access to Payment Links API
   - Can create, update, and manage payment links
   - Can retrieve account balances and transaction history
   - **This is what you need!**

2. **Trade**
   - Execute buy/sell orders
   - Not needed for Payment Links

3. **Transfer**
   - Send funds out of account
   - Not needed for Payment Links

### API Key Format (Correct)

**CDP API Key structure:**
```
Key Name: organizations/{org_id}/apiKeys/{key_id}
Private Key: -----BEGIN EC PRIVATE KEY-----
             ...multi-line EC private key...
             -----END EC PRIVATE KEY-----
```

### Authentication Method (Correct)

**Uses JWT Bearer tokens,** not simple API key headers:

1. Generate JWT token from CDP API key
2. Include in request: `Authorization: Bearer <JWT>`
3. JWT expires after 2 minutes
4. Must generate new JWT for each request

**Example code (Node.js):**
```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const keyName = 'organizations/{org_id}/apiKeys/{key_id}';
const keySecret = `-----BEGIN EC PRIVATE KEY-----
YOUR PRIVATE KEY
-----END EC PRIVATE KEY-----`;

function generateJWT(method, host, path) {
  const uri = `${method} ${host}${path}`;
  
  const payload = {
    iss: 'cdp',
    nbf: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
    sub: keyName,
    uri,
  };
  
  const header = {
    alg: 'ES256',
    kid: keyName,
    nonce: crypto.randomBytes(16).toString('hex'),
  };
  
  return jwt.sign(payload, keySecret, { algorithm: 'ES256', header });
}

// Usage:
const token = generateJWT('POST', 'business.coinbase.com', '/api/v1/payment-links');

const response = await fetch('https://business.coinbase.com/api/v1/payment-links', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ amount: '100.00', currency: 'USDC', network: 'base' })
});
```

---

## Key Differences from Legacy Commerce API

| Aspect | Legacy Commerce API | Payment Links API |
|--------|---------------------|-------------------|
| **Base URL** | `api.commerce.coinbase.com` | `business.coinbase.com/api/v1` |
| **Auth header** | `X-CC-Api-Key: <key>` | `Authorization: Bearer <JWT>` |
| **API key format** | Simple string key | CDP API key (name + private key) |
| **Permissions** | Single API key | View/Trade/Transfer scopes |
| **Token expiry** | No expiry | JWT expires in 2 minutes |

---

## Updated Migration Steps

### Step 1: Create CDP API Key

1. Go to [CDP Portal → API Keys](https://portal.cdp.coinbase.com/projects/api-keys)
2. Click "Create API key"
3. Set permissions:
   - ✅ Enable **View** scope
   - ❌ Don't enable Trade or Transfer (not needed)
4. Set signature algorithm: **ECDSA** (recommended)
5. (Optional) Add IP allowlist for security
6. Save the key name and private key securely

### Step 2: Implement JWT Generation

You'll need to generate JWTs in your backend. Options:

**Option A: Use Coinbase Python SDK (easiest)**
```bash
pip install coinbase-advanced-py
```

```python
from coinbase import jwt_generator

api_key = "organizations/{org_id}/apiKeys/{key_id}"
api_secret = """-----BEGIN EC PRIVATE KEY-----
YOUR PRIVATE KEY
-----END EC PRIVATE KEY-----
"""

request_method = "POST"
request_path = "/api/v1/payment-links"

jwt_uri = jwt_generator.format_jwt_uri(request_method, f"business.coinbase.com{request_path}")
jwt_token = jwt_generator.build_rest_jwt(jwt_uri, api_key, api_secret)

# Use in API call
headers = {
    "Authorization": f"Bearer {jwt_token}",
    "Content-Type": "application/json"
}
```

**Option B: Implement JWT generation manually**
- See [Coinbase JWT examples](https://docs.cdp.coinbase.com/coinbase-business/authentication-authorization/api-key-authentication#code-samples)
- Available in: Python, Go, JavaScript, PHP, Java, C++, C#, TypeScript

### Step 3: Update API Calls

**Old (Commerce API):**
```javascript
fetch('https://api.commerce.coinbase.com/charges', {
  headers: {
    'X-CC-Api-Key': API_KEY,
    'X-CC-Version': '2018-03-22'
  }
})
```

**New (Payment Links API):**
```javascript
const jwt = generateJWT('POST', 'business.coinbase.com', '/api/v1/payment-links');

fetch('https://business.coinbase.com/api/v1/payment-links', {
  headers: {
    'Authorization': `Bearer ${jwt}`,
    'X-Idempotency-Key': uuidv4()
  }
})
```

---

## Why I Made That Mistake

I assumed Coinbase used OAuth2-style granular permissions like:
- `onramp:payment_links:create`
- `onramp:payment_links:read`
- `onramp:payment_links:update`

This pattern is common in many APIs (Google, AWS, etc.), but Coinbase uses a simpler 3-tier system (View/Trade/Transfer).

---

## Corrected Environment Variables

```bash
# WRONG (what I said before)
COINBASE_API_KEY=simple_key
COINBASE_API_SECRET=simple_secret

# CORRECT (actual format)
COINBASE_CDP_KEY_NAME=organizations/abc-123/apiKeys/def-456
COINBASE_CDP_PRIVATE_KEY="-----BEGIN EC PRIVATE KEY-----
MHcCAQEEIBKg8Z5IbIEu9zvEw1tCB4qJBEPvVVbm+1zNdZvL1sLroAoGCCqGSM49
AwEHoUQDQgAEL3i9Jq5VPgKmN7zXBLhN2e9D9Fj8K3gH9vL2qR8T5yU6M1pZ3nV
4vK2jR9qL8mN5oP7sT6yU3wX8zA1bC9vD4g==
-----END EC PRIVATE KEY-----"

# Then generate JWT tokens programmatically in your code
```

---

## References

- [Coinbase API Key Authentication](https://docs.cdp.coinbase.com/coinbase-business/authentication-authorization/api-key-authentication)
- [API Key Scopes explained](https://docs.cdp.coinbase.com/coinbase-business/authentication-authorization/api-key-authentication#understanding-api-key-scopes)
- [Payment Links API Overview](https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/overview)
- [Migration Guide](https://docs.cdp.coinbase.com/coinbase-business/payment-link-apis/migrate/api-schema-mapping)

---

**Updated:** February 12, 2026  
**Correction:** Authentication details now accurate per official docs
