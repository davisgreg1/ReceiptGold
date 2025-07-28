import React, { createContext, useContext, useState, useEffect } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db } from "../config/firebase";

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
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

// Get receipt limits from environment variables
const getReceiptLimits = () => {
  return {
    free: parseInt(process.env.REACT_APP_FREE_TIER_MAX_RECEIPTS || "10", 10),
    starter: parseInt(process.env.REACT_APP_STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(process.env.REACT_APP_GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(process.env.REACT_APP_PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10)
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

      unsubscribe = onSnapshot(subscriptionRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (!data) return;

          const currentTier = (data.currentTier || "free") as SubscriptionTier;
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

      // Update Firestore - this will trigger the onSnapshot listener
      const subscriptionRef = doc(db, "subscriptions", user.uid);
      await updateDoc(subscriptionRef, {
        currentTier: tier,
        status: "active",
        updatedAt: new Date(),
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
