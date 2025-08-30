import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { BusinessData, CreateBusinessRequest } from '../types/business';

export interface BusinessStats {
  totalReceipts: number;
  totalAmount: number;
  lastReceiptDate: Date | null;
  categoryBreakdown: Record<string, number>;
  monthlyExpenses: Record<string, number>;
}


export class BusinessService {
  /**
   * Create a new business for the user
   */
  static async createBusiness(userId: string, businessData: CreateBusinessRequest): Promise<BusinessData> {
    try {
      const newBusiness = {
        userId,
        name: businessData.name.trim(),
        type: businessData.type,
        taxId: businessData.taxId?.trim() || '',
        industry: businessData.industry?.trim() || '',
        phone: businessData.phone?.trim() || '',
        address: businessData.address || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US',
        },
        settings: {
          defaultCurrency: businessData.settings?.defaultCurrency || 'USD',
          taxYear: businessData.settings?.taxYear || new Date().getFullYear(),
          categories: businessData.settings?.categories || [],
        },
        stats: {
          totalReceipts: 0,
          totalAmount: 0,
          lastReceiptDate: null,
        },
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'businesses'), newBusiness);

      return {
        ...newBusiness,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BusinessData;
    } catch (error) {
      console.error('Error creating business:', error);
      throw new Error('Failed to create business');
    }
  }

  /**
   * Get all businesses for a user
   */
  static async getUserBusinesses(userId: string): Promise<BusinessData[]> {
    try {
      const businessesQuery = query(
        collection(db, 'businesses'),
        where('userId', '==', userId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );

      const querySnapshot = await getDocs(businessesQuery);
      const businesses: BusinessData[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        businesses.push({
          id: doc.id,
          userId: data.userId,
          name: data.name,
          type: data.type,
          taxId: data.taxId,
          industry: data.industry,
          phone: data.phone,
          address: data.address,
          settings: data.settings,
          stats: {
            totalReceipts: data.stats?.totalReceipts || 0,
            totalAmount: data.stats?.totalAmount || 0,
            lastReceiptDate: data.stats?.lastReceiptDate?.toDate() || null,
          },
          isActive: data.isActive,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });

      return businesses;
    } catch (error) {
      console.error('Error fetching user businesses:', error);
      throw new Error('Failed to fetch businesses');
    }
  }

  /**
   * Get a specific business by ID
   */
  static async getBusinessById(businessId: string): Promise<BusinessData | null> {
    try {
      const businessDoc = await getDoc(doc(db, 'businesses', businessId));
      
      if (!businessDoc.exists()) {
        return null;
      }

      const data = businessDoc.data();
      return {
        id: businessDoc.id,
        userId: data.userId,
        name: data.name,
        type: data.type,
        taxId: data.taxId,
        industry: data.industry,
        phone: data.phone,
        address: data.address,
        settings: data.settings,
        stats: {
          totalReceipts: data.stats?.totalReceipts || 0,
          totalAmount: data.stats?.totalAmount || 0,
          lastReceiptDate: data.stats?.lastReceiptDate?.toDate() || null,
        },
        isActive: data.isActive,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Error fetching business:', error);
      throw new Error('Failed to fetch business');
    }
  }

  /**
   * Update a business
   */
  static async updateBusiness(
    businessId: string, 
    updates: Partial<Omit<BusinessData, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    try {
      const businessRef = doc(db, 'businesses', businessId);
      
      // Clean the updates object
      const { stats, ...otherUpdates } = updates;
      const cleanUpdates: any = { ...otherUpdates };
      
      // Handle stats separately if provided
      if (stats) {
        cleanUpdates.stats = stats;
      }

      await updateDoc(businessRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating business:', error);
      throw new Error('Failed to update business');
    }
  }

  /**
   * Soft delete a business (mark as inactive)
   */
  static async deleteBusiness(businessId: string): Promise<void> {
    try {
      const businessRef = doc(db, 'businesses', businessId);
      
      await updateDoc(businessRef, {
        isActive: false,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting business:', error);
      throw new Error('Failed to delete business');
    }
  }

  /**
   * Calculate business statistics based on receipts
   */
  static async calculateBusinessStats(businessId: string): Promise<BusinessStats> {
    try {
      const receiptsQuery = query(
        collection(db, 'receipts'),
        where('businessId', '==', businessId),
        where('status', '!=', 'deleted')
      );

      const querySnapshot = await getDocs(receiptsQuery);
      
      let totalReceipts = 0;
      let totalAmount = 0;
      let lastReceiptDate: Date | null = null;
      const categoryBreakdown: Record<string, number> = {};
      const monthlyExpenses: Record<string, number> = {};

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        totalReceipts++;
        totalAmount += data.amount || 0;
        
        // Track latest receipt date
        const receiptDate = data.date?.toDate ? data.date.toDate() : new Date(data.date);
        if (!lastReceiptDate || receiptDate > lastReceiptDate) {
          lastReceiptDate = receiptDate;
        }

        // Category breakdown
        const category = data.category || 'uncategorized';
        categoryBreakdown[category] = (categoryBreakdown[category] || 0) + (data.amount || 0);

        // Monthly expenses
        const monthKey = receiptDate.toISOString().slice(0, 7); // YYYY-MM
        monthlyExpenses[monthKey] = (monthlyExpenses[monthKey] || 0) + (data.amount || 0);
      });

      return {
        totalReceipts,
        totalAmount,
        lastReceiptDate,
        categoryBreakdown,
        monthlyExpenses,
      };
    } catch (error) {
      console.error('Error calculating business stats:', error);
      throw new Error('Failed to calculate business statistics');
    }
  }

  /**
   * Update business statistics
   */
  static async updateBusinessStats(businessId: string): Promise<void> {
    try {
      const stats = await this.calculateBusinessStats(businessId);
      const businessRef = doc(db, 'businesses', businessId);
      
      await updateDoc(businessRef, {
        'stats.totalReceipts': stats.totalReceipts,
        'stats.totalAmount': stats.totalAmount,
        'stats.lastReceiptDate': stats.lastReceiptDate,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating business stats:', error);
      throw new Error('Failed to update business statistics');
    }
  }

  /**
   * Transfer receipts from one business to another
   */
  static async transferReceipts(
    fromBusinessId: string | null, 
    toBusinessId: string, 
    receiptIds: string[]
  ): Promise<void> {
    try {
      const batch = writeBatch(db);

      receiptIds.forEach((receiptId) => {
        const receiptRef = doc(db, 'receipts', receiptId);
        batch.update(receiptRef, {
          businessId: toBusinessId,
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();

      // Update stats for both businesses
      if (fromBusinessId) {
        await this.updateBusinessStats(fromBusinessId);
      }
      await this.updateBusinessStats(toBusinessId);
    } catch (error) {
      console.error('Error transferring receipts:', error);
      throw new Error('Failed to transfer receipts');
    }
  }

  /**
   * Validate business data
   */
  static validateBusinessData(businessData: CreateBusinessRequest): string[] {
    const errors: string[] = [];

    if (!businessData.name?.trim()) {
      errors.push('Business name is required');
    }

    if (businessData.name && businessData.name.trim().length < 2) {
      errors.push('Business name must be at least 2 characters');
    }

    if (!businessData.type) {
      errors.push('Business type is required');
    }

    if (businessData.taxId && businessData.taxId.trim().length > 0) {
      // Basic EIN format validation (XX-XXXXXXX)
      const einRegex = /^\d{2}-\d{7}$/;
      const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
      
      if (!einRegex.test(businessData.taxId) && !ssnRegex.test(businessData.taxId)) {
        errors.push('Tax ID must be in format XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)');
      }
    }

    if (businessData.address) {
      const { street, city, state, zipCode } = businessData.address;
      
      if (street && street.trim().length > 0 && street.trim().length < 5) {
        errors.push('Street address must be at least 5 characters if provided');
      }
      
      if (city && city.trim().length > 0 && city.trim().length < 2) {
        errors.push('City must be at least 2 characters if provided');
      }
      
      if (state && state.trim().length > 0 && state.trim().length !== 2) {
        errors.push('State must be 2 characters (e.g., CA, NY)');
      }
      
      if (zipCode && zipCode.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(zipCode)) {
          errors.push('ZIP code must be in format XXXXX or XXXXX-XXXX');
        }
      }
    }

    return errors;
  }

  /**
   * Get business types for dropdown
   */
  static getBusinessTypes(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'LLC',
        label: 'LLC',
        description: 'Limited Liability Company - Most common for small businesses'
      },
      {
        value: 'Corporation',
        label: 'Corporation',
        description: 'C-Corp or S-Corp - More formal structure'
      },
      {
        value: 'Sole Proprietorship',
        label: 'Sole Proprietorship',
        description: 'Single owner business - Simplest structure'
      },
      {
        value: 'Partnership',
        label: 'Partnership',
        description: 'Multiple owners sharing profits and losses'
      },
      {
        value: 'Other',
        label: 'Other',
        description: 'Non-profit, trust, or other business structure'
      }
    ];
  }

  /**
   * Get industry options for dropdown
   */
  static getIndustryOptions(): string[] {
    return [
      'Consulting',
      'Technology',
      'Healthcare',
      'Real Estate',
      'Retail',
      'Restaurant/Food Service',
      'Construction',
      'Manufacturing',
      'Professional Services',
      'Education',
      'Transportation',
      'Entertainment',
      'Finance',
      'Marketing/Advertising',
      'Non-profit',
      'Other'
    ];
  }
}