// functions/scripts/setupTestUser.ts
// Complete TypeScript script to create test user with sample data

import * as admin from "firebase-admin";
import * as path from "path";
import { initializeMasterCategories } from "./initializeCategories";

// Load service account key
const serviceAccount = require(path.join(
  __dirname,
  "../db/ReceiptGoldAdminReceipt.json"
));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

// Type definitions
interface TestUserConfig {
  userId: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  taxId: string;
  phone: string;
}

interface UserAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface SubscriptionLimits {
  maxReceipts: number;
  maxBusinesses: number;
  storageLimit: number;
  apiCallsPerMonth: number;
  maxReports: number;
}

interface SubscriptionFeatures {
  advancedReporting: boolean;
  taxPreparation: boolean;
  accountingIntegrations: boolean;
  prioritySupport: boolean;
  multiBusinessManagement: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  dedicatedManager: boolean;
}

interface SubscriptionTier {
  name: string;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
}

interface SampleReceipt {
  vendor: string;
  amount: number;
  currency: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
}

interface BusinessData {
  name: string;
  type: string;
  taxId: string;
  industry: string;
  address: UserAddress;
}

interface ExtractedItem {
  description: string;
  amount: number;
  quantity: number;
}

interface ExtractedData {
  vendor: string;
  amount: number;
  tax: number;
  date: string;
  confidence: number;
  items: ExtractedItem[];
}

interface TaxInfo {
  deductible: boolean;
  deductionPercentage: number;
  taxYear: number;
  category: string;
}

interface ReceiptDocument {
  userId: string;
  businessId: string | null;
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
  images: any[];
  extractedData: ExtractedData;
  tax: TaxInfo;
  status: string;
  processingErrors: string[];
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

interface SetupResult {
  success: boolean;
  data: {
    userId: string;
    businessIds: string[];
    receiptIds: string[];
    totalExpenses: number;
  };
}

// Test User Configuration
const TEST_USER_CONFIG: TestUserConfig = {
  userId: "test-user-12345",
  email: "testuser@receiptgold.com",
  displayName: "John Test User",
  firstName: "John",
  lastName: "Doe",
  businessName: "Test Business LLC",
  businessType: "LLC",
  taxId: "12-3456789",
  phone: "+1-555-0123",
};

// Subscription tiers
const subscriptionTiers: Record<string, SubscriptionTier> = {
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
    },
  },
};

// Sample business data
const SAMPLE_BUSINESSES: BusinessData[] = [
  {
    name: "Test Consulting LLC",
    type: "LLC",
    taxId: "98-7654321",
    industry: "consulting",
    address: {
      street: "456 Business Ave",
      city: "Commerce City",
      state: "CA",
      zipCode: "90211",
      country: "US",
    },
  },
  {
    name: "Side Hustle Co",
    type: "Sole Proprietorship",
    taxId: "55-9988776",
    industry: "e-commerce",
    address: {
      street: "789 Startup St",
      city: "Innovation City",
      state: "TX",
      zipCode: "73301",
      country: "US",
    },
  },
];

// Sample receipt data
const SAMPLE_RECEIPTS: SampleReceipt[] = [
  {
    vendor: "Office Depot",
    amount: 89.99,
    currency: "USD",
    description: "Office supplies - notebooks, pens, staplers",
    category: "office_supplies",
    subcategory: "stationery",
    tags: ["tax-deductible", "office", "monthly"],
  },
  {
    vendor: "Starbucks",
    amount: 15.47,
    currency: "USD",
    description: "Client meeting coffee and pastries",
    category: "meals",
    subcategory: "client_meals",
    tags: ["tax-deductible", "client-meeting", "business-meal"],
  },
  {
    vendor: "Uber",
    amount: 32.5,
    currency: "USD",
    description: "Airport ride for business trip",
    category: "travel",
    subcategory: "transportation",
    tags: ["tax-deductible", "business-travel", "airport"],
  },
  {
    vendor: "AWS",
    amount: 127.84,
    currency: "USD",
    description: "Cloud hosting services - January",
    category: "professional_services",
    subcategory: "cloud_services",
    tags: ["tax-deductible", "monthly", "infrastructure", "recurring"],
  },
  {
    vendor: "Adobe",
    amount: 52.99,
    currency: "USD",
    description: "Creative Cloud subscription",
    category: "office_supplies",
    subcategory: "software",
    tags: ["tax-deductible", "monthly", "software", "subscription"],
  },
  {
    vendor: "Shell Gas Station",
    amount: 45.78,
    currency: "USD",
    description: "Fuel for business trip",
    category: "travel",
    subcategory: "gas",
    tags: ["tax-deductible", "business-travel", "fuel"],
  },
  {
    vendor: "Best Buy",
    amount: 299.99,
    currency: "USD",
    description: "Wireless keyboard and mouse for office",
    category: "equipment",
    subcategory: "computers",
    tags: ["tax-deductible", "office-equipment", "hardware"],
  },
  {
    vendor: "State Farm Insurance",
    amount: 185.5,
    currency: "USD",
    description: "Business liability insurance - monthly premium",
    category: "insurance",
    subcategory: "liability",
    tags: ["tax-deductible", "monthly", "insurance", "liability"],
  },
];

