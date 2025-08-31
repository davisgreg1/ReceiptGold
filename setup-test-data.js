#!/usr/bin/env node

/**
 * Script to set up test data for Plaid webhook testing
 * Creates test user and Plaid item in Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
try {
  const serviceAccountPath = path.join(__dirname, 'functions', 'receiptgold-firebase-adminsdk.json');
  const serviceAccount = require(serviceAccountPath);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://receiptgold-default-rtdb.firebaseio.com'
  });
  
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('💡 Make sure you have the service account key at functions/receiptgold-firebase-adminsdk.json');
  process.exit(1);
}

const db = admin.firestore();

// Test data
const TEST_USER_ID = 'test-user-webhook-demo';
const TEST_ITEM_ID = 'test_item_webhook_demo';
const TEST_EXPO_TOKEN = 'ExpoToken[webhook-test-token-replace-with-real]';

async function createTestUser() {
  console.log('📝 Creating test user...');
  
  const userData = {
    email: 'webhook-test@receiptgold.com',
    displayName: 'Webhook Test User',
    expoPushToken: TEST_EXPO_TOKEN,
    notificationSettings: {
      push: true,
      bankConnections: true,
      receipts: true,
      security: true
    },
    settings: {
      notifications: {
        push: true
      }
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isTestUser: true
  };

  try {
    await db.collection('users').doc(TEST_USER_ID).set(userData);
    console.log('✅ Test user created:', TEST_USER_ID);
  } catch (error) {
    console.error('❌ Error creating test user:', error);
  }
}

async function createTestPlaidItem() {
  console.log('📝 Creating test Plaid item...');
  
  const itemData = {
    userId: TEST_USER_ID,
    itemId: TEST_ITEM_ID,
    institutionId: 'ins_109508', // Chase Bank
    institutionName: 'Chase Bank',
    accessToken: 'access-sandbox-test-token-webhook-demo',
    status: 'connected',
    active: true,
    needsReauth: false,
    accounts: [
      {
        accountId: 'test_account_checking',
        name: 'Chase Total Checking',
        type: 'depository',
        subtype: 'checking',
        mask: '1234',
        currency: 'USD',
        selected: true
      },
      {
        accountId: 'test_account_savings', 
        name: 'Chase Savings',
        type: 'depository',
        subtype: 'savings',
        mask: '5678',
        currency: 'USD',
        selected: true
      }
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    isTestItem: true
  };

  try {
    await db.collection('plaid_items').doc().set(itemData);
    console.log('✅ Test Plaid item created:', TEST_ITEM_ID);
  } catch (error) {
    console.error('❌ Error creating test Plaid item:', error);
  }
}

async function cleanupTestData() {
  console.log('🧹 Cleaning up existing test data...');
  
  try {
    // Delete test user
    await db.collection('users').doc(TEST_USER_ID).delete();
    console.log('🗑️ Deleted test user');
  } catch (error) {
    console.log('ℹ️ No test user to delete');
  }

  try {
    // Delete test Plaid items
    const itemsSnapshot = await db.collection('plaid_items')
      .where('itemId', '==', TEST_ITEM_ID)
      .get();
    
    const batch = db.batch();
    itemsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    if (!itemsSnapshot.empty) {
      await batch.commit();
      console.log('🗑️ Deleted test Plaid items');
    }
  } catch (error) {
    console.log('ℹ️ No test Plaid items to delete');
  }

  try {
    // Delete test notifications
    const notificationsSnapshot = await db.collection('connection_notifications')
      .where('userId', '==', TEST_USER_ID)
      .get();
    
    const batch2 = db.batch();
    notificationsSnapshot.docs.forEach(doc => {
      batch2.delete(doc.ref);
    });
    
    if (!notificationsSnapshot.empty) {
      await batch2.commit();
      console.log('🗑️ Deleted test notifications');
    }
  } catch (error) {
    console.log('ℹ️ No test notifications to delete');
  }
}

async function setupTestData() {
  console.log('🧪 Setting up Plaid webhook test data');
  console.log('=====================================');
  
  await cleanupTestData();
  await createTestUser();
  await createTestPlaidItem();
  
  console.log('');
  console.log('✨ Test data setup complete!');
  console.log('');
  console.log('📋 Next steps:');
  console.log('1. Update the TEST_EXPO_TOKEN with a real Expo push token');
  console.log('2. Run: node test-plaid-webhooks.js');
  console.log('3. Check your phone for push notifications');
  console.log('');
  console.log('📱 To get a real Expo token:');
  console.log('1. Run your app on a device');
  console.log('2. Check the console logs for "Expo Push Token: ExpoToken[...]"');
  console.log('3. Copy that token and update the user document in Firestore');
  
  process.exit(0);
}

// Command line interface
const args = process.argv.slice(2);

if (args[0] === 'cleanup') {
  cleanupTestData().then(() => {
    console.log('✅ Cleanup complete');
    process.exit(0);
  }).catch(console.error);
} else {
  setupTestData().catch(console.error);
}