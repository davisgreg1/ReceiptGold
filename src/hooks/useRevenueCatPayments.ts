// Hook for using RevenueCat in components
import { useState, useCallback } from 'react';
import { revenueCatService, SubscriptionTierKey, SUBSCRIPTION_TIERS } from '../services/revenuecatService';
import { useSubscription } from '../context/SubscriptionContext';
// Firestore imports removed - using Cloud Functions instead
import { getAuth } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Interface to match Cloud Function response
interface CloudFunctionResponse {
  success: boolean;
  error?: string;
  receiptsExcluded?: number;
  tierChange?: boolean;
}

export const useRevenueCatPayments = () => {
  const { refreshReceiptCount } = useSubscription();
  const [loading, setLoading] = useState(false);

  const handleSubscriptionWithRevenueCat = async (
    tierId: SubscriptionTierKey,
    billingPeriod: 'monthly' | 'annual',
    _userEmail: string, // Underscore prefix to indicate unused but required for interface compatibility
    _userName: string, // Underscore prefix to indicate unused but required for interface compatibility
    showAlert?: (type: 'error' | 'success' | 'warning', title: string, message: string) => void
  ): Promise<boolean> => {
    if (loading) {
      console.log('Purchase already in progress...');
      return false;
    }

    setLoading(true);
    
    try {
      console.log("🚀 Starting RevenueCat subscription process for tier:", tierId);
      
      if (tierId === 'free' || tierId === 'trial') {
        showAlert?.('warning', 'Free Plan', 'You are already on the free plan!');
        return false;
      }

      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        showAlert?.('error', 'Error', 'You must be logged in to subscribe');
        return false;
      }

      // Start the subscription process through RevenueCat
      const subscriptionResult = await revenueCatService.startSubscription(tierId, billingPeriod, currentUser.uid);

      if (!subscriptionResult.success) {
        console.error('RevenueCat subscription failed:', subscriptionResult.error);
        showAlert?.('error', 'Error', subscriptionResult.error || 'Failed to process subscription');
        return false;
      }

      console.log('✅ RevenueCat purchase successful');

      // Get the current tier to check if this is a tier change (force refresh to get latest data)
      const currentTier = await revenueCatService.getCurrentTier(true);
      console.log('📦 Current tier after purchase:', currentTier);

      // Update Firestore with the new subscription via Cloud Function
      try {
        console.log('🔄 Calling Cloud Function to update subscription...');
        
        const functions = getFunctions();
        const updateSubscription = httpsCallable<
          { subscriptionId: string; tierId: SubscriptionTierKey; userId: string; revenueCatData?: any },
          CloudFunctionResponse
        >(functions, 'updateSubscriptionAfterPayment');

        // Get the subscription ID from RevenueCat customer info
        const subscriptionId = subscriptionResult.customerInfo?.activeSubscriptions?.[0] || 'revenuecat_subscription';

        const result = await updateSubscription({
          subscriptionId: subscriptionId,
          tierId: currentTier, // Use the tier returned by RevenueCat
          userId: currentUser.uid,
          revenueCatData: subscriptionResult.customerInfo
        });

        console.log('🔄 Cloud Function response:', result.data);

        if (result.data?.success) {
          console.log('✅ Subscription updated successfully via Cloud Function');
          
          const { receiptsExcluded, tierChange } = result.data;
          if (tierChange) {
            console.log(`🔄 Tier change confirmed, ${receiptsExcluded || 0} receipts excluded from count`);
          } else {
            console.log('📝 No tier change detected by Cloud Function');
          }
          
          // Refresh the receipt count to reflect the changes
          try {
            console.log('🔄 Refreshing receipt count after Cloud Function update...');
            
            const delay = tierChange ? 3000 : 1500;
            console.log(`⏳ Waiting ${delay}ms for Firestore propagation...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            const refreshResult = await refreshReceiptCount();
            console.log('🔄 First receipt count refresh result:', refreshResult);

            if (tierChange) {
              await new Promise(resolve => setTimeout(resolve, 1000));
              const secondRefreshResult = await refreshReceiptCount();
              console.log('🔄 Second receipt count refresh result:', secondRefreshResult);
            }
          } catch (refreshError) {
            console.warn('⚠️ Failed to refresh receipt count after upgrade:', refreshError);
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

    } catch (error) {
      console.error('❌ RevenueCat subscription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Handle user cancellation
      if (errorMessage.includes('user cancelled') || errorMessage.includes('cancelled')) {
        console.log('User cancelled purchase');
        return false;
      }
      
      showAlert?.('error', 'Error', `Failed to process subscription: ${errorMessage}`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restorePurchases = useCallback(async (
    showAlert?: (type: 'error' | 'success' | 'warning', title: string, message: string) => void
  ): Promise<boolean> => {
    try {
      console.log('🔄 Restoring purchases...');
      const result = await revenueCatService.restorePurchases();
      
      if (result.success) {
        const currentTier = await revenueCatService.getCurrentTier(true); // Force refresh
        console.log('✅ Purchases restored, current tier:', currentTier);
        
        // If we found a paid subscription, update Firestore to sync the state
        if (currentTier !== 'free') {
          console.log('🔄 Syncing restored subscription to Firestore...');
          
          const auth = getAuth();
          const currentUser = auth.currentUser;
          
          if (currentUser) {
            try {
              // Call the Cloud Function to properly sync the subscription
              const functions = getFunctions();
              const updateSubscription = httpsCallable<
                { subscriptionId: string; tierId: SubscriptionTierKey; userId: string; revenueCatData?: any },
                CloudFunctionResponse
              >(functions, 'updateSubscriptionAfterPayment');

              // Get customer info from RevenueCat
              const customerInfo = result.customerInfo;
              const subscriptionId = customerInfo?.activeSubscriptions?.[0] || 'restored_subscription';

              const updateResult = await updateSubscription({
                subscriptionId: subscriptionId,
                tierId: currentTier,
                userId: currentUser.uid,
                revenueCatData: customerInfo
              });

              console.log('🔄 Cloud Function sync result:', updateResult.data);

              if (updateResult.data?.success) {
                console.log('✅ Subscription synced to Firestore successfully');
                
                // Wait a moment for Firestore to propagate
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Refresh the receipt count to update the local state
                await refreshReceiptCount();
                
                showAlert?.('success', 'Success', 'Purchases restored successfully!');
                return true;
              } else {
                console.error('❌ Failed to sync subscription to Firestore:', updateResult.data?.error);
                // Even if Firestore sync fails, the restore was successful
                await refreshReceiptCount();
                showAlert?.('success', 'Success', 'Purchases restored successfully!');
                return true;
              }
            } catch (syncError) {
              console.error('❌ Error syncing to Firestore:', syncError);
              // Even if sync fails, the restore was successful
              await refreshReceiptCount();
              showAlert?.('success', 'Success', 'Purchases restored successfully!');
              return true;
            }
          }
        }
        
        // Update local subscription state
        await refreshReceiptCount();
        
        showAlert?.('success', 'Success', 'Purchases restored successfully!');
        return true;
      } else {
        showAlert?.('error', 'Error', result.error || 'Failed to restore purchases');
        return false;
      }
    } catch (error) {
      console.error('❌ Failed to restore purchases:', error);
      showAlert?.('error', 'Error', 'Failed to restore purchases');
      return false;
    }
  }, [refreshReceiptCount]);

  const getSubscriptionTier = (tierId: SubscriptionTierKey) => {
    return SUBSCRIPTION_TIERS[tierId];
  };

  const formatPrice = (price: number) => {
    return revenueCatService.formatPrice(price);
  };

  const getCurrentTier = useCallback(async () => {
    try {
      return await revenueCatService.getCurrentTier();
    } catch (error) {
      console.error('❌ Failed to get current tier:', error);
      return 'free';
    }
  }, []);

  return {
    handleSubscriptionWithRevenueCat,
    restorePurchases,
    getSubscriptionTier,
    formatPrice,
    getCurrentTier,
    loading,
    SUBSCRIPTION_TIERS,
  };
};