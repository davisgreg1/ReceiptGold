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
      'All features unlocked',
      'Unlimited receipts',
      'Advanced reporting & analytics',
      'Multi-business management',
      'Team management',
      'Premium support'
    ],
    limits: {
      maxReceipts: -1 // Unlimited during trial
    }
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 5.99,
    productIds: {
      monthly: 'rg_starter', // Actual product ID from RevenueCat
      annual: null
    },
    // Legacy product IDs for backward compatibility
    legacyProductIds: {
      monthly: '$rc_monthly', // Old product ID fallback
      annual: null
    },
    features: [
      '50 receipts per month',
      'Basic expense categorization',
      'LLC-specific categories',
      'Export reports',
      'Email support',
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.STARTER_TIER_MAX_RECEIPTS || "50", 10)
    }
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 9.99,
    annualPrice: 39.99,
    productIds: {
      monthly: 'rg_growth_monthly', // Actual product ID from RevenueCat
      annual: 'rg_growth_annual'    // Actual product ID from RevenueCat
    },
    // Legacy product IDs for backward compatibility
    legacyProductIds: {
      monthly: '$rc_monthly',
      annual: '$rc_annual'
    },
    popular: true,
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.GROWTH_TIER_MAX_RECEIPTS || "150", 10)
    },
    features: [
      'Everything in Starter',
      '150 receipts per month',
      'Advanced reporting & analytics',
      'Priority support',
      'Quarterly tax reminders',
      'Expense trend analysis'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: 12.99,
    annualPrice: 89.99,
    productIds: {
      monthly: 'rg_professional_monthly', // Actual product ID from RevenueCat
      annual: 'rg_professional_annual'    // Actual product ID from RevenueCat
    },
    // Legacy product IDs for backward compatibility
    legacyProductIds: {
      monthly: '$rc_monthly',
      annual: '$rc_annual'
    },
    features: [
      'Everything in Growth',
      'Unlimited receipts',
      'Multi-business management',
      'Add team members',
      'Generate receipts from bank transactions',
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
  private isConfigurationValid = false;

  // Initialize RevenueCat
  async initialize(userId?: string): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

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

      // Fetch offerings and check configuration
      const offeringsResult = await this.fetchOfferings();
      this.isConfigurationValid = offeringsResult !== null;

      this.isInitialized = true;

      if (this.isConfigurationValid) {
      } else {
        console.warn('⚠️ RevenueCat initialized but configuration may have issues (no offerings found)');
      }
    } catch (error) {
      console.error('❌ RevenueCat initialization failed:', error);
      throw error;
    }
  }

  // Fetch available offerings from RevenueCat
  async fetchOfferings(): Promise<PurchasesOffering | null> {
    try {
      const offerings = await Purchases.getOfferings();
      console.log("🚀 ~ RevenueCatService ~ fetchOfferings ~ offerings:", offerings)

      // Log all available packages for debugging
      if (offerings.current && offerings.current.availablePackages) {
        console.log("📦 Available packages:");
        offerings.current.availablePackages.forEach(pkg => {
          console.log(`  - Product ID: ${pkg.product.identifier}`);
          console.log(`    Package Type: ${pkg.packageType}`);
          console.log(`    Price: ${pkg.product.priceString}`);
        });
      }

      // First try to find the Default_Premium offering specifically
      if (offerings.all['Default_Premium']) {
        this.offerings = offerings.all['Default_Premium'];
        return offerings.all['Default_Premium'];
      }

      // Fallback to current offering if Default_Premium not found
      if (offerings.current) {
        this.offerings = offerings.current;
        return offerings.current;
      } else {
        console.warn('⚠️ Default_Premium offering not found in RevenueCat dashboard, and no current offering configured');

        // Try to use the first available offering
        const allOfferingKeys = Object.keys(offerings.all);
        if (allOfferingKeys.length > 0) {
          const firstOffering = offerings.all[allOfferingKeys[0]];
          console.warn(`⚠️ Using first available offering: ${allOfferingKeys[0]}`);
          this.offerings = firstOffering;
          return firstOffering;
        }

        return null;
      }
    } catch (error) {
      console.error('❌ Failed to fetch offerings:', error);

      // Enhanced error logging for common RevenueCat issues
      if (error instanceof Error) {
        if (error.message.includes('No products found')) {
          console.error('💡 RevenueCat Fix: Products not configured in App Store Connect or Google Play Console');
          console.error('💡 Expected product IDs:', ['rg_starter', 'rg_growth_monthly', 'rg_growth_annual', 'rg_professional_monthly', 'rg_professional_annual']);
        } else if (error.message.includes('configuration')) {
          console.error('💡 RevenueCat Fix: Check dashboard configuration and API keys');
        }
      }

      return null;
    }
  }

  // Get customer info
  async getCustomerInfo(forceRefresh: boolean = false): Promise<CustomerInfo> {
    try {
      if (forceRefresh) {
        // Force a fresh fetch by calling syncPurchases which updates the cache without OS prompts
        await Purchases.syncPurchases();
      }
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
  async getCurrentTier(forceRefresh: boolean = false): Promise<SubscriptionTierKey> {
    try {
      const customerInfo = await this.getCustomerInfo(forceRefresh);
      const activeEntitlements = customerInfo.entitlements.active;
      const activeSubscriptions = customerInfo.activeSubscriptions;

      // Check if user has the professional entitlement (all paid tiers)
      if (activeEntitlements[ENTITLEMENTS.PROFESSIONAL_ACCESS]) {

        // In sandbox mode, users can have multiple active subscriptions
        // Get detailed subscription info to find the most recent purchase
        const allPurchaseDates = customerInfo.allPurchaseDates;

        // Enhanced logging for each active subscription
        for (const productId of activeSubscriptions) {
          const purchaseDateRaw = allPurchaseDates[productId];

          // Handle both string and Date types
          if (!purchaseDateRaw) {
            console.log('   - Purchase Date: N/A');
          }
        }

        // Find the most recent subscription purchase from ALL purchases, not just active ones
        let mostRecentProductId: string | null = null;
        let mostRecentDate: Date = new Date(0); // Start with epoch

        // Check all purchase dates, not just active subscriptions
        for (const [productId, purchaseDateRaw] of Object.entries(allPurchaseDates)) {
          if (!purchaseDateRaw) continue;

          // Convert to Date object for comparison
          const purchaseDate = typeof purchaseDateRaw === 'string' ? new Date(purchaseDateRaw) : purchaseDateRaw;

          if (purchaseDate > mostRecentDate) {
            mostRecentDate = purchaseDate;
            mostRecentProductId = productId;
          }
        }

        // Use the most recent subscription to determine tier
        if (mostRecentProductId) {

          // Check against all possible product IDs for each tier (new and legacy)
          if (mostRecentProductId === 'rg_starter') {
            return 'starter';
          } else if (mostRecentProductId === 'rg_growth_monthly' || 
                     mostRecentProductId === 'rg_growth_annual') {
            return 'growth';
          } else if (mostRecentProductId === 'rg_professional_monthly' || 
                     mostRecentProductId === 'rg_professional_annual') {
            return 'professional';
          } else if (mostRecentProductId === '$rc_monthly' ||
                     mostRecentProductId === '$rc_annual') {
            return 'growth'; // Default legacy IDs to growth tier
          } else {
            console.log(`⚠️ Unknown product ID: ${mostRecentProductId}, defaulting to growth tier`);
            return 'growth'; // Default to growth for unknown product IDs
          }
        }

        // Fallback: check all subscriptions in reverse order (most recently added first)
        const subscriptionsToCheck = [...activeSubscriptions].reverse();

        for (const productId of subscriptionsToCheck) {

          if (productId === 'rg_starter') {
            return 'starter';
          } else if (productId === 'rg_growth_monthly' || 
                     productId === 'rg_growth_annual') {
            return 'growth';
          } else if (productId === 'rg_professional_monthly' || 
                     productId === 'rg_professional_annual') {
            return 'professional';
          } else if (productId === '$rc_monthly' ||
                     productId === '$rc_annual') {
            return 'growth'; // Default legacy IDs to growth tier
          } else {
            console.log(`⚠️ Unknown product ID in fallback: ${productId}, defaulting to growth`);
            return 'growth'; // Default to growth for unknown product IDs
          }
        }
        return 'growth'; // Changed from starter to growth as default
      }
      return 'trial'; // No active subscription - should trigger trial or paywall
    } catch (error) {
      return 'trial'; // Error - should trigger trial or paywall
    }
  }

  // Get current billing period based on active product ID
  async getCurrentBillingPeriod(forceRefresh: boolean = false): Promise<'monthly' | 'annual' | null> {
    try {
      const customerInfo = await this.getCustomerInfo(forceRefresh);
      const activeEntitlements = customerInfo.entitlements.active;

      if (activeEntitlements.pro) {
        const activeSubscriptions = customerInfo.activeSubscriptions;

        if (activeSubscriptions.length > 0) {
          // Get the most recent product ID
          const allPurchaseDates = customerInfo.allPurchaseDates;
          let mostRecentDate: Date | null = null;
          let mostRecentProductId: string | null = null;

          for (const productId of activeSubscriptions) {
            const purchaseDateRaw: any = allPurchaseDates[productId];
            if (purchaseDateRaw) {
              let purchaseDate: Date;
              if (purchaseDateRaw instanceof Date) {
                purchaseDate = purchaseDateRaw;
              } else if (typeof purchaseDateRaw === 'string') {
                purchaseDate = new Date(purchaseDateRaw);
              } else {
                continue;
              }

              if (!mostRecentDate || purchaseDate > mostRecentDate) {
                mostRecentDate = purchaseDate;
                mostRecentProductId = productId;
              }
            }
          }

          // Determine billing period from product ID
          if (mostRecentProductId) {
            if (mostRecentProductId === 'rg_starter' ||
                mostRecentProductId === 'rg_growth_monthly' || 
                mostRecentProductId === 'rg_professional_monthly' ||
                mostRecentProductId === '$rc_monthly') {
              return 'monthly';
            } else if (mostRecentProductId === 'rg_growth_annual' || 
                       mostRecentProductId === 'rg_professional_annual' ||
                       mostRecentProductId === '$rc_annual') {
              return 'annual';
            }
          }
        }
      }

      return null; // No active subscription or unable to determine
    } catch (error) {
      console.error('❌ Error getting current billing period:', error);
      return null;
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
        throw new Error('RevenueCat configuration issue: No offerings available. Please check your RevenueCat dashboard setup.');
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
        const allAvailableProducts = Object.values(offerings.all)
          .flatMap(offering => offering.availablePackages.map(pkg => pkg.product.identifier));

        console.error(`❌ Product ${productId} not found in any offering`);
        console.error('💡 Available products:', allAvailableProducts);
        console.error('💡 Expected product IDs:', ['rg_starter', 'rg_growth_monthly', 'rg_growth_annual', 'rg_professional_monthly', 'rg_professional_annual']);

        throw new Error(
          `Product "${productId}" not found. This usually means the product isn't configured in your RevenueCat dashboard or App Store Connect. Available products: ${allAvailableProducts.join(', ')}`
        );
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
        // Handle user cancellation gracefully
        if (error.message.includes('user cancelled') || error.message.includes('cancelled')) {
          return {
            success: false,
            error: 'Purchase was cancelled by user',
          };
        }

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
  async getProductId(tierId: SubscriptionTierKey, billingPeriod: 'monthly' | 'annual'): Promise<string | null> {
    const tier = this.getSubscriptionTier(tierId);
    
    // First try the new product IDs
    const preferredProductId = tier.productIds[billingPeriod];
    
    // Check if this product ID exists in our offerings
    if (preferredProductId && await this.isProductAvailable(preferredProductId)) {
      return preferredProductId;
    }
    
    // Fallback to legacy product IDs if they exist
    const legacyProductId = (tier as any).legacyProductIds?.[billingPeriod];
    if (legacyProductId && await this.isProductAvailable(legacyProductId)) {
      console.log(`📋 Using legacy product ID: ${legacyProductId} for ${tierId} ${billingPeriod}`);
      return legacyProductId;
    }
    
    // If neither work, try to find any package with the right billing period
    const allPackages = await this.getAllAvailablePackages();
    const matchingPackage = allPackages.find(pkg => {
      if (billingPeriod === 'monthly') {
        return pkg.packageType === 'MONTHLY' || pkg.product.identifier.includes('monthly');
      } else {
        return pkg.packageType === 'ANNUAL' || pkg.product.identifier.includes('annual');
      }
    });
    
    if (matchingPackage) {
      console.log(`📋 Auto-detected product ID: ${matchingPackage.product.identifier} for ${tierId} ${billingPeriod}`);
      return matchingPackage.product.identifier;
    }
    
    return null;
  }

  // Check if a product ID is available in current offerings
  private async isProductAvailable(productId: string): Promise<boolean> {
    try {
      const allPackages = await this.getAllAvailablePackages();
      return allPackages.some(pkg => pkg.product.identifier === productId);
    } catch (error) {
      return false;
    }
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

  // Get all available packages from all offerings
  async getAllAvailablePackages(): Promise<PurchasesPackage[]> {
    try {
      const offerings = await Purchases.getOfferings();
      const allPackages: PurchasesPackage[] = [];

      Object.values(offerings.all).forEach(offering => {
        allPackages.push(...offering.availablePackages);
      });

      return allPackages;
    } catch (error) {
      console.error('❌ Failed to get all packages:', error);
      return [];
    }
  }

  // Get product pricing from RevenueCat
  async getProductPricing(productId: string): Promise<{
    price: string;
    priceAmountMicros: number;
    priceCurrencyCode: string;
  } | null> {
    try {
      const allPackages = await this.getAllAvailablePackages();
      const packageInfo = allPackages.find(pkg => pkg.product.identifier === productId);

      if (packageInfo) {
        return {
          price: packageInfo.product.priceString,
          priceAmountMicros: packageInfo.product.price,
          priceCurrencyCode: packageInfo.product.currencyCode || 'USD'
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ Failed to get pricing for ${productId}:`, error);
      return null;
    }
  }

  // Check if RevenueCat is properly configured
  async isConfiguredProperly(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }

      const offerings = await Purchases.getOfferings();
      return offerings && Object.keys(offerings.all).length > 0;
    } catch (error) {
      return false;
    }
  }

  // Get actual pricing from RevenueCat offerings
  async getRevenueCatPricing(): Promise<{
    [key: string]: {
      monthly?: { price: string; pricePerMonth?: string };
      annual?: { price: string; pricePerMonth?: string };
    }
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const offerings = await Purchases.getOfferings();
      const pricing: any = {};

      if (!offerings || Object.keys(offerings.all).length === 0) {
        console.warn('⚠️ No RevenueCat offerings available for pricing');
        return {};
      }

      // Search through all offerings for our products
      for (const [, offering] of Object.entries(offerings.all)) {
        for (const pkg of offering.availablePackages) {
          const productId = pkg.product.identifier;
          const priceString = pkg.product.priceString;

          // Map product IDs to tiers (new and legacy)
          if (productId === 'rg_starter') {
            pricing.starter = pricing.starter || {};
            pricing.starter.monthly = {
              price: priceString,
              pricePerMonth: priceString
            };
          } else if (productId === 'rg_growth_monthly') {
            pricing.growth = pricing.growth || {};
            pricing.growth.monthly = {
              price: priceString,
              pricePerMonth: priceString
            };
          } else if (productId === 'rg_growth_annual') {
            pricing.growth = pricing.growth || {};
            pricing.growth.annual = {
              price: priceString,
              pricePerMonth: pkg.product.pricePerMonth ? `$${(pkg.product.pricePerMonth / 100).toFixed(2)}` : 'N/A'
            };
          } else if (productId === 'rg_professional_monthly') {
            pricing.professional = pricing.professional || {};
            pricing.professional.monthly = {
              price: priceString,
              pricePerMonth: priceString
            };
          } else if (productId === 'rg_professional_annual') {
            pricing.professional = pricing.professional || {};
            pricing.professional.annual = {
              price: priceString,
              pricePerMonth: pkg.product.pricePerMonth ? `$${(pkg.product.pricePerMonth / 100).toFixed(2)}` : 'N/A'
            };
          } else if (productId === '$rc_monthly') {
            // Legacy monthly product - map to growth tier by default
            pricing.growth = pricing.growth || {};
            pricing.growth.monthly = {
              price: priceString,
              pricePerMonth: priceString
            };
            console.log('📋 Mapped legacy $rc_monthly to growth tier');
          } else if (productId === '$rc_annual') {
            // Legacy annual product - map to growth tier by default
            pricing.growth = pricing.growth || {};
            pricing.growth.annual = {
              price: priceString,
              pricePerMonth: pkg.product.pricePerMonth ? `$${(pkg.product.pricePerMonth / 100).toFixed(2)}` : 'N/A'
            };
            console.log('📋 Mapped legacy $rc_annual to growth tier');
          } else {
            console.log(`⚠️ Unknown product ID for pricing: ${productId}`);
          }
        }
      }
      return pricing;
    } catch (error) {
      console.error('❌ Failed to get RevenueCat pricing:', error);
      return {};
    }
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

      if (!this.isInitialized) {
        await this.initialize(userId);
      }

      // Check if RevenueCat is properly configured
      if (!this.isConfigurationValid) {
        const detailedError = `
RevenueCat Configuration Required:

❌ RevenueCat is not properly configured for this app.

🔧 To fix this issue:

1. **App Store Connect Setup**:
   - Create these subscription products in App Store Connect:
     • rg_starter (Monthly subscription - $5.99/month)
     • rg_growth_monthly (Monthly subscription - $9.99/month)  
     • rg_growth_annual (Annual subscription - $39.99/year)
     • rg_professional_monthly (Monthly subscription - $12.99/month)
     • rg_professional_annual (Annual subscription - $89.99/year)

2. **RevenueCat Dashboard Setup**:
   - Go to https://app.revenuecat.com/
   - Add the above products to your project
   - Create an offering and add these products to it
   - Set one offering as the "Current" offering

3. **Verify API Keys**:
   - Apple API Key: ${process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY ? '✅ Found' : '❌ Missing'}
   - Google API Key: ${process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY ? '✅ Found' : '❌ Missing'}

Once configured, the subscription buttons will work properly.
        `.trim();

        console.error(detailedError);
        return {
          success: false,
          error: 'RevenueCat configuration required. Check console for setup instructions.',
        };
      }

      const productId = await this.getProductId(tierId, billingPeriod);

      if (!productId) {
        throw new Error('Invalid subscription tier - no product ID');
      }

      // Purchase the subscription
      const result = await this.purchaseSubscription(productId);

      if (result.success) {
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