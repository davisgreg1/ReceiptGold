import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { db } from '../config/firebase';

export type SubscriptionTier = 'free' | 'starter' | 'growth' | 'professional';

export interface SubscriptionFeatures {
  maxReceipts: number;
  advancedReporting: boolean;
  taxPreparation: boolean;
  accountingIntegrations: boolean;
  prioritySupport: boolean;
  multiBusinessManagement: boolean;
  whiteLabel: boolean;
  apiAccess: boolean;
  dedicatedManager: boolean;
}

export interface SubscriptionState {
  tier: SubscriptionTier;
  features: SubscriptionFeatures;
  isActive: boolean;
  expiresAt: Date | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionState;
  canAccessFeature: (feature: keyof SubscriptionFeatures) => boolean;
  canAddReceipt: (currentReceiptCount: number) => boolean;
  getRemainingReceipts: (currentReceiptCount: number) => number;
  upgradeTo: (tier: SubscriptionTier) => Promise<void>;
  loading: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const getFeaturesByTier = (tier: SubscriptionTier): SubscriptionFeatures => {
  switch (tier) {
    case 'free':
      return {
        maxReceipts: 10,
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case 'starter':
      return {
        maxReceipts: -1, // unlimited
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case 'growth':
      return {
        maxReceipts: -1, // unlimited
        advancedReporting: true,
        taxPreparation: true,
        accountingIntegrations: true,
        prioritySupport: true,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case 'professional':
      return {
        maxReceipts: -1, // unlimited
        advancedReporting: true,
        taxPreparation: true,
        accountingIntegrations: true,
        prioritySupport: true,
        multiBusinessManagement: true,
        whiteLabel: true,
        apiAccess: true,
        dedicatedManager: true,
      };
  }
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState>({
    tier: 'free',
    features: getFeaturesByTier('free'),
    isActive: false,
    expiresAt: null,
  });
  const [loading, setLoading] = useState(true);

  // Set up Firestore subscription
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!user) {
      setSubscription({
        tier: 'free',
        features: getFeaturesByTier('free'),
        isActive: false,
        expiresAt: null,
      });
      setLoading(false);
      return;
    }

    try {
      // Set up real-time subscription to Firestore
      const subscriptionRef = doc(db, 'subscriptions', user.uid);
      
      unsubscribe = onSnapshot(subscriptionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (!data) return;
          
          const tier = (data.currentTier || 'free') as SubscriptionTier;
          
          setSubscription({
            tier,
            features: getFeaturesByTier(tier),
            isActive: tier !== 'free' && data.status === 'active',
            expiresAt: data.billing?.currentPeriodEnd ? 
              (data.billing.currentPeriodEnd instanceof Date ? 
                data.billing.currentPeriodEnd : 
                data.billing.currentPeriodEnd.toDate()) : 
              null,
          });
        } else {
          setSubscription({
            tier: 'free',
            features: getFeaturesByTier('free'),
            isActive: false,
            expiresAt: null,
          });
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('Error setting up subscription listener:', error);
      setSubscription({
        tier: 'free',
        features: getFeaturesByTier('free'),
        isActive: false,
        expiresAt: null,
      });
      setLoading(false);
    }

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user]); // Only re-run if user changes

  const canAccessFeature = (feature: keyof SubscriptionFeatures): boolean => {
    return subscription.features[feature] === true;
  };

  const canAddReceipt = (currentReceiptCount: number): boolean => {
    const maxReceipts = subscription.features.maxReceipts;
    return maxReceipts === -1 || currentReceiptCount < maxReceipts;
  };

  const getRemainingReceipts = (currentReceiptCount: number): number => {
    const maxReceipts = subscription.features.maxReceipts;
    if (maxReceipts === -1) return -1; // unlimited
    return Math.max(0, maxReceipts - currentReceiptCount);
  };

  const upgradeTo = async (tier: SubscriptionTier): Promise<void> => {
    try {
      if (!user) {
        throw new Error('User must be logged in to upgrade subscription');
      }

      // Update Firestore - this will trigger the onSnapshot listener
      const subscriptionRef = doc(db, 'subscriptions', user.uid);
      await updateDoc(subscriptionRef, {
        currentTier: tier,
        updatedAt: new Date(),
      });

    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  };

  const contextValue = {
    subscription,
    canAccessFeature,
    canAddReceipt,
    getRemainingReceipts,
    upgradeTo,
    loading,
  };

  return (
    <SubscriptionContext.Provider value={contextValue}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Hook to use subscription context
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

export default SubscriptionProvider;

