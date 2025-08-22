import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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
import { GeneratedReceiptPDF } from '../services/PDFReceiptService';
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
  const [generatedReceipts, setGeneratedReceipts] = useState<Map<string, GeneratedReceiptPDF>>(new Map());
  const [linkToken, setLinkToken] = useState<string | null>(null);
  
  // Quick filter state
  const [currentFilter, setCurrentFilter] = useState<'all' | 'recent' | 'high' | 'dining' | 'shopping' | 'transport'>('all');
  const [showSearchSection, setShowSearchSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();
  
  // Filtered and sorted candidates
  const filteredAndSortedCandidates = useMemo(() => {
    let filtered = candidates;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(candidate => 
        candidate.transaction.merchant_name?.toLowerCase().includes(query) ||
        candidate.transaction.name?.toLowerCase().includes(query)
      );
    }

    // Apply quick filter
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    switch (currentFilter) {
      case 'recent':
        filtered = filtered.filter(candidate => 
          new Date(candidate.transaction.date) >= sevenDaysAgo
        );
        break;
      case 'high':
        filtered = filtered.filter(candidate => 
          Math.abs(candidate.transaction.amount) >= 100
        );
        break;
      case 'dining':
        filtered = filtered.filter(candidate => 
          candidate.transaction.category?.[0]?.toLowerCase().includes('food') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('dining') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('restaurant')
        );
        break;
      case 'shopping':
        filtered = filtered.filter(candidate => 
          candidate.transaction.category?.[0]?.toLowerCase().includes('shop') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('retail') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('store')
        );
        break;
      case 'transport':
        filtered = filtered.filter(candidate => 
          candidate.transaction.category?.[0]?.toLowerCase().includes('transport') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('travel') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('gas') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('uber') ||
          candidate.transaction.category?.[0]?.toLowerCase().includes('taxi')
        );
        break;
      case 'all':
      default:
        // No filtering
        break;
    }

    // Sort by date (most recent first) for all filters
    filtered.sort((a, b) => {
      const dateA = new Date(a.transaction.date).getTime();
      const dateB = new Date(b.transaction.date).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [candidates, currentFilter, searchQuery]);  // Get unique categories for filter
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
      
      const newGeneratedReceipts = new Map<string, GeneratedReceiptPDF>();
      
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
          
          // Convert to GeneratedReceiptPDF format if it's a PDF receipt
          if (receiptData.type === 'pdf' && receiptData.receiptPdfUrl) {
            const generatedReceiptPDF: GeneratedReceiptPDF = {
              receiptPdfUrl: receiptData.receiptPdfUrl,
              receiptPdfPath: receiptData.receiptPdfPath,
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
            newGeneratedReceipts.set(docId, generatedReceiptPDF);
          }
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
      
      // Automatically save the generated receipt
      await bankReceiptService.saveGeneratedPDFReceiptAsReceipt(
        user.uid,
        generatedReceipt,
        candidateId
      );
      
      // Remove from candidates list by Firestore doc id
      setCandidates(prev => prev.filter(c => (c as any)._id !== candidateId));
      
      showNotification({
        type: 'success',
        title: 'Receipt Saved!',
        message: 'We saved your receipt successfully.',
      });
    } catch (error) {
      console.error('Error generating and saving receipt:', error);
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
    generatedReceiptPDF: GeneratedReceiptPDF
  ) => {
    if (!user) return;

    try {
      await bankReceiptService.saveGeneratedPDFReceiptAsReceipt(
        user.uid,
        generatedReceiptPDF,
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

  const discardGeneratedReceipt = (candidateId: string) => {
    console.log('🗑️ Discarding generated receipt for:', candidateId);
    // Just remove the generated receipt from state, keep the candidate
    setGeneratedReceipts(prev => {
      const newMap = new Map(prev);
      newMap.delete(candidateId);
      return newMap;
    });
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

  const clearFilters = () => {
    setCurrentFilter('all');
    setSearchQuery('');
    setShowSearchSection(false);
  };

  const hasActiveFilters = currentFilter !== 'all' || searchQuery.trim() !== '';

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
            <Text style={styles.receiptTitle}>Generated PDF Receipt</Text>
            <View style={styles.pdfPreviewContainer}>
              <Ionicons 
                name="document-text" 
                size={80} 
                color={theme.text.accent} 
                style={styles.pdfIcon}
              />
              <Text style={styles.pdfText}>PDF Receipt Generated</Text>
              <Text style={styles.pdfPath}>
                Path: {generatedReceipt.receiptPdfPath.split('/').pop()}
              </Text>
            </View>
            
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
                  Don't Generate
                </Text>
              </TouchableOpacity>
            </>
          )}

          {isGenerating && (
            <View style={[styles.actionButton, { flexDirection: 'row' }]}>
              <ActivityIndicator size="small" color={theme.gold.primary} />
              <Text style={[styles.loadingText, { marginLeft: 8 }]}>
                Generating & saving receipt...
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
                onPress={() => discardGeneratedReceipt(docId)}
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
    countContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      marginTop: -30,
      alignItems: 'center',
      backgroundColor: theme.background.primary,
    },
    countText: {
      fontSize: 14,
      color: theme.text.secondary,
      textAlign: 'center',
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
      justifyContent: 'center',
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
      textAlign: 'center',
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
    pdfPreviewContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background.secondary,
      borderRadius: 8,
      padding: 20,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    pdfIcon: {
      marginBottom: 8,
    },
    pdfText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    pdfPath: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: 'center',
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
      paddingTop: 0, // Remove padding since search bar will be positioned naturally
      paddingBottom: 20,
    },
    searchAndFiltersContainer: {
      backgroundColor: theme.background.primary,
      zIndex: 1000,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    searchInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background.tertiary,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.border.secondary,
      shadowColor: theme.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      minWidth: 200,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: '#000000',
      backgroundColor: '#FFFFFF',
      paddingVertical: 8,
      paddingHorizontal: 8,
      minHeight: 36,
      minWidth: 150,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    clearButton: {
      padding: 8,
      marginLeft: 4,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background.secondary,
      borderWidth: 1,
      borderColor: theme.gold.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    
    // FAB styles
    fabContainer: {
      position: 'absolute',
      bottom: 30,
      right: 20,
      alignItems: 'center',
    },
    filterLabel: {
      backgroundColor: theme.gold.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 8,
    },
    filterLabelText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.gold.primary,
      justifyContent: 'center',
      alignItems: 'center',
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    fabActive: {
      backgroundColor: theme.gold.rich,
    },

    // Beautiful Search & Filters Section Styles
    searchSection: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
    },
    filtersSection: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    filtersSectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 16,
      letterSpacing: 0.5,
    },
    filtersContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.background.secondary,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border.secondary,
      shadowColor: theme.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    filterChipActive: {
      backgroundColor: theme.gold.primary,
      borderColor: theme.gold.primary,
      shadowColor: theme.gold.primary,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    filterChipIcon: {
      marginRight: 8,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.text.secondary,
    },
    filterChipTextActive: {
      color: 'white',
      fontWeight: '600',
    },
  });

  // Check if user has Professional subscription
  if (subscription.currentTier !== 'professional') {
    return (
      <SafeAreaView style={styles.container}>
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {candidates.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredAndSortedCandidates.length === 0 && hasActiveFilters
              ? `No transactions match the current filter`
              : filteredAndSortedCandidates.length === 0
              ? 'No recent purchases found'
              : `${filteredAndSortedCandidates.length} of ${candidates.length} transactions`
            }
          </Text>
        </View>
      )}

      {showSearchSection && (
        <View style={styles.searchAndFiltersContainer}>
          {/* Search Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchInputContainer}>
              <Ionicons name="search-outline" size={22} color={theme.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Type here..."
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
                multiline={false}
                numberOfLines={1}
                returnKeyType="done"
                onSubmitEditing={() => setShowSearchSection(false)}
                blurOnSubmit={true}
              />
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                style={[
                  styles.clearButton,
                  { opacity: searchQuery.length > 0 ? 1 : 0 }
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#999999" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filters Section */}
          <ScrollView 
            style={styles.filtersSection}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.filtersSectionTitle}>Quick Filters</Text>
            <View style={styles.filtersContainer}>
              {[
                { key: 'all', label: 'All', icon: 'list' },
                { key: 'recent', label: 'Recent', icon: 'time' },
                { key: 'high', label: 'High Amount', icon: 'trending-up' },
                { key: 'dining', label: 'Dining', icon: 'restaurant' },
                { key: 'shopping', label: 'Shopping', icon: 'bag' },
                { key: 'transport', label: 'Transport', icon: 'car' }
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={[
                    styles.filterChip,
                    currentFilter === option.key && styles.filterChipActive
                  ]}
                  onPress={() => {
                    setCurrentFilter(option.key as any);
                    setShowSearchSection(false);
                  }}
                >
                  <Ionicons 
                    name={option.icon as any} 
                    size={16} 
                    color={currentFilter === option.key ? 'white' : theme.text.secondary} 
                    style={styles.filterChipIcon}
                  />
                  <Text style={[
                    styles.filterChipText,
                    currentFilter === option.key && styles.filterChipTextActive
                  ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
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
          <Text style={styles.emptyTitle}>No Transactions Found</Text>
          <Text style={styles.emptySubtitle}>
            {currentFilter !== 'all' 
              ? `No transactions match the "${currentFilter}" filter.`
              : "Connect your bank account to see transactions here."
            }
          </Text>
          {currentFilter !== 'all' && (
            <TouchableOpacity 
              style={styles.connectButton}
              onPress={clearFilters}
            >
              <Text style={styles.connectButtonText}>Show All Transactions</Text>
            </TouchableOpacity>
          )}
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
          onScroll={undefined}
          scrollEventThrottle={16}
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

      {/* Smart Filter FAB */}
      {candidates.length > 0 && (
        <View style={styles.fabContainer}>
          {hasActiveFilters && !showSearchSection && (
            <View style={styles.filterLabel}>
              <Text style={styles.filterLabelText}>
                {searchQuery.trim() ? 'Search Active' : currentFilter.charAt(0).toUpperCase() + currentFilter.slice(1)}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.fab, (hasActiveFilters || showSearchSection) && styles.fabActive]}
            onPress={() => setShowSearchSection(!showSearchSection)}
          >
            <Ionicons 
              name={showSearchSection ? 'close' : 'search'}
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>
      )}

    </SafeAreaView>
  );
};

export default BankTransactionsScreen;
