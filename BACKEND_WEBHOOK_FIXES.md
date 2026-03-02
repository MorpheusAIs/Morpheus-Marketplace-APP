# Backend API Webhook Fixes Required

## Repository: morpheus-marketplace-api (Python/FastAPI)

The webhook handler at `/api/v1/webhooks/coinbase` needs the following fixes to resolve the "Missing user_id in metadata" errors.

---

## Issue Analysis from Logs

Your logs show:
```
{"coinbase_charge_code": "K2V6CS3I", "coinbase_charge_id": "6621bedd-f935-4aef-92df-6d8ba7dc4edf", "event": "Missing user_id in metadata"}
{"event": "Failed to process charge:confirmed"}
```

This means the webhook handler is receiving events but the `metadata.userId` field is missing or invalid.

---

## Required Fixes

### 1. Add Idempotency Protection

**Current issue:** Same webhook processed multiple times → potential double-crediting

**Fix needed in webhook handler:**

```python
# Add module-level cache or use Redis
processed_charges = set()  # In production, use Redis

async def handle_charge_confirmed(event_data):
    charge_code = event_data.get('code')
    
    # Idempotency check
    if charge_code in processed_charges:
        logger.info(f"Charge {charge_code} already processed, skipping")
        return
    
    # ... process payment ...
    
    # Mark as processed
    processed_charges.add(charge_code)
```

### 2. Better Error Handling for Missing user_id

**Current issue:** Webhook fails with error, Coinbase retries infinitely

**Fix needed:**

```python
async def handle_charge_confirmed(event_data):
    user_id = event_data.get('metadata', {}).get('userId')
    charge_code = event_data.get('code')
    charge_id = event_data.get('id')
    
    # Validate user_id
    if not user_id or user_id == 'anonymous':
        logger.error(
            f"Charge {charge_code}: Missing or invalid user_id in metadata",
            extra={
                'charge_id': charge_id,
                'charge_code': charge_code,
                'metadata': event_data.get('metadata', {}),
            }
        )
        # DON'T raise exception - return success to prevent infinite retries
        return
    
    # Validate amount
    payment = event_data.get('payments', [{}])[0]
    amount = payment.get('value', {}).get('local', {}).get('amount', '0')
    
    try:
        numeric_amount = Decimal(amount)
        if numeric_amount <= 0:
            logger.error(f"Charge {charge_code}: Invalid amount: {amount}")
            return
    except (InvalidOperation, ValueError) as e:
        logger.error(f"Charge {charge_code}: Cannot parse amount: {amount}")
        return
    
    # Continue processing...
```

### 3. Enhanced Logging

**Current issue:** Hard to debug webhook failures

**Fix needed:**

```python
@router.post("/api/v1/webhooks/coinbase")
async def handle_coinbase_webhook(request: Request):
    start_time = time.time()
    event_type = 'unknown'
    charge_code = 'unknown'
    
    try:
        # ... signature verification ...
        
        body = await request.json()
        
        # Detect API version
        signature_header = request.headers.get('x-cc-webhook-signature')
        is_legacy = signature_header is not None
        
        if is_legacy:
            # Legacy Commerce API
            event_type = body.get('event', {}).get('type')
            event_data = body.get('event', {}).get('data', {})
            charge_code = event_data.get('code', 'unknown')
        else:
            # Payment Links API
            event_type = body.get('event_type')
            event_data = body.get('data', {})
            charge_code = event_data.get('payment_id', 'unknown')
        
        logger.info(
            f"[Coinbase Webhook] {event_type} for {charge_code}",
            extra={
                'event_type': event_type,
                'charge_code': charge_code,
                'api_version': 'legacy' if is_legacy else 'payment_links',
                'user_id': event_data.get('metadata', {}).get('user_id') or 
                          event_data.get('metadata', {}).get('userId'),
            }
        )
        
        # ... handle event ...
        
        duration = (time.time() - start_time) * 1000
        logger.info(f"[Coinbase Webhook] Processed {event_type} in {duration:.0f}ms")
        
        return {"received": True}
        
    except Exception as e:
        duration = (time.time() - start_time) * 1000
        logger.error(
            f"[Coinbase Webhook] Error processing {event_type} ({duration:.0f}ms)",
            exc_info=True,
            extra={
                'event_type': event_type,
                'charge_code': charge_code,
            }
        )
        raise
```

### 4. Security Enhancement

**Current issue:** If webhook secret not set, accepts all webhooks

**Fix needed:**

```python
async def verify_coinbase_webhook(request: Request, body_bytes: bytes) -> bool:
    """Verify Coinbase webhook signature."""
    
    # Try both signature formats
    legacy_signature = request.headers.get('x-cc-webhook-signature')
    new_signature = request.headers.get('x-hook0-signature')
    
    signature = legacy_signature or new_signature
    api_version = 'legacy' if legacy_signature else 'payment_links'
    
    # Get appropriate secret
    if api_version == 'legacy':
        webhook_secret = os.getenv('COINBASE_COMMERCE_WEBHOOK_SECRET')
    else:
        webhook_secret = os.getenv('COINBASE_WEBHOOK_SECRET')
    
    if not webhook_secret:
        logger.warning(
            f"⚠️ Coinbase webhook secret not configured for {api_version} API! "
            "Accepting unverified webhooks. THIS IS INSECURE!"
        )
        return True  # Or return False in production
    
    if not signature:
        logger.error(f"Webhook rejected: Missing signature header for {api_version}")
        raise HTTPException(status_code=401, detail="Missing signature")
    
    # Verify signature
    computed = hmac.new(
        webhook_secret.encode('utf-8'),
        body_bytes,
        hashlib.sha256
    ).hexdigest()
    
    if computed != signature:
        logger.error(f"Webhook rejected: Invalid signature for {api_version}")
        raise HTTPException(status_code=401, detail="Invalid signature")
    
    return True
```

