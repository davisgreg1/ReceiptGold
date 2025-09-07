import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  getDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { db } from '../config/firebase';
import { BusinessData, CreateBusinessRequest } from '../types/business';

interface BusinessContextType {
  businesses: BusinessData[];
  accessibleBusinesses: BusinessData[];
  selectedBusiness: BusinessData | null;
  loading: boolean;
  error: string | null;
  
  // Business management functions
  createBusiness: (businessData: CreateBusinessRequest) => Promise<BusinessData>;
  updateBusiness: (businessId: string, updates: Partial<BusinessData>) => Promise<void>;
  deleteBusiness: (businessId: string) => Promise<void>;
  selectBusiness: (businessId: string | null) => void;
  
  // Utility functions
  canCreateBusiness: () => boolean;
  getBusinessById: (businessId: string) => BusinessData | undefined;
  refreshBusinesses: () => Promise<void>;
  isBusinessAccessible: (businessId: string) => boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { subscription, canAccessFeature } = useSubscription();
  
  const [businesses, setBusinesses] = useState<BusinessData[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter businesses based on subscription tier access
  const getAccessibleBusinesses = useCallback(() => {
    if (!canAccessFeature('multiBusinessManagement') && businesses.length > 1) {
      // For lower tiers, only allow access to the first business (oldest)
      const oldestBusiness = businesses.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0];
      return oldestBusiness ? [oldestBusiness] : [];
    }
    return businesses;
  }, [canAccessFeature, businesses]);

  // Check if user can create more businesses
  const canCreateBusiness = useCallback(() => {
    if (!canAccessFeature('multiBusinessManagement')) {
      return businesses.length === 0; // Can create first business even on non-professional plans
    }
    
    const maxBusinesses = subscription.limits.maxBusinesses;
    return maxBusinesses === -1 || businesses.length < maxBusinesses;
  }, [canAccessFeature, businesses.length, subscription.limits.maxBusinesses]);

  // Get business by ID
  const getBusinessById = useCallback((businessId: string) => {
    return businesses.find(business => business.id === businessId);
  }, [businesses]);

  // Check if a business is accessible based on current subscription
  const isBusinessAccessible = useCallback((businessId: string) => {
    const accessibleBusinesses = getAccessibleBusinesses();
    return accessibleBusinesses.some(business => business.id === businessId);
  }, [getAccessibleBusinesses]);

