// Hook for using Stripe in components
import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import { doc, updateDoc, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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

      // Update Firestore with the new subscription
      try {
        const db = getFirestore();
        const auth = getAuth();
        if (!auth.currentUser) throw new Error('User not authenticated');
        
        await updateDoc(doc(db, 'subscriptions', auth.currentUser.uid), {
          currentTier: tierId,
          status: 'active',
          subscriptionId: subscriptionResult.subscriptionId,
          updatedAt: new Date(),
          billing: {
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          }
        });

        console.log('✅ Subscription activated and Firestore updated successfully');
        Alert.alert('Success', 'Your subscription has been activated!');
        return true;
      } catch (error) {
        console.error('Failed to update Firestore with new subscription:', error);
        Alert.alert('Warning', 'Payment processed but failed to update subscription status. Please contact support.');
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