---

## Implementation Steps

### Step 1: Update Webhook Handler Code

File: `src/webhooks/coinbase.py` (or wherever it's located)

1. Add idempotency check using Redis or in-memory cache
2. Update `handle_charge_confirmed` with better validation
3. Enhance logging with structured context
4. Improve signature verification with warnings

### Step 2: Test Changes

```bash
# 1. Create test charge from frontend
# User must be logged in with valid cognito_user_id

# 2. Complete payment on Coinbase

# 3. Check logs for webhook processing
grep "Coinbase Webhook" /var/log/api.log

# Expected output:
# [Coinbase Webhook] charge:confirmed for ABC123 { user_id: 'uuid-...', api_version: 'legacy' }
# Payment confirmed for user uuid-...: USD 5.00 (charge: ABC123)
# Account credited successfully for charge ABC123
# [Coinbase Webhook] Processed charge:confirmed in 234ms

# 4. Verify no "Missing user_id" errors
grep "Missing user_id" /var/log/api.log  # Should be empty

# 5. Test idempotency - send same webhook twice
curl -X POST https://api.dev.mor.org/api/v1/webhooks/coinbase \
  -H "Content-Type: application/json" \
  -H "X-CC-Webhook-Signature: test" \
  -d @webhook_payload.json

# Should log: "Charge ABC123 already processed, skipping"
```

### Step 3: Deploy

```bash
# Backend deployment
cd morpheus-marketplace-api
git add .
git commit -m "fix: Coinbase webhook handling - idempotency, validation, logging"
git push origin main

# Monitor deployment
# Check logs for 1 hour after deployment
```

---

## Current Backend API Schema

According to the OpenAPI spec you provided, the webhook endpoint already:

✅ Exists at `/api/v1/webhooks/coinbase`  
✅ Auto-detects Payment Link API vs Legacy Commerce API  
✅ Handles both signature types:
   - `X-Hook0-Signature` → Payment Link API  
   - `X-CC-Webhook-Signature` → Legacy Commerce  

**Just needs the logic fixes above for:**
- Idempotency
- Better validation
- Enhanced logging
- Security warnings

---

## Environment Variables Required

Make sure these are set in the backend:

```bash
# Legacy Commerce API (current)
COINBASE_COMMERCE_WEBHOOK_SECRET=your_legacy_webhook_secret

# Payment Links API (future)
COINBASE_WEBHOOK_SECRET=your_new_webhook_secret

# Admin credentials
ADMIN_API_SECRET=your_admin_secret

# Database
DATABASE_URL=postgresql://...
```

---

## Monitoring After Deployment

### Success Metrics

```bash
# Successful webhook processing
grep "Account credited successfully" /var/log/api.log | wc -l

# Should be 0 after fixes
grep "Missing user_id" /var/log/api.log

# Idempotency working
grep "already processed" /var/log/api.log
```

### Alert on These Errors

```bash
# High priority
grep "Failed to credit account" /var/log/api.log
grep "Missing or invalid user_id" /var/log/api.log

# Medium priority  
grep "Invalid signature" /var/log/api.log
grep "webhook secret not configured" /var/log/api.log
```

---

## Migration to Payment Links API

The backend already supports both APIs! From the OpenAPI spec:

> "Supports both Payment Link API (new) and legacy Commerce Charge API formats.
> Auto-detects the format based on the signature header"

So you can migrate gradually:
1. Frontend creates charges using new Payment Links API
2. Backend automatically handles both webhook formats
3. No breaking changes needed

---

## Next Steps

1. **Today:** Apply these fixes to backend webhook handler
2. **Test:** Make test payment and verify webhook processes correctly
3. **Monitor:** Watch logs for 24 hours
4. **Frontend:** Deploy the Next.js fixes (already done in this repo)
5. **Migration:** Plan Payment Links API migration (when ready)

---

## Questions for Backend Team

1. **Where is the webhook handler code?**
   - `src/webhooks/coinbase.py`?
   - `src/api/v1/webhooks.py`?

2. **Do you use Redis or in-memory for idempotency?**
   - Redis recommended for production
   - In-memory OK for single-instance deployments

3. **What's the logging setup?**
   - Structured logging (JSON)?
   - Log aggregation service (CloudWatch, Datadog)?

4. **Test environment available?**
   - Can we test webhook fixes in dev/staging first?

---

**Backend repo:** morpheus-marketplace-api  
**Endpoint:** `/api/v1/webhooks/coinbase`  
**Priority:** High - fixes prevent payment failures
