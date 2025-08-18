// Hook for using Stripe in components
import { useStripe } from '@stripe/stripe-react-native';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, getFirestore, getDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { stripeService, SubscriptionTierKey, SUBSCRIPTION_TIERS } from '../services/stripe';
import { useSubscription } from '../context/SubscriptionContext';
import { useCustomAlert } from './useCustomAlert';

// Interface to match Cloud Function response
interface CloudFunctionResponse {
  success: boolean;
  error?: string;
  receiptsExcluded?: number;
  tierChange?: boolean;
}

export const useStripePayments = () => {
  const stripe = useStripe();
  const { refreshReceiptCount } = useSubscription();

  const handleSubscriptionWithCloudFunction = async (
    tierId: SubscriptionTierKey,
    userEmail: string,
    userName: string,
    customerId?: string,
    showAlert?: (type: 'error' | 'success' | 'warning', title: string, message: string) => void
  ): Promise<boolean> => {
    try {
      console.log("🚀 Starting subscription process for tier:", tierId);
      if (tierId === 'free') {
        showAlert?.('warning', 'Free Plan', 'You are already on the free plan!');
        return false;
      }

      if (!stripe) {
        console.error('Stripe not initialized');
        showAlert?.('error', 'Error', 'Payment system not initialized');
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
        showAlert?.('error', 'Error', subscriptionResult.error || 'Failed to start subscription');
        return false;
      }

      if (!subscriptionResult.clientSecret || !subscriptionResult.subscriptionId) {
        console.error('Backend response missing required data:', subscriptionResult);
        showAlert?.('error', 'Error', 'Incomplete server response. Please try again.');
        return false;
      }

      console.log('Starting payment for subscription:', subscriptionResult.subscriptionId);

      // Update Firestore with the new subscription via Cloud Function
      try {
        const auth = getAuth();
        if (!auth.currentUser) throw new Error('User not authenticated');

        console.log('🔄 Calling Cloud Function to update subscription...');
        
        // Call Cloud Function
        const functions = getFunctions();
        const updateSubscription = httpsCallable<
          { subscriptionId: string; tierId: SubscriptionTierKey; userId: string },
          CloudFunctionResponse
        >(functions, 'updateSubscriptionAfterPayment');

        const result = await updateSubscription({
          subscriptionId: subscriptionResult.subscriptionId,
          tierId: tierId,
          userId: auth.currentUser.uid
        });

        console.log('🔄 Cloud Function response:', result.data);

        if (result.data?.success) {
          console.log('✅ Subscription updated successfully via Cloud Function');
          
          // Log details about the update
          const { receiptsExcluded, tierChange } = result.data;
          if (tierChange) {
            console.log(`🔄 Tier change confirmed, ${receiptsExcluded || 0} receipts excluded from count`);
          } else {
            console.log('📝 No tier change detected by Cloud Function');
          }
          
          // Refresh the receipt count to reflect the changes
          try {
            console.log('🔄 Refreshing receipt count after Cloud Function update...');
            
            // Always wait for Firestore propagation, longer delay for tier changes
            const delay = tierChange ? 3000 : 1500;
            console.log(`⏳ Waiting ${delay}ms for Firestore propagation...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // First refresh
            const refreshResult = await refreshReceiptCount();
            console.log('🔄 First receipt count refresh result:', refreshResult);

            // Second refresh for tier changes (extra safety)
            if (tierChange) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const secondRefreshResult = await refreshReceiptCount();
              console.log('🔄 Second receipt count refresh result:', secondRefreshResult);
            }
          } catch (refreshError) {
            console.warn('⚠️ Failed to refresh receipt count after upgrade:', refreshError);
            // Don't fail the whole process if refresh fails
          }

          showAlert?.('success', 'Success', 'Your subscription has been activated!');
          return true;
        } else {
          const errorMessage = result.data?.error || 'Failed to update subscription';
          console.error('❌ Cloud Function returned error:', errorMessage);
          throw new Error(errorMessage);
        }

      } catch (error) {
        console.error('❌ Failed to update subscription via Cloud Function:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showAlert?.('error', 'Error', `Failed to activate subscription: ${errorMessage}`);
        return false;
      }

      // try {
      //   const db = getFirestore();
      //   const auth = getAuth();
      //   if (!auth.currentUser) throw new Error('User not authenticated');

      //   // Get current subscription to check if this is actually a tier change
      //   const subscriptionRef = doc(db, 'subscriptions', auth.currentUser.uid);
      //   const currentSub = await getDoc(subscriptionRef);
      //   const currentTier = currentSub.data()?.currentTier || 'free';

      //   const now = new Date();

      //   // Create a batch for atomic updates
      //   const batch = writeBatch(db);
      //   let receiptsExcludedCount = 0;

      //   if (currentTier !== tierId) {
      //     // This is a tier change, so reset monthly count by excluding ALL existing receipts
      //     console.log(`🔄 Tier change detected: ${currentTier} → ${tierId}, resetting monthly count...`);

      //     // Get ALL existing receipts for this user (not just current month)
      //     const receiptsQuery = query(
      //       collection(db, "receipts"),
      //       where("userId", "==", auth.currentUser.uid)
      //     );

      //     const receiptsSnapshot = await getDocs(receiptsQuery);
      //     receiptsExcludedCount = receiptsSnapshot.docs.length;
      //     console.log(`📝 Found ${receiptsExcludedCount} receipts to mark as excluded from new tier count`);

      //     // Log details about each receipt being excluded
      //     receiptsSnapshot.docs.forEach((receiptDoc, index) => {
      //       const data = receiptDoc.data();
      //       console.log(`Receipt ${index + 1} to exclude:`, {
      //         id: receiptDoc.id.substring(0, 8),
      //         createdAt: data.createdAt?.toDate(),
      //         vendor: data.vendor,
      //         amount: data.amount,
      //         currentlyExcluded: data.excludeFromMonthlyCount
      //       });
      //     });

      //     // Mark ALL existing receipts as excluded from the new tier's count
      //     receiptsSnapshot.docs.forEach((receiptDoc) => {
      //       batch.update(doc(db, "receipts", receiptDoc.id), {
      //         excludeFromMonthlyCount: true,
      //         monthlyCountExcludedAt: now,
      //         previousTier: currentTier
      //       });
      //     });
      //   } else {
      //     console.log(`📝 No tier change detected: staying on ${currentTier}`);
      //   }

      //   // Prepare subscription update data
      //   const subscriptionUpdateData = {
      //     currentTier: tierId,
      //     status: 'active',
      //     subscriptionId: subscriptionResult.subscriptionId,
      //     updatedAt: now,
      //     lastMonthlyCountResetAt: currentTier !== tierId ? now : currentSub.data()?.lastMonthlyCountResetAt,
      //     billing: {
      //       subscriptionId: subscriptionResult.subscriptionId,
      //       currentPeriodStart: now,
      //       currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      //     }
      //   };

      //   if (currentTier !== tierId) {
      //     console.log(`🔄 MONTHLY COUNT RESET: Upgrading from ${currentTier} to ${tierId}, setting lastMonthlyCountResetAt to:`, now);
      //   } else {
      //     console.log(`📝 No tier change, keeping existing lastMonthlyCountResetAt:`, currentSub.data()?.lastMonthlyCountResetAt);
      //   }

      //   console.log(`📝 Updating subscription with data:`, {
      //     currentTier: subscriptionUpdateData.currentTier,
      //     status: subscriptionUpdateData.status,
      //     subscriptionId: subscriptionUpdateData.subscriptionId,
      //     willResetMonthlyCount: currentTier !== tierId,
      //     lastMonthlyCountResetAt: subscriptionUpdateData.lastMonthlyCountResetAt?.toISOString?.() || subscriptionUpdateData.lastMonthlyCountResetAt
      //   });

      //   // Update subscription with new tier and billing info
      //   batch.update(subscriptionRef, subscriptionUpdateData);

      //   // Execute all updates atomically
      //   try {
      //     await batch.commit();
      //     console.log('✅ Subscription activated and Firestore updated successfully');
      //     if (currentTier !== tierId) {
      //       console.log(`✅ Successfully excluded ${receiptsExcludedCount} receipts from monthly count`);
      //     }
      //   } catch (batchError) {
      //     console.error('❌ Failed to commit batch update:', batchError);
      //     const errorMessage = batchError instanceof Error ? batchError.message : 'Unknown error';
      //     throw new Error(`Failed to update subscription: ${errorMessage}`);
      //   }

      //   // Refresh the receipt count to reflect the reset
      //   try {
      //     if (currentTier !== tierId) {
      //       // For tier changes, add extra delay and retry to ensure Firestore propagation
      //       console.log('🔄 Waiting longer for Firestore propagation after tier change...');
      //       await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay

      //       await refreshReceiptCount();
      //       console.log('🔄 Initial receipt count refresh after tier upgrade');

      //       // Wait a bit more and refresh again to be extra sure
      //       await new Promise(resolve => setTimeout(resolve, 1000));
      //       await refreshReceiptCount();
      //       console.log('🔄 Second receipt count refresh after tier upgrade');
      //     } else {
      //       await refreshReceiptCount();
      //       console.log('🔄 Receipt count refreshed after subscription update');
      //     }
      //   } catch (refreshError) {
      //     console.warn('Failed to refresh receipt count after upgrade:', refreshError);
      //   }

      //   showAlert?.('success', 'Success', 'Your subscription has been activated!');
      //   return true;
      // } catch (error) {
      //   console.error('Failed to update Firestore with new subscription:', error);
      //   showAlert?.('warning', 'Warning', 'Payment processed but failed to update subscription status. Please contact support.');
      //   return false;
      // }

    } catch (error) {
      console.error('Subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      showAlert?.('error', 'Error', `Failed to process subscription: ${errorMessage}`);
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
    handleSubscriptionWithCloudFunction,
    getSubscriptionTier,
    formatPrice,
    SUBSCRIPTION_TIERS,
  };
};