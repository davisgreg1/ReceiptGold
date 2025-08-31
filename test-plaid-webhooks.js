#!/usr/bin/env node

/**
 * Test script to fire Plaid webhooks using the sandbox environment
 * This script tests the bank connection notification system
 */

require('dotenv').config();

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '68a07336c483650023cffb04';
const PLAID_SECRET = process.env.PLAID_SANDBOX_SECRET || '10daff9b719e1715a913ba16f91e2d';
const PLAID_ENV = 'sandbox';

// Your Firebase Functions webhook URL (change to your project ID)
const WEBHOOK_URL = 'https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook';

// Test item ID - you'll need to create a test item first or use an existing one
const TEST_ITEM_ID = 'test_item_12345'; // Replace with a real sandbox item ID

console.log('🧪 Plaid Webhook Testing Script');
console.log('===============================');
console.log(`Environment: ${PLAID_ENV}`);
console.log(`Webhook URL: ${WEBHOOK_URL}`);
console.log(`Item ID: ${TEST_ITEM_ID}`);
console.log('');

/**
 * Fire a webhook using Plaid's sandbox API
 */
async function fireWebhook(webhookCode, additionalData = {}) {
  const url = 'https://sandbox.plaid.com/sandbox/item/fire_webhook';
  
  const payload = {
    client_id: PLAID_CLIENT_ID,
    secret: PLAID_SECRET,
    access_token: 'access-sandbox-test-token', // You'll need a real access token
    webhook_code: webhookCode,
    ...additionalData
  };

  console.log(`🔥 Firing webhook: ${webhookCode}`);
  console.log(`📤 Payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Successfully fired ${webhookCode} webhook`);
      console.log(`📥 Response:`, JSON.stringify(result, null, 2));
    } else {
      console.log(`❌ Failed to fire ${webhookCode} webhook`);
      console.log(`📥 Error:`, JSON.stringify(result, null, 2));
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error firing ${webhookCode} webhook:`, error);
    return null;
  }
}

/**
 * Test webhook directly to your Firebase Function (bypass Plaid)
 * This is useful when you don't have a valid access token yet
 */
async function testWebhookDirect(webhookType, webhookCode, additionalData = {}) {
  console.log(`🎯 Testing webhook directly: ${webhookType} - ${webhookCode}`);
  
  const payload = {
    webhook_type: webhookType,
    webhook_code: webhookCode,
    item_id: TEST_ITEM_ID,
    environment: PLAID_ENV,
    ...additionalData
  };

  console.log(`📤 Direct payload:`, JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.text();
    
    if (response.ok) {
      console.log(`✅ Direct webhook test successful`);
      console.log(`📥 Response:`, result);
    } else {
      console.log(`❌ Direct webhook test failed`);
      console.log(`📥 Error response:`, result);
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Error testing direct webhook:`, error);
    return null;
  }
}

/**
 * Run all webhook tests
 */
async function runTests() {
  console.log('🚀 Starting Plaid webhook tests...\n');

  // Test 1: PENDING_EXPIRATION (Medium priority notification)
  console.log('📝 Test 1: Connection Expiring Soon');
  console.log('Expected: Medium priority push notification with 7-day warning');
  await testWebhookDirect('ITEM', 'PENDING_EXPIRATION');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
  console.log('');

  // Test 2: ERROR (High priority notification)
  console.log('📝 Test 2: Connection Error');
  console.log('Expected: High priority push notification requiring immediate action');
  await testWebhookDirect('ITEM', 'ERROR', {
    error: {
      error_type: 'ITEM_ERROR',
      error_code: 'ITEM_LOGIN_REQUIRED',
      display_message: 'The login details of this item have changed (credentials, MFA, or required user action) and a user login is required to update this information.',
      suggested_action: 'Please have the user reconnect their account.'
    }
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Test 3: USER_PERMISSION_REVOKED (High priority notification)
  console.log('📝 Test 3: Permissions Revoked');
  console.log('Expected: High priority push notification for revoked permissions');
  await testWebhookDirect('ITEM', 'USER_PERMISSION_REVOKED');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Test 4: NEW_ACCOUNTS_AVAILABLE (Medium priority, optional action)
  console.log('📝 Test 4: New Accounts Available');
  console.log('Expected: Medium priority notification, no immediate action required');
  await testWebhookDirect('ITEM', 'NEW_ACCOUNTS_AVAILABLE');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Test 5: LOGIN_REPAIRED (Good news, low priority)
  console.log('📝 Test 5: Connection Auto-Repaired');
  console.log('Expected: Low priority positive notification, no action needed');
  await testWebhookDirect('ITEM', 'LOGIN_REPAIRED');
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  // Test 6: Transaction webhook (should create transaction update)
  console.log('📝 Test 6: New Transactions Available');
  console.log('Expected: Create transaction update record, no push notification');
  await testWebhookDirect('TRANSACTIONS', 'INITIAL_UPDATE', {
    new_transactions: 5,
    removed_transactions: []
  });
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('');

  console.log('✨ All webhook tests completed!');
  console.log('\n📱 Check your phone for push notifications');
  console.log('🔍 Check Firebase Functions logs: firebase functions:log');
  console.log('🗄️  Check Firestore for connection_notifications collection');
}

/**
 * Test specific webhook
 */
async function testSpecificWebhook(type, code) {
  console.log(`🎯 Testing specific webhook: ${type} - ${code}`);
  await testWebhookDirect(type, code);
}

// Command line interface
const args = process.argv.slice(2);

if (args.length === 0) {
  // Run all tests
  runTests().catch(console.error);
} else if (args.length === 2) {
  // Test specific webhook
  const [type, code] = args;
  testSpecificWebhook(type.toUpperCase(), code.toUpperCase()).catch(console.error);
} else {
  console.log('Usage:');
  console.log('  Run all tests: node test-plaid-webhooks.js');
  console.log('  Test specific: node test-plaid-webhooks.js ITEM PENDING_EXPIRATION');
  console.log('');
  console.log('Available webhook codes:');
  console.log('  ITEM webhooks: PENDING_EXPIRATION, ERROR, USER_PERMISSION_REVOKED, NEW_ACCOUNTS_AVAILABLE, LOGIN_REPAIRED');
  console.log('  TRANSACTIONS webhooks: INITIAL_UPDATE, HISTORICAL_UPDATE, DEFAULT_UPDATE, TRANSACTIONS_REMOVED');
  process.exit(1);
}

module.exports = {
  fireWebhook,
  testWebhookDirect,
  runTests
};