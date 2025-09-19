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
import { getReceiptLimits } from "../src/config/limits";

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
  currentTier: 'trial' | 'starter' | 'growth' | 'professional';
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
  teamAttribution?: {
    accountHolderId: string;
    createdByUserId: string;
    createdByEmail: string;
    createdByName?: string;
    isTeamReceipt: boolean;
  };
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
  maxApiCalls: number;
  maxReports: number;
}

interface UsageDocument {
  userId: string;
  month: string;
  receiptsUploaded: number;
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

// Create receipt document
export const createReceiptDocument = async (
  userId: string, 
  receiptData: ReceiptData,
  teamAttribution?: {
    accountHolderId: string;
    createdByUserId: string;
    createdByEmail: string;
    createdByName?: string;
    isTeamReceipt: boolean;
  }
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

    // Team Attribution (if applicable)
    ...(teamAttribution && { teamAttribution }),

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

// Subscription tier configurations
export const subscriptionTiers: Record<string, SubscriptionTier> = {
  trial: {
    name: "Trial",
    price: 0,
    limits: {
      maxReceipts: getReceiptLimits().trial,
      maxBusinesses: -1,
      apiCallsPerMonth: 1000,
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
  starter: {
    name: "Starter",
    price: 9.99,
    limits: {
      maxReceipts: getReceiptLimits().starter,
      maxBusinesses: 1,
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
      maxReceipts: getReceiptLimits().growth,
      maxBusinesses: 3,
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
      maxReceipts: getReceiptLimits().professional,
      maxBusinesses: -1, // unlimited
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

// Export types for use in other files
export type {
  UserDocument,
  SubscriptionDocument,
  ReceiptDocument,
  BusinessDocument,
  UsageDocument,
  CategoryDocument,
  SubscriptionTier,
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
