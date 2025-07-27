import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { useStripePayments } from '../hooks/useStripePayments';
import { useAuth } from '../context/AuthContext';
import { ReceiptLimitGate } from '../components/PremiumGate';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';

export const ReceiptsListScreen: React.FC = () => {
  const { theme } = useTheme();
  const { subscription, getRemainingReceipts } = useSubscription();
  const { handleSubscription } = useStripePayments();
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // Get actual receipt count from usage document
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  React.useEffect(() => {
    const fetchReceiptCount = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        // For professional plan, we want to show all receipts
        if (subscription?.currentTier === 'professional') {
          // Use collection query to get total count of non-deleted receipts
          const receiptsQuery = query(
            collection(db, 'receipts'),
            where('userId', '==', user.uid),
            where('status', '!=', 'deleted')
          );
          const receiptsSnapshot = await getDocs(receiptsQuery);
          setCurrentReceiptCount(receiptsSnapshot.size);
        } else {
          // For other plans, only show current month's receipts
          const currentMonth = new Date().toISOString().slice(0, 7);
          const usageDoc = await getDoc(doc(db, 'usage', `${user.uid}_${currentMonth}`));
          
          if (usageDoc.exists()) {
            const data = usageDoc.data();
            setCurrentReceiptCount(data?.receiptsUploaded || 0);
          } else {
            // Reset count for new month
            setCurrentReceiptCount(0);
          }
        }
      } catch (error) {
        console.error('Error fetching receipt count:', error);
        setCurrentReceiptCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchReceiptCount();
  }, [user?.uid, subscription?.currentTier]);
  // Calculate remaining receipts based on subscription tier limits
  const maxReceipts = subscription?.limits?.maxReceipts || 10; // default to free tier
  console.log("🚀 ~ ReceiptsListScreen ~ subscription:", subscription)
  const remainingReceipts = maxReceipts === -1 ? -1 : Math.max(0, maxReceipts - currentReceiptCount);

  const handleUpgrade = async () => {
    if (!user?.email) {
      Alert.alert('Error', 'You must be logged in to upgrade');
      return;
    }

    setIsUpgrading(true);
    try {
      // Start the Stripe payment flow
      const success = await handleSubscription(
        'starter',
        user.email,
        user.displayName || 'User'
      );

      if (!success) {
        Alert.alert('Error', 'Failed to process payment. Please try again.');
      }
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      Alert.alert(
        'Error',
        'Failed to process payment. Please check your payment details and try again.'
      );
    } finally {
      setIsUpgrading(false);
    }
  };

  const mockReceipts = Array.from({ length: currentReceiptCount }, (_, i) => ({
    id: i + 1,
    name: `Receipt ${i + 1}`,
    amount: Math.floor(Math.random() * 200) + 10,
    date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    category: ['Office Supplies', 'Meals', 'Travel', 'Equipment'][Math.floor(Math.random() * 4)],
  }));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView style={styles.content}>
        {/* Header with usage info */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            My Receipts
          </Text>
          {/* Show usage info for free tier, or receipt count for paid tiers */}
          <View style={[styles.usageCard, { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary 
          }]}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.gold.primary} />
            ) : (
              <Text style={[styles.usageText, { color: theme.text.secondary }]}>
                {maxReceipts === -1 ? (
                  `${currentReceiptCount} receipts total`
                ) : (
                  `${currentReceiptCount} out of ${maxReceipts} receipts used this month`
                )}
              </Text>
            )}
            {maxReceipts !== -1 && remainingReceipts <= 2 && (
              <Text style={[styles.warningText, { color: theme.status.warning }]}>
                {remainingReceipts} {remainingReceipts === 1 ? 'receipt' : 'receipts'} remaining
              </Text>
            )}
          </View>
        </View>

        {/* Receipts List */}
        <View style={styles.receiptsList}>
          {mockReceipts.map((receipt) => (
            <View
              key={receipt.id}
              style={[styles.receiptCard, {
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.primary,
              }]}
            >
              <View style={styles.receiptHeader}>
                <Text style={[styles.receiptName, { color: theme.text.primary }]}>
                  {receipt.name}
                </Text>
                <Text style={[styles.receiptAmount, { color: theme.gold.primary }]}>
                  ${receipt.amount}
                </Text>
              </View>
              <View style={styles.receiptDetails}>
                <Text style={[styles.receiptCategory, { color: theme.text.secondary }]}>
                  {receipt.category}
                </Text>
                <Text style={[styles.receiptDate, { color: theme.text.tertiary }]}>
                  {receipt.date.toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Add Receipt Button - with limit check */}
        <ReceiptLimitGate currentReceiptCount={currentReceiptCount}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.gold.primary }]}
          >
            <Text style={styles.addButtonText}>📄 Add New Receipt</Text>
          </TouchableOpacity>
        </ReceiptLimitGate>

        {/* Free tier upgrade prompt */}
        {subscription?.currentTier === 'free' && (
          <View style={[styles.upgradePrompt, {
            backgroundColor: theme.gold.background,
            borderColor: theme.gold.primary,
          }]}>
            <Text style={[styles.upgradeTitle, { color: theme.gold.primary }]}>
              ✨ Unlock More Receipts
            </Text>
            <Text style={[styles.upgradeText, { color: theme.text.secondary }]}>
              Upgrade to Starter Plan for 50 receipts/month and more features
            </Text>
            <TouchableOpacity
              style={[
                styles.upgradeButton,
                { 
                  backgroundColor: theme.gold.primary,
                  opacity: isUpgrading ? 0.6 : 1,
                }
              ]}
              onPress={handleUpgrade}
              disabled={isUpgrading}
            >
              {isUpgrading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.upgradeButtonText}>Upgrade for $9/month</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  usageText: {
    fontSize: 16,
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
  },
  receiptsList: {
    gap: 12,
    marginBottom: 20,
  },
  receiptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptName: {
    fontSize: 18,
    fontWeight: '600',
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptCategory: {
    fontSize: 14,
    fontWeight: '500',
  },
  receiptDate: {
    fontSize: 14,
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  upgradePrompt: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginTop: 20,
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  upgradeText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  upgradeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
