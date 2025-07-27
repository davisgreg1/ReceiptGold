// Firebase Collections Setup for ReceiptGold
// This file contains the structure and initialization for all Firebase collections

import {
  collection,
  doc,
  setDoc,
  addDoc,
  serverTimestamp,
  CollectionReference,
  DocumentReference,
  Timestamp,
} from "firebase/firestore";
import { db } from "../src/config/firebase"; // Your Firebase app instance

// Type definitions
interface UserAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface UserProfile {
  firstName: string;
  lastName: string;
  businessName: string;
  businessType: string;
  taxId: string;
  phone: string;
  address: UserAddress;
}

interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    push: boolean;
    taxReminders: boolean;
    receiptReminders: boolean;
  };
  defaultCurrency: string;
  taxYear: number;
}

interface UserDocument {
  userId: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  lastLoginAt: Timestamp;
  profile: UserProfile;
  settings: UserSettings;
}

interface SubscriptionLimits {
  maxReceipts: number;
  maxBusinesses: number;
  storageLimit: number;
  apiCallsPerMonth: number;
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

interface BillingInfo {
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Timestamp | null;
}

interface SubscriptionHistory {
  tier: string;
  startDate: Timestamp;
  endDate: Timestamp | null;
  reason: string;
}

interface SubscriptionDocument {
  userId: string;
  currentTier: 'free' | 'starter' | 'growth' | 'professional';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  billing: BillingInfo;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
  history: SubscriptionHistory[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ReceiptImage {
  url: string;
  thumbnail?: string;
  size: number;
  uploadedAt: Timestamp;
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
  date: Timestamp | string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
  images: ReceiptImage[];
  extractedData: ExtractedData;
  tax: TaxInfo;
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';
  processingErrors: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface BusinessStats {
  totalReceipts: number;
  totalAmount: number;
  lastReceiptDate: string | null;
}

interface BusinessSettings {
  defaultCurrency: string;
  taxYear: number;
  categories: string[];
}

interface BusinessDocument {
  userId: string;
  name: string;
  type: string;
  taxId: string;
  industry: string;
  address: UserAddress;
  settings: BusinessSettings;
  stats: BusinessStats;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface UsageLimits {
  maxReceipts: number;
  maxStorage: number;
  maxApiCalls: number;
  maxReports: number;
}

interface UsageDocument {
  userId: string;
  month: string;
  receiptsUploaded: number;
  storageUsed: number;
  apiCalls: number;
  reportsGenerated: number;
  limits: UsageLimits;
  resetDate: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface CategoryDocument {
  categoryId: string;
  name: string;
  description: string;
  taxDeductible: boolean;
  icon: string;
  subcategories: string[];
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
}

interface SubscriptionTier {
  name: string;
  price: number;
  limits: SubscriptionLimits;
  features: SubscriptionFeatures;
}

interface UserData {
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: string;
  taxId?: string;
  phone?: string;
}

interface ReceiptData {
  businessId?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
  date?: Timestamp | string;
  description?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  images?: ReceiptImage[];
  extractedData?: Partial<ExtractedData>;
  tax?: Partial<TaxInfo>;
}

interface BusinessData {
  name?: string;
  type?: string;
  taxId?: string;
  industry?: string;
  address?: Partial<UserAddress>;
}

// Collection References
export const collections = {
  users: "users",
  subscriptions: "subscriptions",
  receipts: "receipts",
  businesses: "businesses",
  reports: "reports",
  categories: "categories",
  usage: "usage",
} as const;

// Helper function to get collection reference
export const getCollectionRef = (collectionName: string): CollectionReference => {
  return collection(db, collectionName);
};

// Helper function to get document reference
export const getDocRef = (collectionName: string, docId: string): DocumentReference => {
  return doc(db, collectionName, docId);
};

// Create initial user document
export const createUserDocument = async (
  userId: string, 
  userData: UserData
): Promise<DocumentReference> => {
  const userRef = doc(db, collections.users, userId);

  const defaultUserData: UserDocument = {
    userId,
    email: userData.email || "",
    displayName: userData.displayName || "",
    createdAt: serverTimestamp() as Timestamp,
    lastLoginAt: serverTimestamp() as Timestamp,

    // Profile Information
    profile: {
      firstName: userData.firstName || "",
      lastName: userData.lastName || "",
      businessName: userData.businessName || "",
      businessType: userData.businessType || "Sole Proprietorship",
      taxId: userData.taxId || "",
      phone: userData.phone || "",
      address: {
        street: "",
        city: "",
        state: "",
        zipCode: "",
        country: "US",
      },
    },

    // App Settings
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

  await setDoc(userRef, defaultUserData);
  return userRef;
};

// Create initial subscription document (free tier)
export const createSubscriptionDocument = async (userId: string): Promise<DocumentReference> => {
  const subscriptionRef = doc(db, collections.subscriptions, userId);

  const defaultSubscriptionData: SubscriptionDocument = {
    userId,

    // Current Subscription
    currentTier: "free",
    status: "active",

    // Billing Information
    billing: {
      customerId: null,
      subscriptionId: null,
      priceId: null,
      currentPeriodStart: serverTimestamp() as Timestamp,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    },

    // Feature Limits (free tier)
    limits: {
      maxReceipts: 10,
      maxBusinesses: 1,
      storageLimit: 100, // 100 MB
      apiCallsPerMonth: 0,
    },

    // Feature Access (free tier)
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

    // Subscription History
    history: [
      {
        tier: "free",
        startDate: serverTimestamp() as Timestamp,
        endDate: null,
        reason: "initial_signup",
      },
    ],

    // Metadata
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(subscriptionRef, defaultSubscriptionData);
  return subscriptionRef;
};

// Create receipt document
export const createReceiptDocument = async (
  userId: string, 
  receiptData: ReceiptData
): Promise<DocumentReference> => {
  const receiptsRef = collection(db, collections.receipts);

  const defaultReceiptData: Omit<ReceiptDocument, 'id'> = {
    userId,
    businessId: receiptData.businessId || null,

    // Receipt Information
    vendor: receiptData.vendor || "",
    amount: receiptData.amount || 0,
    currency: receiptData.currency || "USD",
    date: receiptData.date || (serverTimestamp() as Timestamp),
    description: receiptData.description || "",

    // Categorization
    category: receiptData.category || "uncategorized",
    subcategory: receiptData.subcategory || "",
    tags: receiptData.tags || [],

    // Receipt Images/Files
    images: receiptData.images || [],

    // OCR/Extraction Data
    extractedData: {
      vendor: receiptData.extractedData?.vendor || "",
      amount: receiptData.extractedData?.amount || 0,
      tax: receiptData.extractedData?.tax || 0,
      date: receiptData.extractedData?.date || "",
      confidence: receiptData.extractedData?.confidence || 0,
      items: receiptData.extractedData?.items || [],
    },

    // Tax Information
    tax: {
      deductible: receiptData.tax?.deductible ?? true,
      deductionPercentage: receiptData.tax?.deductionPercentage ?? 100,
      taxYear: receiptData.tax?.taxYear ?? new Date().getFullYear(),
      category: receiptData.tax?.category || "business_expense",
    },

    // Status
    status: "uploaded",
    processingErrors: [],

    // Metadata
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(receiptsRef, defaultReceiptData);
  return docRef;
};

// Create business document
export const createBusinessDocument = async (
  userId: string, 
  businessData: BusinessData
): Promise<DocumentReference> => {
  const businessesRef = collection(db, collections.businesses);

  const defaultBusinessData: Omit<BusinessDocument, 'id'> = {
    userId,

    // Business Information
    name: businessData.name || "",
    type: businessData.type || "LLC",
    taxId: businessData.taxId || "",
    industry: businessData.industry || "",

    // Address
    address: {
      street: businessData.address?.street || "",
      city: businessData.address?.city || "",
      state: businessData.address?.state || "",
      zipCode: businessData.address?.zipCode || "",
      country: businessData.address?.country || "US",
    },

    // Settings
    settings: {
      defaultCurrency: "USD",
      taxYear: new Date().getFullYear(),
      categories: [],
    },

    // Stats (calculated)
    stats: {
      totalReceipts: 0,
      totalAmount: 0,
      lastReceiptDate: null,
    },

    // Metadata
    isActive: true,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(businessesRef, defaultBusinessData);
  return docRef;
};

// Create usage tracking document
export const createUsageDocument = async (userId: string): Promise<DocumentReference> => {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
  const usageRef = doc(db, collections.usage, `${userId}_${currentMonth}`);

  const defaultUsageData: UsageDocument = {
    userId,
    month: currentMonth,

    // Usage Statistics
    receiptsUploaded: 0,
    storageUsed: 0,
    apiCalls: 0,
    reportsGenerated: 0,

    // Limits for current tier (free tier defaults)
    limits: {
      maxReceipts: 10,
      maxStorage: 104857600, // 100 MB in bytes
      maxApiCalls: 0,
      maxReports: 1,
    },

    // Reset date for limits
    resetDate: new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      1
    ).toISOString(),

    // Metadata
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  await setDoc(usageRef, defaultUsageData);
  return usageRef;
};

// Initialize master categories
export const initializeMasterCategories = async (): Promise<void> => {
  const masterCategories: CategoryDocument[] = [
    {
      categoryId: "office_supplies",
      name: "Office Supplies",
      description: "General office supplies and equipment",
      taxDeductible: true,
      icon: "📝",
      subcategories: ["software", "hardware", "stationery", "furniture"],
      keywords: ["office", "supplies", "desk", "chair", "computer", "software"],
      isActive: true,
      sortOrder: 1,
    },
    {
      categoryId: "travel",
      name: "Travel",
      description: "Business travel expenses",
      taxDeductible: true,
      icon: "✈️",
      subcategories: ["flights", "hotels", "car_rental", "gas", "parking"],
      keywords: ["travel", "flight", "hotel", "rental", "gas", "parking"],
      isActive: true,
      sortOrder: 2,
    },
    {
      categoryId: "meals",
      name: "Meals & Entertainment",
      description: "Business meals and entertainment expenses",
      taxDeductible: true,
      icon: "🍽️",
      subcategories: ["client_meals", "team_meals", "conferences"],
      keywords: ["meal", "restaurant", "food", "entertainment", "conference"],
      isActive: true,
      sortOrder: 3,
    },
    {
      categoryId: "utilities",
      name: "Utilities",
      description: "Office utilities and services",
      taxDeductible: true,
      icon: "💡",
      subcategories: ["electricity", "internet", "phone", "water"],
      keywords: [
        "utility",
        "electric",
        "internet",
        "phone",
        "water",
        "service",
      ],
      isActive: true,
      sortOrder: 4,
    },
    {
      categoryId: "marketing",
      name: "Marketing & Advertising",
      description: "Marketing and advertising expenses",
      taxDeductible: true,
      icon: "📢",
      subcategories: ["online_ads", "print_ads", "promotional_materials"],
      keywords: ["marketing", "advertising", "promotion", "ads", "campaign"],
      isActive: true,
      sortOrder: 5,
    },
    {
      categoryId: "professional_services",
      name: "Professional Services",
      description: "Legal, accounting, and consulting services",
      taxDeductible: true,
      icon: "⚖️",
      subcategories: ["legal", "accounting", "consulting"],
      keywords: [
        "legal",
        "accounting",
        "consulting",
        "professional",
        "service",
      ],
      isActive: true,
      sortOrder: 6,
    },
    {
      categoryId: "equipment",
      name: "Equipment",
      description: "Business equipment and machinery",
      taxDeductible: true,
      icon: "🔧",
      subcategories: ["computers", "machinery", "tools"],
      keywords: ["equipment", "machinery", "tools", "computer", "hardware"],
      isActive: true,
      sortOrder: 7,
    },
    {
      categoryId: "insurance",
      name: "Insurance",
      description: "Business insurance premiums",
      taxDeductible: true,
      icon: "🛡️",
      subcategories: ["liability", "property", "health"],
      keywords: ["insurance", "premium", "liability", "property", "coverage"],
      isActive: true,
      sortOrder: 8,
    },
    {
      categoryId: "other",
      name: "Other",
      description: "Other business expenses",
      taxDeductible: true,
      icon: "📋",
      subcategories: ["miscellaneous"],
      keywords: ["other", "miscellaneous", "various"],
      isActive: true,
      sortOrder: 99,
    },
  ];

  const promises = masterCategories.map((category) => {
    const categoryRef = doc(db, collections.categories, category.categoryId);
    return setDoc(categoryRef, category);
  });

  await Promise.all(promises);
  console.log("Master categories initialized successfully");
};

// Subscription tier configurations
export const subscriptionTiers: Record<string, SubscriptionTier> = {
  free: {
    name: "Free",
    price: 0,
    limits: {
      maxReceipts: 10,
      maxBusinesses: 1,
      storageLimit: 100, // MB
      apiCallsPerMonth: 0,
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
  starter: {
    name: "Starter",
    price: 9.99,
    limits: {
      maxReceipts: 100,
      maxBusinesses: 1,
      storageLimit: 1000, // MB
      apiCallsPerMonth: 100,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: false,
      prioritySupport: false,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: true,
      dedicatedManager: false,
    },
  },
  growth: {
    name: "Growth",
    price: 29.99,
    limits: {
      maxReceipts: 1000,
      maxBusinesses: 3,
      storageLimit: 5000, // MB
      apiCallsPerMonth: 1000,
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
    },
  },
  professional: {
    name: "Professional",
    price: 99.99,
    limits: {
      maxReceipts: -1, // unlimited
      maxBusinesses: -1, // unlimited
      storageLimit: -1, // unlimited
      apiCallsPerMonth: 10000,
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
    },
  },
};

// Initialize user with default documents
export const initializeNewUser = async (
  userId: string, 
  userData: UserData
): Promise<{ success: boolean }> => {
  try {
    // Create user document
    await createUserDocument(userId, userData);

    // Create subscription document (free tier)
    await createSubscriptionDocument(userId);

    // Create usage tracking document
    await createUsageDocument(userId);

    console.log(`User ${userId} initialized successfully`);
    return { success: true };
  } catch (error) {
    console.error("Error initializing user:", error);
    throw error;
  }
};

// Export types for use in other files
export type {
  UserDocument,
  SubscriptionDocument,
  ReceiptDocument,
  BusinessDocument,
  UsageDocument,
  CategoryDocument,
  SubscriptionTier,
  UserData,
  ReceiptData,
  BusinessData,
  SubscriptionLimits,
  SubscriptionFeatures,
  TaxInfo,
  ExtractedData,
};

// Database instance
export { db };
export default db;
