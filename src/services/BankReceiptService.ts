import { PlaidService, PlaidTransaction } from './PlaidService';
import ReceiptServiceFactory, { ReceiptService } from './ReceiptServiceFactory';
import { GeneratedReceipt } from './HTMLReceiptService'; // Using HTMLReceiptService as the common interface
import { NotificationService } from './ExpoNotificationService';
import { doc, collection, addDoc, updateDoc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BankConnection {
  id: string;
  userId: string;
  accessToken: string;
  institutionName: string;
  accounts: Array<{
    accountId: string;
    name: string;
    type: string;
    subtype: string;
    mask: string;
  }>;
  connectedAt: Date;
  lastSyncAt: Date;
  isActive: boolean;
}

export interface TransactionCandidate {
  transaction: PlaidTransaction;
  generatedReceipt?: GeneratedReceipt;
  status: 'pending' | 'approved' | 'rejected' | 'generated';
  createdAt: Date;
  userId: string;
}

export class BankReceiptService {
  private static instance: BankReceiptService;
  private plaidService: PlaidService;
  private receiptService: ReceiptService;
  private notificationService: NotificationService;
  
  // Storage keys
  private static BANK_CONNECTIONS_KEY = 'bank_connections';
  private static LAST_SYNC_KEY = 'last_transaction_sync';

  private constructor() {
    this.plaidService = PlaidService.getInstance();
    this.receiptService = ReceiptServiceFactory.getReceiptService();
    this.notificationService = NotificationService.getInstance();
  }

  public static getInstance(): BankReceiptService {
    if (!BankReceiptService.instance) {
      BankReceiptService.instance = new BankReceiptService();
    }
    return BankReceiptService.instance;
  }

  /**
   * Connect a new bank account for a professional user
   */
  public async connectBankAccount(userId: string): Promise<BankConnection> {
    try {
      // Create link token
      const linkToken = await this.plaidService.createLinkToken(userId);
      
      // Open Plaid Link
      const accessToken = await this.plaidService.openPlaidLink(linkToken);
      
      // Get account information
      const accounts = await this.plaidService.getAccounts(accessToken);
      
      // Create bank connection record
      const bankConnection: BankConnection = {
        id: `bank_${userId}_${Date.now()}`,
        userId,
        accessToken,
        institutionName: 'Connected Bank', // This would come from Plaid institution info
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

      // Save to Firebase
      await addDoc(collection(db, 'bankConnections'), bankConnection);
      
      // Save to local storage for quick access
      await this.saveBankConnectionLocally(bankConnection);
      
      console.log('✅ Bank account connected successfully');
      return bankConnection;
    } catch (error) {
      console.error('❌ Error connecting bank account:', error);
      throw error;
    }
  }

  /**
   * Monitor for new transactions and create receipt candidates
   */
  public async monitorTransactions(userId: string): Promise<TransactionCandidate[]> {
    try {
      const bankConnections = await this.getBankConnections(userId);
      
      // If no bank connections exist, return empty array
      if (bankConnections.length === 0) {
        console.log('ℹ️ No bank connections found for user:', userId);
        return [];
      }
      
      // Check if we should fetch new data or use cached data
      const cachedCandidates = await this.getCachedTransactionCandidates(userId);
      if (cachedCandidates.length > 0) {
        console.log('📱 Using cached transaction data:', cachedCandidates.length, 'candidates found');
        return cachedCandidates;
      }
      
      console.log('🔄 Fetching fresh transaction data from Plaid...');
      const candidates: TransactionCandidate[] = [];
      
      for (const connection of bankConnections) {
        if (!connection.isActive) continue;
        
  // Get transactions from the last 30 days
  const endDate = new Date().toISOString().split('T')[0];
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const transactions = await this.plaidService.fetchRecentTransactions(
          connection.accessToken,
          startDate,
          endDate
        );
        
        // Filter for receipt candidates
        const receiptCandidates = transactions
        // const receiptCandidates = this.plaidService.filterReceiptCandidates(transactions);
        
        // Create transaction candidates for all transactions in the last 30 days
        for (const transaction of transactions) {
          // Avoid creating duplicates: check if a candidate already exists for this transaction and user
          try {
            const q = query(
              collection(db, 'transactionCandidates'),
              where('transaction.transaction_id', '==', transaction.transaction_id),
              where('userId', '==', userId)
            );
            const existingSnap = await getDocs(q);
            if (!existingSnap.empty) {
              // already have this transaction as a candidate
              continue;
            }
          } catch (err) {
            console.warn('Warning: failed to query existing candidates, will attempt to create candidate anyway', err);
          }

          const candidate: TransactionCandidate = {
            transaction,
            status: 'pending',
            createdAt: new Date(),
            userId,
          };

          candidates.push(candidate);

          // Save candidate to Firebase
          await addDoc(collection(db, 'transactionCandidates'), candidate);
        }
      }
      
      // Update last sync time
      await this.updateLastSyncTime(userId);
      
      // Cache the candidates locally for faster access
      await this.cacheTransactionCandidates(userId, candidates);
      
      // Send notification if there are new candidates
      if (candidates.length > 0) {
        await this.sendTransactionNotification(candidates.length);
      }
      
      return candidates;
    } catch (error) {
      console.error('❌ Error monitoring transactions:', error);
      throw error;
    }
  }

  /**
   * Generate receipt for a transaction candidate
   */
  public async generateReceiptForTransaction(
    candidateId: string,
    transaction: PlaidTransaction
  ): Promise<GeneratedReceipt> {
    try {
      // Generate receipt using selected service (AI or HTML)
      const generatedReceipt = await this.receiptService.generateReceiptFromTransaction(transaction);
      console.log('🔍 Generated receipt structure:', JSON.stringify(generatedReceipt, null, 2));
      
      // The receipt service already provides the image URL (base64 for HTML, URL for AI)
      const finalReceipt = generatedReceipt;
      console.log('🔍 Final receipt structure:', JSON.stringify(finalReceipt.receiptData, null, 2));
      
      // Update candidate status in Firebase
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      const candidateSnap = await getDoc(candidateRef);
      
      // Flatten the receipt data for Firestore storage
      const firestoreReceiptData = {
        receiptImageUrl: finalReceipt.receiptImageUrl,
        receiptData: {
          businessName: finalReceipt.receiptData?.businessName || 'Unknown Business',
          address: finalReceipt.receiptData?.address || '',
          date: finalReceipt.receiptData?.date || new Date().toISOString(),
          time: finalReceipt.receiptData?.time || '',
          subtotal: finalReceipt.receiptData?.subtotal || 0,
          tax: finalReceipt.receiptData?.tax || 0,
          total: finalReceipt.receiptData?.total || 0,
          paymentMethod: finalReceipt.receiptData?.paymentMethod || 'Card',
          transactionId: finalReceipt.receiptData?.transactionId || '',
          items: (finalReceipt.receiptData?.items || []).map((item: any) => ({
            description: item.description || 'Unknown Item',
            amount: item.amount || 0,
          })),
        },
        status: 'generated',
      };
      
      // Instead of updating the existing candidate document which might have complex nested objects,
      // let's create a simple status update and store the receipt data separately
      try {
        // First, try to just update the status
        await updateDoc(candidateRef, {
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
        
        // Store the receipt data in a separate collection to avoid nested entity issues
        const receiptDoc = {
          candidateId: candidateId,
          receiptImageUrl: finalReceipt.receiptImageUrl,
          businessName: finalReceipt.receiptData?.businessName || 'Unknown Business',
          address: finalReceipt.receiptData?.address || '',
          date: finalReceipt.receiptData?.date || new Date().toISOString().split('T')[0],
          time: finalReceipt.receiptData?.time || '',
          subtotal: Number(finalReceipt.receiptData?.subtotal) || 0,
          tax: Number(finalReceipt.receiptData?.tax) || 0,
          total: Number(finalReceipt.receiptData?.total) || 0,
          paymentMethod: finalReceipt.receiptData?.paymentMethod || 'Card',
          transactionId: finalReceipt.receiptData?.transactionId || '',
          items: (finalReceipt.receiptData?.items || []).map((item: any) => ({
            description: String(item.description || 'Unknown Item'),
            amount: Number(item.amount || 0),
          })),
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'generatedReceipts'), receiptDoc);
        console.log('✅ Receipt data stored separately');
        
      } catch (updateError) {
        console.error('Failed to update candidate document:', updateError);
        // If we can't update the existing document, create a new status document
        await addDoc(collection(db, 'candidateStatus'), {
          candidateId: candidateId,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
      }
      
      console.log('✅ Receipt generated successfully');
      return finalReceipt;
    } catch (error) {
      console.error('❌ Error generating receipt:', error);
      throw error;
    }
  }

  /**
   * Save generated receipt as a regular receipt in the system
   */
  public async saveGeneratedReceiptAsReceipt(
    userId: string,
    generatedReceipt: GeneratedReceipt,
    candidateId: string
  ): Promise<string> {
    try {
      // Create receipt document for Firebase
      const receiptDoc = {
        userId,
        imageUrl: generatedReceipt.receiptImageUrl,
        businessName: generatedReceipt.receiptData.businessName,
        totalAmount: generatedReceipt.receiptData.total,
        date: generatedReceipt.receiptData.date,
        category: 'Generated from Bank Transaction',
        items: generatedReceipt.receiptData.items,
        metadata: {
          source: 'bank_transaction',
          originalTransactionId: generatedReceipt.receiptData.transactionId,
          generatedAt: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add to receipts collection
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptDoc);
      
      // Update candidate status
      await updateDoc(doc(db, 'transactionCandidates', candidateId), {
        status: 'approved',
        receiptId: receiptRef.id,
      });
      
      console.log('✅ Generated receipt saved as regular receipt');
      return receiptRef.id;
    } catch (error) {
      console.error('❌ Error saving generated receipt:', error);
      throw error;
    }
  }

  /**
   * Get bank connections for a user
   */
  private async getBankConnections(userId: string): Promise<BankConnection[]> {
    try {
      // Try to get from local storage first for quick access
      const localConnections = await AsyncStorage.getItem(`${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`);
      if (localConnections) {
        const connections = JSON.parse(localConnections);
        console.log(`📱 Found ${connections.length} local bank connections for user:`, userId);
        // Log access tokens for debugging (first 10 chars only)
        connections.forEach((conn: BankConnection, index: number) => {
          console.log(`  Connection ${index + 1}: ${conn.accessToken?.substring(0, 10)}...`);
        });
        return connections;
      }
      
      // In production, query Firebase for user's bank connections
      // For now, return empty array if no local connections exist
      console.log('📱 No local bank connections found for user:', userId);
      return [];
    } catch (error) {
      console.error('Error getting bank connections:', error);
      return [];
    }
  }

  /**
   * Save bank connection locally for quick access
   */
  public async saveBankConnectionLocally(connection: BankConnection): Promise<void> {
    try {
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${connection.userId}`;
      const existing = await AsyncStorage.getItem(key);
      const connections = existing ? JSON.parse(existing) : [];
      
      connections.push(connection);
      await AsyncStorage.setItem(key, JSON.stringify(connections));
    } catch (error) {
      console.error('Error saving bank connection locally:', error);
    }
  }

  /**
   * Get last sync time
   */
  private async getLastSyncTime(userId: string): Promise<Date> {
    try {
      const stored = await AsyncStorage.getItem(`${BankReceiptService.LAST_SYNC_KEY}_${userId}`);
      return stored ? new Date(stored) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago default
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Update last sync time
   */
  private async updateLastSyncTime(userId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(`${BankReceiptService.LAST_SYNC_KEY}_${userId}`, new Date().toISOString());
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  /**
   * Send notification about new transaction candidates
   */
  private async sendTransactionNotification(count: number): Promise<void> {
    try {
      await this.notificationService.scheduleProductionNotification(
        'receiptProcessing',
        '💳 New Purchases Found!',
        `We found ${count} recent ${count === 1 ? 'purchase' : 'purchases'} that could become receipts. Tap to review.`,
        {
          type: 'bank_transactions',
          count,
          action: 'review_transactions',
        }
      );
    } catch (error) {
      console.error('Error sending transaction notification:', error);
    }
  }

  /**
   * Clear all stored bank connections for a user (useful for testing)
   */
  public async clearBankConnections(userId: string): Promise<void> {
    try {
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`;
      await AsyncStorage.removeItem(key);
      console.log('🗑️ Cleared all bank connections for user:', userId);
    } catch (error) {
      console.error('Error clearing bank connections:', error);
    }
  }

  /**
   * Cache transaction candidates locally
   */
  private async cacheTransactionCandidates(userId: string, candidates: TransactionCandidate[]): Promise<void> {
    try {
      const key = `transaction_candidates_${userId}`;
      const cacheData = {
        timestamp: Date.now(),
        candidates: candidates,
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`📱 Cached ${candidates.length} transaction candidates locally`);
    } catch (error) {
      console.error('Error caching transaction candidates:', error);
    }
  }

  /**
   * Cache candidates from Firestore (includes document IDs)
   */
  public async cacheFirestoreCandidates(userId: string, candidates: (TransactionCandidate & { _id?: string })[]): Promise<void> {
    try {
      const key = `transaction_candidates_${userId}`;
      const cacheData = {
        timestamp: Date.now(),
        candidates: candidates,
        source: 'firestore'
      };
      await AsyncStorage.setItem(key, JSON.stringify(cacheData));
      console.log(`📱 Cached ${candidates.length} Firestore candidates locally`);
    } catch (error) {
      console.error('Error caching Firestore candidates:', error);
    }
  }

  /**
   * Get cached transaction candidates
   */
  public async getCachedTransactionCandidates(userId: string): Promise<TransactionCandidate[]> {
    try {
      const key = `transaction_candidates_${userId}`;
      const cached = await AsyncStorage.getItem(key);
      
      if (!cached) {
        console.log('📱 No cached data found');
        return [];
      }
      
      const cacheData = JSON.parse(cached);
      const ageInMinutes = (Date.now() - cacheData.timestamp) / 1000 / 60;
      const candidatesCount = cacheData.candidates?.length || 0;
      
      console.log(`📱 Found cached data: ${candidatesCount} candidates, ${Math.round(ageInMinutes)} minutes old`);
      
      // Return cached data if it's less than 10 minutes old (reduced from 30 for testing)
      if (ageInMinutes < 10) {
        console.log('📱 Using cached data (fresh enough)');
        return cacheData.candidates || [];
      } else {
        console.log('📱 Cache expired, clearing and will fetch fresh data');
        // Clear expired cache
        await AsyncStorage.removeItem(key);
        return [];
      }
    } catch (error) {
      console.error('Error getting cached transaction candidates:', error);
      return [];
    }
  }

  /**
   * Clear cached transaction data for a user
   */
  public async clearTransactionCache(userId: string): Promise<void> {
    try {
      const key = `transaction_candidates_${userId}`;
      await AsyncStorage.removeItem(key);
      console.log('🗑️ Cleared transaction cache for user:', userId);
    } catch (error) {
      console.error('Error clearing transaction cache:', error);
    }
  }
}

export default BankReceiptService;