  // Create a new business
  const createBusiness = useCallback(async (businessData: CreateBusinessRequest): Promise<BusinessData> => {
    if (!user) {
      throw new Error('User must be authenticated to create a business');
    }

    if (!canCreateBusiness()) {
      throw new Error('Business limit reached for current subscription');
    }

    try {
      const newBusiness = {
        name: businessData.name,
        type: businessData.type,
        taxId: businessData.taxId || '',
        industry: businessData.industry || '',
        phone: businessData.phone || '',
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
        userId: user.uid,
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
      
      const createdBusiness: BusinessData = {
        ...newBusiness,
        id: docRef.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // If this is the first business, auto-select it
      if (businesses.length === 0) {
        setSelectedBusiness(createdBusiness);
        AsyncStorage.setItem('selectedBusinessId', docRef.id);
      }

      return createdBusiness;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create business';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, canCreateBusiness, businesses.length]);

  // Update a business
  const updateBusiness = useCallback(async (businessId: string, updates: Partial<BusinessData>) => {
    if (!user) {
      throw new Error('User must be authenticated to update a business');
    }

    try {
      const businessRef = doc(db, 'businesses', businessId);
      
      // Remove fields that shouldn't be updated directly
      const { id, userId, createdAt, ...allowedUpdates } = updates;
      
      await updateDoc(businessRef, {
        ...allowedUpdates,
        updatedAt: serverTimestamp(),
      });

      // Update selected business if it's the one being updated
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(prev => prev ? { ...prev, ...allowedUpdates, updatedAt: new Date() } : null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update business';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, selectedBusiness]);

  // Delete a business
  const deleteBusiness = useCallback(async (businessId: string) => {
    if (!user) {
      throw new Error('User must be authenticated to delete a business');
    }

    try {
      await deleteDoc(doc(db, 'businesses', businessId));

      // If the deleted business was selected, clear selection
      if (selectedBusiness?.id === businessId) {
        setSelectedBusiness(null);
        AsyncStorage.removeItem('selectedBusinessId');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete business';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, [user, selectedBusiness]);

  // Select a business (with access restrictions)
  const selectBusiness = useCallback((businessId: string | null) => {
    if (businessId) {
      const business = getBusinessById(businessId);
      if (business && isBusinessAccessible(businessId)) {
        setSelectedBusiness(business);
        AsyncStorage.setItem('selectedBusinessId', businessId);
      } else {
        console.warn('🚫 Business not accessible or not found:', businessId);
        // If trying to select an inaccessible business, select the first accessible one
        const accessibleBusinesses = getAccessibleBusinesses();
        if (accessibleBusinesses.length > 0) {
          setSelectedBusiness(accessibleBusinesses[0]);
          AsyncStorage.setItem('selectedBusinessId', accessibleBusinesses[0].id!);
        }
      }
    } else {
      setSelectedBusiness(null);
      AsyncStorage.removeItem('selectedBusinessId');
    }
  }, [getBusinessById, isBusinessAccessible, getAccessibleBusinesses]);

  // Refresh businesses from Firestore
  const refreshBusinesses = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      // The real-time listener will handle the update
      // This function is mainly for manual refresh triggers
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh businesses';
      setError(errorMessage);
      setLoading(false);
    }
  }, [user]);

  // Set up real-time listener for businesses
  useEffect(() => {
    if (!user) {
      setBusinesses([]);
      setSelectedBusiness(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const businessesQuery = query(
      collection(db, 'businesses'),
      where('userId', '==', user.uid),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(
      businessesQuery,
      (snapshot) => {
        const businessList: BusinessData[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          businessList.push({
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
              lastReceiptDate: data.stats?.lastReceiptDate && typeof data.stats.lastReceiptDate.toDate === 'function' 
                ? data.stats.lastReceiptDate.toDate() 
                : null,
            },
            isActive: data.isActive,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        });

        console.log('🏢 BusinessContext: Loaded businesses:', businessList.map(b => ({ id: b.id, name: b.name })));
        setBusinesses(businessList);

        // Restore selected business from AsyncStorage with access restrictions
        const restoreSelectedBusiness = async () => {
          try {
            const savedBusinessId = await AsyncStorage.getItem('selectedBusinessId');
            
            // Get accessible businesses for current tier
            const tempAccessibleBusinesses = !canAccessFeature('multiBusinessManagement') && businessList.length > 1
              ? [businessList.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]]
              : businessList;
            
            if (savedBusinessId) {
              const savedBusiness = businessList.find(b => b.id === savedBusinessId);
              const isAccessible = tempAccessibleBusinesses.some(b => b.id === savedBusinessId);
              
              if (savedBusiness && isAccessible) {
                setSelectedBusiness(savedBusiness);
              } else {
                // Saved business no longer exists or is not accessible, clear it and select first accessible
                console.log('🔄 Switching to accessible business due to tier restriction or missing business');
                await AsyncStorage.removeItem('selectedBusinessId');
                if (tempAccessibleBusinesses.length > 0) {
                  setSelectedBusiness(tempAccessibleBusinesses[0]);
                  await AsyncStorage.setItem('selectedBusinessId', tempAccessibleBusinesses[0].id!);
                } else {
                  setSelectedBusiness(null);
                }
              }
            } else if (tempAccessibleBusinesses.length === 1) {
              // Auto-select the only accessible business
              setSelectedBusiness(tempAccessibleBusinesses[0]);
              await AsyncStorage.setItem('selectedBusinessId', tempAccessibleBusinesses[0].id!);
            } else if (tempAccessibleBusinesses.length === 0) {
              // No accessible businesses
              console.log('⚠️ No accessible businesses found.');
              setSelectedBusiness(null);
            }
          } catch (error) {
            console.error('Error restoring selected business:', error);
          }
          setLoading(false);
        };

        restoreSelectedBusiness();
      },
      (err) => {
        console.error('Error listening to businesses:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user]);

  const contextValue: BusinessContextType = {
    businesses,
    accessibleBusinesses: getAccessibleBusinesses(),
    selectedBusiness,
    loading,
    error,
    createBusiness,
    updateBusiness,
    deleteBusiness,
    selectBusiness,
    canCreateBusiness,
    getBusinessById,
    refreshBusinesses,
    isBusinessAccessible,
  };

  return (
    <BusinessContext.Provider value={contextValue}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => {
  const context = useContext(BusinessContext);
  if (context === undefined) {
    throw new Error('useBusiness must be used within a BusinessProvider');
  }
  return context;
};