async function createTestUser(): Promise<admin.firestore.DocumentReference> {
  console.log("👤 Creating test user...");

  const userRef = db.collection("users").doc(TEST_USER_CONFIG.userId);

  const userData = {
    userId: TEST_USER_CONFIG.userId,
    email: TEST_USER_CONFIG.email,
    displayName: TEST_USER_CONFIG.displayName,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
    profile: {
      firstName: TEST_USER_CONFIG.firstName,
      lastName: TEST_USER_CONFIG.lastName,
      businessName: TEST_USER_CONFIG.businessName,
      businessType: TEST_USER_CONFIG.businessType,
      taxId: TEST_USER_CONFIG.taxId,
      phone: TEST_USER_CONFIG.phone,
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "US",
      },
    },
    settings: {
      theme: "light",
      notifications: {
        email: true,
        push: true,
        taxReminders: true,
        receiptReminders: true,
      },
      defaultCurrency: "USD",
      taxYear: new Date().getFullYear(),
    },
  };

  await userRef.set(userData);
  console.log("   ✓ User document created");
  return userRef;
}

async function createTestSubscription(): Promise<admin.firestore.DocumentReference> {
  console.log("📋 Creating test subscription...");

  const subscriptionRef = db
    .collection("subscriptions")
    .doc(TEST_USER_CONFIG.userId);

  const subscriptionData = {
    userId: TEST_USER_CONFIG.userId,
    currentTier: "free",
    status: "active",
    billing: {
      customerId: null,
      subscriptionId: null,
      priceId: null,
      currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    },
    limits: subscriptionTiers.free.limits,
    features: subscriptionTiers.free.features,
    history: [
      {
        tier: "free",
        startDate: admin.firestore.FieldValue.serverTimestamp(),
        endDate: null,
        reason: "initial_signup",
      },
    ],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await subscriptionRef.set(subscriptionData);
  console.log("   ✓ Subscription document created");
  return subscriptionRef;
}

async function createTestBusinesses(): Promise<string[]> {
  console.log("🏢 Creating test businesses...");

  const businessIds: string[] = [];

  for (const businessData of SAMPLE_BUSINESSES) {
    const businessDoc = {
      userId: TEST_USER_CONFIG.userId,
      name: businessData.name,
      type: businessData.type,
      taxId: businessData.taxId,
      industry: businessData.industry,
      address: businessData.address,
      settings: {
        defaultCurrency: "USD",
        taxYear: new Date().getFullYear(),
        categories: [],
      },
      stats: {
        totalReceipts: 0,
        totalAmount: 0,
        lastReceiptDate: null,
      },
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const businessRef = await db.collection("businesses").add(businessDoc);
    businessIds.push(businessRef.id);
    console.log(
      `   ✓ Created business: ${businessData.name} (${businessRef.id})`
    );
  }

  return businessIds;
}

async function createTestReceipts(businessIds: string[]): Promise<string[]> {
  console.log("📄 Creating sample receipts...");

  const receiptIds: string[] = [];

  for (let i = 0; i < SAMPLE_RECEIPTS.length; i++) {
    const receiptData = SAMPLE_RECEIPTS[i];

    // Assign receipts to different businesses
    const businessId =
      i % 3 === 0 ? businessIds[0] : i % 5 === 0 ? businessIds[1] : null;

    const fullReceiptData: ReceiptDocument = {
      userId: TEST_USER_CONFIG.userId,
      businessId: businessId,
      vendor: receiptData.vendor,
      amount: receiptData.amount,
      currency: receiptData.currency,
      date: new Date().toISOString(),
      description: receiptData.description,
      category: receiptData.category,
      subcategory: receiptData.subcategory,
      tags: receiptData.tags,
      images: [],
      extractedData: {
        vendor: receiptData.vendor,
        amount: receiptData.amount,
        tax: receiptData.amount * 0.08,
        date: new Date().toISOString().split("T")[0],
        confidence: 0.95,
        items: [
          {
            description: receiptData.description,
            amount: receiptData.amount,
            quantity: 1,
          },
        ],
      },
      tax: {
        deductible: true,
        deductionPercentage: receiptData.category === "meals" ? 50 : 100,
        taxYear: new Date().getFullYear(),
        category: "business_expense",
      },
      status: "processed",
      processingErrors: [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const receiptRef = await db.collection("receipts").add(fullReceiptData);
    receiptIds.push(receiptRef.id);
    console.log(
      `   ✓ Created receipt: ${receiptData.vendor} - ${receiptData.amount} (${receiptRef.id})`
    );
  }

  return receiptIds;
}

async function createUsageDocument(): Promise<void> {
  console.log("📈 Creating usage document...");

  const currentMonth = new Date().toISOString().slice(0, 7);
  const usageRef = db
    .collection("usage")
    .doc(`${TEST_USER_CONFIG.userId}_${currentMonth}`);

  const usageData = {
    userId: TEST_USER_CONFIG.userId,
    month: currentMonth,
    receiptsUploaded: SAMPLE_RECEIPTS.length,
    storageUsed: 1250000, // ~1.25MB
    apiCalls: 0,
    reportsGenerated: 0,
    limits: subscriptionTiers.free.limits,
    resetDate: new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1
    ).toISOString(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await usageRef.set(usageData);
  console.log("   ✓ Usage document created");
}

async function createSampleReport(businessId: string): Promise<string> {
  console.log("📊 Creating sample report...");

  const totalExpenses = SAMPLE_RECEIPTS.reduce(
    (sum, receipt) => sum + receipt.amount,
    0
  );
  const deductibleExpenses = SAMPLE_RECEIPTS.reduce((sum, receipt) => {
    const deductionPercentage = receipt.category === "meals" ? 50 : 100;
    return sum + (receipt.amount * deductionPercentage) / 100;
  }, 0);

  // Calculate categories breakdown
  const categories: Record<string, number> = {};
  SAMPLE_RECEIPTS.forEach((receipt) => {
    categories[receipt.category] =
      (categories[receipt.category] || 0) + receipt.amount;
  });

  const reportData = {
    userId: TEST_USER_CONFIG.userId,
    businessId: businessId,
    type: "tax_summary",
    title: "January 2025 Tax Summary",
    period: {
      startDate: "2025-01-01",
      endDate: "2025-01-31",
    },
    data: {
      totalExpenses,
      deductibleExpenses,
      categories,
      receiptCount: SAMPLE_RECEIPTS.length,
    },
    files: [],
    status: "completed",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const reportRef = await db.collection("reports").add(reportData);
  console.log(`   ✓ Created sample report: ${reportRef.id}`);
  return reportRef.id;
}

async function setupCompleteTestUser(): Promise<SetupResult> {
  try {
    console.log("🚀 Starting complete test user setup...\n");

    // 1. Initialize master categories
    await initializeMasterCategories();

    // 2. Create test user
    await createTestUser();

    // 3. Create subscription
    await createTestSubscription();

    // 4. Create test businesses
    const businessIds = await createTestBusinesses();

    // 5. Create sample receipts
    const receiptIds = await createTestReceipts(businessIds);

    // 6. Create usage document
    await createUsageDocument();

    // 7. Create sample report
    const reportId = await createSampleReport(businessIds[0]);

    const totalExpenses = SAMPLE_RECEIPTS.reduce(
      (sum, receipt) => sum + receipt.amount,
      0
    );

    console.log("\n🎉 Test user setup completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   👤 User ID: ${TEST_USER_CONFIG.userId}`);
    console.log(`   📧 Email: ${TEST_USER_CONFIG.email}`);
    console.log(`   🏢 Businesses created: ${businessIds.length}`);
    console.log(`   📄 Receipts created: ${receiptIds.length}`);
    console.log(`   📊 Reports created: 1`);
    console.log(`   💰 Total expenses: ${totalExpenses.toFixed(2)}`);

    console.log("\n🔐 To test authentication:");
    console.log(`   1. Create Firebase Auth user with:`);
    console.log(`      Email: ${TEST_USER_CONFIG.email}`);
    console.log(`      Password: TestPassword123!`);
    console.log(`      UID: ${TEST_USER_CONFIG.userId}`);
    console.log("   2. Login with these credentials in your app");

    console.log("\n🧪 Test scenarios you can now run:");
    console.log("   • User authentication and profile");
    console.log("   • Receipt viewing and management");
    console.log("   • Business switching");
    console.log("   • Usage limit testing (try adding 3+ more receipts)");
    console.log("   • Report generation");
    console.log("   • Subscription upgrade flow");

    process.exit(0);

    return {
      success: true,
      data: {
        userId: TEST_USER_CONFIG.userId,
        businessIds,
        receiptIds,
        totalExpenses,
      },
    };
  } catch (error) {
    console.error("❌ Error setting up test user:", error);
    process.exit(1);
  }
}

// Alternative: Setup minimal test user (just basics)
async function setupMinimalTestUser(): Promise<{
  success: boolean;
  userId: string;
}> {
  try {
    console.log("🚀 Setting up minimal test user...");

    // Initialize categories
    await initializeMasterCategories();

    // Create test user
    await createTestUser();

    // Create subscription
    await createTestSubscription();

    // Create one business
    const businessIds = await createTestBusinesses();

    // Create 3 sample receipts
    const minimalReceipts = SAMPLE_RECEIPTS.slice(0, 3);
    const receiptIds: string[] = [];

    for (let i = 0; i < minimalReceipts.length; i++) {
      const receiptData = minimalReceipts[i];

      const fullReceiptData: ReceiptDocument = {
        userId: TEST_USER_CONFIG.userId,
        businessId: businessIds[0],
        vendor: receiptData.vendor,
        amount: receiptData.amount,
        currency: receiptData.currency,
        date: new Date().toISOString(),
        description: receiptData.description,
        category: receiptData.category,
        subcategory: receiptData.subcategory,
        tags: receiptData.tags,
        images: [],
        extractedData: {
          vendor: receiptData.vendor,
          amount: receiptData.amount,
          tax: receiptData.amount * 0.08,
          date: new Date().toISOString().split("T")[0],
          confidence: 0.95,
          items: [
            {
              description: receiptData.description,
              amount: receiptData.amount,
              quantity: 1,
            },
          ],
        },
        tax: {
          deductible: true,
          deductionPercentage: receiptData.category === "meals" ? 50 : 100,
          taxYear: new Date().getFullYear(),
          category: "business_expense",
        },
        status: "processed",
        processingErrors: [],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      const receiptRef = await db.collection("receipts").add(fullReceiptData);
      receiptIds.push(receiptRef.id);
    }

    // Create usage document
    await createUsageDocument();

    console.log("✅ Minimal test user setup completed!");
    console.log(`   👤 User: ${TEST_USER_CONFIG.email}`);
    console.log(`   🏢 Business: ${businessIds[0]}`);
    console.log(`   📄 Receipts: ${receiptIds.length}`);

    return { success: true, userId: TEST_USER_CONFIG.userId };
  } catch (error) {
    console.error("❌ Error setting up minimal test user:", error);
    throw error;
  }
}

// Handle script execution
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes("--minimal")) {
    setupMinimalTestUser();
  } else {
    setupCompleteTestUser();
  }
}

// Export test configuration for reference
export const TEST_USER_INFO = {
  ...TEST_USER_CONFIG,
  loginCredentials: {
    email: TEST_USER_CONFIG.email,
    password: "TestPassword123!",
  },
  sampleDataCounts: {
    businesses: SAMPLE_BUSINESSES.length,
    receipts: SAMPLE_RECEIPTS.length,
    categories: 10,
  },
};

export { setupCompleteTestUser, setupMinimalTestUser, TEST_USER_CONFIG };
