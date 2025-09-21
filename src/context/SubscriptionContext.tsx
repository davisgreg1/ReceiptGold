import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  doc,
  onSnapshot,
  query,
  collection,
  where,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";
import { db } from "../config/firebase";
import { getMonthlyReceiptCount } from "../utils/getMonthlyReceipts";

export type SubscriptionTier = "starter" | "growth" | "professional" | "teammate";

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
  teamManagement: boolean;
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
    maxTeamMembers: number;
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
  refreshReceiptCount: (accountHolderId?: string) => Promise<{
    success: boolean;
    count?: number;
    error?: string;
  }>;
  refreshSubscription: () => Promise<{ success: boolean; error?: string }>;
  isRefreshing: boolean;
  canAccessPremiumFeatures: () => boolean;
  hasProfessionalAccess: () => boolean;
  getFeaturesForTeammate: (teamMemberRole?: string) => SubscriptionFeatures;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

import Constants from "expo-constants";

// Get receipt limits from environment variables
const getReceiptLimits = () => {
  const extra = Constants.expoConfig?.extra || {};
  return {
    starter: 2,
    // starter: parseInt(extra.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(extra.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(extra.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
    teammate: parseInt(extra.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10),
  };
};

const getFeaturesByTier = (tier: SubscriptionTier, teamMemberRole?: string): SubscriptionFeatures => {
  const limits = getReceiptLimits();

  switch (tier) {
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
        teamManagement: false,
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
        teamManagement: false,
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
        teamManagement: true,
      };
    case "teammate":
      return {
        maxReceipts: -1, // Unlimited receipts for teammates
        advancedReporting: false, // Limited features for teammates
        taxPreparation: false,
        accountingIntegrations: false,
        prioritySupport: false,
        multiBusinessManagement: false,
        whiteLabel: false,
        apiAccess: false,
        dedicatedManager: false,
        bankConnection: false, // No bank connections for teammates
        teamManagement: teamMemberRole === 'admin', // Only admin teammates can manage teams
      };
    default:
      // Fallback to starter tier for unknown tiers (no more free tier)
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
        teamManagement: false,
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

// OPTIMIZATION: Memoized helper functions to reduce expensive recalculations

const computeSubscriptionLimits = (effectiveTier: SubscriptionTier, receiptLimits: any) => {
  return {
    maxReceipts:
      effectiveTier === "professional" || effectiveTier === "teammate"
        ? receiptLimits.professional
        : effectiveTier === "growth"
        ? receiptLimits.growth
        : receiptLimits.starter,
    maxBusinesses:
      effectiveTier === "professional"
        ? -1
        : effectiveTier === "teammate"
        ? 1 // Teammates work within assigned business
        : 1, // 1 for others
    apiCallsPerMonth:
      effectiveTier === "professional"
        ? -1
        : effectiveTier === "growth"
        ? 1000
        : 0,
    maxReports:
      effectiveTier === "professional"
        ? -1
        : effectiveTier === "growth"
        ? 50
        : effectiveTier === "starter"
        ? 10
        : 5, // Reduced default for non-subscribers
    maxTeamMembers:
      effectiveTier === "professional"
        ? 10 // Reasonable limit for team members
        : effectiveTier === "teammate"
        ? 0 // Teammates can't have their own team members
        : 0, // No team members for lower tiers
  };
};

const applyTeamMemberOverrides = (baseState: any, teamMemberRole?: string) => {
  return {
    ...baseState,
    currentTier: "teammate",
    features: getFeaturesByTier("teammate", teamMemberRole),
    limits: {
      maxReceipts: -1, // Unlimited receipts for teammates
      maxBusinesses: 1, // Limited to assigned business
      apiCallsPerMonth: 0, // No API access
      maxReports: 0, // No reports for teammates
      maxTeamMembers: teamMemberRole === 'admin' ? 10 : 0, // Only admin teammates can manage team
    },
  };
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const limits = getReceiptLimits();
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [teamMemberRole, setTeamMemberRole] = useState<string | undefined>();
  
  // OPTIMIZATION: Track previous tier for receipt count refresh logic
  const previousTierRef = useRef<string | null>(null);

  // Use refs to track refresh state and abort controller
  const refreshingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Improved refresh receipt count function
  const refreshReceiptCount = useCallback(
    async (
      accountHolderIdParam?: string,
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
        return { success: false, error: "No user ID" };
      }

      if (refreshingRef.current && !forceRefresh) {
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


      try {
        // Progressive delay strategy
        if (!skipDelay) {
          const delay =
            retryCount === 0
              ? REFRESH_CONFIG.INITIAL_DELAY
              : REFRESH_CONFIG.RETRY_DELAY *
                Math.pow(REFRESH_CONFIG.BACKOFF_MULTIPLIER, retryCount - 1);

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

        // Use the provided accountHolderId parameter if available (for team members)

        // Race between the actual request and timeout
        const count = await Promise.race([
          getMonthlyReceiptCount(user.uid, accountHolderIdParam),
          timeoutPromise,
        ]);

        // Validate the response
        if (typeof count !== "number" || count < 0) {
          throw new Error(`Invalid count received: ${count}`);
        }


        // Update state - use functional update to ensure we get the latest state
        console.log('🔄 Updating currentReceiptCount from', currentReceiptCount, 'to', count);
        setCurrentReceiptCount(prevCount => {
          console.log('📊 State transition:', prevCount, '->', count);
          return count;
        });

        // Note: Tier synchronization is handled by updateSubscriptionAfterPayment Cloud Function
        // No additional sync needed here since we rely on the onSnapshot listener for real-time updates

        return { success: true, count };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `refreshReceiptCount: Error (attempt ${retryCount + 1}):`,
          errorMessage
        );

        // Handle aborted requests
        if (errorMessage.includes("aborted")) {
          return { success: false, error: "cancelled" };
        }

        // Determine if error is retryable
        const isRetryableError =
          !errorMessage.includes("permission") &&
          !errorMessage.includes("unauthorized") &&
          !errorMessage.includes("not-found") &&
          retryCount < REFRESH_CONFIG.MAX_RETRIES;

        if (isRetryableError) {
          return refreshReceiptCount(accountHolderIdParam, {
            retryCount: retryCount + 1,
            forceRefresh: true,
            skipDelay: false,
          });
        }

        // Max retries reached or non-retryable error
        console.error(
          `refreshReceiptCount: Failed after ${retryCount + 1} attempts:`,
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
    }
  }, []);


  // Detect team members for subscription inheritance
  useEffect(() => {
    const checkTeamMemberStatus = async () => {
      if (!user?.uid) {
        setIsTeamMember(false);
        setTeamMemberRole(undefined);
        return;
      }

      try {
        // Import TeamService dynamically to avoid circular dependencies
        const { TeamService } = await import('../services/TeamService');
        const membership = await TeamService.getTeamMembershipByUserId(user.uid);
        
        if (membership) {
          setIsTeamMember(true);
          setTeamMemberRole(membership.role);
        } else {
          setIsTeamMember(false);
          setTeamMemberRole(undefined);
        }
      } catch (error) {
        console.error('SubscriptionContext: Error checking team membership:', error);
        setIsTeamMember(false);
        setTeamMemberRole(undefined);
      }
    };

    checkTeamMemberStatus();
  }, [user?.uid]);

  const [subscription, setSubscription] = useState<SubscriptionState>({
    currentTier: "starter",
    features: getFeaturesByTier("starter"),
    limits: {
      maxReceipts: 50, // Starter tier limit
      maxBusinesses: 1,
      apiCallsPerMonth: 0,
      maxReports: 10,
      maxTeamMembers: 0,
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
  console.log("🚀 ~ SubscriptionProvider ~ subscription:", subscription)
  const [loading, setLoading] = useState(true);

  // Refresh receipt count when user changes
  useEffect(() => {
    if (user?.uid) {
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
        currentTier: "starter",
        features: getFeaturesByTier("starter"),
        limits: {
          maxReceipts: 50, // Starter tier limit
          maxBusinesses: 1,
          apiCallsPerMonth: 0,
          maxReports: 10,
          maxTeamMembers: 0,
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

    const setupSubscriptionListener = async () => {
      try {
        // Determine which subscription document to listen to
        let subscriptionUserId = user.uid;
        
        if (isTeamMember) {
          // For team members, get their account holder's subscription
          const { TeamService } = await import('../services/TeamService');
          const membership = await TeamService.getTeamMembershipByUserId(user.uid);
          console.log("🚀 ~ setupSubscriptionListener ~ membership:", membership)
          if (membership?.accountHolderId) {
            subscriptionUserId = membership.accountHolderId;
          } else {
            console.error('SubscriptionContext: Team member has no account holder ID');
          }
        } else {
        }

        // Set up real-time subscription to Firestore
        const subscriptionRef = doc(db, "subscriptions", subscriptionUserId);

        unsubscribe = onSnapshot(subscriptionRef, async (docSnapshot) => {
        
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          if (!data) {
            return;
          }

          const currentTier = (data.currentTier || "starter") as SubscriptionTier;
          console.log("🚀 ~ setupSubscriptionListener ~ currentTier:", currentTier)

          // OPTIMIZATION: Use memoized limits calculation
          const receiptLimits = getReceiptLimits();
          const limits = computeSubscriptionLimits(currentTier, receiptLimits);

          // OPTIMIZATION: Use memoized team member override logic
          const baseState = {
            currentTier: currentTier,
            features: getFeaturesByTier(currentTier),
            limits: limits,
          };

          const { currentTier: finalTier, features: finalFeatures, limits: finalLimits } = isTeamMember
            ? applyTeamMemberOverrides(baseState, teamMemberRole)
            : baseState;

          const newSubscriptionState = {
            currentTier: finalTier,
            features: finalFeatures,
            limits: finalLimits,
            isActive: data.status === 'active',
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
          };

          setSubscription(newSubscriptionState);

          // OPTIMIZATION: Only refresh receipt count when tier actually changes
          const hasEffectiveTierChanged = previousTierRef.current !== finalTier;
          if (hasEffectiveTierChanged) {
            previousTierRef.current = finalTier;
            setTimeout(() => {
              refreshReceiptCount(undefined, { skipDelay: true, forceRefresh: true });
            }, 500); // Small delay to allow for Firestore consistency
          } else {
            // Update the ref even if no change to keep it current
            previousTierRef.current = finalTier;
          }

        } else {
          // New user - start with starter plan

          // Check if there might be existing RevenueCat subscriptions to restore
          try {
            const { revenueCatService } = await import('../services/revenuecatService');
            const currentTier = await revenueCatService.getCurrentTier(true); // force refresh
            // Don't auto-sync - let user manually restore purchases
            // This will be handled by the restorePurchases function in useRevenueCatPayments
          } catch (error) {
            console.warn('Failed to check RevenueCat:', error);
          }

          // Note: Subscription document will be created by onUserCreate Cloud Function
          // We just set local state here temporarily until the Cloud Function completes

          let newUserTier: SubscriptionTier;
          let newUserFeatures: SubscriptionFeatures;
          let newUserLimits: any;

          if (isTeamMember) {
            // Team members get access based on their role
            newUserTier = "teammate";
            newUserFeatures = getFeaturesByTier("teammate", teamMemberRole);
            newUserLimits = {
              maxReceipts: -1, // Unlimited receipts for teammates
              maxBusinesses: 1, // Limited to assigned business
              apiCallsPerMonth: 0, // No API access
              maxReports: 0, // No reports for teammates
              maxTeamMembers: teamMemberRole === 'admin' ? 10 : 0, // Only admin teammates can manage team
            };
          } else {
            // New regular users get no access until they subscribe
            newUserTier = "starter";
            newUserFeatures = {
              maxReceipts: 0,
              advancedReporting: false,
              taxPreparation: false,
              accountingIntegrations: false,
              prioritySupport: false,
              multiBusinessManagement: false,
              whiteLabel: false,
              apiAccess: false,
              dedicatedManager: false,
              bankConnection: false,
              teamManagement: false,
            };
            newUserLimits = {
              maxReceipts: 0, // No receipts until they subscribe
              maxBusinesses: 0,
              apiCallsPerMonth: 0,
              maxReports: 0,
              maxTeamMembers: 0,
            };
          }

          setSubscription({
            currentTier: newUserTier,
            features: newUserFeatures,
            limits: newUserLimits,
            isActive: false, // No subscription document means no active subscription
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
          currentTier: "starter",
          features: {
            maxReceipts: 0,
            advancedReporting: false,
            taxPreparation: false,
            accountingIntegrations: false,
            prioritySupport: false,
            multiBusinessManagement: false,
            whiteLabel: false,
            apiAccess: false,
            dedicatedManager: false,
            bankConnection: false,
            teamManagement: false,
          },
          limits: {
            maxReceipts: 0, // No access until they subscribe
            maxBusinesses: 0,
            apiCallsPerMonth: 0,
            maxReports: 0,
            maxTeamMembers: 0,
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
    };

    // Call the async setup function
    setupSubscriptionListener();

    // Cleanup function
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      cancelRefresh();
    };
  }, [user, limits.starter, refreshReceiptCount, cancelRefresh, isTeamMember, teamMemberRole]); // Changed from limits.free to limits.starter


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


  const canAccessPremiumFeatures = useCallback((): boolean => {
    // Users can access premium features with paid subscription
    return subscription.isActive && subscription.currentTier !== "teammate";
  }, [subscription.currentTier, subscription.isActive]);

  const hasProfessionalAccess = useCallback((): boolean => {
    return subscription.currentTier === "professional" && subscription.isActive;
  }, [subscription.currentTier, subscription.isActive]);

  // Method to get features for teammates with role-based permissions
  const getFeaturesForTeammate = useCallback((teamMemberRole?: string): SubscriptionFeatures => {
    if (subscription.currentTier !== "teammate") {
      return subscription.features;
    }
    return getFeaturesByTier("teammate", teamMemberRole);
  }, [subscription.currentTier, subscription.features]);


  const contextValue = {
    subscription,
    canAccessFeature,
    canAddReceipt,
    getRemainingReceipts,
    loading,
    currentReceiptCount,
    refreshReceiptCount,
    refreshSubscription: async (): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log('🔄 Refreshing subscription state after purchase...');

        if (!user?.uid) {
          return { success: false, error: 'No user authenticated' };
        }

        // Force refresh from RevenueCat first
        try {
          const { revenueCatService } = await import('../services/revenuecatService');
          const customerInfo = await revenueCatService.getCustomerInfo(true); // force refresh
          console.log('🔄 RefreshedRevenueCat customer info:', {
            activeSubscriptions: customerInfo.activeSubscriptions,
            entitlements: Object.keys(customerInfo.entitlements.active || {})
          });
        } catch (revenueCatError) {
          console.warn('⚠️ Failed to refresh RevenueCat info:', revenueCatError);
        }

        // Force refresh from Firestore
        const { doc, getDoc } = await import('firebase/firestore');
        const subscriptionRef = doc(db, 'subscriptions', user.uid);
        const subscriptionSnap = await getDoc(subscriptionRef);

        if (subscriptionSnap.exists()) {
          const data = subscriptionSnap.data();
          console.log('🔄 Refreshed Firestore subscription data:', {
            currentTier: data.currentTier,
            status: data.status,
            hasActiveSubscription: !!data.billing?.subscriptionId
          });
        } else {
          console.log('🔄 No subscription document found in Firestore');
        }

        // Refresh receipt count as well
        await refreshReceiptCount();

        console.log('✅ Subscription refresh completed');
        return { success: true };
      } catch (error) {
        console.error('❌ Error refreshing subscription:', error);
        return { success: false, error: (error as Error).message };
      }
    },
    isRefreshing,
    canAccessPremiumFeatures,
    hasProfessionalAccess,
    getFeaturesForTeammate,
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