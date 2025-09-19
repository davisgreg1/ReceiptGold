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

// Get receipt limits from environment variables
const getReceiptLimits = () => {
  return {
    starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
    teammate: parseInt(process.env.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
  };
};

type SubscriptionTier = 'starter' | 'growth' | 'professional' | 'teammate';

interface SubscriptionLimits {
  maxReceipts: number;
  maxBusinesses: number;
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
  starter: {
    name: "Starter",
    limits: {
      maxReceipts: getReceiptLimits().starter,
      maxBusinesses: 1,
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
      maxReceipts: getReceiptLimits().growth,
      maxBusinesses: 1,
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
      maxReceipts: getReceiptLimits().professional,
      maxBusinesses: -1,
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
  teammate: {
    name: "Teammate",
    limits: {
      maxReceipts: getReceiptLimits().teammate,
      maxBusinesses: 1,
      apiCallsPerMonth: 0,
      maxReports: -1,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: false,
      dedicatedManager: false,
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
      
    let currentTier: SubscriptionTier = 'starter';
    
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
