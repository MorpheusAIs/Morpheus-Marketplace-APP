# PayRam billing backend integration plan

The billing page now starts PayRam checkout sessions for USDC payments on Base with a minimum amount of 10 USDC. The frontend route `POST /api/payram/payment` calls the configured PayRam node and sends `customer_id` as the Cognito user id so the backend can reconcile the payment to the correct user.

## Frontend-facing payment creation

Required deployment variables:

```env
PAYRAM_BASE_URL=https://your-payram-node.com
PAYRAM_API_KEY=pr_live_xxxxxxxxxxxxx
PAYRAM_WEBHOOK_SECRET=your_payram_webhook_secret_here
```

The billing UI sends:

```json
{
  "amount": "10.00",
  "currency": "USDC",
  "chain": "base",
  "customerId": "<cognito-sub>"
}
```

The PayRam payment response is expected to include a hosted `url`. The frontend opens that URL and then relies on the backend webhook path below to credit the user and make the updated balance visible through the existing `/billing/balance` API.

## Backend API webhook endpoint

Add a backend endpoint such as:

```text
POST /api/v1/webhooks/payram
```

Configure the PayRam dashboard/node to deliver webhooks to the dev and production backend API URLs, not to the frontend app. The handler must read the raw request body and verify `X-PayRam-Signature` using `PAYRAM_WEBHOOK_SECRET` before parsing JSON. PayRam signs the raw body with HMAC-SHA256. The handler should also store `X-PayRam-Delivery` for idempotency because PayRam retries failed webhook deliveries.

Expected PayRam payload fields:

```json
{
  "event": "payment.confirmed",
  "reference_id": "mor_<cognito-sub>_<timestamp>",
  "customer_id": "<cognito-sub>",
  "amount": 10.0,
  "currency": "USDC",
  "chain": "base",
  "status": "Confirmed",
  "tx_hash": "0x...",
  "confirmed_at": "2026-04-18T12:35:01Z"
}
```

## Balance crediting requirements

On `payment.confirmed`, the backend should:

1. Verify the signature against the raw request body.
2. Reject unsupported assets unless `currency === "USDC"` and `chain === "base"`.
3. Enforce `amount >= 10` before crediting.
4. Use `X-PayRam-Delivery` or `tx_hash + event` as an idempotency key with a database unique constraint.
5. Resolve the user from `customer_id` and reject missing or unknown users without crediting.
6. Insert a credit ledger entry for the exact PayRam amount and mark the provider as `payram`.
7. Store `reference_id`, `tx_hash`, `from_address`, `to_address`, `amount`, `currency`, `chain`, and `confirmed_at` for audit/reconciliation.
8. Return a 2xx response only after the credit operation is durably recorded.

PayRam retry timing is documented as `30m, 1h, 2h, 4h, 8h, 24h, 48h`, so the idempotency record should be retained for at least seven days.

## Frontend balance update after payment

The frontend already invalidates/refetches billing balance data after a successful payment redirect and when payment notifications are received. Once the backend webhook credits the user, `/api/v1/billing/balance` should return the updated paid balance. If the backend supports realtime or notification polling, add a PayRam notification source equivalent to the existing payment notification flow so the frontend can dismiss the pending toast when `payment.confirmed` arrives.

Until that notification source is wired, users can return to `/billing?payment=success`; the page shows the confirmation state and refetches billing balance, but the updated amount will appear only after the backend webhook has processed and the balance endpoint reflects the new ledger entry.
