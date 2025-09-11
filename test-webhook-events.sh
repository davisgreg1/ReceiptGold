#!/bin/bash

# RevenueCat Webhook Test Suite
# Tests different event types to ensure proper handling

WEBHOOK_URL="https://us-central1-receiptgold.cloudfunctions.net/revenueCatWebhookHandler"
AUTH_HEADER="Authorization: Bearer fWSJsTGrt8evpCirj0WFOYl9cRCyojb7dHORrvnudpE="
CONTENT_TYPE="Content-Type: application/json"
TIMESTAMP=$(date +%s)000

echo "🔔 Testing RevenueCat Webhook Events"
echo "======================================"

# Test 1: INITIAL_PURCHASE - Growth Monthly
echo ""
echo "1️⃣ Testing INITIAL_PURCHASE (Growth Monthly)"
echo "----------------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"INITIAL_PURCHASE\",
      \"event_timestamp_ms\": $TIMESTAMP,
      \"product_id\": \"rc_growth_monthly\",
      \"original_app_user_id\": \"test_user_initial\",
      \"app_user_id\": \"test_user_initial\",
      \"aliases\": [\"test_user_initial\"],
      \"entitlement_ids\": [\"Pro\"],
      \"environment\": \"SANDBOX\",
      \"store\": \"APP_STORE\",
      \"currency\": \"USD\",
      \"price\": 19.00,
      \"transaction_id\": \"test_txn_initial_001\"
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""

# Test 2: PRODUCT_CHANGE - Professional to Starter  
echo "2️⃣ Testing PRODUCT_CHANGE (Professional → Starter)"
echo "---------------------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"PRODUCT_CHANGE\",
      \"event_timestamp_ms\": $((TIMESTAMP + 60000)),
      \"product_id\": \"rc_professional_annual\",
      \"new_product_id\": \"rc_starter\",
      \"original_app_user_id\": \"test_user_change\",
      \"app_user_id\": \"test_user_change\",
      \"aliases\": [\"test_user_change\"],
      \"entitlement_ids\": [\"Pro\"],
      \"environment\": \"SANDBOX\",
      \"store\": \"APP_STORE\",
      \"currency\": \"USD\",
      \"price\": 9.00,
      \"transaction_id\": \"test_txn_change_001\"
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""

# Test 3: RENEWAL - Growth Annual
echo "3️⃣ Testing RENEWAL (Growth Annual)"
echo "-----------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"RENEWAL\",
      \"event_timestamp_ms\": $((TIMESTAMP + 120000)),
      \"product_id\": \"rc_growth_annual\",
      \"original_app_user_id\": \"test_user_renewal\",
      \"app_user_id\": \"test_user_renewal\",
      \"aliases\": [\"test_user_renewal\"],
      \"entitlement_ids\": [\"Pro\"],
      \"environment\": \"SANDBOX\",
      \"store\": \"APP_STORE\",
      \"currency\": \"USD\",
      \"price\": 190.00,
      \"transaction_id\": \"test_txn_renewal_001\",
      \"renewal_number\": 2
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""

# Test 4: CANCELLATION
echo "4️⃣ Testing CANCELLATION"
echo "------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"CANCELLATION\",
      \"event_timestamp_ms\": $((TIMESTAMP + 180000)),
      \"product_id\": \"rc_professional_monthly\",
      \"original_app_user_id\": \"test_user_cancel\",
      \"app_user_id\": \"test_user_cancel\",
      \"aliases\": [\"test_user_cancel\"],
      \"entitlement_ids\": [\"Pro\"],
      \"environment\": \"SANDBOX\",
      \"store\": \"APP_STORE\",
      \"currency\": \"USD\",
      \"price\": 39.00,
      \"transaction_id\": \"test_txn_cancel_001\"
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""

# Test 5: NON_RENEWING_PURCHASE - Starter
echo "5️⃣ Testing NON_RENEWING_PURCHASE (Starter)"
echo "-------------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "$AUTH_HEADER" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"NON_RENEWING_PURCHASE\",
      \"event_timestamp_ms\": $((TIMESTAMP + 240000)),
      \"product_id\": \"rc_starter\",
      \"original_app_user_id\": \"test_user_nonrenew\",
      \"app_user_id\": \"test_user_nonrenew\",
      \"aliases\": [\"test_user_nonrenew\"],
      \"entitlement_ids\": [\"Pro\"],
      \"environment\": \"SANDBOX\",
      \"store\": \"APP_STORE\",
      \"currency\": \"USD\",
      \"price\": 9.00,
      \"transaction_id\": \"test_txn_nonrenew_001\"
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""

# Test 6: Test Invalid Auth (should fail)
echo "6️⃣ Testing Invalid Authorization (should fail)"
echo "-----------------------------------------------"
curl -X POST "$WEBHOOK_URL" \
  -H "Authorization: Bearer invalid_token" \
  -H "$CONTENT_TYPE" \
  -d "{
    \"event\": {
      \"type\": \"INITIAL_PURCHASE\",
      \"event_timestamp_ms\": $TIMESTAMP,
      \"product_id\": \"rc_growth_monthly\",
      \"original_app_user_id\": \"test_user_invalid\"
    },
    \"api_version\": \"1.0\"
  }"

echo ""
echo ""
echo "✅ All webhook tests completed!"
echo "Check Firebase Functions logs to see the processing results."