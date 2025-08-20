import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { BankReceiptService, TransactionCandidate } from '../services/BankReceiptService';
import { PlaidService } from '../services/PlaidService';
import { GeneratedReceipt } from '../services/HTMLReceiptService';
import ReceiptServiceFactory from '../services/ReceiptServiceFactory';
import { useInAppNotifications } from '../components/InAppNotificationProvider';
import { PlaidLinkButton } from '../components/PlaidLinkButton';

export const BankTransactionsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { showNotification } = useInAppNotifications();
  
  const [candidates, setCandidates] = useState<(TransactionCandidate & { _id?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  const [generatedReceipts, setGeneratedReceipts] = useState<Map<string, GeneratedReceipt>>(new Map());
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  // Search and filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'merchant'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterByCategory, setFilterByCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();
  
  // Get service info for display
  const serviceInfo = ReceiptServiceFactory.getServiceInfo();

  // Filtered and sorted candidates
  const filteredAndSortedCandidates = useMemo(() => {
    let filtered = candidates;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(candidate => 
        (candidate.transaction.merchant_name || candidate.transaction.name || '').toLowerCase().includes(query) ||
        (candidate.transaction.category?.[0] || '').toLowerCase().includes(query)
      );
    }

    // Category filter
    if (filterByCategory && filterByCategory !== 'all') {
      filtered = filtered.filter(candidate => 
        candidate.transaction.category?.[0] === filterByCategory
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'date':
          aValue = new Date(a.transaction.date).getTime();
          bValue = new Date(b.transaction.date).getTime();
          break;
        case 'amount':
          aValue = Math.abs(a.transaction.amount);
          bValue = Math.abs(b.transaction.amount);
          break;
        case 'merchant':
          aValue = (a.transaction.merchant_name || a.transaction.name || '').toLowerCase();
          bValue = (b.transaction.merchant_name || b.transaction.name || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [candidates, searchQuery, sortBy, sortDirection, filterByCategory]);

  // Get unique categories for filter
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    candidates.forEach(candidate => {
      if (candidate.transaction.category?.[0]) {
        categories.add(candidate.transaction.category[0]);
      }
    });
    return Array.from(categories).sort();
  }, [candidates]);

  useEffect(() => {
    if (user && subscription.currentTier === 'professional') {
      // Only load candidates and create link token; do not clear bank connections in dev mode
      loadTransactionCandidates();
      createLinkToken(); // Prepare link token for bank connection
    }
  }, [user, subscription.currentTier]);

  const loadTransactionCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // First, try to get candidates from cache
      const cachedCandidates = await bankReceiptService.getCachedTransactionCandidates(user.uid);
      
      if (cachedCandidates.length > 0) {
        console.log('� Using cached candidates:', cachedCandidates.length);
        setCandidates(cachedCandidates.map(candidate => ({ _id: candidate.transaction?.transaction_id || 'unknown', ...candidate })));
        
        // Load generated receipts for candidates with 'generated' status
        await loadGeneratedReceipts(cachedCandidates.filter(c => c.status === 'generated').map(candidate => ({ _id: candidate.transaction?.transaction_id || 'unknown', ...candidate })));
        return;
      }
      
      // No cache, run the full sync process
      console.log('� No cache found, running full sync...');
      await bankReceiptService.monitorTransactions(user.uid);
      
      // Now fetch the newly created candidates from Firestore
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      const candidatesQuery = query(
        collection(db, 'transactionCandidates'),
        where('userId', '==', user.uid),
        where('status', '!=', 'rejected')
      );
      const snapshot = await getDocs(candidatesQuery);
      const allCandidates = snapshot.docs.map(doc => ({ _id: doc.id, ...(doc.data() as TransactionCandidate) }));
      setCandidates(allCandidates);
      
      // Cache these candidates with their Firestore IDs
      await bankReceiptService.cacheFirestoreCandidates(user.uid, allCandidates);
      
      // Load generated receipts for candidates with 'generated' status
      await loadGeneratedReceipts(allCandidates.filter(c => c.status === 'generated'));
    } catch (error) {
      console.error('Error loading transaction candidates:', error);
      // Check if error is due to no bank connections
      if (error instanceof Error && error.message.includes('Network request failed')) {
        console.log('ℹ️ Network error - likely no bank connections exist yet');
        setCandidates([]); // Set empty array so UI shows connect button
      } else {
        showNotification({
          type: 'error',
          title: 'Error Loading Transactions',
          message: 'Failed to load recent transactions. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGeneratedReceipts = async (candidatesWithReceipts: (TransactionCandidate & { _id?: string })[]) => {
    if (candidatesWithReceipts.length === 0) return;
    
    try {
      const { getDocs, collection, query, where } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');
      
      const newGeneratedReceipts = new Map<string, GeneratedReceipt>();
      
      for (const candidate of candidatesWithReceipts) {
        const docId = (candidate as any)._id;
        if (!docId) continue;
        
        // Query the generatedReceipts collection with userId filter for security
        const receiptsQuery = query(
          collection(db, 'generatedReceipts'),
          where('candidateId', '==', docId),
          where('userId', '==', user?.uid)
        );
        const receiptSnap = await getDocs(receiptsQuery);
        
        if (!receiptSnap.empty) {
          const receiptData = receiptSnap.docs[0].data();
          // Convert back to GeneratedReceipt format
          const generatedReceipt: GeneratedReceipt = {
            receiptImageUrl: receiptData.receiptImageUrl,
            receiptData: {
              businessName: receiptData.businessName,
              address: receiptData.address,
              date: receiptData.date,
              time: receiptData.time,
              items: receiptData.items || [],
              subtotal: receiptData.subtotal,
              tax: receiptData.tax,
              total: receiptData.total,
              paymentMethod: receiptData.paymentMethod,
              transactionId: receiptData.transactionId,
            }
          };
          newGeneratedReceipts.set(docId, generatedReceipt);
        }
      }
      
      setGeneratedReceipts(newGeneratedReceipts);
    } catch (error) {
      console.error('Error loading generated receipts:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    
    // Clear cache to force fresh data fetch
    if (user) {
      await bankReceiptService.clearTransactionCache(user.uid);
    }
    
    await loadTransactionCandidates();
    setRefreshing(false);
  };

  const createLinkToken = async () => {
    if (!user) return;

    try {
      const token = await plaidService.createLinkToken(user.uid);
      setLinkToken(token);
    } catch (error) {
      console.error('Error creating link token:', error);
      showNotification({
        type: 'error',
        title: 'Connection Error',
        message: 'Failed to prepare bank connection. Please try again.',
      });
    }
  };

  const handlePlaidSuccess = async (success: LinkSuccess) => {
    if (!user) return;

    try {
      setLoading(true);
      const accessToken = await plaidService.exchangePublicToken(success.publicToken);
      const accounts = await plaidService.getAccounts(accessToken);
      
      // Create bank connection record
      const bankConnection = {
        id: `bank_${user.uid}_${Date.now()}`,
        userId: user.uid,
        accessToken,
        institutionName: 'Connected Bank',
        accounts: accounts.map(acc => ({
          accountId: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask,
        })),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        isActive: true,
      };

      await bankReceiptService.saveBankConnectionLocally(bankConnection);
      
      showNotification({
        type: 'success',
        title: 'Bank Connected!',
        message: 'Your bank account has been connected successfully.',
      });
      
      await loadTransactionCandidates();
    } catch (error) {
      console.error('Error handling Plaid success:', error);
      showNotification({
        type: 'error',
        title: 'Connection Failed',
        message: 'Failed to complete bank connection. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = (exit: LinkExit) => {
    console.log('Plaid Link exited:', exit);
    if (exit.error) {
      showNotification({
        type: 'error',
        title: 'Connection Error',
        message: exit.error.errorMessage || 'Failed to connect bank account.',
      });
    }
  };

  const generateReceipt = async (candidate: TransactionCandidate, candidateId: string) => {
    try {
      console.log('� Generate receipt called for candidate:', candidateId);
      console.log('🔍 Current user:', user);
      console.log('🔍 User UID:', user?.uid);
      
      if (!user?.uid) {
        console.error('❌ No authenticated user found');
        showNotification({
          type: 'error',
          title: 'Authentication Error',
          message: 'You must be logged in to generate receipts.',
        });
        return;
      }

      setGeneratingReceipt(candidateId);
      
      console.log('🔍 Calling generateReceiptForTransaction with userId:', user.uid);
      const generatedReceipt = await bankReceiptService.generateReceiptForTransaction(
        candidateId,
        candidate.transaction,
        user.uid
      );
      
      setGeneratedReceipts(prev => new Map(prev).set(candidateId, generatedReceipt));
      
      showNotification({
        type: 'success',
        title: 'Receipt Generated!',
        message: 'AI has created a receipt for this transaction.',
      });
    } catch (error) {
      console.error('Error generating receipt:', error);
      showNotification({
        type: 'error',
        title: 'Generation Failed',
        message: 'Failed to generate receipt. Please try again.',
      });
    } finally {
      setGeneratingReceipt(null);
    }
  };

  const approveReceipt = async (
    candidate: TransactionCandidate & { _id?: string },
    candidateId: string,
    generatedReceipt: GeneratedReceipt
  ) => {
    if (!user) return;

    try {
      await bankReceiptService.saveGeneratedReceiptAsReceipt(
        user.uid,
        generatedReceipt,
        candidateId
      );
      
      // Remove from candidates list by Firestore doc id
      setCandidates(prev => prev.filter(c => (c as any)._id !== candidateId));
      setGeneratedReceipts(prev => {
        const newMap = new Map(prev);
        newMap.delete(candidateId);
        return newMap;
      });
      
      showNotification({
        type: 'success',
        title: 'Receipt Saved!',
        message: 'The generated receipt has been added to your collection.',
      });
    } catch (error) {
      console.error('Error approving receipt:', error);
      showNotification({
        type: 'error',
        title: 'Save Failed',
        message: 'Failed to save receipt. Please try again.',
      });
    }
  };

  const rejectCandidate = async (candidateId: string) => {
    try {
      console.log('🗑️ Reject candidate called for:', candidateId);
      
      if (!user?.uid) {
        showNotification({
          type: 'error',
          title: 'Authentication Error',
          message: 'You must be logged in to dismiss transactions.',
        });
        return;
      }

      // Call the service to dismiss the candidate in Firestore
      await bankReceiptService.dismissCandidate(candidateId, user.uid);
      
      // Remove from local state
      setCandidates(prev => prev.filter(c => (c as any)._id !== candidateId));
      setGeneratedReceipts(prev => {
        const newMap = new Map(prev);
        newMap.delete(candidateId);
        return newMap;
      });
      
    } catch (error) {
      console.error('Error dismissing candidate:', error);
      showNotification({
        type: 'error',
        title: 'Dismiss Failed',
        message: 'Failed to dismiss transaction. Please try again.',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // FlatList item renderer
  const renderTransactionItem = ({ item: candidate }: { item: TransactionCandidate & { _id?: string } }) => {
    const docId = (candidate as any)._id ?? `${candidate.transaction.transaction_id}_fallback`;
    const generatedReceipt = generatedReceipts.get(docId);
    const isGenerating = generatingReceipt === docId;

    return (
      <View style={styles.candidateCard}>
        <View style={styles.candidateHeader}>
          <View style={styles.merchantInfo}>
            <Text style={styles.merchantName}>
              {candidate.transaction.merchant_name || candidate.transaction.name}
            </Text>
            <Text style={styles.transactionDate}>
              {formatDate(candidate.transaction.date)}
            </Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>
              {formatCurrency(candidate.transaction.amount)}
            </Text>
            {candidate.transaction.category && (
              <Text style={styles.category}>
                {candidate.transaction.category[0]}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Channel:</Text>
            <Text style={styles.detailValue}>
              {candidate.transaction.payment_channel}
            </Text>
          </View>
          {candidate.transaction.location && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Location:</Text>
              <Text style={styles.detailValue}>
                {candidate.transaction.location.city}, {candidate.transaction.location.region}
              </Text>
            </View>
          )}
        </View>

        {generatedReceipt && (
          <View style={styles.generatedReceiptContainer}>
            <Text style={styles.receiptTitle}>Generated Receipt Preview</Text>
            <Image 
              source={{ uri: generatedReceipt.receiptImageUrl }} 
              style={styles.receiptImage}
              resizeMode="contain"
              onLoad={() => console.log('✅ Receipt image loaded successfully')}
              onError={(error) => {
                console.log('⚠️ Image failed to load:', error.nativeEvent.error);
                console.log('🔍 Image URL:', generatedReceipt.receiptImageUrl);
              }}
            />
            
            <Text style={styles.receiptDetails}>
              {generatedReceipt.receiptData.businessName} • {generatedReceipt.receiptData.date}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!generatedReceipt && !isGenerating && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.generateButton]}
                onPress={() => generateReceipt(candidate, docId)}
              >
                <Text style={[styles.buttonText, styles.generateButtonText]}>
                  Generate Receipt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => rejectCandidate(docId)}
              >
                <Text style={[styles.buttonText, styles.rejectButtonText]}>
                  Dismiss
                </Text>
              </TouchableOpacity>
            </>
          )}

          {isGenerating && (
            <View style={[styles.actionButton, { flexDirection: 'row' }]}>
              <ActivityIndicator size="small" color={theme.gold.primary} />
              <Text style={[styles.loadingText, { marginLeft: 8 }]}>
                Generating receipt...
              </Text>
            </View>
          )}

          {generatedReceipt && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.approveButton]}
                onPress={() => approveReceipt(candidate, docId, generatedReceipt)}
              >
                <Text style={[styles.buttonText, styles.approveButtonText]}>
                  Save Receipt
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => rejectCandidate(docId)}
              >
                <Text style={[styles.buttonText, styles.rejectButtonText]}>
                  Discard
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    scrollContainer: {
      flex: 1,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: theme.text.primary,
      marginBottom: 8,
    },
    titleRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    serviceIndicator: {
      backgroundColor: theme.background.secondary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    serviceText: {
      fontSize: 12,
      color: theme.text.secondary,
      fontWeight: '600',
    },
    subtitle: {
      fontSize: 16,
      color: theme.text.secondary,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text.primary,
      marginTop: 16,
      textAlign: 'center',
    },
    emptySubtitle: {
      fontSize: 16,
      color: theme.text.secondary,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 22,
    },
    connectButton: {
      backgroundColor: theme.gold.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
    },
    connectButtonText: {
      color: theme.background.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    candidateCard: {
      backgroundColor: theme.background.secondary,
      marginHorizontal: 20,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    candidateHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    merchantInfo: {
      flex: 1,
    },
    merchantName: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    transactionDate: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    amountContainer: {
      alignItems: 'flex-end',
    },
    amount: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.gold.primary,
    },
    category: {
      fontSize: 12,
      color: theme.text.secondary,
      backgroundColor: theme.background.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 4,
    },
    transactionDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border.primary,
    },
    detailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    detailValue: {
      fontSize: 14,
      color: theme.text.primary,
    },
    buttonContainer: {
      flexDirection: 'row',
      marginTop: 16,
      gap: 12,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    generateButton: {
      backgroundColor: theme.gold.primary,
    },
    approveButton: {
      backgroundColor: theme.status.success,
    },
    rejectButton: {
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.status.error,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    generateButtonText: {
      color: theme.background.primary,
    },
    approveButtonText: {
      color: theme.background.primary,
    },
    rejectButtonText: {
      color: theme.status.error,
    },
    generatedReceiptContainer: {
      marginTop: 16,
      padding: 12,
      backgroundColor: theme.background.primary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.gold.primary,
    },
    receiptTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 8,
    },
    receiptImage: {
      width: '100%',
      height: 200,
      borderRadius: 8,
      marginBottom: 8,
    },
    receiptDetails: {
      fontSize: 12,
      color: theme.text.secondary,
    },
    // Text-based receipt styles
    textReceiptContainer: {
      backgroundColor: theme.background.secondary,
      padding: 16,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    textReceiptTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: theme.text.primary,
      textAlign: 'center',
      marginBottom: 4,
    },
    textReceiptAddress: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    textReceiptDate: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: 'monospace',
      marginBottom: 2,
    },
    textReceiptLine: {
      height: 1,
      backgroundColor: theme.border.primary,
      marginVertical: 8,
    },
    textReceiptItemRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    textReceiptItemName: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: 'monospace',
      flex: 1,
    },
    textReceiptItemPrice: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: 'monospace',
    },
    textReceiptTotalLabel: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text.primary,
      fontFamily: 'monospace',
    },
    textReceiptTotalAmount: {
      fontSize: 14,
      fontWeight: 'bold',
      color: theme.text.primary,
      fontFamily: 'monospace',
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    },
    loadingText: {
      marginLeft: 8,
      color: theme.text.secondary,
    },
    listContainer: {
      paddingBottom: 20,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    searchInputContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginRight: 12,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: theme.text.primary,
      paddingVertical: 4,
    },
    filterButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background.secondary,
      borderWidth: 1,
      borderColor: theme.gold.primary,
    },
    filtersContainer: {
      backgroundColor: theme.background.secondary,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    filterRow: {
      marginBottom: 12,
    },
    filterLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 8,
    },
    filterOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    filterOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    filterOptionActive: {
      backgroundColor: theme.gold.primary,
      borderColor: theme.gold.primary,
    },
    filterOptionText: {
      fontSize: 14,
      color: theme.text.primary,
      marginRight: 4,
    },
    filterOptionTextActive: {
      color: theme.background.primary,
    },
    categoryFilters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    categoryFilter: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    categoryFilterActive: {
      backgroundColor: theme.gold.primary,
      borderColor: theme.gold.primary,
    },
    categoryFilterText: {
      fontSize: 12,
      color: theme.text.primary,
    },
    categoryFilterTextActive: {
      color: theme.background.primary,
    },
  });

  // Check if user has Professional subscription
  if (subscription.currentTier !== 'professional') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bank Transactions</Text>
          <Text style={styles.subtitle}>Professional Feature</Text>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={64} color={theme.text.secondary} />
          <Text style={styles.emptyTitle}>Professional Feature</Text>
          <Text style={styles.emptySubtitle}>
            Bank transaction monitoring and automatic receipt generation is available for Professional subscribers only.
          </Text>
          <TouchableOpacity style={styles.connectButton}>
            <Text style={styles.connectButtonText}>Upgrade to Professional</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && candidates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Bank Transactions</Text>
          <Text style={styles.subtitle}>Loading recent purchases...</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Bank Transactions</Text>
          <View style={styles.serviceIndicator}>
            <Text style={styles.serviceText}>
              {serviceInfo.currentService === 'ai' ? '🤖 AI' : '📄 HTML'}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          {filteredAndSortedCandidates.length === 0 && searchQuery.trim() 
            ? `No matches for "${searchQuery}"` 
            : filteredAndSortedCandidates.length === 0
            ? 'No recent purchases found'
            : `${filteredAndSortedCandidates.length} of ${candidates.length} transactions`
          }
        </Text>
      </View>

      {candidates.length > 0 && (
        <>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={20} color={theme.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search transactions..."
                placeholderTextColor={theme.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={theme.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity 
              style={styles.filterButton}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Ionicons name="options-outline" size={20} color={theme.gold.primary} />
            </TouchableOpacity>
          </View>

          {/* Filters */}
          {showFilters && (
            <View style={styles.filtersContainer}>
              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Sort by:</Text>
                <View style={styles.filterOptions}>
                  {[
                    { key: 'date', label: 'Date' },
                    { key: 'amount', label: 'Amount' },
                    { key: 'merchant', label: 'Merchant' }
                  ].map(option => (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.filterOption,
                        sortBy === option.key && styles.filterOptionActive
                      ]}
                      onPress={() => {
                        if (sortBy === option.key) {
                          setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                        } else {
                          setSortBy(option.key as any);
                          setSortDirection('desc');
                        }
                      }}
                    >
                      <Text style={[
                        styles.filterOptionText,
                        sortBy === option.key && styles.filterOptionTextActive
                      ]}>
                        {option.label}
                      </Text>
                      {sortBy === option.key && (
                        <Ionicons 
                          name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                          size={16} 
                          color={theme.gold.primary} 
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.filterRow}>
                <Text style={styles.filterLabel}>Category:</Text>
                <View style={styles.categoryFilters}>
                  <TouchableOpacity
                    style={[
                      styles.categoryFilter,
                      (filterByCategory === '' || filterByCategory === 'all') && styles.categoryFilterActive
                    ]}
                    onPress={() => setFilterByCategory('')}
                  >
                    <Text style={[
                      styles.categoryFilterText,
                      (filterByCategory === '' || filterByCategory === 'all') && styles.categoryFilterTextActive
                    ]}>
                      All
                    </Text>
                  </TouchableOpacity>
                  {availableCategories.slice(0, 3).map(category => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryFilter,
                        filterByCategory === category && styles.categoryFilterActive
                      ]}
                      onPress={() => setFilterByCategory(category)}
                    >
                      <Text style={[
                        styles.categoryFilterText,
                        filterByCategory === category && styles.categoryFilterTextActive
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          )}
        </>
      )}

      {candidates.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={64} color={theme.text.secondary} />
          <Text style={styles.emptyTitle}>No Recent Purchases</Text>
          <Text style={styles.emptySubtitle}>
            We'll monitor your connected accounts for new purchases and notify you when we find potential receipts.
          </Text>
          {linkToken ? (
            <PlaidLinkButton
              linkToken={linkToken}
              onSuccess={handlePlaidSuccess}
              onExit={handlePlaidExit}
              style={styles.connectButton}
            >
              <Text style={styles.connectButtonText}>Connect Bank Account</Text>
            </PlaidLinkButton>
          ) : (
            <TouchableOpacity style={styles.connectButton} onPress={createLinkToken}>
              <Text style={styles.connectButtonText}>Connect Bank Account</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : filteredAndSortedCandidates.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color={theme.text.secondary} />
          <Text style={styles.emptyTitle}>No Matching Transactions</Text>
          <Text style={styles.emptySubtitle}>
            Try adjusting your search terms or filters to find what you're looking for.
          </Text>
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => {
              setSearchQuery('');
              setFilterByCategory('');
            }}
          >
            <Text style={styles.connectButtonText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedCandidates}
          renderItem={renderTransactionItem}
          keyExtractor={(item) => (item as any)._id ?? `${item.transaction.transaction_id}_fallback`}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.gold.primary]}
              tintColor={theme.gold.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={(data, index) => (
            {length: 200, offset: 200 * index, index}
          )}
        />
      )}
    </SafeAreaView>
  );
};

export default BankTransactionsScreen;
