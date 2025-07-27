// Hook for using Stripe in components
import { useStripe } from '@stripe/stripe-react-native';
import { Alert, Linking } from 'react-native';
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
      if (tierId === 'free') {
        Alert.alert('Free Plan', 'You are already on the free plan!');
        return false;
      }

      const result = await stripeService.startSubscription(
        tierId,
        userEmail,
        userName,
        customerId
      );

      if (result.success && result.checkoutUrl) {
        // For now, we'll show an alert. In production, you'd redirect to Stripe Checkout
        Alert.alert(
          'Redirect to Stripe',
          'You will be redirected to complete your subscription.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => {
                // Open Stripe Checkout (this is a simplified example)
                Linking.openURL(result.checkoutUrl!).catch(err => {
                  console.error('Failed to open URL:', err);
                  Alert.alert('Error', 'Failed to open payment page');
                });
              }
            }
          ]
        );
        return true;
      } else {
        Alert.alert('Error', result.error || 'Failed to start subscription');
        return false;
      }
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
