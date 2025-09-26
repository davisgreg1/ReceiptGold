// Hook for using RevenueCat in components
import { useState, useCallback } from 'react';
import { revenueCatService, SubscriptionTierKey, SUBSCRIPTION_TIERS } from '../services/revenuecatService';
import { useSubscription } from '../context/SubscriptionContext';
import { getAuth } from 'firebase/auth';

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

      // RevenueCat webhooks will automatically handle subscription updates in Firestore
      // Just wait for webhook processing and refresh local state
      console.log('✅ Purchase successful - waiting for RevenueCat webhook to update subscription...');

      // Wait for RevenueCat webhook to process the subscription
      // await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh local state to pick up webhook-driven changes
      await refreshReceiptCount();

      console.log('✅ Subscription activated successfully');
      return true;

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

        // If we found a paid subscription, manually sync with Firestore
        if (currentTier !== 'trial') {
          console.log('✅ Purchases restored - syncing subscription to Firestore...');

          // Import Firebase Functions to call the sync function
          const { httpsCallable } = await import('firebase/functions');
          const { functions } = await import('../config/firebase');

          try {
            // Call the sync function to update Firestore
            const syncFunction = httpsCallable(functions, 'syncRevenueCatSubscription');
            await syncFunction();
            console.log('✅ Subscription synced to Firestore');
          } catch (syncError) {
            console.warn('⚠️ Failed to sync subscription to Firestore:', syncError);
            // Continue anyway - RevenueCat webhooks might still work
          }

          // Refresh the receipt count to update the local state
          await refreshReceiptCount();

          showAlert?.('success', 'Success', 'Purchases restored successfully!');
          return true;
        } else {
          // No paid subscription found - user has no previous purchases to restore
          showAlert?.('warning', 'No Purchases Found', 'No previous purchases were found for this Apple ID. Start a new subscription to access premium features.');
          return false;
        }
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
      const currentPeriod = await revenueCatService.getCurrentBillingPeriod();
      console.log("🚀 ~ useRevenueCatPayments ~ currentPeriod:", currentPeriod)
      return currentPeriod;
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