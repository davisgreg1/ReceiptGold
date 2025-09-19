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
    console.log('🚀 handleSubscriptionWithRevenueCat called with:', { tierId, billingPeriod });
    
    if (loading) {
      console.log('⏰ Purchase already in progress...');
      return false;
    }

    console.log('🔄 Setting loading state to true');
    setLoading(true);
    
    try {
      if (tierId === 'trial') {
        showAlert?.('warning', 'Trial Plan', 'You are already on the trial plan!');
        return false;
      }

      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        showAlert?.('error', 'Error', 'You must be logged in to subscribe');
        return false;
      }

      // Start the subscription process through RevenueCat
      console.log('📱 About to call revenueCatService.startSubscription...');
      const subscriptionResult = await revenueCatService.startSubscription(tierId, billingPeriod, currentUser.uid);
      console.log('📋 RevenueCat service result:', subscriptionResult);

      if (!subscriptionResult.success) {
        console.error('RevenueCat subscription failed:', subscriptionResult.error);
        showAlert?.('error', 'Error', subscriptionResult.error || 'Failed to process subscription');
        return false;
      }

      // Get the current tier to check if this is a tier change (force refresh to get latest data)
      const currentTier = await revenueCatService.getCurrentTier(true);

      // Update Firestore with the new subscription via Cloud Function
      try {
        const functions = getFunctions();
        const updateSubscription = httpsCallable<
          { subscriptionId: string; tierId: SubscriptionTierKey; userId: string; revenueCatData?: any },
          CloudFunctionResponse
        >(functions, 'updateSubscriptionAfterPayment');

        // Get the product ID that was just purchased
        // We know exactly which product was purchased based on the parameters we passed to startSubscription
        const getProductId = (tier: string, billing: 'monthly' | 'annual'): string => {
          const productMap: { [key: string]: { [key: string]: string } } = {
            'starter': { 'monthly': 'rg_starter', 'annual': 'rg_starter' },
            'growth': { 'monthly': 'rg_growth_monthly', 'annual': 'rg_growth_annual' },
            'professional': { 'monthly': 'rg_professional_monthly', 'annual': 'rg_professional_annual' }
          };
          return productMap[tier]?.[billing] || 'revenuecat_subscription';
        };
        
        const subscriptionId = getProductId(tierId, billingPeriod);
        
        console.log('🔍 Using purchased product ID:', {
          tierId,
          billingPeriod,
          productId: subscriptionId,
          currentTier
        });

        const result = await updateSubscription({
          subscriptionId: subscriptionId,
          tierId: currentTier, // Use the tier returned by RevenueCat
          userId: currentUser.uid,
          revenueCatData: subscriptionResult.customerInfo
        });

        if (result.data?.success) {
          // Wait for RevenueCat webhook to process tier change via new_product_id
          // This ensures Firestore tier is updated by webhook before UI refresh
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Refresh local state to pick up webhook-driven tier changes
          await refreshReceiptCount();

          // showAlert?.('success', 'Success', 'Your subscription has been activated!');
          return true;
        } else {
          const errorMessage = result.data?.error || 'Failed to update subscription';
          console.error('Cloud Function returned error:', errorMessage);
          throw new Error(errorMessage);
        }

      } catch (error) {
        console.error('Failed to update subscription via Cloud Function:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        showAlert?.('error', 'Error', `Failed to activate subscription: ${errorMessage}`);
        return false;
      }

    } catch (error) {
      console.error('RevenueCat subscription error:', error);
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
      const result = await revenueCatService.restorePurchases();
      
      if (result.success) {
        const currentTier = await revenueCatService.getCurrentTier(true); // Force refresh

        // If we found a paid subscription, update Firestore to sync the state
        if (currentTier !== 'trial') {
          
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

              if (updateResult.data?.success) {
                
                // Wait a moment for Firestore to propagate
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Refresh the receipt count to update the local state
                await refreshReceiptCount();
                
                showAlert?.('success', 'Success', 'Purchases restored successfully!');
                return true;
              } else {
                console.error('Failed to sync subscription to Firestore:', updateResult.data?.error);
                // Even if Firestore sync fails, the restore was successful
                await refreshReceiptCount();
                showAlert?.('success', 'Success', 'Purchases restored successfully!');
                return true;
              }
            } catch (syncError) {
              console.error('Error syncing to Firestore:', syncError);
              // Even if sync fails, the restore was successful
              await refreshReceiptCount();
              showAlert?.('success', 'Success', 'Purchases restored successfully!');
              return true;
            }
          }
        } else {
          // No paid subscription found - user has no previous purchases to restore
          showAlert?.('warning', 'No Purchases Found', 'No previous purchases were found for this Apple ID. Start a new subscription to access premium features.');
          return false;
        }

        // This line should only be reached if currentTier !== 'trial' (paid subscription found)
        // Update local subscription state
        await refreshReceiptCount();

        showAlert?.('success', 'Success', 'Purchases restored successfully!');
        return true;
      } else {
        showAlert?.('error', 'Error', result.error || 'Failed to restore purchases');
        return false;
      }
    } catch (error) {
      console.error('Failed to restore purchases:', error);
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
      console.error('Failed to get current tier:', error);
      return 'trial' as SubscriptionTierKey;
    }
  }, []);

  const getCurrentBillingPeriod = useCallback(async () => {
    try {
      return await revenueCatService.getCurrentBillingPeriod();
    } catch (error) {
      console.error('Failed to get current billing period:', error);
      return null;
    }
  }, []);

  return {
    handleSubscriptionWithRevenueCat,
    restorePurchases,
    getSubscriptionTier,
    formatPrice,
    getCurrentTier,
    getCurrentBillingPeriod,
    loading,
    SUBSCRIPTION_TIERS,
  };
};