// RevenueCat service for handling payments and subscriptions
import Purchases, { PurchasesOffering, PurchasesPackage, CustomerInfo } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Types for RevenueCat operations
export interface RevenueCatCustomer {
  originalAppUserId: string;
  originalApplicationVersion: string;
  requestDate: string;
  firstSeen: string;
  nonSubscriptionTransactions: any[];
  subscriptions: { [key: string]: any };
  entitlements: { [key: string]: any };
}

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  trial: {
    id: 'trial',
    name: 'Trial',
    monthlyPrice: 0,
    annualPrice: 0,
    productIds: {
      monthly: null,
      annual: null
    },
    features: [
      `${Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || 10} receipts per month`,
      'Basic categorization',
      'Email support'
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || "10", 10)
    }
  },
  free: {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    annualPrice: 0,
    productIds: {
      monthly: null,
      annual: null
    },
    features: [
      `${Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || 10} receipts per month`,
      'Basic categorization',
      'Email support'
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || "10", 10)
    }
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 9.00,
    annualPrice: 90.00,
    productIds: {
      monthly: 'rc_starter',
      annual: null
    },
    features: [
      'Unlimited receipt storage',
      'Basic expense categorization',
      'LLC-specific categories',
      'Monthly/yearly reports',
      'Email support',
      'Educational content'
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.STARTER_TIER_MAX_RECEIPTS || "50", 10)
    }
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 19.00,
    annualPrice: 190.00,
    productIds: {
      monthly: 'rc_growth_monthly',
      annual: 'rc_growth_annual'
    },
    popular: true,
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.GROWTH_TIER_MAX_RECEIPTS || "150", 10)
    },
    features: [
      'Everything in Starter',
      'Advanced reporting & analytics',
      'Tax preparation tools',
      'QuickBooks & Xero integration',
      'Priority support',
      'Quarterly tax reminders',
      'Expense trend analysis'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 39.00,
    annualPrice: 390.00,
    productIds: {
      monthly: 'rc_professional_monthly',
      annual: 'rc_professional_annual'
    },
    features: [
      'Everything in Growth',
      'Multi-business management',
      'White-label options',
      'API access',
      'Dedicated account manager',
      'Custom compliance workflows',
      'Bulk client management'
    ]
  },
  teammate: {
    id: 'teammate',
    name: 'Teammate',
    monthlyPrice: 0,
    annualPrice: 0,
    productIds: {
      monthly: null,
      annual: null
    },
    features: [
      'Team member access',
      'Limited features'
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
    }
  }
} as const;

export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS;

// Entitlement identifiers (configured in RevenueCat dashboard)
export const ENTITLEMENTS = {
  PROFESSIONAL_ACCESS: 'Pro', // Single entitlement for all paid tiers (matches RevenueCat dashboard)
} as const;

class RevenueCatService {
  private isInitialized = false;
  private offerings: PurchasesOffering | null = null;

  // Initialize RevenueCat
  async initialize(userId?: string): Promise<void> {
    try {
      if (this.isInitialized) {
        console.log('RevenueCat already initialized');
        return;
      }

      console.log('Initializing RevenueCat...');
      
      // Get API keys from environment
      const appleApiKey = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY;
      const googleApiKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;

      if (Platform.OS === 'ios' && !appleApiKey) {
        throw new Error('RevenueCat Apple API key not found');
      }
      if (Platform.OS === 'android' && !googleApiKey) {
        throw new Error('RevenueCat Google API key not found');
      }

      const apiKey = Platform.OS === 'ios' ? appleApiKey! : googleApiKey!;
      
      // Configure RevenueCat
      Purchases.configure({ apiKey, appUserID: userId });
      
      // Fetch offerings
      await this.fetchOfferings();
      
      this.isInitialized = true;
      console.log('✅ RevenueCat initialized successfully');
    } catch (error) {
      console.error('❌ RevenueCat initialization failed:', error);
      throw error;
    }
  }

