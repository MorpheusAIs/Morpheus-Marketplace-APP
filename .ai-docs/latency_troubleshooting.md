# Latency Troubleshooting Analysis: High-Latency User Experience Issues

**Date:** December 12, 2025  
**Issue:** Users in Asia (Malaysia) experiencing intermittent failures on app.mor.org  
**Symptoms:**
1. "Message Failed" toast on initial chat request
2. "Request Failed: No Session ID" when switching models
3. Intermittent success (sometimes works, sometimes fails)

---

## Executive Summary

After reviewing the frontend code, backend API, and infrastructure configuration, the hypothesis about latency being the root cause is **confirmed**. The architecture has several components that are latency-sensitive and lack proper accommodation for high-latency connections (~200-350ms RTT from Malaysia to US-EAST-2).

### Key Findings

| Component | Current State | Risk Level |
|-----------|--------------|------------|
| API Endpoint Location | US-EAST-2 only (no edge/CDN) | **HIGH** |
| Session Creation | Synchronous blockchain + DB operation | **HIGH** |
| Frontend Fetch Timeout | Default browser (varies, typically 30-60s) | **MEDIUM** |
| DB Connection Pool | 30s timeout | **MEDIUM** |
| Redis Cache | Disabled in production | **MEDIUM** |
| Streaming Timeout | 60s in client context manager | **LOW** |

---

## Architecture Analysis

### 1. Network Path for Asian Users

```
┌─────────────────┐     ┌────────────────────┐     ┌───────────────────┐
│   User Browser  │────▶│  CloudFront Edge   │────▶│  Amplify (Static) │
│   (Malaysia)    │     │  (Asia-Pacific)    │     │  (US-EAST-2)      │
└─────────────────┘     └────────────────────┘     └───────────────────┘
         │                                                   
         │  Direct API Call (~200-350ms RTT)
         ▼
┌─────────────────┐     ┌────────────────────┐     ┌───────────────────┐
│   api.mor.org   │────▶│  ALB (US-EAST-2)   │────▶│  ECS Fargate      │
│   (DNS lookup)  │     │  300s idle timeout │     │  (US-EAST-2)      │
└─────────────────┘     └────────────────────┘     └───────────────────┘
                                                            │
         ┌──────────────────────────────────────────────────┤
         ▼                                                  ▼
┌─────────────────┐                               ┌───────────────────┐
│  RDS PostgreSQL │                               │  Proxy Router     │
│  (US-EAST-2)    │                               │  (Blockchain)     │
│  db.t3.small    │                               │  120s timeout     │
└─────────────────┘                               └───────────────────┘
```

**Key Issue:** While static assets are served via CloudFront (with edge locations worldwide), all API calls go directly to US-EAST-2 with no regional acceleration or caching.

### 2. Session Creation Flow (Critical Path)

When a user sends their first message or switches models, the following synchronous operations occur:

```python
# From session_service.py - This is the critical bottleneck
async def get_session_for_api_key(...):
    # 1. Acquire row lock on API key (DB roundtrip)
    result = await db.execute(
        select(APIKey)
        .where(APIKey.id == api_key_id)
        .with_for_update()  # Blocking lock
    )
    
    # 2. Check for existing session (DB roundtrip)
    session = await session_crud.get_active_session_by_api_key(...)
    
    # 3. If model mismatch, close old session (Proxy Router call)
    await close_session(db, session.id)
    
    # 4. Create new session (multiple operations)
    return await create_automated_session(...)
```

The `create_automated_session` function performs:
1. Get automation settings (DB lookup)
2. Resolve target model via model router (external HTTP call)
3. Deactivate existing sessions (DB update)
4. Get user's private key (DB lookup)
5. **Call proxy router to open blockchain session** (external HTTP call, up to 120s timeout)
6. Store session in database (DB insert)

**Total potential operations:** 6+ database roundtrips + 2+ external HTTP calls

With ~250ms RTT to US-EAST-2, this adds up to:
- Database operations: ~1.5-2.5 seconds
- Proxy router call: Variable (blockchain confirmation time)

### 3. Frontend API Client Analysis

**Location:** `src/lib/api/apiService.ts`

```typescript
// Current implementation - NO timeout configuration
export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  // ...
  const response = await fetch(url, options);  // Uses browser default timeout
  // ...
}
```

