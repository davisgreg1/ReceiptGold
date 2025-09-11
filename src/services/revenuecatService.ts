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
  private isConfigurationValid = false;

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
      
      // Fetch offerings and check configuration
      const offeringsResult = await this.fetchOfferings();
      this.isConfigurationValid = offeringsResult !== null;
      
      this.isInitialized = true;
      
      if (this.isConfigurationValid) {
        console.log('✅ RevenueCat initialized successfully with valid configuration');
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
      console.log('🔍 Fetching offerings from RevenueCat...');
      const offerings = await Purchases.getOfferings();
      
      console.log('🔍 Raw offerings received:', {
        current: offerings.current?.identifier,
        allOfferings: Object.keys(offerings.all),
        totalOfferings: Object.keys(offerings.all).length
      });
      
      if (offerings.current) {
        console.log('✅ Found current offering:', offerings.current.identifier);
        console.log('📦 Available packages:', offerings.current.availablePackages.map(pkg => ({
          identifier: pkg.identifier,
          productId: pkg.product.identifier,
          productType: pkg.product.productType,
          price: pkg.product.priceString
        })));
        
        this.offerings = offerings.current;
        return offerings.current;
      } else {
        console.warn('⚠️ No current offering configured in RevenueCat dashboard');
        
        // Try to use the first available offering
        const allOfferingKeys = Object.keys(offerings.all);
        if (allOfferingKeys.length > 0) {
          const firstOffering = offerings.all[allOfferingKeys[0]];
          console.log('🔄 Using first available offering:', firstOffering.identifier);
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
          console.error('💡 Expected product IDs:', ['rc_starter', 'rc_growth_monthly', 'rc_growth_annual', 'rc_professional_monthly', 'rc_professional_annual']);
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
        console.log('🔄 Force refreshing customer info from RevenueCat servers...');
        // Force a fresh fetch by calling restorePurchases which updates the cache
        await Purchases.restorePurchases();
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

      console.log('🔍 === TIER DETECTION DEBUG START ===');
      console.log('🔍 Raw customer info keys:', Object.keys(customerInfo));
      console.log('🔍 Active entitlements:', Object.keys(activeEntitlements));
      console.log('🔍 Active entitlements details:', activeEntitlements);
      console.log('🔍 Active subscriptions array:', activeSubscriptions);

      // Check if user has the professional entitlement (all paid tiers)
      if (activeEntitlements[ENTITLEMENTS.PROFESSIONAL_ACCESS]) {
        console.log('✅ User has Pro entitlement, determining specific tier...');
        
        // In sandbox mode, users can have multiple active subscriptions
        // Get detailed subscription info to find the most recent purchase
        const allPurchaseDates = customerInfo.allPurchaseDates;
        const entitlementsInfo = customerInfo.entitlements.all;
        const allPurchaseKeys = Object.keys(allPurchaseDates);
        
        console.log('🔍 All purchase dates keys:', allPurchaseKeys);
        console.log('🔍 All purchase dates full object:', allPurchaseDates);
        console.log('🔍 All entitlements info:', Object.keys(entitlementsInfo));
        
        // Check if we have fresh purchase data vs cached data
        console.log('🔍 All purchased product identifiers:', customerInfo.allPurchasedProductIdentifiers);
        console.log('🔍 Latest expiration date:', customerInfo.latestExpirationDate);
        console.log('🔍 Request date:', customerInfo.requestDate);
        
        // Enhanced logging for each active subscription
        for (const productId of activeSubscriptions) {
          const purchaseDateRaw = allPurchaseDates[productId];
          console.log(`🔍 Product ID: ${productId}`);
          console.log(`   - Purchase Date Raw: ${purchaseDateRaw}`);
          console.log(`   - Purchase Date Type: ${typeof purchaseDateRaw}`);
          
          // Handle both string and Date types
          if (purchaseDateRaw) {
            const purchaseDate = typeof purchaseDateRaw === 'string' ? new Date(purchaseDateRaw) : purchaseDateRaw;
            console.log(`   - Purchase Date Parsed: ${purchaseDate.toISOString()}`);
          } else {
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
          
          console.log(`🔍 Comparing ${productId}: ${purchaseDate.toISOString()} vs current most recent: ${mostRecentDate.toISOString()}`);
          
          if (purchaseDate > mostRecentDate) {
            console.log(`🔍 New most recent found: ${productId} (${purchaseDate.toISOString()})`);
            mostRecentDate = purchaseDate;
            mostRecentProductId = productId;
          }
        }
        
        console.log(`🔍 Final most recent subscription: ${mostRecentProductId} (purchased: ${mostRecentDate})`);
        
        // Use the most recent subscription to determine tier
        if (mostRecentProductId) {
          console.log(`🔍 Checking most recent product ID: ${mostRecentProductId}`);
          
          // Check against all possible product IDs for each tier
          if (mostRecentProductId === 'rc_professional_monthly' || mostRecentProductId === 'rc_professional_annual') {
            console.log('✅ Detected professional tier (most recent)');
            console.log('🔍 === TIER DETECTION DEBUG END: PROFESSIONAL ===');
            return 'professional';
          } else if (mostRecentProductId === 'rc_growth_monthly' || mostRecentProductId === 'rc_growth_annual') {
            console.log('✅ Detected growth tier (most recent)'); 
            console.log('🔍 === TIER DETECTION DEBUG END: GROWTH ===');
            return 'growth';
          } else if (mostRecentProductId === 'rc_starter') {
            console.log('✅ Detected starter tier (most recent)');
            console.log('🔍 === TIER DETECTION DEBUG END: STARTER ===');
            return 'starter';
          } else {
            console.log(`⚠️ Unknown product ID: ${mostRecentProductId}`);
          }
        }
        
        // Fallback: check all subscriptions in reverse order (most recently added first)
        console.log('⚠️ Could not determine tier from purchase dates, using fallback logic');
        const subscriptionsToCheck = [...activeSubscriptions].reverse();
        console.log('🔍 Subscriptions to check in fallback:', subscriptionsToCheck);
        
        for (const productId of subscriptionsToCheck) {
          console.log(`🔍 Fallback - Checking product ID: ${productId}`);
          
          if (productId === 'rc_starter') {
            console.log('✅ Detected starter tier (fallback)');
            console.log('🔍 === TIER DETECTION DEBUG END: STARTER (FALLBACK) ===');
            return 'starter';
          } else if (productId === 'rc_growth_monthly' || productId === 'rc_growth_annual') {
            console.log('✅ Detected growth tier (fallback)'); 
            console.log('🔍 === TIER DETECTION DEBUG END: GROWTH (FALLBACK) ===');
            return 'growth';
          } else if (productId === 'rc_professional_monthly' || productId === 'rc_professional_annual') {
            console.log('✅ Detected professional tier (fallback)');
            console.log('🔍 === TIER DETECTION DEBUG END: PROFESSIONAL (FALLBACK) ===');
            return 'professional';
          } else {
            console.log(`⚠️ Unknown product ID in fallback: ${productId}`);
          }
        }
        
        // If we have the entitlement but can't determine the specific tier, default to starter
        console.log('⚠️ Have Pro entitlement but no matching product ID found, defaulting to starter');
        console.log('🔍 === TIER DETECTION DEBUG END: DEFAULT STARTER ===');
        return 'starter';
      }
      
      console.log('🔍 No Pro entitlement found, returning free tier');
      console.log('🔍 === TIER DETECTION DEBUG END: FREE ===');
      return 'free';
    } catch (error) {
      console.error('❌ Error getting current tier:', error);
      console.log('🔍 === TIER DETECTION DEBUG END: ERROR ===');
      return 'free';
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
            const purchaseDateRaw = allPurchaseDates[productId];
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
            if (mostRecentProductId.includes('_monthly')) {
              return 'monthly';
            } else if (mostRecentProductId.includes('_annual')) {
              return 'annual';
            } else if (mostRecentProductId === 'rc_starter') {
              // Starter is monthly only
              return 'monthly';
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
      console.log(`🛒 Attempting to purchase product: ${productId}`);

      // Get all offerings to search across them
      const offerings = await Purchases.getOfferings();
      console.log('🔍 Available offerings for purchase:', {
        current: offerings.current?.identifier,
        all: Object.keys(offerings.all),
        total: Object.keys(offerings.all).length
      });
      
      if (!offerings || Object.keys(offerings.all).length === 0) {
        throw new Error('RevenueCat configuration issue: No offerings available. Please check your RevenueCat dashboard setup.');
      }

      // Find the package with the specified product ID across ALL offerings
      let packageToPurchase: PurchasesPackage | undefined;
      
      for (const [offeringId, offering] of Object.entries(offerings.all)) {
        console.log(`🔍 Searching offering ${offeringId} for product ${productId}`);
        console.log(`📦 Available packages in ${offeringId}:`, offering.availablePackages.map(pkg => ({
          id: pkg.identifier,
          productId: pkg.product.identifier,
          price: pkg.product.priceString
        })));
        
        const foundPackage = offering.availablePackages.find(
          pkg => pkg.product.identifier === productId
        );
        
        if (foundPackage) {
          console.log(`✅ Found package for ${productId} in offering ${offeringId}`);
          packageToPurchase = foundPackage;
          break;
        }
      }

      if (!packageToPurchase) {
        const allAvailableProducts = Object.values(offerings.all)
          .flatMap(offering => offering.availablePackages.map(pkg => pkg.product.identifier));
        
        console.error(`❌ Product ${productId} not found in any offering`);
        console.error('💡 Available products:', allAvailableProducts);
        console.error('💡 Expected product IDs:', ['rc_starter', 'rc_growth_monthly', 'rc_growth_annual', 'rc_professional_monthly', 'rc_professional_annual']);
        
        throw new Error(
          `Product "${productId}" not found. This usually means the product isn't configured in your RevenueCat dashboard or App Store Connect. Available products: ${allAvailableProducts.join(', ')}`
        );
      }

      console.log(`🚀 Initiating purchase for package: ${packageToPurchase.identifier}`);
      
      // Make the purchase
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);

      console.log('✅ Purchase completed successfully!');
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
          
          console.log(`💰 Found product: ${productId} = ${priceString}`);

          // Map product IDs to tiers
          if (productId === 'rc_starter') {
            pricing.starter = pricing.starter || {};
            pricing.starter.monthly = { 
              price: priceString,
              pricePerMonth: priceString 
            };
          } else if (productId === 'rc_growth_monthly') {
            pricing.growth = pricing.growth || {};
            pricing.growth.monthly = { 
              price: priceString,
              pricePerMonth: priceString 
            };
          } else if (productId === 'rc_growth_annual') {
            pricing.growth = pricing.growth || {};
            pricing.growth.annual = { 
              price: priceString,
              pricePerMonth: pkg.product.pricePerMonth?.priceString || 'N/A'
            };
          } else if (productId === 'rc_professional_monthly') {
            pricing.professional = pricing.professional || {};
            pricing.professional.monthly = { 
              price: priceString,
              pricePerMonth: priceString 
            };
          } else if (productId === 'rc_professional_annual') {
            pricing.professional = pricing.professional || {};
            pricing.professional.annual = { 
              price: priceString,
              pricePerMonth: pkg.product.pricePerMonth?.priceString || 'N/A'
            };
          }
        }
      }

      console.log('💰 Final pricing mapping:', pricing);
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
      console.log(`🚀 Starting subscription for tier: ${tierId} (${billingPeriod})`);

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
     • rc_starter (Monthly subscription - $9/month)
     • rc_growth_monthly (Monthly subscription - $19/month)  
     • rc_growth_annual (Annual subscription - $190/year)
     • rc_professional_monthly (Monthly subscription - $39/month)
     • rc_professional_annual (Annual subscription - $390/year)

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