  // Fetch available offerings from RevenueCat
  async fetchOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      
      if (offerings.current) {
        this.offerings = offerings.current;
        return offerings.current;
      } else {
        console.warn('No current offering configured in RevenueCat');
        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch offerings:', error);
      return null;
    }
  }

  // Get customer info
  async getCustomerInfo(): Promise<CustomerInfo> {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      return customerInfo;
    } catch (error) {
      console.error('❌ Failed to get customer info:', error);
      throw error;
    }
  }

  // Check if user has specific entitlement
  async hasEntitlement(entitlementId: string): Promise<boolean> {
    try {
      const customerInfo = await this.getCustomerInfo();
      return customerInfo.entitlements.active[entitlementId] !== undefined;
    } catch (error) {
      console.error('❌ Error checking entitlement:', error);
      return false;
    }
  }

  // Get current subscription tier based on active entitlements and products
  async getCurrentTier(): Promise<SubscriptionTierKey> {
    try {
      const customerInfo = await this.getCustomerInfo();
      const activeEntitlements = customerInfo.entitlements.active;
      const activeSubscriptions = customerInfo.activeSubscriptions;

      // Check if user has the professional entitlement (all paid tiers)
      if (activeEntitlements[ENTITLEMENTS.PROFESSIONAL_ACCESS]) {
        
        // Determine specific tier based on active product
        for (const productId of activeSubscriptions) {
          
          if (productId === 'rc_professional_monthly' || productId === 'rc_professional_annual') {
            return 'professional';
          } else if (productId === 'rc_growth_monthly' || productId === 'rc_growth_annual') {
            return 'growth';
          } else if (productId === 'rc_starter') {
            return 'starter';
          }
        }
        
        // If we have the entitlement but can't determine the specific tier, default to starter
        return 'starter';
      }
      
      return 'free';
    } catch (error) {
      console.error('❌ Error getting current tier:', error);
      return 'free';
    }
  }

  // Purchase a subscription
  async purchaseSubscription(productId: string): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    try {

      // Get all offerings to search across them
      const offerings = await Purchases.getOfferings();
      if (!offerings || Object.keys(offerings.all).length === 0) {
        throw new Error('No offerings available');
      }

      // Find the package with the specified product ID across ALL offerings
      let packageToPurchase: PurchasesPackage | undefined;
      
      for (const [, offering] of Object.entries(offerings.all)) {
        const foundPackage = offering.availablePackages.find(
          pkg => pkg.product.identifier === productId
        );
        
        if (foundPackage) {
          packageToPurchase = foundPackage;
          break;
        }
      }

      if (!packageToPurchase) {
        throw new Error(`Product ${productId} not found in offerings`);
      }

      // Make the purchase
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      return {
        success: true,
        customerInfo,
      };
    } catch (error) {
      console.error('❌ Purchase failed:', error);
      
      if (error instanceof Error) {
        return {
          success: false,
          error: error.message,
        };
      }
      
      return {
        success: false,
        error: 'Unknown error occurred during purchase',
      };
    }
  }

  // Restore purchases
  async restorePurchases(): Promise<{
    success: boolean;
    customerInfo?: CustomerInfo;
    error?: string;
  }> {
    try {
      const customerInfo = await Purchases.restorePurchases();

      return {
        success: true,
        customerInfo,
      };
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Login user (identify user to RevenueCat)
  async loginUser(userId: string): Promise<void> {
    try {
      await Purchases.logIn(userId);
    } catch (error) {
      console.error('❌ Failed to login user:', error);
      throw error;
    }
  }

  // Logout user
  async logoutUser(): Promise<void> {
    try {
      await Purchases.logOut();
    } catch (error) {
      console.error('❌ Failed to logout user:', error);
      throw error;
    }
  }

  // Get subscription tier configuration
  getSubscriptionTier(tierId: SubscriptionTierKey) {
    return SUBSCRIPTION_TIERS[tierId];
  }

  // Get product ID based on tier and billing period
  getProductId(tierId: SubscriptionTierKey, billingPeriod: 'monthly' | 'annual'): string | null {
    const tier = this.getSubscriptionTier(tierId);
    return tier.productIds[billingPeriod];
  }

  // Format price for display
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  // Get available packages from current offering
  getAvailablePackages(): PurchasesPackage[] {
    return this.offerings?.availablePackages || [];
  }

  // Start subscription process for mobile
  async startSubscription(
    tierId: SubscriptionTierKey,
    billingPeriod: 'monthly' | 'annual' = 'monthly',
    userId?: string
  ): Promise<{
    success: boolean;
    error?: string;
    customerInfo?: CustomerInfo;
  }> {
    try {
      console.log(`🚀 Starting subscription for tier: ${tierId} (${billingPeriod})`);

      if (!this.isInitialized) {
        await this.initialize(userId);
      }

      const productId = this.getProductId(tierId, billingPeriod);
      
      if (!productId) {
        throw new Error('Invalid subscription tier - no product ID');
      }

      // Purchase the subscription
      const result = await this.purchaseSubscription(productId);
      
      if (result.success) {
        console.log('✅ Subscription started successfully!');
        return {
          success: true,
          customerInfo: result.customerInfo,
        };
      } else {
        throw new Error(result.error || 'Purchase failed');
      }
    } catch (error) {
      console.error('❌ Subscription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const revenueCatService = new RevenueCatService();
export default revenueCatService;