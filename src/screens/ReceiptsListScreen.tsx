import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteReceiptAndImage } from '../utils/deleteReceipt';
import { getMonthlyReceiptCount } from '../utils/getMonthlyReceipts';
import { checkReceiptLimit } from '../utils/navigationGuards';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Platform } from 'react-native';
import { useSubscription } from '../context/SubscriptionContext';
import Constants from 'expo-constants';
import { useStripePayments } from '../hooks/useStripePayments';
import { useAuth } from '../context/AuthContext';
import { ReceiptLimitGate } from '../components/PremiumGate';
import { db } from '../config/firebase';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useReceiptsNavigation } from '../navigation/navigationHelpers';
import { useFocusEffect } from '@react-navigation/native';

export const ReceiptsListScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useReceiptsNavigation();
  const { subscription, getRemainingReceipts } = useSubscription();
  const { handleSubscription } = useStripePayments();
  const { user } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  interface Receipt {
    id: string;
    date: any; // Firebase Timestamp
    createdAt: any; // Firebase Timestamp
    status: string;
    vendor: string;
    amount: number;
    category: string;
    userId: string;
    imageUrl: string;
  }
  
  // State for receipts and loading
  const [receipts, setReceipts] = useState<Array<Receipt>>([]);
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const [activeReceiptCount, setActiveReceiptCount] = useState(0);
  const [historicalUsage, setHistoricalUsage] = useState<{ month: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const fetchReceipts = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      
      let receiptDocs;
      
      // First try the optimized query with indexes
      try {
        // Get displayed receipts (not deleted) with ordering
        const receiptsQuery = query(
          collection(db, 'receipts'),
          where('userId', '==', user.uid),
          where('status', '!=', 'deleted'),
          orderBy('createdAt', 'desc')
        );
        const receiptsSnapshot = await getDocs(receiptsQuery);
        receiptDocs = receiptsSnapshot.docs;
      } catch (error: any) {
        // If we get an index error, fall back to the basic query
        if (error?.message?.includes('requires an index')) {
          console.log('Index not ready, falling back to basic query...');
          Alert.alert(
            'Loading Receipts',
            'First-time setup in progress. Your receipts will be available shortly.',
            [{ text: 'OK' }]
          );
          
          // Get all receipts and sort them in memory
          const basicQuery = query(
            collection(db, 'receipts'),
            where('userId', '==', user.uid)
          );
          const basicSnapshot = await getDocs(basicQuery);
          receiptDocs = basicSnapshot.docs
            .filter(doc => doc.data().status !== 'deleted')
            .sort((a, b) => {
              const aDate = a.data().createdAt?.toDate?.() || new Date(0);
              const bDate = b.data().createdAt?.toDate?.() || new Date(0);
              return bDate.getTime() - aDate.getTime();
            });
        } else {
          throw error; // Re-throw if it's not an index error
        }
      }
      
      // Convert the docs to receipt data
      const receiptData = receiptDocs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Receipt, 'id'>)
      })) as Receipt[];
      
      // Get monthly usage count using our utility function
      const monthlyCount = await getMonthlyReceiptCount(user.uid);
      console.log("🚀 ~ ReceiptsListScreen ~ monthlyCount:", monthlyCount)
      console.log('Monthly usage count (including deleted):', monthlyCount);

      // Get historical usage (last 6 months)
      let historicalDocs;
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        // Try optimized historical query first
        const historicalQuery = query(
          collection(db, 'receipts'),
          where('userId', '==', user.uid),
          where('createdAt', '>=', sixMonthsAgo),
          orderBy('createdAt', 'desc')
        );
        const historicalSnapshot = await getDocs(historicalQuery);
        historicalDocs = historicalSnapshot.docs;
      } catch (error: any) {
        if (error?.message?.includes('requires an index')) {
          console.log('Historical index not ready, using basic query...');
          // Fall back to basic query and filter/sort in memory
          const basicHistoricalQuery = query(
            collection(db, 'receipts'),
            where('userId', '==', user.uid)
          );
          const basicSnapshot = await getDocs(basicHistoricalQuery);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
          
          historicalDocs = basicSnapshot.docs.filter(doc => {
            const createdAt = doc.data().createdAt?.toDate?.();
            return createdAt && createdAt >= sixMonthsAgo;
          }).sort((a, b) => {
            const aDate = a.data().createdAt?.toDate?.() || new Date(0);
            const bDate = b.data().createdAt?.toDate?.() || new Date(0);
            return bDate.getTime() - aDate.getTime();
          });
        } else {
          throw error;
        }
      }
      const historicalData = historicalDocs
        .reduce<Record<string, number>>((acc, doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          if (!createdAt) {
            console.warn('Receipt missing createdAt:', doc.id);
            return acc;
          }
          
          const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
          acc[monthKey] = (acc[monthKey] || 0) + 1;
          return acc;
        }, {});
      
      const historicalUsageData = Object.entries(historicalData)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => b.month.localeCompare(a.month));
      
      console.log("📝 Receipt Data:", {
        activeCount: receiptData.length,
        monthlyUsageCount: monthlyCount,
        historical: historicalUsageData,
        receipts: receiptData.map(r => ({
          id: r.id,
          date: r.date,
          status: r.status,
          vendor: r.vendor
        }))
      });
      
      // Update all states
      setReceipts(receiptData);
      setActiveReceiptCount(receiptData.length);
      setCurrentReceiptCount(monthlyCount);
      setHistoricalUsage(historicalUsageData);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setReceipts([]);
      setCurrentReceiptCount(0);
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Fetch receipts when the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, fetching receipts...');
      fetchReceipts();
    }, [fetchReceipts])
  );
  // Calculate remaining receipts based on subscription tier limits
  const maxReceipts = subscription?.limits?.maxReceipts || Constants.expoConfig?.extra?.FREE_TIER_MAX_RECEIPTS || 10; // default to free tier
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView style={styles.content}>
        {/* Header with usage info */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              My Receipts
            </Text>
            {receipts.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedReceipts(new Set());
                }}
              >
                <Text style={[styles.selectButton, { color: theme.gold.primary }]}>
                  {isSelectionMode ? 'Cancel' : 'Select'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {isSelectionMode && selectedReceipts.size > 0 && (
            <View style={styles.selectionBar}>
              <Text style={[styles.selectionText, { color: theme.text.primary }]}>
                {selectedReceipts.size} selected
              </Text>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.status.error }]}
                onPress={() => {
                  Alert.alert(
                    'Delete Receipts',
                    `Are you sure you want to delete ${selectedReceipts.size} receipts? This cannot be undone.`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            setLoading(true);
                            const deletePromises = Array.from(selectedReceipts).map(id =>
                              deleteReceiptAndImage(id)
                            );
                            await Promise.all(deletePromises);
                            setSelectedReceipts(new Set());
                            setIsSelectionMode(false);
                            fetchReceipts();
                          } catch (error) {
                            console.error('Error deleting receipts:', error);
                            Alert.alert('Error', 'Failed to delete some receipts. Please try again.');
                          }
                        },
                      },
                    ]
                  );
                }}
              >
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Show usage info for free tier, or receipt count for paid tiers */}
          <View style={[styles.usageCard, { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary 
          }]}>
            {loading ? (
              <ActivityIndicator size="small" color={theme.gold.primary} />
            ) : (
              <>
                <View style={styles.usageRow}>
                  <View style={styles.usageColumn}>
                    <Text style={[styles.usageLabel, { color: theme.text.tertiary }]}>
                      Active Receipts
                    </Text>
                    <Text style={[styles.usageValue, { color: theme.text.primary }]}>
                      {activeReceiptCount}
                    </Text>
                  </View>
                  <View style={styles.usageColumn}>
                    <Text style={[styles.usageLabel, { color: theme.text.tertiary }]}>
                      {subscription?.currentTier === 'free' 
                        ? 'Total Usage (includes deleted)'
                        : 'Monthly Usage (includes deleted)'}
                    </Text>
                    <Text style={[styles.usageValue, { color: theme.text.primary }]}>
                      {maxReceipts === -1 ? currentReceiptCount : `${currentReceiptCount} / ${maxReceipts}`}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.usageDivider} />
                
                <View style={styles.usageInfo}>
                  {subscription?.currentTier !== 'free' && maxReceipts !== -1 && (
                    <Text style={[styles.usageLabel, { color: theme.text.tertiary }]}>
                      Limit resets on {subscription?.billing?.currentPeriodEnd?.toLocaleDateString() || 'N/A'}
                    </Text>
                  )}
                  
                  {maxReceipts !== -1 && remainingReceipts <= 2 && (
                    <Text style={[styles.warningText, { color: theme.status.warning }]}>
                      {remainingReceipts} {remainingReceipts === 1 ? 'receipt' : 'receipts'} remaining this month
                    </Text>
                  )}
                </View>

                {historicalUsage.filter(({ month }) => month !== new Date().toISOString().slice(0, 7)).length > 0 && (
                  <View style={styles.historicalUsage}>
                    <Text style={[styles.usageLabel, { color: theme.text.tertiary, marginBottom: 8 }]}>
                      Previous Months
                    </Text>
                    {historicalUsage
                      .filter(({ month }) => {
                        // Filter out the current month
                        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                        return month !== currentMonth;
                      })
                      .slice(0, 3)
                      .map(({ month, count }) => {
                        const [year, monthNum] = month.split('-');
                        const displayDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
                        console.log('Displaying month:', { month, displayDate: displayDate.toISOString() });
                        return (
                          <View key={month} style={styles.historicalRow}>
                            <Text style={[styles.historicalMonth, { color: theme.text.secondary }]}>
                              {displayDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                            </Text>
                            <Text style={[styles.historicalCount, { color: theme.text.primary }]}>
                              {count} receipts
                            </Text>
                          </View>
                        );
                      })}
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Receipts List */}
        <View style={styles.receiptsList}>
          {receipts.map((receipt) => (
            <TouchableOpacity
              key={receipt.id}
              onPress={() => {
                if (isSelectionMode) {
                  const newSelected = new Set(selectedReceipts);
                  if (newSelected.has(receipt.id)) {
                    newSelected.delete(receipt.id);
                  } else {
                    newSelected.add(receipt.id);
                  }
                  setSelectedReceipts(newSelected);
                } else {
                  navigation.navigate('ReceiptDetail', {
                    receiptId: receipt.id
                  });
                }
              }}
              onLongPress={() => {
                if (!isSelectionMode) {
                  setIsSelectionMode(true);
                  setSelectedReceipts(new Set([receipt.id]));
                }
              }}
              style={[
                styles.receiptCard,
                {
                  backgroundColor: theme.background.secondary,
                  borderColor: selectedReceipts.has(receipt.id) 
                    ? theme.gold.primary 
                    : theme.border.primary,
                  borderWidth: selectedReceipts.has(receipt.id) ? 2 : 1,
                },
              ]}
            >
              {isSelectionMode && (
                <View style={[styles.checkbox, { borderColor: theme.border.primary }]}>
                  {selectedReceipts.has(receipt.id) && (
                    <View style={[styles.checkboxInner, { backgroundColor: theme.gold.primary }]} />
                  )}
                </View>
              )}
              <View style={styles.receiptHeader}>
                <Text style={[styles.receiptName, { color: theme.text.primary }]}>
                  {new Date(receipt.createdAt?.toDate()).toLocaleDateString()}
                </Text>
                <Text style={[styles.receiptAmount, { color: theme.gold.primary }]}>
                  ${receipt.amount || '0.00'}
                </Text>
              </View>
              <View style={styles.receiptDetails}>
                <Text style={[styles.receiptCategory, { color: theme.text.secondary }]}>
                  {receipt.category || 'Uncategorized'}
                </Text>
                <Text style={[styles.receiptDate, { color: theme.text.tertiary }]}>
                  {receipt.vendor || 'Unknown Vendor'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Add Receipt Button - with limit check */}
        <ReceiptLimitGate currentReceiptCount={currentReceiptCount}>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.gold.primary }]}
            onPress={() => {
              // Check again right before navigation
              const maxReceipts = subscription?.limits?.maxReceipts || 10;
              if (checkReceiptLimit(currentReceiptCount, maxReceipts, handleUpgrade)) {
                navigation.navigate('ScanReceipt');
              }
            }}
          >
            <Text style={styles.addButtonText}>� Scan New Receipt</Text>
          </TouchableOpacity>
        </ReceiptLimitGate>

        {/* Free tier upgrade prompt - only show if limit not reached */}
        {subscription?.currentTier === 'free' && remainingReceipts > 0 && (
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
                <Text style={styles.upgradeButtonText}>Upgrade for $9.99/month</Text>
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
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  selectButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 16,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  usageColumn: {
    flex: 1,
  },
  usageLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  usageDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginBottom: 16,
  },
  usageInfo: {
    marginBottom: 16,
  },
  historicalUsage: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    paddingTop: 16,
  },
  historicalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historicalMonth: {
    fontSize: 14,
  },
  historicalCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
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
