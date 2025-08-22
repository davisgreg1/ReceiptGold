import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
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
  bankConnection: boolean;
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
  loading: boolean;
  currentReceiptCount: number;
  refreshReceiptCount: () => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>;
  isRefreshing: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

import Constants from "expo-constants";

// Get receipt limits from environment variables
const getReceiptLimits = () => {
  const extra = Constants.expoConfig?.extra || {};
  return {
    free: parseInt(extra.FREE_TIER_MAX_RECEIPTS || "10", 10),
    starter: parseInt(extra.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(extra.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(extra.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
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
        bankConnection: false,
      };
    case "starter":
      return {
        maxReceipts: limits.starter,
        advancedReporting: false,
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
        bankConnection: false,
      };
    case "growth":
      return {
        maxReceipts: limits.growth,
        advancedReporting: true,
        taxPreparation: true,
        accountingIntegrations: true,
        prioritySupport: true,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
        bankConnection: false,
      };
    case "professional":
      return {
        maxReceipts: limits.professional,
        advancedReporting: true,
        taxPreparation: true,
        accountingIntegrations: true,
        prioritySupport: true,
        multiBusinessManagement: true,
        whiteLabel: true,
        apiAccess: true,
        dedicatedManager: true,
        bankConnection: true,
      };
  }
};

// Configuration for refresh behavior
const REFRESH_CONFIG = {
  MAX_RETRIES: 3,
  INITIAL_DELAY: 500,
  RETRY_DELAY: 1000,
  BACKOFF_MULTIPLIER: 1.5,
  TIMEOUT: 10000,
} as const;

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const limits = getReceiptLimits();
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Use refs to track refresh state and abort controller
  const refreshingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Improved refresh receipt count function
  const refreshReceiptCount = useCallback(
    async (
      options: {
        retryCount?: number;
        forceRefresh?: boolean;
        skipDelay?: boolean;
      } = {}
    ): Promise<{ success: boolean; count?: number; error?: string }> => {
      const {
        retryCount = 0,
        forceRefresh = false,
        skipDelay = false,
      } = options;

      // Early validation
      if (!user?.uid) {
        console.log("📊 refreshReceiptCount: No user ID available");
        return { success: false, error: "No user ID" };
      }

      if (refreshingRef.current && !forceRefresh) {
        console.log("📊 refreshReceiptCount: Already in progress, skipping");
        return { success: false, error: "Already refreshing" };
      }

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const { signal } = abortControllerRef.current;

      // Set refreshing state
      refreshingRef.current = true;
      setIsRefreshing(true);

      console.log(
        `📊 refreshReceiptCount: Starting${
          retryCount > 0
            ? ` (retry ${retryCount}/${REFRESH_CONFIG.MAX_RETRIES})`
            : ""
        } for user: ${user.uid}`
      );

      try {
        // Progressive delay strategy
        if (!skipDelay) {
          const delay =
            retryCount === 0
              ? REFRESH_CONFIG.INITIAL_DELAY
              : REFRESH_CONFIG.RETRY_DELAY *
                Math.pow(REFRESH_CONFIG.BACKOFF_MULTIPLIER, retryCount - 1);

          console.log(
            `📊 refreshReceiptCount: Waiting ${delay}ms before refresh`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        // Check if request was aborted during delay
        if (signal.aborted) {
          throw new Error("Request aborted");
        }

        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error("Request timeout"));
          }, REFRESH_CONFIG.TIMEOUT);

          // Clear timeout if signal is aborted
          signal.addEventListener("abort", () => {
            clearTimeout(timeoutId);
            reject(new Error("Request aborted"));
          });
        });

        // Race between the actual request and timeout
        const count = await Promise.race([
          getMonthlyReceiptCount(user.uid),
          timeoutPromise,
        ]);

        // Validate the response
        if (typeof count !== "number" || count < 0) {
          throw new Error(`Invalid count received: ${count}`);
        }

        console.log(
          `📊 refreshReceiptCount: Successfully retrieved count: ${count}`
        );

        // Update state
        setCurrentReceiptCount(count);

        return { success: true, count };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `📊 refreshReceiptCount: Error (attempt ${retryCount + 1}):`,
          errorMessage
        );

        // Handle aborted requests
        if (errorMessage.includes("aborted")) {
          console.log("📊 refreshReceiptCount: Request was cancelled");
          return { success: false, error: "cancelled" };
        }

        // Determine if error is retryable
        const isRetryableError =
          !errorMessage.includes("permission") &&
          !errorMessage.includes("unauthorized") &&
          !errorMessage.includes("not-found") &&
          retryCount < REFRESH_CONFIG.MAX_RETRIES;

        if (isRetryableError) {
          console.log(`📊 refreshReceiptCount: Retrying...`);
          return refreshReceiptCount({
            retryCount: retryCount + 1,
            forceRefresh: true,
            skipDelay: false,
          });
        }

        // Max retries reached or non-retryable error
        console.error(
          `📊 refreshReceiptCount: Failed after ${retryCount + 1} attempts:`,
          errorMessage
        );
        return { success: false, error: errorMessage };
      } finally {
        refreshingRef.current = false;
        setIsRefreshing(false);
        abortControllerRef.current = null;
      }
    },
    [user?.uid]
  );

  // Cancel ongoing refresh (useful for cleanup)
  const cancelRefresh = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log("📊 refreshReceiptCount: Cancelled ongoing request");
    }
  }, []);

  // Quick refresh without delay
  const quickRefresh = useCallback(() => {
    return refreshReceiptCount({ skipDelay: true, forceRefresh: true });
  }, [refreshReceiptCount]);

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

  // Refresh receipt count when user changes
  useEffect(() => {
    if (user?.uid) {
      console.log(
        "🔄 SubscriptionContext: User changed, refreshing receipt count for:",
        user.uid
      );
      refreshReceiptCount();
    }

    // Cleanup on unmount or user change
    return () => {
      cancelRefresh();
    };
  }, [user?.uid, refreshReceiptCount, cancelRefresh]); // Fixed: Added proper dependencies

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
                : 1, // Unlimited for professional, 1 for others
            apiCallsPerMonth:
              currentTier === "professional"
                ? -1
                : currentTier === "growth"
                ? 1000
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

          // Refresh receipt count when subscription changes
          // This will trigger after Cloud Function updates
          console.log("🔄 Subscription changed, refreshing receipt count");
          setTimeout(() => {
            refreshReceiptCount({ skipDelay: true, forceRefresh: true });
          }, 500); // Small delay to allow for Firestore consistency

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
      cancelRefresh();
    };
  }, [user, limits.free, refreshReceiptCount, cancelRefresh]); // Fixed: Added proper dependencies

  const canAccessFeature = useCallback(
    (feature: keyof SubscriptionFeatures): boolean => {
      return subscription.features[feature] === true;
    },
    [subscription.features]
  );

  const canAddReceipt = useCallback(
    (currentReceiptCount: number): boolean => {
      const maxReceipts = subscription.limits.maxReceipts;
      return maxReceipts === -1 ? true : currentReceiptCount < maxReceipts;
    },
    [subscription.limits.maxReceipts]
  );

  const getRemainingReceipts = useCallback(
    (currentReceiptCount: number): number => {
      const maxReceipts = subscription.limits.maxReceipts;
      if (maxReceipts === -1) return -1; // unlimited
      return currentReceiptCount >= maxReceipts
        ? 0
        : maxReceipts - currentReceiptCount;
    },
    [subscription.limits.maxReceipts]
  );

  const contextValue = {
    subscription,
    canAccessFeature,
    canAddReceipt,
    getRemainingReceipts,
    loading,
    currentReceiptCount,
    refreshReceiptCount,
    isRefreshing,
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