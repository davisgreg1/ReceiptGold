import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

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

  useEffect(() => {
    const loadSubscription = async () => {
      if (user) {
        try {
          // TODO: Fetch user's actual subscription from your backend
          // For now, simulate with AsyncStorage for demo
          const savedTier = await AsyncStorage.getItem(`subscription_${user.uid}`) as SubscriptionTier;
          const tier = savedTier || 'free';
          const features = getFeaturesByTier(tier);
          
          setSubscription({
            tier,
            features,
            isActive: tier !== 'free',
            expiresAt: tier !== 'free' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null, // 30 days from now
          });
        } catch (error) {
          console.error('Failed to load subscription:', error);
          // Fall back to free tier on error
          setSubscription({
            tier: 'free',
            features: getFeaturesByTier('free'),
            isActive: false,
            expiresAt: null,
          });
        }
      } else {
        // Not authenticated = free tier
        setSubscription({
          tier: 'free',
          features: getFeaturesByTier('free'),
          isActive: false,
          expiresAt: null,
        });
      }
      setLoading(false);
    };

    loadSubscription();
  }, [user]);

  const canAccessFeature = (feature: keyof SubscriptionFeatures): boolean => {
    return subscription.features[feature] as boolean;
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
    setLoading(true);
    try {
      // TODO: Implement actual payment flow with Stripe/etc
      console.log(`Upgrading to ${tier}`);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo, save to AsyncStorage
      if (user) {
        await AsyncStorage.setItem(`subscription_${user.uid}`, tier);
      }
      
      const features = getFeaturesByTier(tier);
      setSubscription({
        tier,
        features,
        isActive: tier !== 'free',
        expiresAt: tier !== 'free' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
      });
    } catch (error) {
      console.error('Upgrade failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        canAccessFeature,
        canAddReceipt,
        getRemainingReceipts,
        upgradeTo,
        loading,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
