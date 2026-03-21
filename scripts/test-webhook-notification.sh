#!/bin/bash

# Test script for Coinbase Business Payment Link notification webhook endpoint
# Usage: ./scripts/test-webhook-notification.sh [base_url] [user_id]

BASE_URL="${1:-http://localhost:3000}"
USER_ID="${2:-test-user-123}"
PAYMENT_LINK_ID="test-pl-$(date +%s)"

echo "Testing Coinbase Business Payment Link Notification Webhook"
echo "============================================================"
echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo "Payment Link ID: $PAYMENT_LINK_ID"
echo ""

# Test 1: Simulate Payment Link webhook POST (payment_link.payment.success)
echo "Test 1: Sending payment_link.payment.success webhook..."
WEBHOOK_PAYLOAD=$(cat <<EOF
{
  "event_type": "payment_link.payment.success",
  "data": {
    "id": "$PAYMENT_LINK_ID",
    "metadata": {
      "user_id": "$USER_ID"
    },
    "amount": "10.00",
    "currency": "USDC",
    "status": "COMPLETED"
  }
}
EOF
)

WEBHOOK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/webhooks/coinbase-notification" \
  -H "Content-Type: application/json" \
  -d "$WEBHOOK_PAYLOAD")

echo "Response: $WEBHOOK_RESPONSE"
echo ""

# Test 2: Poll for notifications
echo "Test 2: Polling for notifications..."
sleep 1
POLL_RESPONSE=$(curl -s "$BASE_URL/api/webhooks/coinbase-notification?userId=$USER_ID")
echo "Response: $POLL_RESPONSE"
echo ""

# Test 3: Poll again (should be empty)
echo "Test 3: Polling again (should be empty)..."
sleep 1
POLL_RESPONSE2=$(curl -s "$BASE_URL/api/webhooks/coinbase-notification?userId=$USER_ID")
echo "Response: $POLL_RESPONSE2"
echo ""

echo "============================================================"
echo "Test complete!"
echo ""
echo "Expected results:"
echo "- Test 1: {\"received\":true}"
echo "- Test 2: {\"notifications\":[{...status:confirmed...}],\"count\":1}"
echo "- Test 3: {\"notifications\":[],\"count\":0}"