**Issues:**
- No explicit timeout set on fetch requests
- No retry logic with exponential backoff
- No connection health monitoring
- Relies on browser's default timeout (varies by browser: 30s-300s)

### 4. Chat Page Request Handling

**Location:** `src/app/chat/page.tsx`

```typescript
// Line 496-505 - Chat request with streaming
const res = await fetch(API_URLS.chatCompletions(), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'accept': 'text/event-stream',
    'Authorization': `Bearer ${fullApiKey}`
  },
  body: JSON.stringify(requestBody),
  signal: abortController.signal  // Only abort, no timeout
});
```

**Issues:**
- No timeout wrapper around the fetch call
- AbortController is for manual cancellation, not automatic timeout
- Error handling shows "Message Failed" immediately without retry

### 5. Backend Streaming Timeout

**Location:** `src/services/proxy_router_service.py`

```python
# Line 721-729 - Streaming context manager
async with httpx.AsyncClient() as client:
    async with client.stream(
        "POST",
        url,
        json=payload,
        headers=headers,
        timeout=60.0  # Only 60 seconds for streaming
    ) as response:
```

**Issue:** 60-second timeout for streaming may be insufficient when session creation takes 5-15 seconds and response generation adds more time.

### 6. Database Connection Pool Configuration

**Location:** `environments/03-morpheus_api/04-prd/terraform.tfvars`

```hcl
api_service = {
  # ...
  db_pool_size     = 50
  db_max_overflow  = 144
  db_pool_timeout  = 30  # Seconds to wait for connection
  # ...
}
```

**Issue:** With high-latency connections and row-level locking, the 30-second pool timeout may be hit during concurrent requests from high-latency regions.

### 7. Redis Cache Disabled

```hcl
switches = {
  # ...
  redis = false  # ElastiCache Redis for API key caching
}
```

**Impact:** Every API request requires full database roundtrips for authentication and session lookup, adding latency that could be cached.

---

## Root Cause Analysis

### Why It Works Sometimes (Low Latency Path)

When conditions are favorable:
1. Session already exists in database for the requested model
2. Session is not expired
3. Database connections are readily available
4. No row lock contention

The request can complete with minimal overhead (~500ms-1s additional latency).

### Why It Fails (High Latency Path)

When any of these occur:
1. **New session creation required:** First message or model switch triggers full session creation flow
2. **Blockchain operation delays:** Proxy router call to create session on blockchain can take 5-30+ seconds
3. **Database contention:** Row locks held during high-latency operations block other requests
4. **Timeout cascade:** Frontend times out before backend completes session creation
5. **Connection pool exhaustion:** Long-held connections during high-latency operations exhaust the pool

### Race Condition Scenario

```
Time=0s:    User sends message
Time=0.3s:  Request reaches API (300ms latency)
Time=0.6s:  Session lookup - none found
Time=0.9s:  Row lock acquired
Time=1.2s:  Model resolution
Time=1.5s:  Deactivate old sessions
Time=2.0s:  Private key lookup
Time=2.5s:  Proxy router call initiated
Time=?:     Waiting for blockchain confirmation...
Time=15s:   Browser fetch timeout (some browsers)
Time=20s:   Session created on blockchain
Time=20.3s: Session stored in DB
Time=20.6s: Response sent to client
            ❌ Client already displayed "Message Failed"
```

---

## Recommendations

### Immediate Actions (Low Effort, High Impact)

#### 1. Add Frontend Timeout with Retry Logic

**File:** `src/lib/api/apiService.ts`

