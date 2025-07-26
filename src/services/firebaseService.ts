import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  getDocs,
  serverTimestamp,
  increment 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { SubscriptionTier } from '../context/SubscriptionContext';

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
  storageUsed: number;
  apiCalls: number;
  reportsGenerated: number;
  limits: {
    maxReceipts: number;
    maxStorage: number;
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

  async createReceipt(receipt: Omit<Receipt, 'receiptId' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const docRef = doc(collection(db, 'receipts'));
      await setDoc(docRef, {
        ...receipt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Update usage statistics
      await this.updateUsageStats(receipt.userId);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating receipt:', error);
      throw error;
    }
  },

  async updateReceipt(receiptId: string, updates: Partial<Receipt>): Promise<void> {
    try {
      const docRef = doc(db, 'receipts', receiptId);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating receipt:', error);
      throw error;
    }
  },

  async deleteReceipt(receiptId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'receipts', receiptId);
      
      // In a real app, you'd want to soft delete or move to a deleted collection
      // For now, we'll just decrement the usage count
      await updateDoc(docRef, {
        status: 'deleted',
        updatedAt: serverTimestamp(),
      });
      
      // Decrement usage count
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usageRef = doc(db, 'usage', `${userId}_${currentMonth}`);
      await updateDoc(usageRef, {
        receiptsUploaded: increment(-1),
        updatedAt: serverTimestamp(),
      });
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
      
      await updateDoc(usageRef, {
        receiptsUploaded: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      // If usage document doesn't exist, create it
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usageRef = doc(db, 'usage', `${userId}_${currentMonth}`);
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      
      await setDoc(usageRef, {
        userId,
        month: currentMonth,
        receiptsUploaded: 1,
        storageUsed: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: {
          maxReceipts: 10, // Default to free tier
          maxStorage: -1,
          maxApiCalls: 0,
          maxReports: 1,
        },
        resetDate: nextMonth,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
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
        storageUsed: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: {
          maxReceipts: 10, // Default to free tier
          maxStorage: -1,
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
          maxReceipts: 10,
          maxStorage: 100 * 1024 * 1024, // 100MB
          maxApiCalls: 0,
          maxReports: 1,
        };
      case 'starter':
        return {
          maxReceipts: -1, // unlimited
          maxStorage: -1, // unlimited
          maxApiCalls: 0,
          maxReports: -1, // unlimited
        };
      case 'growth':
        return {
          maxReceipts: -1,
          maxStorage: -1,
          maxApiCalls: 100,
          maxReports: -1,
        };
      case 'professional':
        return {
          maxReceipts: -1,
          maxStorage: -1,
          maxApiCalls: 1000,
          maxReports: -1,
        };
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
