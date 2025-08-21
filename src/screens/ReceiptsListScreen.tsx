import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { deleteReceiptAndImage } from '../utils/deleteReceipt';
import { getMonthlyReceiptCount } from '../utils/getMonthlyReceipts';
import { checkReceiptLimit } from '../utils/navigationGuards';
import { debugSubscriptionState } from '../utils/debugSubscription';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { useStripePayments } from '../hooks/useStripePayments';
import { useAuth } from '../context/AuthContext';
import { useReceiptSync } from '../services/ReceiptSyncService';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { useReceiptsNavigation } from '../navigation/navigationHelpers';
import { useFocusEffect } from '@react-navigation/native';
import { ReceiptCategoryService } from '../services/ReceiptCategoryService';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { FirebaseErrorScenarios } from '../utils/firebaseErrorHandler';
import { ReceiptsLoadingAnimation } from '../components/ReceiptsLoadingAnimation';
import { Receipt as FirebaseReceipt } from '../services/firebaseService';

export const ReceiptsListScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useReceiptsNavigation();
  const { subscription, getRemainingReceipts, currentReceiptCount } = useSubscription();
  const { handleSubscriptionWithCloudFunction } = useStripePayments();
  const { user } = useAuth();
  const { showError, showSuccess, showWarning, showFirebaseError, hideAlert } = useCustomAlert();
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  // Sync status from global sync hook
  const { syncing, syncError } = useReceiptSync();
  // Receipt type is imported from firebaseService
  
  // State for receipts and loading
  const [receipts, setReceipts] = useState<Array<FirebaseReceipt>>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<Array<FirebaseReceipt>>([]);
  const [activeReceiptCount, setActiveReceiptCount] = useState(0);
  const [historicalUsage, setHistoricalUsage] = useState<{ month: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isUpgradePromptDismissed, setIsUpgradePromptDismissed] = useState(false);
  const [isLimitReachedPromptDismissed, setIsLimitReachedPromptDismissed] = useState(false);
  
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
          showWarning(
            'Loading Receipts',
            'First-time setup in progress. Your receipts will be available shortly.'
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
      const receiptData = receiptDocs.map(doc => {
        const data = doc.data();
        // Normalize Firestore Timestamp to JS Date
        const createdAt = data.createdAt instanceof Date ? data.createdAt : (data.createdAt?.toDate?.() || new Date());
        const updatedAt = data.updatedAt instanceof Date ? data.updatedAt : (data.updatedAt?.toDate?.() || new Date());
        const date = data.date instanceof Date ? data.date : (data.date?.toDate?.() || new Date());
        return {
          ...data,
          receiptId: data.receiptId || doc.id,
          createdAt,
          updatedAt,
          date,
        };
      }) as FirebaseReceipt[];
      
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
          receiptId: r.receiptId,
          date: r.date,
          status: r.status,
          vendor: r.vendor,
          businessName: (r as any).businessName,
          type: (r as any).type
        }))
      });
      
      // Update all states
  setReceipts(receiptData);
  setFilteredReceipts(receiptData);
      setActiveReceiptCount(receiptData.length);
      setHistoricalUsage(historicalUsageData);
    } catch (error) {
      console.error('Error fetching receipts:', error);
      setReceipts([]);
      setFilteredReceipts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Focus effect to fetch receipts when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('Screen focused, fetching receipts...');
      fetchReceipts();
    }, [fetchReceipts])
  );

  // Filter receipts based on search query
  const filterReceipts = useCallback((query: string) => {
    if (!query.trim()) {
      setFilteredReceipts(receipts);
      return;
    }

    const filtered = receipts.filter(receipt => 
      receipt.vendor?.toLowerCase().includes(query.toLowerCase()) ||
      (receipt as any).businessName?.toLowerCase().includes(query.toLowerCase()) ||
      receipt.category?.toLowerCase().includes(query.toLowerCase()) ||
      receipt.amount?.toString().includes(query) ||
  receipt.createdAt.toLocaleDateString().includes(query)
    );
    
    setFilteredReceipts(filtered);
  }, [receipts]);

  // Handle search query changes
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    filterReceipts(query);
  }, [filterReceipts]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReceipts();
  }, [fetchReceipts]);

  // Reset search when receipts update
  React.useEffect(() => {
    if (searchQuery) {
      filterReceipts(searchQuery);
    } else {
      setFilteredReceipts(receipts);
    }
  }, [receipts, searchQuery, filterReceipts]);

  // Render receipt item for FlatList
  const renderReceiptItem = ({ item: receipt }: { item: FirebaseReceipt }) => (
    <TouchableOpacity
      onPress={() => {
        if (isSelectionMode) {
          const newSelected = new Set(selectedReceipts);
          if (newSelected.has(receipt.receiptId)) {
            newSelected.delete(receipt.receiptId);
          } else {
            newSelected.add(receipt.receiptId);
          }
          setSelectedReceipts(newSelected);
        } else {
          // Get the image URL or PDF path from the receipt
          const imageUrl = receipt.images?.[0]?.url || '';
          const pdfPath = (receipt as any).pdfPath || '';
          const pdfUrl = (receipt as any).pdfUrl || '';
          
          // For PDF receipts, use businessName as vendor, otherwise use vendor field
          const vendor = (receipt as any).businessName || receipt.vendor || 'Unknown Vendor';
          
          // Convert the local receipt format to the format expected by EditReceipt
          const firebaseReceipt: FirebaseReceipt = {
            receiptId: receipt.receiptId,
            userId: receipt.userId,
            vendor: vendor,
            amount: receipt.amount || 0,
            currency: 'USD', // Default currency
            date: receipt.date,
            description: '', // Default description
            category: receipt.category || 'business_expense',
            subcategory: '',
            tags: [],
            images: imageUrl ? [{
              url: imageUrl,
              size: 0,
              uploadedAt: receipt.createdAt
            }] : [],
            tax: {
              deductible: (receipt as any).tax?.deductible ?? true,
              deductionPercentage: (receipt as any).tax?.deductionPercentage ?? 100,
              taxYear: (receipt as any).tax?.taxYear ?? new Date().getFullYear(),
              category: (receipt as any).tax?.category ?? 'business'
            },
            status: 'processed' as const,
            processingErrors: [],
            createdAt: receipt.createdAt,
            updatedAt: receipt.updatedAt,
            // Add PDF fields for EditReceipt to handle
            ...(pdfPath && { pdfPath, pdfUrl, type: 'pdf' }),
            // Pass through metadata for regeneration logic
            metadata: (receipt as any).metadata
          };
          
          navigation.navigate('EditReceipt', {
            receipt: firebaseReceipt as any
          });
        }
      }}
      onLongPress={() => {
        if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedReceipts(new Set([receipt.receiptId]));
        }
      }}
      style={[
        styles.receiptCard,
        {
          backgroundColor: theme.background.secondary,
          borderColor: selectedReceipts.has(receipt.receiptId) 
            ? theme.gold.primary 
            : theme.border.primary,
          borderWidth: selectedReceipts.has(receipt.receiptId) ? 2 : 1,
        },
      ]}
    >
      {isSelectionMode && (
        <View style={[styles.checkbox, { borderColor: theme.border.primary }]}>
          {selectedReceipts.has(receipt.receiptId) && (
            <View style={[styles.checkboxInner, { backgroundColor: theme.gold.primary }]} />
          )}
        </View>
      )}
      <View style={styles.receiptContent}>
        <View style={styles.receiptHeader}>
          <Text style={[styles.receiptName, { color: theme.text.primary }]}>
            {receipt.createdAt.toLocaleDateString()}
          </Text>
          <Text style={[styles.receiptAmount, { color: theme.gold.primary }]}>
            ${(receipt.amount || 0).toFixed(2)}
          </Text>
        </View>
        <View style={styles.receiptDetails}>
          <Text style={[styles.receiptCategory, { color: theme.text.secondary }]}>
            {receipt.category ? ReceiptCategoryService.getCategoryDisplayName(receipt.category as any) : 'Uncategorized'}
          </Text>
          <Text style={[styles.receiptDate, { color: theme.text.tertiary }]}>
            {(receipt as any).businessName || receipt.vendor || 'Unknown Vendor'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render header component for FlatList
  const ListHeaderComponent = () => {
    const maxReceipts = subscription?.limits?.maxReceipts || 10;
    const remainingReceipts = getRemainingReceipts(currentReceiptCount);

    return (
      <View style={[styles.usageCard, { 
        backgroundColor: theme.background.secondary,
        borderColor: theme.border.primary,
        marginBottom: 16,
      }]}>
        {refreshing ? (
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
    );
  };

  // Render empty state
  const ListEmptyComponent = () => (
    <View style={styles.emptyState}>
      <Ionicons name="receipt-outline" size={64} color={theme.text.tertiary} />
      <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
        {searchQuery ? 'No receipts found' : 'No receipts yet'}
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
        {searchQuery 
          ? `No receipts match "${searchQuery}"`
          : 'Start by scanning your first receipt!'
        }
      </Text>
    </View>
  );

  const handleUpgrade = async () => {
    if (!user) return;

    setIsUpgrading(true);
    try {
      const success = await handleSubscriptionWithCloudFunction(
        'starter',
        user.email || '',
        user.displayName || 'User'
      );

      if (!success) {
        showError('Error', 'Failed to process payment. Please try again.');
      }
    } catch (error) {
      console.error('Failed to upgrade subscription:', error);
      showError(
        'Error',
        'Failed to process payment. Please check your payment details and try again.'
      );
    } finally {
      setIsUpgrading(false);
    }
  };

  const maxReceipts = subscription?.limits?.maxReceipts || 10;
  const remainingReceipts = getRemainingReceipts(currentReceiptCount);

  // Show loading animation when initially loading receipts (but not when refreshing)
  if (loading && !refreshing) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <ReceiptsLoadingAnimation />
        
        {/* Floating Action Button - Always Visible */}
        <TouchableOpacity
          style={[styles.fab, { 
            backgroundColor: theme.gold.primary,
            shadowColor: theme.text.primary,
            opacity: 0.7, // Slightly dimmed during loading
          }]}
          onPress={() => {
            // Check again right before navigation
            const maxReceipts = subscription?.limits?.maxReceipts || 10;
            if (checkReceiptLimit(currentReceiptCount, maxReceipts, handleUpgrade)) {
              navigation.navigate('ScanReceipt');
            }
          }}
        >
          <Ionicons name="camera" size={28} color="white" />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Sync status banner
  const SyncBanner = () => {
    if (syncing) {
      return (
        <View style={{ width: '100%', backgroundColor: theme.gold.primary, padding: 8 }}>
          <Text style={{ color: theme.text.primary, textAlign: 'center', fontWeight: 'bold' }}>Syncing receipts...</Text>
        </View>
      );
    }
    if (syncError) {
      return (
        <View style={{ width: '100%', backgroundColor: '#FF4D4F', padding: 8 }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>{syncError}</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <View style={styles.content}>
        {/* Header with title and controls */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              My Receipts
            </Text>
            <View style={styles.headerControls}>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Ionicons 
                  name={showSearch ? "close" : "search"} 
                  size={24} 
                  color={theme.text.primary} 
                />
              </TouchableOpacity>
              {filteredReceipts.length > 0 && (
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedReceipts(new Set());
                  }}
                >
                  <Text style={[styles.selectButtonText, { color: theme.gold.primary }]}>
                    {isSelectionMode ? 'Cancel' : 'Select'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Bar */}
          {showSearch && (
            <View style={[styles.searchContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.primary 
            }]}>
              <Ionicons name="search" size={20} color={theme.text.tertiary} />
              <TextInput
                style={[styles.searchInput, { color: theme.text.primary }]}
                placeholder="Search receipts..."
                placeholderTextColor={theme.text.tertiary}
                value={searchQuery}
                onChangeText={handleSearchChange}
                autoFocus={showSearch}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => handleSearchChange('')}>
                  <Ionicons name="close-circle" size={20} color={theme.text.tertiary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Selection Bar */}
          {isSelectionMode && selectedReceipts.size > 0 && (
            <View style={styles.selectionBar}>
              <Text style={[styles.selectionText, { color: theme.text.primary }]}>
                {selectedReceipts.size} selected
              </Text>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: theme.status.error }]}
                onPress={() => {
                  const handleDelete = async () => {
                    try {
                      setLoading(true);
                      const deletePromises = Array.from(selectedReceipts).map(id =>
                        deleteReceiptAndImage(id)
                      );
                      await Promise.all(deletePromises);
                      setSelectedReceipts(new Set());
                      setIsSelectionMode(false);
                      fetchReceipts();
                      hideAlert(); // Dismiss the alert after successful deletion
                    } catch (error) {
                      console.error('Error deleting receipts:', error);
                      hideAlert(); // Dismiss the confirmation alert first
                      showError('Error', 'Failed to delete some receipts. Please try again.');
                    } finally {
                      setLoading(false);
                    }
                  };

                  showWarning(
                    'Delete Receipts',
                    `Are you sure you want to delete ${selectedReceipts.size} receipt${selectedReceipts.size === 1 ? '' : 's'}? This action cannot be undone.`,
                    {
                      primaryButtonText: 'Delete',
                      secondaryButtonText: 'Cancel',
                      onPrimaryPress: handleDelete,
                    }
                  );
                }}
              >
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Receipts FlatList */}
        <FlatList
          data={[
            ...filteredReceipts,
            // Add limit reached prompt for users who have reached their limit
            ...(remainingReceipts === 0 && !isLimitReachedPromptDismissed 
              ? [{ isLimitReachedPrompt: true }] 
              : []
            ),
            // Add upgrade prompt as last item for free users with remaining receipts
            ...(subscription?.currentTier === 'free' && remainingReceipts > 0 && !isUpgradePromptDismissed 
              ? [{ isUpgradePrompt: true }] 
              : []
            )
          ]}
          renderItem={({ item }) => {
            // Check if this is the limit reached prompt item
            if ('isLimitReachedPrompt' in item) {
              return (
                <View style={[styles.limitReachedPromptCard, {
                  backgroundColor: theme.background.secondary,
                  borderColor: theme.border.primary,
                }]}>
                  <TouchableOpacity
                    style={styles.limitReachedPromptClose}
                    onPress={() => setIsLimitReachedPromptDismissed(true)}
                  >
                    <Ionicons name="close" size={24} color={theme.text.secondary} />
                  </TouchableOpacity>
                  <View style={styles.limitReachedPromptIcon}>
                    <Ionicons name="warning" size={48} color="#ff6b35" />
                  </View>
                  <Text style={[styles.limitReachedPromptTitle, { color: "#ff6b35" }]}>
                    🚫 Monthly Limit Reached
                  </Text>
                  <Text style={[styles.limitReachedPromptDescription, { color: theme.text.secondary }]}>
                    You've used all your receipts for this month. Upgrade your plan for unlimited storage or wait until next month.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.limitReachedPromptButton, { 
                      backgroundColor: "#ff6b35",
                    }]}
                    onPress={async () => {
                      setIsUpgrading(true);
                      try {
                        const success = await handleSubscriptionWithCloudFunction(
                          'growth',
                          user?.email || '',
                          user?.displayName || 'User'
                        );
                        if (!success) {
                          showError('Error', 'Failed to process payment. Please try again.');
                        }
                      } finally {
                        setIsUpgrading(false);
                      }
                    }}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text style={styles.limitReachedPromptButtonText}>Upgrade Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }
            // Check if this is the upgrade prompt item
            if ('isUpgradePrompt' in item) {
              return (
                <View style={[styles.upgradePromptCard, {
                  backgroundColor: theme.gold.background,
                  borderColor: theme.gold.primary,
                }]}>
                  <TouchableOpacity
                    style={styles.upgradePromptClose}
                    onPress={() => setIsUpgradePromptDismissed(true)}
                  >
                    <Ionicons name="close" size={20} color={theme.text.secondary} />
                  </TouchableOpacity>
                  
                  <View style={styles.upgradePromptIcon}>
                    <Ionicons name="sparkles" size={24} color={theme.gold.primary} />
                  </View>
                  
                  <Text style={[styles.upgradePromptTitle, { color: theme.gold.primary }]}>
                    ✨ Unlock More Receipts
                  </Text>
                  
                  <Text style={[styles.upgradePromptDescription, { color: theme.text.secondary }]}>
                    Get 50 receipts per month with our Starter Plan. Never worry about running out of space for your receipts again!
                  </Text>
                  
                  <TouchableOpacity
                    style={[styles.upgradePromptButton, { 
                      backgroundColor: theme.gold.primary,
                      opacity: isUpgrading ? 0.7 : 1,
                    }]}
                    onPress={handleUpgrade}
                    disabled={isUpgrading}
                  >
                    {isUpgrading ? (
                      <ActivityIndicator color="white" size="small" />
                    ) : (
                      <>
                        <Ionicons name="arrow-up" size={16} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.upgradePromptButtonText}>Upgrade Now</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }

            // Regular receipt item
            const receipt = item as FirebaseReceipt;
            return renderReceiptItem({ item: receipt });
          }}
          keyExtractor={(item) => {
            if ('isLimitReachedPrompt' in item) return 'limit-reached-prompt';
            if ('isUpgradePrompt' in item) return 'upgrade-prompt';
            return (item as FirebaseReceipt).receiptId;
          }}
          ListHeaderComponent={ListHeaderComponent}
          ListEmptyComponent={ListEmptyComponent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.gold.primary}
              colors={[theme.gold.primary]}
            />
          }
          contentContainerStyle={{ 
            paddingBottom: 100
          }}
          showsVerticalScrollIndicator={false}
          getItemLayout={(data, index) => ({
            length: 100, // Approximate height of receipt card
            offset: 100 * index,
            index,
          })}
          initialNumToRender={10}
          maxToRenderPerBatch={5}
          windowSize={10}
        />
      </View>

      {/* Floating Action Button - Always Visible */}
      <TouchableOpacity
        style={[styles.fab, { 
          backgroundColor: theme.gold.primary,
          shadowColor: theme.text.primary,
        }]}
        onPress={() => {
          // Check again right before navigation
          const maxReceipts = subscription?.limits?.maxReceipts || 10;
          if (checkReceiptLimit(currentReceiptCount, maxReceipts, handleUpgrade)) {
            navigation.navigate('ScanReceipt');
          }
        }}
      >
        <Ionicons name="camera" size={28} color="white" />
      </TouchableOpacity>
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  searchButton: {
    padding: 8,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
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
  receiptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptContent: {
    flex: 1,
    marginLeft: 8,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  receiptName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
  },
  receiptDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptCategory: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  receiptDate: {
    fontSize: 12,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  upgradePrompt: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
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
  upgradePromptCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    position: 'relative',
  },
  upgradePromptClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  upgradePromptIcon: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  upgradePromptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  upgradePromptDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradePromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  upgradePromptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  limitReachedPromptCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    position: 'relative',
  },
  limitReachedPromptClose: {
    position: 'absolute',
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  limitReachedPromptIcon: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  limitReachedPromptTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  limitReachedPromptDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  limitReachedPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  limitReachedPromptButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 10,
  },
});
