// Stripe service for handling payments and subscriptions
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { getAuth } from 'firebase/auth';
import Constants from 'expo-constants';

// Types for Stripe operations
export interface StripeCustomer {
  id: string;
  email: string;
  name: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  customer: string;
}

// Subscription tiers configuration
export const SUBSCRIPTION_TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
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
    price: 9.99,
    priceId: 'price_1RpYbuAZ9H3S1Eo7Qd3qk3IV', // Stripe price ID (not product ID)
    features: [
      `${Constants.expoConfig?.extra?.STARTER_TIER_MAX_RECEIPTS || 50} receipts per month`,
      'Basic reporting',
      'Email support',
      '1 Business profile'
    ],
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.STARTER_TIER_MAX_RECEIPTS || "50", 10)
    }
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 19.99,
    limits: {
      maxReceipts: parseInt(Constants.expoConfig?.extra?.GROWTH_TIER_MAX_RECEIPTS || "150", 10)
    },
    priceId: 'price_1RpYbeAZ9H3S1Eo75oTj2nHe', // Stripe price ID (not product ID)
    features: [
      `Everything in Starter + ${Constants.expoConfig?.extra?.GROWTH_TIER_MAX_RECEIPTS || 150} receipts`,
      'Advanced reporting',
      // 'OCR scanning',
      // '3 Business profiles',
      'Priority support'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 39.99,
    priceId: 'price_1RpYbJAZ9H3S1Eo78dUvxerL', // Stripe price ID (not product ID)
    features: [
      `Everything in Growth + unlimited receipts`,
      // 'White-label reports',
      // 'API access',
      'Unlimited businesses',
      // 'Dedicated manager'
    ]
  }
} as const;

export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS;

class StripeService {
  // Create Stripe customer via Cloud Function
  async createCustomer(email: string, name: string): Promise<string> {
    console.log("🚀 Starting customer creation with:", { email, name });
    try {
      // Verify auth first
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Authentication required to create customer');
      }
      console.log("� Current user:", {
        uid: currentUser.uid,
        email: currentUser.email
      });

      // Get fresh token
      const token = await currentUser.getIdToken(true);
      console.log("🔑 Got fresh auth token:", token.substring(0, 10) + "...");

      const createCustomer = httpsCallable(functions, 'createStripeCustomer');
      console.log("� Calling createStripeCustomer with:", { email, name });

      const result = await createCustomer({ email, name });
      console.log("📦 Raw customer creation response:", JSON.stringify(result, null, 2));

      if (!result.data) {
        throw new Error('No data returned from customer creation');
      }

      const data = result.data as { customerId: string };
      if (!data.customerId) {
        console.error('Invalid customer data structure:', data);
        throw new Error('Invalid customer response format');
      }

      console.log("✅ Successfully created customer:", { customerId: data.customerId });
      return data.customerId;
    } catch (error) {
      console.error('Detailed customer creation error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw the original error to preserve the stack trace
    }
  }

  // Create subscription and initialize PaymentSheet
  async createSubscriptionPayment(priceId: string, customerId: string): Promise<{ subscriptionId: string; clientSecret: string }> {
    console.log("🚀 Creating subscription with:", { priceId, customerId });
    try {
      if (!priceId) throw new Error('Price ID is required');
      if (!customerId) throw new Error('Customer ID is required');

      // Force token refresh before making the call
      const auth = getAuth();
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken(true); // Force refresh the token
        console.log("🔑 Got fresh auth token:", token.substring(0, 10) + "...");
        console.log("👤 Current user ID:", currentUser.uid);
      } else {
        throw new Error('Authentication required');
      }

      // Connect to the function
      const createSub = httpsCallable(functions, 'createSubscription');
      console.log("📞 Calling createSubscription function with:", { priceId, customerId });

      const result = await createSub({ priceId, customerId });
      console.log("📦 Raw subscription creation response:", JSON.stringify(result, null, 2));

      if (!result.data) throw new Error('No data returned from subscription creation');

      const data = result.data as { subscriptionId: string; clientSecret: string };
      console.log("🚀 ~ StripeService ~ createSubscriptionPaymentcreateSubscriptionPayment ~ data:", data)
      if (!data.subscriptionId || !data.clientSecret) {
        console.error('Invalid data structure:', data);
        throw new Error('Invalid subscription response format');
      }

      console.log("✅ Successfully created subscription:", {
        subscriptionId: data.subscriptionId,
        hasClientSecret: !!data.clientSecret
      });

      return data;
    } catch (error) {
      console.error('Detailed subscription error:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error; // Re-throw the original error to preserve the stack trace
    }
  }

  // Get subscription tier configuration
  getSubscriptionTier(tierId: SubscriptionTierKey) {
    return SUBSCRIPTION_TIERS[tierId];
  }

  // Format price for display
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }

  // Start subscription process for mobile
  async startSubscription(
    tierId: SubscriptionTierKey,
    userEmail: string,
    userName: string,
    customerId?: string
  ): Promise<{
    success: boolean;
    error?: string;
    clientSecret?: string;
    subscriptionId?: string;
  }> {
    try {
      // Check if user is authenticated
      const auth = getAuth();
      const currentUser = auth.currentUser;
      console.log("🚀 ~ StripeService ~ startSubscription ~ currentUser:", currentUser)
      if (!currentUser) {
        throw new Error('You must be logged in to subscribe');
      }

      const tier = this.getSubscriptionTier(tierId);
      console.log("🚀 ~ StripeService ~ startSubscription ~ tier:", tier)

      if (!tier.priceId) {
        throw new Error('Invalid subscription tier');
      }

      // Create customer if not provided
      let finalCustomerId = customerId;
      if (!finalCustomerId) {
        finalCustomerId = await this.createCustomer(userEmail, userName);
      }

      // Create subscription and get PaymentSheet details
      const { clientSecret, subscriptionId } = await this.createSubscriptionPayment(tier.priceId, finalCustomerId);

      // Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ReceiptGold',
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: userName,
          email: userEmail
        },
        returnURL: 'receiptgold://stripe-redirect',
      });

      if (initError) {
        console.error('PaymentSheet initialization failed:', initError);
        throw new Error(initError.message);
      }

      // Present PaymentSheet to user
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        console.error('PaymentSheet presentation failed:', presentError);
        throw new Error(presentError.message);
      }

      console.log('✅ Payment successful!');
      return {
        success: true,
        clientSecret,
        subscriptionId
      };
    } catch (error) {
      console.error('Subscription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        clientSecret: undefined,
        subscriptionId: undefined
      };
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;