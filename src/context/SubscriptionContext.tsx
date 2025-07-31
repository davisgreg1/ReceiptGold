import React, { createContext, useContext, useState, useEffect } from "react";
import { 
  doc, 
  onSnapshot, 
  updateDoc, 
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  getDoc,
  DocumentData,
  QueryDocumentSnapshot
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db } from "../config/firebase";
import { getMonthlyReceiptCount } from "../utils/getMonthlyReceipts";

export type SubscriptionTier = "free" | "starter" | "growth" | "professional";

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

export interface BillingInfo {
  customerId: string | null;
  subscriptionId: string | null;
  priceId: string | null;
  currentPeriodStart: Date;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: Date | null;
}

export interface SubscriptionState {
  currentTier: string;
  features: SubscriptionFeatures;
  limits: {
    maxReceipts: number;
    maxBusinesses: number;
    apiCallsPerMonth: number;
    maxReports?: number;
  };
  isActive: boolean;
  expiresAt: Date | null;
  billing: BillingInfo;
}

interface SubscriptionContextType {
  subscription: SubscriptionState;
  canAccessFeature: (feature: keyof SubscriptionFeatures) => boolean;
  canAddReceipt: (currentReceiptCount: number) => boolean;
  getRemainingReceipts: (currentReceiptCount: number) => number;
  upgradeTo: (tier: SubscriptionTier) => Promise<void>;
  loading: boolean;
  currentReceiptCount: number;
  refreshReceiptCount: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

import Constants from 'expo-constants';

// Get receipt limits from environment variables
const getReceiptLimits = () => {
  const extra = Constants.expoConfig?.extra || {};
  return {
    free: parseInt(extra.FREE_TIER_MAX_RECEIPTS || "10", 10),
    starter: parseInt(extra.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(extra.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(extra.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10)
  };
};

const getFeaturesByTier = (tier: SubscriptionTier): SubscriptionFeatures => {
  const limits = getReceiptLimits();
  
  switch (tier) {
    case "free":
      return {
        maxReceipts: limits.free,
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case "starter":
      return {
        maxReceipts: limits.starter, // Configurable via environment
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case "growth":
      return {
        maxReceipts: limits.growth, // Configurable via environment
        advancedReporting: true,
        taxPreparation: true,
        accountingIntegrations: true,
        prioritySupport: true,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
      };
    case "professional":
      return {
        maxReceipts: limits.professional, // unlimited
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

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const limits = getReceiptLimits();
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  
  const refreshReceiptCount = async (retryCount = 0) => {
    if (!user?.uid) {
      console.log("🚀 ~ refreshReceiptCount ~ No user ID, skipping");
      return;
    }
    
    // Prevent multiple simultaneous refreshes
    if (refreshing) {
      console.log("🚀 ~ refreshReceiptCount ~ Already refreshing, skipping");
      return;
    }
    
    setRefreshing(true);
    console.log("🚀 ~ refreshReceiptCount ~ Starting refresh for user:", user.uid, "retry:", retryCount);
    console.log("🚀 ~ refreshReceiptCount ~ Current count before refresh:", currentReceiptCount);
    
    try {
      // Add a small delay to allow Firestore to propagate changes
      if (retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      const count = await getMonthlyReceiptCount(user.uid);
      console.log("🚀 ~ refreshReceiptCount ~ New count from getMonthlyReceiptCount:", count);
      
      // Update the count immediately
      setCurrentReceiptCount(count);
      console.log("🚀 ~ refreshReceiptCount ~ Set new count to state:", count);
    } catch (error) {
      console.error("🚀 ~ refreshReceiptCount ~ Error:", error);
    } finally {
      setRefreshing(false);
    }
  };

  const [subscription, setSubscription] = useState<SubscriptionState>({
    currentTier: "free",
    features: getFeaturesByTier("free"),
    limits: {
      maxReceipts: limits.free,
      maxBusinesses: 1,
      apiCallsPerMonth: 0,
      maxReports: 3,
    },
    isActive: false,
    expiresAt: null,
    billing: {
      customerId: null,
      subscriptionId: null,
      priceId: null,
      currentPeriodStart: new Date(),
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      trialEnd: null,
    },
  });
  const [loading, setLoading] = useState(true);

  // Refresh receipt count when subscription changes or user changes
  useEffect(() => {
    if (user?.uid) {
      console.log("🚀 ~ SubscriptionContext ~ Refreshing receipt count for user:", user.uid);
      refreshReceiptCount();
    }
  }, [user?.uid, subscription.currentTier]);

  // Set up Firestore subscription
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (!user) {
      setSubscription({
        currentTier: "free",
        features: getFeaturesByTier("free"),
        limits: {
          maxReceipts: limits.free,
          maxBusinesses: 1,
          apiCallsPerMonth: 0,
          maxReports: 3,
        },
        isActive: false,
        expiresAt: null,
        billing: {
          customerId: null,
          subscriptionId: null,
          priceId: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
        },
      });
      setLoading(false);
      return;
    }

    try {
      // Set up real-time subscription to Firestore
      const subscriptionRef = doc(db, "subscriptions", user.uid);

      unsubscribe = onSnapshot(subscriptionRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (!data) return;

          const currentTier = (data.currentTier || "free") as SubscriptionTier;

          // Initialize lastMonthlyCountResetAt if it doesn't exist
          // For free accounts, we should start counting from the beginning of the month
          if (!data.lastMonthlyCountResetAt && data.billing?.currentPeriodStart) {
            try {
              // For free accounts, use start of month instead of subscription creation time
              const resetDate = currentTier === 'free' 
                ? (() => {
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);
                    return startOfMonth;
                  })()
                : data.billing.currentPeriodStart;
                
              await updateDoc(subscriptionRef, {
                lastMonthlyCountResetAt: resetDate,
                updatedAt: new Date()
              });
              console.log("Initialized lastMonthlyCountResetAt for subscription:", currentTier, resetDate);
            } catch (error) {
              console.error("Error initializing lastMonthlyCountResetAt:", error);
            }
          }

          // TEMPORARY FIX: Force update for existing free accounts with wrong reset date
          if (currentTier === 'free' && data.lastMonthlyCountResetAt) {
            const currentResetDate = data.lastMonthlyCountResetAt.toDate();
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);
            
            // If the reset date is after the start of the month, update it
            if (currentResetDate > startOfMonth) {
              try {
                await updateDoc(subscriptionRef, {
                  lastMonthlyCountResetAt: startOfMonth,
                  updatedAt: new Date()
                });
                console.log("🔧 FIXED: Updated lastMonthlyCountResetAt for free account from", currentResetDate, "to", startOfMonth);
              } catch (error) {
                console.error("Error fixing lastMonthlyCountResetAt:", error);
              }
            }
          }

          console.log("Subscription updated:", {
            currentTier,
            status: data.status,
          });

          // Always compute the limits based on the current tier
          const receiptLimits = getReceiptLimits();
          const limits = {
            maxReceipts:
              currentTier === "professional"
                ? receiptLimits.professional
                : currentTier === "growth"
                ? receiptLimits.growth
                : currentTier === "starter"
                ? receiptLimits.starter
                : receiptLimits.free,
            maxBusinesses:
              currentTier === "professional"
                ? -1
                : currentTier === "growth"
                ? 3
                : currentTier === "starter"
                ? 1
                : 1,
            apiCallsPerMonth:
              currentTier === "professional"
                ? -1
                : currentTier === "growth"
                ? 1000
                : currentTier === "starter"
                ? 0
                : 0,
            maxReports:
              currentTier === "professional"
                ? -1
                : currentTier === "growth"
                ? 50
                : currentTier === "starter"
                ? 10
                : 3,
          };

          setSubscription({
            currentTier,
            features: getFeaturesByTier(currentTier),
            limits,
            isActive: currentTier !== "free" && data.status === "active",
            expiresAt: data.billing?.currentPeriodEnd
              ? data.billing.currentPeriodEnd instanceof Date
                ? data.billing.currentPeriodEnd
                : data.billing.currentPeriodEnd.toDate()
              : null,
            billing: {
              customerId: data.billing?.customerId || null,
              subscriptionId: data.billing?.subscriptionId || null,
              priceId: data.billing?.priceId || null,
              currentPeriodStart:
                data.billing?.currentPeriodStart?.toDate() || new Date(),
              currentPeriodEnd:
                data.billing?.currentPeriodEnd?.toDate() || null,
              cancelAtPeriodEnd: data.billing?.cancelAtPeriodEnd || false,
              trialEnd: data.billing?.trialEnd?.toDate() || null,
            },
          });
          
          // Refresh receipt count when subscription is loaded
          refreshReceiptCount();
        } else {
          setSubscription({
            currentTier: "free",
            features: getFeaturesByTier("free"),
            limits: {
              maxReceipts: limits.free,
              maxBusinesses: 1,
              apiCallsPerMonth: 0,
              maxReports: 3,
            },
            isActive: false,
            expiresAt: null,
            billing: {
              customerId: null,
              subscriptionId: null,
              priceId: null,
              currentPeriodStart: new Date(),
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              trialEnd: null,
            },
          });
        }
        setLoading(false);
      });
    } catch (error) {
      console.error("Error setting up subscription listener:", error);
      setSubscription({
        currentTier: "free",
        features: getFeaturesByTier("free"),
        limits: {
          maxReceipts: limits.free,
          maxBusinesses: 1,
          apiCallsPerMonth: 0,
          maxReports: 3,
        },
        isActive: false,
        expiresAt: null,
        billing: {
          customerId: null,
          subscriptionId: null,
          priceId: null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: null,
          cancelAtPeriodEnd: false,
          trialEnd: null,
        },
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
    const maxReceipts = subscription.limits.maxReceipts;
    // Only allow if unlimited or strictly under the limit
    return maxReceipts === -1 ? true : currentReceiptCount < maxReceipts;
  };

  const getRemainingReceipts = (currentReceiptCount: number): number => {
    const maxReceipts = subscription.limits.maxReceipts;
    if (maxReceipts === -1) return -1; // unlimited
    // If at or above the limit, always return 0
    return currentReceiptCount >= maxReceipts ? 0 : maxReceipts - currentReceiptCount;
  };

  const upgradeTo = async (tier: SubscriptionTier): Promise<void> => {
    try {
      if (!user) {
        throw new Error("User must be logged in to upgrade subscription");
      }

      const now = new Date();
      const batch = writeBatch(db);
      const subscriptionRef = doc(db, "subscriptions", user.uid);
      
      // Get current subscription to check if this is actually a tier change
      const currentSub = await getDoc(subscriptionRef);
      const currentTier = currentSub.data()?.currentTier || 'free';
      
      if (currentTier !== tier) {
        // This is a tier change, so reset monthly count
        
        // Get current month's receipts
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const receiptsQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", startOfMonth)
        );
        
        const receiptsSnapshot = await getDocs(receiptsQuery);
        
        // Mark all current month's receipts as excluded from the new tier's count
        receiptsSnapshot.docs.forEach((receiptDoc: DocumentData) => {
          batch.update(doc(db, "receipts", receiptDoc.id), {
            excludeFromMonthlyCount: true,
            monthlyCountExcludedAt: now,
            previousTier: currentTier
          });
        });
      }
      
      // Update subscription
      batch.update(subscriptionRef, {
        currentTier: tier,
        status: "active",
        updatedAt: now,
        lastMonthlyCountResetAt: tier !== currentTier ? now : currentSub.data()?.lastMonthlyCountResetAt,
        limits: {
          maxReceipts:
            tier === "free"
              ? getReceiptLimits().free
              : tier === "starter"
              ? getReceiptLimits().starter
              : tier === "growth"
              ? getReceiptLimits().growth
              : getReceiptLimits().professional,
          maxBusinesses:
            tier === "free"
              ? 1
              : tier === "starter"
              ? 1
              : tier === "growth"
              ? 3
              : -1,
          apiCallsPerMonth:
            tier === "free"
              ? 0
              : tier === "starter"
              ? 0
              : tier === "growth"
              ? 1000
              : -1,
          maxReports:
            tier === "free"
              ? 3
              : tier === "starter"
              ? 10
              : tier === "growth"
              ? 50
              : -1,
        },
        features: getFeaturesByTier(tier),
      });
      
      // Commit all changes
      await batch.commit();
    } catch (error) {
      console.error("Error upgrading subscription:", error);
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
    currentReceiptCount,
    refreshReceiptCount,
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
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }
  return context;
};

export default SubscriptionProvider;