```typescript
// Add timeout wrapper with retry
const TIMEOUT_MS = 60000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export async function apiRequestWithRetry<T = any>(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
  try {
    return await apiRequest<T>(url, {
      ...options,
      signal: controller.signal
    });
  } catch (error) {
    if (retries > 0 && error.name === 'AbortError') {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return apiRequestWithRetry(url, options, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

#### 2. Increase Streaming Timeout

**File:** `src/services/proxy_router_service.py`

```python
# Line 728 - Increase timeout to 180 seconds
timeout=180.0  # 3 minutes for high-latency regions
```

#### 3. Add Session Status Polling

Instead of waiting synchronously for session creation, implement:
- Return immediately with "session_pending" status
- Frontend polls for session readiness
- Show "Connecting to AI provider..." instead of error

### Medium-Term Actions (Medium Effort, High Impact)

#### 4. Enable Redis Caching

**File:** `environments/03-morpheus_api/04-prd/terraform.tfvars`

```hcl
switches = {
  redis = true  # Enable caching
}
```

This would cache:
- API key validation (eliminates DB roundtrip per request)
- Session lookups (reduces DB load)
- Model mappings (eliminates external HTTP calls)

#### 5. Add API Gateway Regional Endpoints

Consider AWS Global Accelerator or CloudFront API Gateway integration to provide:
- Edge locations for API requests
- Anycast IP routing for lower latency
- Connection pre-warming

#### 6. Implement Optimistic Session Creation

Pre-create sessions for active users:
- Background task monitors users with recent activity
- Pre-creates sessions for popular models before expiry
- Reduces time-to-first-response significantly

### Long-Term Actions (High Effort, High Impact)

#### 7. Multi-Region API Deployment

Deploy API service in multiple regions with:
- Read replicas of RDS in AP-SOUTHEAST regions
- Session data replication or regional session management
- Proxy router integration from regional endpoints

#### 8. WebSocket-Based Chat

Replace HTTP streaming with persistent WebSocket connections:
- Eliminates connection overhead per message
- Enables bi-directional heartbeats
- Better handles high-latency networks with keepalives

---

## Diagnostic Commands

### Check Latency from User Location

```bash
# Have user run:
curl -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTTFB: %{time_starttransfer}s\nTotal: %{time_total}s\n" \
  -o /dev/null -s https://api.mor.org/health
```

Expected output for Asia:
```
DNS: 0.050s
Connect: 0.250s
TTFB: 0.350s
Total: 0.400s
```

### Check Session Creation Time

```bash
# API call timing
time curl -X POST https://api.mor.org/api/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{"model":"default","messages":[{"role":"user","content":"hi"}],"stream":false}'
```

### Monitor Database Connection Pool

```sql
-- Run on RDS
SELECT count(*) as total_connections,
       count(*) FILTER (WHERE state = 'active') as active,
       count(*) FILTER (WHERE state = 'idle') as idle,
       count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
FROM pg_stat_activity
WHERE datname = 'morpheusapi';
```

### Check for Lock Contention

```sql
SELECT blocked_locks.pid AS blocked_pid,
       blocked_activity.usename AS blocked_user,
       blocking_locks.pid AS blocking_pid,
       blocking_activity.usename AS blocking_user,
       blocked_activity.query AS blocked_statement,
       blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
WHERE NOT blocked_locks.granted;
```

---

## Monitoring Recommendations

### Add CloudWatch Alarms

1. **API Latency by Region:** Track p95/p99 latency bucketed by client region
2. **Session Creation Time:** Histogram of session creation duration
3. **Database Connection Pool Usage:** Alert at 80% utilization
4. **Proxy Router Timeout Rate:** Track blockchain call failures

### Add Client-Side Metrics

```typescript
// In chat page
const startTime = performance.now();
try {
  const response = await fetch(...);
  // Log success
  analytics.track('chat_request', {
    duration_ms: performance.now() - startTime,
    model: selectedModel,
    region: navigator.language  // Rough region indicator
  });
} catch (error) {
  // Log failure
  analytics.track('chat_error', {
    duration_ms: performance.now() - startTime,
    error_type: error.name,
    model: selectedModel
  });
}
```

---

## Conclusion

The user's intermittent failures are caused by a combination of:

1. **Architectural gap:** No edge caching or regional presence for API calls
2. **Synchronous session creation:** Blocking operations that compound high-latency connections
3. **Missing resilience patterns:** No retry logic, timeouts, or optimistic UI updates
4. **Disabled caching:** Redis disabled, requiring full DB roundtrips

The "sometimes works" pattern correlates with whether a valid session already exists (fast path) versus requiring session creation (slow path with blockchain interaction).

### Immediate Priority Actions

1. ✅ Add frontend timeout and retry logic (1-2 day implementation)
2. ✅ Enable Redis caching (infrastructure change, ~1 hour)
3. ✅ Increase streaming timeout to 180s (code change, ~15 minutes)
4. ✅ Add session status polling endpoint (1 day implementation)

These changes should significantly improve the experience for high-latency users while the longer-term multi-region architecture is planned.
