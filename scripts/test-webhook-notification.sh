#!/bin/bash

# Test script for Coinbase notification webhook endpoint
# Usage: ./scripts/test-webhook-notification.sh [base_url] [user_id]

BASE_URL="${1:-http://localhost:3000}"
USER_ID="${2:-test-user-123}"
CHARGE_ID="test-charge-$(date +%s)"

echo "Testing Coinbase Notification Webhook"
echo "======================================"
echo "Base URL: $BASE_URL"
echo "User ID: $USER_ID"
echo "Charge ID: $CHARGE_ID"
echo ""

# Test 1: Simulate Coinbase webhook POST
echo "Test 1: Sending webhook notification..."
WEBHOOK_PAYLOAD=$(cat <<EOF
{
  "event": {
    "type": "charge:confirmed",
    "data": {
      "id": "$CHARGE_ID",
      "code": "TESTCODE",
      "metadata": {
        "user_id": "$USER_ID"
      },
      "payments": [{
        "value": {
          "local": {
            "amount": "10.00",
            "currency": "USD"
          }
        }
      }]
    }
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

echo "======================================"
echo "Test complete!"
echo ""
echo "Expected results:"
echo "- Test 1: {\"received\":true}"
echo "- Test 2: {\"notifications\":[{...}],\"count\":1}"
echo "- Test 3: {\"notifications\":[],\"count\":0}"
