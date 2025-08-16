import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { BankReceiptService, TransactionCandidate } from '../services/BankReceiptService';
import { PlaidService } from '../services/PlaidService';
import { GeneratedReceipt } from '../services/OpenAIReceiptService';
import { useInAppNotifications } from '../components/InAppNotificationProvider';
import { PlaidLinkButton } from '../components/PlaidLinkButton';

export const BankTransactionsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { showNotification } = useInAppNotifications();
  
  const [candidates, setCandidates] = useState<TransactionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);
  const [generatedReceipts, setGeneratedReceipts] = useState<Map<string, GeneratedReceipt>>(new Map());
  const [linkToken, setLinkToken] = useState<string | null>(null);

  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();

  useEffect(() => {
    if (user && subscription.currentTier === 'professional') {
      // Clear any potentially corrupted stored connections for testing
      bankReceiptService.clearBankConnections(user.uid).then(() => {
        loadTransactionCandidates();
        createLinkToken(); // Prepare link token for bank connection
      });
    }
  }, [user, subscription.currentTier]);

  const loadTransactionCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const newCandidates = await bankReceiptService.monitorTransactions(user.uid);
      setCandidates(newCandidates);
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

  const handleRefresh = async () => {
    setRefreshing(true);
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
      setGeneratingReceipt(candidateId);
      
      const generatedReceipt = await bankReceiptService.generateReceiptForTransaction(
        candidateId,
        candidate.transaction
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
    candidate: TransactionCandidate,
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
      
      // Remove from candidates list
      setCandidates(prev => prev.filter(c => c.transaction.transaction_id !== candidate.transaction.transaction_id));
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

  const rejectCandidate = (candidateId: string) => {
    setCandidates(prev => prev.filter(c => c.transaction.transaction_id !== candidateId));
    setGeneratedReceipts(prev => {
      const newMap = new Map(prev);
      newMap.delete(candidateId);
      return newMap;
    });
    
    showNotification({
      type: 'info',
      title: 'Transaction Dismissed',
      message: 'This transaction has been removed from the list.',
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
        <Text style={styles.title}>Bank Transactions</Text>
        <Text style={styles.subtitle}>
          {candidates.length === 0 
            ? 'No recent purchases found' 
            : `${candidates.length} recent ${candidates.length === 1 ? 'purchase' : 'purchases'} found`
          }
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.gold.primary]}
            tintColor={theme.gold.primary}
          />
        }
      >
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
        ) : (
          candidates.map((candidate, index) => {
            const candidateId = candidate.transaction.transaction_id;
            const generatedReceipt = generatedReceipts.get(candidateId);
            const isGenerating = generatingReceipt === candidateId;

            return (
              <View key={candidateId} style={styles.candidateCard}>
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
                        onPress={() => generateReceipt(candidate, candidateId)}
                      >
                        <Text style={[styles.buttonText, styles.generateButtonText]}>
                          Generate Receipt
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => rejectCandidate(candidateId)}
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
                        onPress={() => approveReceipt(candidate, candidateId, generatedReceipt)}
                      >
                        <Text style={[styles.buttonText, styles.approveButtonText]}>
                          Save Receipt
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.rejectButton]}
                        onPress={() => rejectCandidate(candidateId)}
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
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default BankTransactionsScreen;
