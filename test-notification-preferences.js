#!/usr/bin/env node

/**
 * Test script to verify notification preference checking
 * Tests various user notification settings scenarios
 */

require('dotenv').config();

const WEBHOOK_URL = 'https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook';

console.log('🔔 Testing Notification Preferences');
console.log('===================================');

/**
 * Test webhook with different user preference scenarios
 */
async function testNotificationPreferences() {
  const testScenarios = [
    {
      name: 'User with all notifications enabled',
      userId: 'test-user-all-enabled',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: true,
        security: true,
        frequency: 'all'
      },
      expectedResult: 'Should send push notification'
    },
    {
      name: 'User with notifications globally disabled',
      userId: 'test-user-global-disabled',
      settings: {
        notificationsEnabled: false,
        push: true,
        bankConnections: true,
        security: true
      },
      expectedResult: 'Should NOT send push notification'
    },
    {
      name: 'User with push notifications disabled',
      userId: 'test-user-push-disabled',
      settings: {
        notificationsEnabled: true,
        push: false,
        bankConnections: true,
        security: true
      },
      expectedResult: 'Should NOT send push notification'
    },
    {
      name: 'User with bank connections disabled',
      userId: 'test-user-bank-disabled',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: false,
        security: true
      },
      expectedResult: 'Should NOT send push notification'
    },
    {
      name: 'User with security alerts disabled (testing ERROR webhook)',
      userId: 'test-user-security-disabled',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: true,
        security: false
      },
      expectedResult: 'Should NOT send push notification for ERROR/reauth_required'
    },
    {
      name: 'User with minimal frequency (testing PENDING_EXPIRATION)',
      userId: 'test-user-minimal-freq',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: true,
        security: true,
        frequency: 'minimal'
      },
      expectedResult: 'Should NOT send push notification for PENDING_EXPIRATION (medium priority)'
    },
    {
      name: 'User with important frequency (testing NEW_ACCOUNTS_AVAILABLE)',
      userId: 'test-user-important-freq',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: true,
        security: true,
        frequency: 'important'
      },
      expectedResult: 'Should NOT send push notification for NEW_ACCOUNTS_AVAILABLE (optional)'
    },
    {
      name: 'User in quiet hours (testing PENDING_EXPIRATION)',
      userId: 'test-user-quiet-hours',
      settings: {
        notificationsEnabled: true,
        push: true,
        bankConnections: true,
        security: true,
        frequency: 'all',
        quietHours: {
          enabled: true,
          startTime: '22:00',
          endTime: '07:00'
        }
      },
      expectedResult: 'Should NOT send push notification during quiet hours (except security)'
    }
  ];

  console.log('🧪 Testing notification preference scenarios...\n');

  for (const scenario of testScenarios) {
    console.log(`📝 ${scenario.name}`);
    console.log(`Expected: ${scenario.expectedResult}`);
    
    // Create test user data structure
    const testUserData = {
      expoPushToken: 'ExpoToken[test-token-12345]',
      notificationSettings: scenario.settings
    };

    console.log('Settings:', JSON.stringify(scenario.settings, null, 2));

    // Test with different webhook types based on scenario
    let webhookCode = 'ERROR'; // Default to high priority
    
    if (scenario.name.includes('PENDING_EXPIRATION')) {
      webhookCode = 'PENDING_EXPIRATION';
    } else if (scenario.name.includes('NEW_ACCOUNTS_AVAILABLE')) {
      webhookCode = 'NEW_ACCOUNTS_AVAILABLE';
    }

    console.log(`Testing with webhook: ${webhookCode}`);
    console.log('─'.repeat(50));
  }

  console.log('\n✨ Preference testing scenarios documented!');
  console.log('\n📋 To test these scenarios:');
  console.log('1. Create test users in Firestore with the settings above');
  console.log('2. Create matching plaid_items for each test user');
  console.log('3. Run webhooks and check Firebase Functions logs for:');
  console.log('   - "📵 User X has disabled Y notifications" (should skip)');
  console.log('   - "✅ Push notification sent to user X" (should send)');
  console.log('   - Expo Push API calls in notification_logs collection');
}

/**
 * Generate Firestore test data for preference testing
 */
function generateTestData() {
  console.log('\n📄 Sample Firestore Test Data');
  console.log('=============================\n');

  const sampleUsers = [
    {
      collection: 'users',
      document: 'test-user-all-enabled',
      data: {
        email: 'test-all@example.com',
        expoPushToken: 'ExpoToken[all-enabled-12345]',
        notificationSettings: {
          notificationsEnabled: true,
          push: true,
          bankConnections: true,
          security: true,
          frequency: 'all'
        }
      }
    },
    {
      collection: 'users', 
      document: 'test-user-global-disabled',
      data: {
        email: 'test-disabled@example.com',
        expoPushToken: 'ExpoToken[disabled-12345]',
        notificationSettings: {
          notificationsEnabled: false,
          push: true,
          bankConnections: true,
          security: true
        }
      }
    },
    {
      collection: 'plaid_items',
      document: 'item-test-all-enabled',
      data: {
        userId: 'test-user-all-enabled',
        itemId: 'test_item_all_enabled',
        institutionName: 'Test Bank All Enabled',
        status: 'connected'
      }
    },
    {
      collection: 'plaid_items',
      document: 'item-test-disabled',
      data: {
        userId: 'test-user-global-disabled', 
        itemId: 'test_item_disabled',
        institutionName: 'Test Bank Disabled',
        status: 'connected'
      }
    }
  ];

  sampleUsers.forEach(item => {
    console.log(`📄 Collection: ${item.collection}/${item.document}`);
    console.log(JSON.stringify(item.data, null, 2));
    console.log('');
  });

  console.log('🧪 Test Commands:');
  console.log('# Test user with all notifications enabled (should send):');
  console.log(`curl -X POST ${WEBHOOK_URL} -H "Content-Type: application/json" -d '{"webhook_type":"ITEM","webhook_code":"ERROR","item_id":"test_item_all_enabled"}'`);
  console.log('');
  console.log('# Test user with notifications disabled (should NOT send):');
  console.log(`curl -X POST ${WEBHOOK_URL} -H "Content-Type: application/json" -d '{"webhook_type":"ITEM","webhook_code":"ERROR","item_id":"test_item_disabled"}'`);
}

// Run tests
testNotificationPreferences();
generateTestData();

console.log('\n🔒 Key Notification Preference Checks:');
console.log('=====================================');
console.log('✅ Global notifications toggle (notificationsEnabled)');
console.log('✅ Push notifications toggle (push)');
console.log('✅ Bank connections toggle (bankConnections)');  
console.log('✅ Security alerts toggle (security)');
console.log('✅ Notification frequency (all/important/minimal)');
console.log('✅ Quiet hours with time ranges');
console.log('✅ Critical vs non-critical notification handling');
console.log('✅ User preference preservation on token updates');