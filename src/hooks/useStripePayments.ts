// Hook for using Stripe in components
import { useStripe } from '@stripe/stripe-react-native';
import { Alert } from 'react-native';
import { doc, updateDoc, getFirestore, getDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { stripeService, SubscriptionTierKey, SUBSCRIPTION_TIERS } from '../services/stripe';
import { useSubscription } from '../context/SubscriptionContext';

export const useStripePayments = () => {
  const stripe = useStripe();
  const { refreshReceiptCount } = useSubscription();

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
        
        // Get current subscription to check if this is actually a tier change
        const subscriptionRef = doc(db, 'subscriptions', auth.currentUser.uid);
        const currentSub = await getDoc(subscriptionRef);
        const currentTier = currentSub.data()?.currentTier || 'free';
        
        const now = new Date();
        
        // Create a batch for atomic updates
        const batch = writeBatch(db);
        
        if (currentTier !== tierId) {
          // This is a tier change, so reset monthly count by excluding current receipts
          console.log(`🔄 Tier change detected: ${currentTier} → ${tierId}, resetting monthly count...`);
          
          // Get current month's receipts
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);
          
          const receiptsQuery = query(
            collection(db, "receipts"),
            where("userId", "==", auth.currentUser.uid),
            where("createdAt", ">=", startOfMonth)
          );
          
          const receiptsSnapshot = await getDocs(receiptsQuery);
          console.log(`📝 Found ${receiptsSnapshot.docs.length} receipts to mark as excluded from new tier count`);
          
          // Mark all current month's receipts as excluded from the new tier's count
          receiptsSnapshot.docs.forEach((receiptDoc) => {
            batch.update(doc(db, "receipts", receiptDoc.id), {
              excludeFromMonthlyCount: true,
              monthlyCountExcludedAt: now,
              previousTier: currentTier
            });
          });
        } else {
          console.log(`📝 No tier change detected: staying on ${currentTier}`);
        }
        
        // Prepare subscription update data
        const subscriptionUpdateData = {
          currentTier: tierId,
          status: 'active',
          subscriptionId: subscriptionResult.subscriptionId,
          updatedAt: now,
          lastMonthlyCountResetAt: currentTier !== tierId ? now : currentSub.data()?.lastMonthlyCountResetAt,
          billing: {
            subscriptionId: subscriptionResult.subscriptionId,
            currentPeriodStart: now,
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          }
        };
        
        console.log(`📝 Updating subscription with data:`, {
          currentTier: subscriptionUpdateData.currentTier,
          status: subscriptionUpdateData.status,
          subscriptionId: subscriptionUpdateData.subscriptionId,
          willResetMonthlyCount: currentTier !== tierId,
          lastMonthlyCountResetAt: subscriptionUpdateData.lastMonthlyCountResetAt?.toISOString?.() || subscriptionUpdateData.lastMonthlyCountResetAt
        });
        
        // Update subscription with new tier and billing info
        batch.update(subscriptionRef, subscriptionUpdateData);

        // Execute all updates atomically
        try {
          await batch.commit();
          console.log('✅ Subscription activated and Firestore updated successfully');
        } catch (batchError) {
          console.error('❌ Failed to commit batch update:', batchError);
          const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error';
          throw new Error(`Failed to update subscription: ${errorMessage}`);
        }
        
        // Refresh the receipt count to reflect the reset
        try {
          await refreshReceiptCount();
          console.log('🔄 Receipt count refreshed after upgrade');
        } catch (refreshError) {
          console.warn('Failed to refresh receipt count after upgrade:', refreshError);
        }
        
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
