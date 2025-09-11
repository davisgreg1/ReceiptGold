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

export type SubscriptionTier = "trial" | "free" | "starter" | "growth" | "professional" | "teammate";

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
  trial: {
    isActive: boolean;
    startedAt: Date | null;
    expiresAt: Date | null;
    daysRemaining: number;
  };
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
  startTrial: () => Promise<{ success: boolean; error?: string }>;
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
    free: parseInt(extra.FREE_TIER_MAX_RECEIPTS || "10", 10),
    starter: parseInt(extra.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(extra.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(extra.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
    teammate: parseInt(extra.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10),
  };
};

const getFeaturesByTier = (tier: SubscriptionTier, teamMemberRole?: string): SubscriptionFeatures => {
  const limits = getReceiptLimits();

  switch (tier) {
    case "trial":
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
        teamManagement: false,
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
const computeTrialData = (trialData: any) => {
  if (!trialData) {
    return {
      isActive: false,
      startedAt: null,
      expiresAt: null,
      daysRemaining: 0,
    };
  }

  const startedAt = trialData.startedAt?.toDate() || null;
  const expiresAt = trialData.expiresAt?.toDate() || null;
  const now = new Date();
  const isActive = !!(expiresAt && now < expiresAt);
  const daysRemaining = expiresAt 
    ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    isActive,
    startedAt,
    expiresAt,
    daysRemaining,
  };
};

const computeSubscriptionLimits = (effectiveTier: SubscriptionTier, receiptLimits: any) => {
  return {
    maxReceipts:
      effectiveTier === "professional" || effectiveTier === "trial" || effectiveTier === "teammate"
        ? receiptLimits.professional
        : effectiveTier === "growth"
        ? receiptLimits.growth
        : effectiveTier === "starter"
        ? receiptLimits.starter
        : receiptLimits.free,
    maxBusinesses:
      effectiveTier === "professional" || effectiveTier === "trial"
        ? -1
        : effectiveTier === "teammate"
        ? 1 // Teammates work within assigned business
        : 1, // 1 for others
    apiCallsPerMonth:
      effectiveTier === "professional" || effectiveTier === "trial"
        ? -1
        : effectiveTier === "growth"
        ? 1000
        : 0,
    maxReports:
      effectiveTier === "professional" || effectiveTier === "trial"
        ? -1
        : effectiveTier === "growth"
        ? 50
        : effectiveTier === "starter"
        ? 10
        : 3,
    maxTeamMembers:
      effectiveTier === "professional" || effectiveTier === "trial"
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


        // Update state
        setCurrentReceiptCount(count);

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
    currentTier: "free",
    features: getFeaturesByTier("free"),
    limits: {
      maxReceipts: limits.free,
      maxBusinesses: 1,
      apiCallsPerMonth: 0,
      maxReports: 3,
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
    trial: {
      isActive: false,
      startedAt: null,
      expiresAt: null,
      daysRemaining: 0,
    },
  });
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
        currentTier: "free",
        features: getFeaturesByTier("free"),
        limits: {
          maxReceipts: limits.free,
          maxBusinesses: 1,
          apiCallsPerMonth: 0,
          maxReports: 3,
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
        trial: {
          isActive: false,
          startedAt: null,
          expiresAt: null,
          daysRemaining: 0,
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

          const currentTier = (data.currentTier || "free") as SubscriptionTier;
          
          // OPTIMIZATION: Use memoized trial calculation
          const trialData = computeTrialData(data.trial);
          const effectiveTier = trialData.isActive ? "trial" : (currentTier === "trial" ? "free" : currentTier);
          

          // OPTIMIZATION: Use memoized limits calculation
          const receiptLimits = getReceiptLimits();
          const limits = computeSubscriptionLimits(effectiveTier, receiptLimits);

          // OPTIMIZATION: Use memoized team member override logic
          const baseState = {
            currentTier: effectiveTier,
            features: getFeaturesByTier(effectiveTier),
            limits: limits,
          };

          const { currentTier: finalTier, features: finalFeatures, limits: finalLimits } = isTeamMember 
            ? applyTeamMemberOverrides(baseState, teamMemberRole)
            : baseState;


          const newSubscriptionState = {
            currentTier: finalTier,
            features: finalFeatures,
            limits: finalLimits,
            isActive: effectiveTier !== "free" && (data.status === "active" || trialData.isActive),
            expiresAt: trialData.isActive 
              ? trialData.expiresAt
              : data.billing?.currentPeriodEnd
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
            trial: trialData,
          };

          setSubscription(newSubscriptionState);

          // OPTIMIZATION: Only refresh receipt count when tier actually changes
          const hasEffectiveTierChanged = previousTierRef.current !== effectiveTier;
          if (hasEffectiveTierChanged) {
            previousTierRef.current = effectiveTier;
            setTimeout(() => {
              refreshReceiptCount(undefined, { skipDelay: true, forceRefresh: true });
            }, 500); // Small delay to allow for Firestore consistency
          } else {
            // Update the ref even if no change to keep it current
            previousTierRef.current = effectiveTier;
          }

        } else {
          // New user - start with trial
          
          // Check if there might be existing RevenueCat subscriptions to restore
          try {
            const { revenueCatService } = await import('../services/revenuecatService');
            const currentTier = await revenueCatService.getCurrentTier(true); // force refresh
            
            if (currentTier !== 'free') {
              // Don't auto-sync - let user manually restore purchases
              // This will be handled by the restorePurchases function in useRevenueCatPayments
            }
          } catch (error) {
            console.warn('Failed to check RevenueCat:', error);
          }

          const now = new Date();
          const trialExpires = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days from now
          const receiptLimits = getReceiptLimits();
          
          // Create subscription document with trial
          const newSubscriptionData = {
            currentTier: "free",
            status: "active", 
            trial: {
              startedAt: now,
              expiresAt: trialExpires,
            },
            billing: {
              customerId: null,
              subscriptionId: null,
              priceId: null,
              currentPeriodStart: now,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              trialEnd: null,
            },
            createdAt: now,
            updatedAt: now,
          };
          
          
          // Save to Firestore
          try {
            const { setDoc } = await import('firebase/firestore');
            await setDoc(doc(db, "subscriptions", user.uid), newSubscriptionData);
          } catch (error) {
            console.error('Error creating trial subscription:', error);
            // Don't return early - still set local state even if Firestore write fails
          }
          
          // Override features for team members even for new users
          let newUserTier = "trial";
          let newUserFeatures = getFeaturesByTier("trial");
          let newUserLimits = {
            maxReceipts: receiptLimits.professional,
            maxBusinesses: -1,
            apiCallsPerMonth: -1,
            maxReports: -1,
            maxTeamMembers: 10,
          };

          if (isTeamMember) {
            newUserTier = "teammate";
            newUserFeatures = getFeaturesByTier("teammate", teamMemberRole);
            newUserLimits = {
              maxReceipts: -1, // Unlimited receipts for teammates
              maxBusinesses: 1, // Limited to assigned business
              apiCallsPerMonth: 0, // No API access
              maxReports: 0, // No reports for teammates
              maxTeamMembers: teamMemberRole === 'admin' ? 10 : 0, // Only admin teammates can manage team
            };
          }

          setSubscription({
            currentTier: newUserTier,
            features: newUserFeatures,
            limits: newUserLimits,
            isActive: true,
            expiresAt: trialExpires,
            billing: {
              customerId: null,
              subscriptionId: null,
              priceId: null,
              currentPeriodStart: now,
              currentPeriodEnd: null,
              cancelAtPeriodEnd: false,
              trialEnd: null,
            },
            trial: {
              isActive: !isTeamMember, // Team members don't get trial
              startedAt: now,
              expiresAt: trialExpires,
              daysRemaining: isTeamMember ? 0 : 3,
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
          trial: {
            isActive: false,
            startedAt: null,
            expiresAt: null,
            daysRemaining: 0,
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
  }, [user, limits.free, refreshReceiptCount, cancelRefresh, isTeamMember, teamMemberRole]); // Added team member dependencies

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

  // Trial management methods
  const startTrial = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user?.uid) {
      return { success: false, error: "No user authenticated" };
    }

    try {
      const now = new Date();
      const trialExpires = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000)); // 3 days from now
      
      const subscriptionData = {
        currentTier: "free",
        status: "active",
        trial: {
          startedAt: now,
          expiresAt: trialExpires,
        },
        updatedAt: now,
      };

      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, "subscriptions", user.uid), subscriptionData, { merge: true });
      
      return { success: true };
    } catch (error) {
      console.error("Error starting trial:", error);
      return { success: false, error: "Failed to start trial" };
    }
  }, [user?.uid]);

  const canAccessPremiumFeatures = useCallback((): boolean => {
    return subscription.currentTier !== "free" || subscription.trial.isActive;
  }, [subscription.currentTier, subscription.trial.isActive]);

  const hasProfessionalAccess = useCallback((): boolean => {
    return subscription.currentTier === "professional" || subscription.trial.isActive;
  }, [subscription.currentTier, subscription.trial.isActive]);

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
    refreshSubscription: refreshReceiptCount, // Use refreshReceiptCount as refreshSubscription
    isRefreshing,
    startTrial,
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