// Quick test script to add sample data to Firestore
const admin = require('firebase-admin');

// Initialize Firebase Admin (using application default credentials)
admin.initializeApp({
  projectId: 'receiptgold'
});

const db = admin.firestore();

async function addSampleData() {
  try {
    // Add a test user
    const userRef = await db.collection('users').doc('test-user-123').set({
      userId: 'test-user-123',
      email: 'test@receiptgold.com',
      displayName: 'Test User',
      profile: {
        firstName: 'Test',
        lastName: 'User',
        businessName: 'Test LLC',
        businessType: 'LLC',
        phone: '+1-555-0123',
        address: {
          street: '123 Test St',
          city: 'Test City',
          state: 'TX',
          zipCode: '12345',
          country: 'US'
        }
      },
      settings: {
        theme: 'dark',
        notifications: {
          email: true,
          push: true,
          taxReminders: true,
          receiptReminders: true
        },
        defaultCurrency: 'USD',
        taxYear: 2025
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Add a test subscription
    await db.collection('subscriptions').doc('test-user-123').set({
      userId: 'test-user-123',
      currentTier: 'free',
      status: 'active',
      billing: {
        customerId: null,
        subscriptionId: null,
        priceId: null,
        currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        trialEnd: null
      },
      limits: {
        maxReceipts: 10,
        maxBusinesses: 1,
        storageLimit: 104857600,
        apiCallsPerMonth: 0,
        maxReports: 3
      },
      features: {
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false
      },
      history: [{
        tier: 'free',
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: null,
        reason: 'initial_signup'
      }],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Add a test receipt
    await db.collection('receipts').add({
      userId: 'test-user-123',
      vendor: 'Office Depot',
      amount: 45.99,
      currency: 'USD',
      date: '2025-07-26',
      description: 'Office supplies - pens, paper',
      category: 'Office Supplies',
      subcategory: 'Stationery',
      tags: ['office', 'supplies', 'business'],
      images: [{
        url: 'https://example.com/receipt1.jpg',
        thumbnail: 'https://example.com/receipt1_thumb.jpg',
        size: 256000,
        uploadedAt: new Date()
      }],
      extractedData: {
        vendor: 'Office Depot',
        amount: 45.99,
        tax: 3.68,
        date: '2025-07-26',
        confidence: 0.95,
        items: [{
          description: 'Ballpoint pens (pack of 12)',
          amount: 12.99,
          quantity: 1
        }, {
          description: 'Copy paper (500 sheets)',
          amount: 29.32,
          quantity: 1
        }]
      },
      tax: {
        deductible: true,
        deductionPercentage: 100,
        taxYear: 2025,
        category: 'Business Expense'
      },
      status: 'processed',
      processingErrors: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('✅ Sample data added successfully!');
    console.log('Check your Firestore console: https://console.firebase.google.com/project/receiptgold/firestore');
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error);
  }
}

addSampleData();
