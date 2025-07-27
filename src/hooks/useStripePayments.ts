// Hook for using Stripe in components
import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import { stripeService, SubscriptionTierKey, SUBSCRIPTION_TIERS } from '../services/stripe';

export const useStripePayments = () => {
  const stripe = useStripe();

  const handleSubscription = async (
    tierId: SubscriptionTierKey,
    userEmail: string,
    userName: string,
    customerId?: string
  ): Promise<boolean> => {
    try {
      console.log("🚀 Starting subscription process for tier:", tierId);
      if (tierId === 'free') {
        Alert.alert('Free Plan', 'You are already on the free plan!');
        return false;
      }

      if (!stripe) {
        console.error('Stripe not initialized');
        Alert.alert('Error', 'Payment system not initialized');
        return false;
      }

      // First create or get customer and create subscription
      console.log('Calling startSubscription with:', { tierId, userEmail, userName, customerId });
      
      const subscriptionResult = await stripeService.startSubscription(
        tierId,
        userEmail,
        userName,
        customerId
      );

      console.log("🚀 Customer and subscription created:", subscriptionResult);

      if (!subscriptionResult.success) {
        console.error('Subscription creation failed:', subscriptionResult);
        Alert.alert('Error', subscriptionResult.error || 'Failed to start subscription');
        return false;
      }

      if (!subscriptionResult.clientSecret || !subscriptionResult.subscriptionId) {
        console.error('Backend response missing required data:', subscriptionResult);
        Alert.alert('Error', 'Incomplete server response. Please try again.');
        return false;
      }

      console.log('Starting payment for subscription:', subscriptionResult.subscriptionId);

      // The payment sheet presentation is already handled in stripeService.startSubscription
      // If we got here, it means the payment was successful
      console.log('✅ Subscription activated successfully');
      Alert.alert('Success', 'Your subscription has been activated!');
      return true;

    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', 'Failed to process subscription');
      return false;
    }
  };

  const getSubscriptionTier = (tierId: SubscriptionTierKey) => {
    return SUBSCRIPTION_TIERS[tierId];
  };

  const formatPrice = (price: number) => {
    return stripeService.formatPrice(price);
  };

  return {
    stripe,
    handleSubscription,
    getSubscriptionTier,
    formatPrice,
    SUBSCRIPTION_TIERS,
  };
};
