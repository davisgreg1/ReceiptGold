// Stripe service for handling payments and subscriptions
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

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
      '10 receipts per month',
      'Basic categorization',
      'Email support'
    ]
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    priceId: 'price_starter_monthly', // Replace with your actual Stripe price ID
    features: [
      'Unlimited receipts',
      'Basic reporting',
      'Email support',
      '1 Business profile'
    ]
  },
  growth: {
    id: 'growth',
    name: 'Growth',
    price: 19.99,
    priceId: 'price_growth_monthly', // Replace with your actual Stripe price ID
    features: [
      'Everything in Starter',
      'Advanced reporting',
      'OCR scanning',
      '3 Business profiles',
      'Priority support'
    ]
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: 39.99,
    priceId: 'price_professional_monthly', // Replace with your actual Stripe price ID
    features: [
      'Everything in Growth',
      'White-label reports',
      'API access',
      'Unlimited businesses',
      'Dedicated manager'
    ]
  }
} as const;

export type SubscriptionTierKey = keyof typeof SUBSCRIPTION_TIERS;

class StripeService {
  // Create Stripe customer via Cloud Function
  async createCustomer(email: string, name: string): Promise<string> {
    try {
      const createCustomer = httpsCallable(functions, 'createStripeCustomer');
      const result = await createCustomer({ email, name });
      const data = result.data as { customerId: string };
      return data.customerId;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create checkout session via Cloud Function
  async createCheckoutSession(priceId: string, customerId: string): Promise<string> {
    try {
      const createSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createSession({ priceId, customerId });
      const data = result.data as { sessionId: string };
      return data.sessionId;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw new Error('Failed to create checkout session');
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

  // Start subscription process
  async startSubscription(
    tierId: SubscriptionTierKey,
    userEmail: string,
    userName: string,
    customerId?: string
  ): Promise<{ success: boolean; checkoutUrl?: string; error?: string }> {
    try {
      const tier = this.getSubscriptionTier(tierId);
      
      if (!tier.priceId) {
        throw new Error('Invalid subscription tier');
      }

      // Create customer if not provided
      let finalCustomerId = customerId;
      if (!finalCustomerId) {
        finalCustomerId = await this.createCustomer(userEmail, userName);
      }

      // Create checkout session
      const sessionId = await this.createCheckoutSession(tier.priceId, finalCustomerId);
      
      // For now, we'll return the session ID
      // In a real implementation, you might redirect to Stripe Checkout
      return {
        success: true,
        checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`
      };
    } catch (error) {
      console.error('Subscription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const stripeService = new StripeService();
export default stripeService;
