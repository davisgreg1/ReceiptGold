import * as admin from 'firebase-admin';

import * as path from 'path';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    // Import serviceAccountKey.json synchronously using require
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'receiptgold-467121'
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();

type SubscriptionTier = 'free' | 'starter' | 'growth' | 'professional';

interface SubscriptionLimits {
  maxReceipts: number;
  maxBusinesses: number;
  storageLimit: number;
  apiCallsPerMonth: number;
  maxReports: number;
}

interface TierConfig {
  name: string;
  limits: SubscriptionLimits;
}

interface SubscriptionDocument {
  userId: string;
  currentTier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  billing: {
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    currentPeriodStart: any;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
    lastPaymentStatus?: string;
    lastPaymentDate?: Date;
    lastInvoiceId?: string;
  };
  limits: TierConfig['limits'];
  features: {
    advancedReporting: boolean;
    taxPreparation: boolean;
    accountingIntegrations: boolean;
    prioritySupport: boolean;
    multiBusinessManagement: boolean;
    whiteLabel: boolean;
    apiAccess: boolean;
    dedicatedManager: boolean;
  };
  history: Array<{
    tier: string;
    startDate: Date;
    endDate: Date | null;
    reason: string;
  }>;
  createdAt: any;
  updatedAt: any;
}

const subscriptionTiers: Record<SubscriptionTier, TierConfig & { features: SubscriptionDocument['features'] }> = {
  free: {
    name: "Free",
    limits: {
      maxReceipts: 10,
      maxBusinesses: 1,
      storageLimit: 104857600, // 100 MB
      apiCallsPerMonth: 0,
      maxReports: 3,
    },
    features: {
      advancedReporting: false,
      taxPreparation: false,
      accountingIntegrations: false,
      prioritySupport: false,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: false,
      dedicatedManager: false,
    }
  },
  starter: {
    name: "Starter",
    limits: {
      maxReceipts: -1, // unlimited
      maxBusinesses: 1,
      storageLimit: -1, // unlimited
      apiCallsPerMonth: 0,
      maxReports: 10,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: false,
      prioritySupport: false,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: false,
      dedicatedManager: false,
    }
  },
  growth: {
    name: "Growth",
    limits: {
      maxReceipts: -1,
      maxBusinesses: 3,
      storageLimit: -1,
      apiCallsPerMonth: 1000,
      maxReports: 50,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: true,
      whiteLabel: false,
      apiAccess: true,
      dedicatedManager: false,
    }
  },
  professional: {
    name: "Professional",
    limits: {
      maxReceipts: -1,
      maxBusinesses: -1,
      storageLimit: -1,
      apiCallsPerMonth: 10000,
      maxReports: -1,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: true,
      whiteLabel: true,
      apiAccess: true,
      dedicatedManager: true,
    }
  },
};

async function initializeUsageCollection() {
  try {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const batch = db.batch();

    // First, check if the users collection exists and has any users
    const usersSnapshot = await db.collection('users').limit(1).get();
    
    if (usersSnapshot.empty) {
      // Create a test user if no users exist
      console.log('No users found. Creating a test user...');
      const testUserId = 'testUser123';
      await db.collection('users').doc(testUserId).set({
        email: 'test@example.com',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Test user created successfully');
      
      // Use the test user ID for initializing usage
      const userId = testUserId;

      // Get user's subscription
      // Initialize subscription if it doesn't exist
      const subscriptionRef = db.collection('subscriptions').doc(userId);
      const subscriptionDoc = await subscriptionRef.get();
      
    let currentTier: SubscriptionTier = 'free';
    
    if (!subscriptionDoc.exists) {
      console.log(`Creating subscription for user ${userId}...`);
      const newSubscription: SubscriptionDocument = {
        userId,
        currentTier,
        status: 'active',
        billing: {
          customerId: null,
          subscriptionId: null,
          priceId: null,
          currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
        },
        limits: subscriptionTiers[currentTier].limits,
        features: subscriptionTiers[currentTier].features,
        history: [{
          tier: currentTier,
          startDate: new Date(),
          endDate: null,
          reason: 'Initial subscription'
        }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await subscriptionRef.set(newSubscription);
      console.log('Subscription created successfully');
    } else {
      const subscriptionData = subscriptionDoc.data() as SubscriptionDocument;
      currentTier = subscriptionData.currentTier;
      
      // Update the subscription to ensure it has all required fields
      const updateData = {
        limits: subscriptionTiers[currentTier].limits,
        features: subscriptionTiers[currentTier].features,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await subscriptionRef.update(updateData);
      console.log(`Updated subscription for user ${userId}`);
    }      // Create usage document for current month
      const usageRef = db.collection('usage').doc(`${userId}_${currentMonth}`);
      const usageDoc = {
        userId,
        month: currentMonth,
        receiptsUploaded: 0,
        storageUsed: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: subscriptionTiers[currentTier].limits,
        resetDate: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1
        ).toISOString(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      batch.set(usageRef, usageDoc, { merge: true });
    }

    await batch.commit();
    console.log('✅ Successfully initialized usage documents for all users');

  } catch (error) {
    console.error('Error initializing usage collection:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    throw error; // Re-throw to trigger the catch block below
  }
}

// Run the initialization
initializeUsageCollection()
  .then(() => {
    console.log('Usage collection initialization completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to initialize usage collection:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  });
