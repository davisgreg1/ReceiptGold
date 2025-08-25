import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment,
  runTransaction
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { getMonthlyReceiptCount } from '../utils/getMonthlyReceipts';
import { SubscriptionTier } from '../context/SubscriptionContext';
import Constants from 'expo-constants';

// Types
export interface UserProfile {
  userId: string;
  email: string;
  displayName?: string;
  profile: {
    firstName?: string;
    lastName?: string;
    businessName?: string;
    businessType?: string;
    phone?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      country?: string;
    };
  };
  settings: {
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      push: boolean;
      taxReminders: boolean;
      receiptReminders: boolean;
    };
    defaultCurrency: string;
    taxYear: number;
  };
  createdAt: Date;
  lastLoginAt: Date;
}

export interface Receipt {
  receiptId: string;
  userId: string;
  businessId?: string;
  vendor: string;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  images: {
    url: string;
    thumbnail?: string;
    size: number;
    uploadedAt: Date;
  }[];
  extractedData?: {
    vendor?: string;
    amount?: number;
    tax?: number;
    date?: string;
    confidence?: number;
    items?: {
      description: string;
      amount: number;
      quantity: number;
    }[];
  };
  tax: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
    amount?: number; // Add optional tax amount field
  };
  status: 'uploaded' | 'processing' | 'processed' | 'error';
  processingErrors: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Usage {
  userId: string;
  month: string; // YYYY-MM
  receiptsUploaded: number;
  apiCalls: number;
  reportsGenerated: number;
  limits: {
    maxReceipts: number;
    maxApiCalls: number;
    maxReports: number;
  };
  resetDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// User Profile Service
export const userService = {
  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return { ...docSnap.data(), userId } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  },

  async createProfile(profile: Omit<UserProfile, 'createdAt' | 'lastLoginAt'>): Promise<void> {
    try {
      const docRef = doc(db, 'users', profile.userId);
      await setDoc(docRef, {
        ...profile,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  async updateLastLogin(userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'users', userId);
      await updateDoc(docRef, {
        lastLoginAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating last login:', error);
      throw error;
    }
  },
};

// Receipt Service
export const receiptService = {
  async getReceipts(userId: string, limitCount: number = 50): Promise<Receipt[]> {
    try {
      const q = query(
        collection(db, 'receipts'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        receiptId: doc.id,
        ...doc.data(),
      })) as Receipt[];
    } catch (error) {
      console.error('Error getting receipts:', error);
      throw error;
    }
  },

  async getReceiptById(receiptId: string): Promise<Receipt | null> {
    try {
      const docRef = doc(db, 'receipts', receiptId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          receiptId: docSnap.id,
          ...docSnap.data(),
        } as Receipt;
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting receipt by ID:', error);
      throw error;
    }
  },

  async createReceipt(receipt: Omit<Receipt, 'receiptId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      console.log("🚀 Starting receipt creation process");
      console.log("🚀 Input receipt data:", receipt);

      // Validate only the essential field
      if (!receipt.userId) {
        throw new Error("userId is required");
      }

      const docRef = doc(collection(db, 'receipts'));
      console.log("🚀 Creating receipt document with ID:", docRef.id);

      // Ensure userId is present and properly typed
      const { userId, businessId, ...rest } = receipt;
      
      // Create base receipt data
      const receiptData = {
        userId: String(userId), // Ensure it's a string
        ...rest, // Spread all other properties except userId and businessId
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Only add businessId if it's not undefined
      if (businessId !== undefined) {
        (receiptData as any).businessId = businessId;
      }

      console.log("🚀 Final receipt data to save:", receiptData);
      console.log("🚀 Data types:", {
        userId: typeof receiptData.userId,
        hasBusinessName: 'businessName' in receiptData,
        hasAmount: 'amount' in receiptData,
      });

      await setDoc(docRef, receiptData);
      console.log("✅ Receipt document created successfully");

      // Immediately verify the document exists
      const verifyDoc = await getDoc(docRef);
      if (verifyDoc.exists()) {
        console.log("✅ Document verified to exist immediately after creation");
        console.log("🚀 Document data:", verifyDoc.data());
      } else {
        console.error("❌ Document does not exist immediately after creation!");
      }

      // Update usage stats
      // try {
      //   await this.updateUsageStats(receipt.userId);
      //   console.log("✅ Usage stats updated successfully");
      // } catch (usageError) {
      //   console.error("❌ Error updating usage stats (receipt still saved):", usageError);
      //   // Don't throw here - the receipt was saved successfully
      // }

      console.log("🚀 Receipt creation process completed, returning ID:", docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating receipt:', error);

      // Enhanced error logging
      if (error instanceof Error) {
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }

      // Log specific Firebase error details
      if (error && typeof error === 'object' && 'code' in error) {
        console.error('❌ Firebase error code:', (error as any).code);
        console.error('❌ Firebase error message:', (error as any).message);
      }

      throw error;
    }
  },

  async updateReceipt(receiptId: string, updates: Partial<Receipt>): Promise<void> {
    try {
      const docRef = doc(db, 'receipts', receiptId);
      
      // Process the updates to handle undefined values
      const processedUpdates: any = {
        updatedAt: serverTimestamp(),
      };
      
      // Add all defined values
      Object.keys(updates).forEach(key => {
        const value = (updates as any)[key];
        if (value === undefined) {
          // Use deleteField() to remove undefined fields
          processedUpdates[key] = deleteField();
        } else {
          processedUpdates[key] = value;
        }
      });
      
      await updateDoc(docRef, processedUpdates);
    } catch (error) {
      console.error('Error updating receipt:', error);
      throw error;
    }
  },

  async deleteReceipt(receiptId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'receipts', receiptId);

      // Soft delete the receipt by updating its status
      await updateDoc(docRef, {
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });

      // We no longer decrement the usage count when deleting receipts
      // Monthly usage should track ALL receipts created in a month,
      // regardless of whether they are later deleted
    } catch (error) {
      console.error('Error deleting receipt:', error);
      throw error;
    }
  },

  async getReceiptCount(userId: string): Promise<number> {
    try {
      const q = query(
        collection(db, 'receipts'),
        where('userId', '==', userId),
        where('status', '!=', 'deleted')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.size;
    } catch (error) {
      console.error('Error getting receipt count:', error);
      throw error;
    }
  },

  async updateUsageStats(userId: string): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usageRef = doc(db, 'usage', `${userId}_${currentMonth}`);

      // Use transaction to ensure atomic updates
      await runTransaction(db, async (transaction) => {
        // Check if usage document exists
        const usageDoc = await transaction.get(usageRef);

        if (usageDoc.exists()) {
          // Increment the count by 1 (since we just added a receipt)
          transaction.update(usageRef, {
            receiptsUploaded: increment(1),
            updatedAt: serverTimestamp(),
          });
        } else {
          // Create new usage document starting with 1 receipt
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          nextMonth.setDate(1);
          nextMonth.setHours(0, 0, 0, 0);

          transaction.set(usageRef, {
            userId,
            month: currentMonth,
            receiptsUploaded: 1, // Start with 1 since we just added a receipt
            apiCalls: 0,
            reportsGenerated: 0,
            limits: {
              maxReceipts: parseInt(Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || "10", 10),
              maxApiCalls: 0,
              maxReports: 1,
            },
            resetDate: nextMonth,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      });
    } catch (error) {
      console.error('Error updating usage stats:', error);
      throw error;
    }
  },
};

// Usage Service
export const usageService = {
  async getCurrentUsage(userId: string): Promise<Usage | null> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const docRef = doc(db, 'usage', `${userId}_${currentMonth}`);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return docSnap.data() as Usage;
      }

      // Create initial usage document if it doesn't exist
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);

      const initialUsage: Usage = {
        userId,
        month: currentMonth,
        receiptsUploaded: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: {
          maxReceipts: parseInt(process.env.REACT_APP_FREE_TIER_MAX_RECEIPTS || "10", 10),
          maxApiCalls: 0,
          maxReports: 1,
        },
        resetDate: nextMonth,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await setDoc(docRef, {
        ...initialUsage,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return initialUsage;
    } catch (error) {
      console.error('Error getting current usage:', error);
      throw error;
    }
  },

  async updateLimitsForTier(userId: string, tier: SubscriptionTier): Promise<void> {
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageRef = doc(db, 'usage', `${userId}_${currentMonth}`);

      const limits = this.getLimitsForTier(tier);

      await updateDoc(usageRef, {
        limits,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating usage limits:', error);
      throw error;
    }
  },

  getLimitsForTier(tier: SubscriptionTier) {
    switch (tier) {
      case 'free':
        return {
          maxReceipts: parseInt(Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || "10", 10),
          maxApiCalls: 0,
          maxReports: 1,
        };
      case 'starter':
        return {
          maxReceipts: parseInt(Constants.expoConfig?.extra?.STARTER_TIER_MAX_RECEIPTS || "50", 10),
          maxApiCalls: 0,
          maxReports: -1, // unlimited
        };
      case 'growth':
        return {
          maxReceipts: parseInt(Constants.expoConfig?.extra?.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
          maxApiCalls: 100,
          maxReports: -1,
        };
      case 'professional':
        return {
          maxReceipts: parseInt(Constants.expoConfig?.extra?.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
          maxApiCalls: 1000,
          maxReports: -1,
        };
    }
  },

  async getCurrentMonthUsage(userId: string): Promise<number> {
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthlyUsageQuery = query(
        collection(db, 'receipts'),
        where('userId', '==', userId),
        where('createdAt', '>=', startOfMonth),
        orderBy('createdAt', 'desc')
      );

      const monthlyUsageSnapshot = await getDocs(monthlyUsageQuery);
      return monthlyUsageSnapshot.size;
    } catch (error) {
      console.error('Error getting current month usage:', error);
      throw error;
    }
  },

  async canUserPerformAction(userId: string, action: 'addReceipt' | 'generateReport' | 'apiCall'): Promise<boolean> {
    try {
      const usage = await this.getCurrentUsage(userId);
      if (!usage) return false;

      switch (action) {
        case 'addReceipt':
          return usage.limits.maxReceipts === -1 || usage.receiptsUploaded < usage.limits.maxReceipts;
        case 'generateReport':
          return usage.limits.maxReports === -1 || usage.reportsGenerated < usage.limits.maxReports;
        case 'apiCall':
          return usage.limits.maxApiCalls === -1 || usage.apiCalls < usage.limits.maxApiCalls;
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking user action permissions:', error);
      return false;
    }
  },
};
