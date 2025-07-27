// Stripe service for handling payments and subscriptions
import { 
  useStripe, 
  useConfirmPayment, 
  PaymentSheet,
  usePaymentSheet,
  CardField,
  StripeProvider 
} from '@stripe/stripe-react-native';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

// Types
export interface PaymentIntentResponse {
  clientSecret: string;
  paymentIntentId: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url?: string;
}

export interface CustomerResponse {
  customerId: string;
}

export interface SubscriptionResponse {
  clientSecret: string;
  subscriptionId: string;
}

export interface SubscriptionTier {
  id: 'starter' | 'growth' | 'professional';
  name: string;
  price: number;
  priceId: string;
  features: string[];
  popular?: boolean;
}

// Subscription tiers with Stripe price IDs
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 9.99,
    priceId: 'price_1RpYbuAZ9H3S1Eo7Qd3qk3IV', // Starter tier price ID
    features: [
      '50 receipts per month',
      'Basic reporting',
      'Email support',
      '1 Business profile'
    ]
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 19.99,
    priceId: 'price_1RpYbeAZ9H3S1Eo75oTj2nHe', // Growth tier price ID
    features: [
      '150 receipts per month',
      'Advanced reporting',
      'OCR scanning',
      '3 Business profiles',
      'Priority support'
    ],
    popular: true
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 39.99,
    priceId: 'price_1RpYbJAZ9H3S1Eo78dUvxerL', // Professional tier price ID
    features: [
      'Everything in Growth',
      'White-label reports',
      'API access',
      'Unlimited businesses',
      'Dedicated manager'
    ]
  }
];

class StripeService {
  // Create Stripe customer
  async createCustomer(email: string, name: string): Promise<string> {
    try {
      const createCustomer = httpsCallable(functions, 'createStripeCustomer');
      const result = await createCustomer({ email, name });
      const data = result.data as CustomerResponse;
      return data.customerId;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  }

  // Create checkout session for subscription
  async createCheckoutSession(priceId: string, customerId: string): Promise<string> {
    console.log("🚀 Creating checkoutCreating checkout session with session with:", { priceId, customerId });
    try {
      const createSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createSession({ priceId, customerId });
      console.log("🚀 ~ StripeServiceStripeService ~ createCheckoutSession ~ result:", result)
      const data = result.data as CheckoutSessionResponse;
      // console.log("🚀 ~ StripeService ~ createCheckoutSession ~ data:", data)
      return data.sessionId;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  }

  // Initialize payment sheet for subscription
  async initializePaymentSheet(priceId: string, customerId: string) {
    try {
      const sessionId = await this.createCheckoutSession(priceId, customerId);
      
      // Note: For React Native, you might want to use a different approach
      // This is more suitable for web. For mobile, consider using PaymentSheet.createPaymentMethod
      return sessionId;
    } catch (error) {
      console.error('Error initializing payment sheet:', error);
      throw error;
    }
  }

  // Get subscription tier by ID
  getSubscriptionTier(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(tier => tier.id === tierId);
  }

  // Get price ID for tier
  getPriceId(tierId: string): string | undefined {
    const tier = this.getSubscriptionTier(tierId);
    return tier?.priceId;
  }

  // Format price for display
  formatPrice(price: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price);
  }
}

// Stripe hook for easier usage in components
export const useStripeService = () => {
  console.log("🚀 ~ useStripeService ~ useStripeService called");
  const stripe = useStripe();
  const { initPaymentSheet, presentPaymentSheet } = usePaymentSheet();
  const { confirmPayment } = useConfirmPayment();

  const service = new StripeService();

    const handleSubscription = async (
    tierId: string, 
    customerId: string,
    onSuccess?: () => void,
    onError?: (error: Error) => void
  ) => {
    try {
      console.log('🚀 Starting handleSubscription:', { tierId, customerId });
      const priceId = service.getPriceId(tierId);
      console.log('📦 Got priceId:', priceId);
      if (!priceId) {
        console.error('❌ Invalid price ID for tier:', tierId);
        throw new Error('Invalid subscription tier');
      }

      // Create subscription and get payment intent client secret
      const createSubscription = httpsCallable(functions, 'createSubscription');
      const { data: subscriptionData } = await createSubscription({ priceId, customerId });
      const { clientSecret, subscriptionId } = subscriptionData as { clientSecret: string; subscriptionId: string };
      
      console.log('📦 Created subscription:', { subscriptionId });

      // Initialize payment sheet
      const { error: initError } = await initPaymentSheet({
        merchantDisplayName: 'ReceiptGold',
        paymentIntentClientSecret: clientSecret,
        allowsDelayedPaymentMethods: true,
        defaultBillingDetails: {
          name: 'Customer', // You can pass actual customer name
        },
        returnURL: 'receiptgold://stripe-redirect',
      });

      if (initError) {
        console.error('❌ Payment sheet init error:', initError);
        throw new Error(initError.message);
      }

      // Present payment sheet
      const { error: presentError } = await presentPaymentSheet();
      
      if (presentError) {
        console.error('❌ Payment sheet present error:', presentError);
        throw new Error(presentError.message);
      }

      console.log('✅ Payment successful!');
      onSuccess?.();
    } catch (error) {
      console.error('❌ handleSubscription error:', error);
      onError?.(error as Error);
    }
  }

  return {
    ...service,
    stripe,
    handleSubscription,
    confirmPayment,
    SUBSCRIPTION_TIERS,
  };
};

export default StripeService;
