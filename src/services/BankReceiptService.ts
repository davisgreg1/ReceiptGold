import { PlaidService, PlaidTransaction } from './PlaidService';
import ReceiptServiceFactory, { ReceiptService } from './ReceiptServiceFactory';
import { GeneratedReceipt } from './HTMLReceiptService'; // Using HTMLReceiptService as the common interface
import { PDFReceiptService, GeneratedReceiptPDF } from './PDFReceiptService';
import { NotificationService } from './ExpoNotificationService';
import { doc, collection, addDoc, updateDoc, getDoc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface BankConnection {
  id: string;
  userId: string;
  accessToken: string;
  institutionName: string;
  institutionId?: string;
  institutionLogo?: string | null;
  institutionColor?: string | null;
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
  generatedReceiptPDF?: GeneratedReceiptPDF;
  status: 'pending' | 'approved' | 'rejected' | 'generated';
  createdAt: Date;
  userId: string;
}

export class BankReceiptService {
  private static instance: BankReceiptService;
  private plaidService: PlaidService;
  private receiptService: ReceiptService;
  private pdfReceiptService: PDFReceiptService;
  private notificationService: NotificationService;

  // Storage keys
  private static BANK_CONNECTIONS_KEY = 'bank_connections';
  private static LAST_SYNC_KEY = 'last_transaction_sync';

  private constructor() {
    this.plaidService = PlaidService.getInstance();
    this.receiptService = ReceiptServiceFactory.getReceiptService();
    this.pdfReceiptService = PDFReceiptService.getInstance();
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
      console.log('🔍 Connecting new bank account for user:', userId);

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
      
      // Filter for only active connections
      const activeConnections = bankConnections.filter(conn => conn.isActive);

      // If no active bank connections exist, clear any cached data and return empty array
      if (activeConnections.length === 0) {
        console.log('ℹ️ No active bank connections found for user:', userId);
        console.log(`🔍 Found ${bankConnections.length} total connections, but 0 are active`);
        console.log('🗑️ Clearing any cached transaction data since no active connections exist');
        await this.clearTransactionCache(userId);
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

      for (const connection of activeConnections) {
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
   * Generate PDF receipt for a transaction candidate
   */
  public async generateReceiptForTransaction(
    candidateId: string,
    transaction: PlaidTransaction,
    userId: string
  ): Promise<GeneratedReceiptPDF> {
    try {
      console.log('📄 Generating PDF receipt for transaction...');
      
      // Generate PDF receipt using the new PDF service
      const generatedReceiptPDF = await this.pdfReceiptService.generatePDFReceiptFromTransaction(transaction);
      console.log('🔍 Generated PDF receipt structure:', {
        pdfPath: generatedReceiptPDF.receiptPdfPath,
        businessName: generatedReceiptPDF.receiptData.businessName,
        total: generatedReceiptPDF.receiptData.total
      });

      // Update candidate status in Firebase
      console.log('🔍 Updating candidate with userId:', userId);
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      const candidateSnap = await getDoc(candidateRef);

      if (!candidateSnap.exists()) {
        console.error('❌ Candidate document not found:', candidateId);
        throw new Error('Transaction candidate not found');
      }

      const candidateData = candidateSnap.data();
      console.log('🔍 Existing candidate data userId:', candidateData?.userId);
      console.log('🔍 Current user ID:', userId);

      if (candidateData?.userId !== userId) {
        console.error('❌ User ID mismatch - candidate belongs to different user');
        throw new Error('Permission denied: candidate belongs to different user');
      }

      // Store the PDF receipt data
      try {
        // Update candidate status
        console.log('🔍 Attempting to update candidate status for:', candidateId);
        await updateDoc(candidateRef, {
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
        console.log('✅ Successfully updated candidate status');

        // Store the PDF receipt data in Firestore
        console.log('🔍 Storing PDF receipt data for userId:', userId);
        const receiptDoc = {
          userId: userId,
          candidateId: candidateId,
          receiptPdfUrl: generatedReceiptPDF.receiptPdfUrl,
          receiptPdfPath: generatedReceiptPDF.receiptPdfPath,
          businessName: generatedReceiptPDF.receiptData.businessName,
          address: generatedReceiptPDF.receiptData.address,
          date: generatedReceiptPDF.receiptData.date,
          time: generatedReceiptPDF.receiptData.time,
          subtotal: generatedReceiptPDF.receiptData.subtotal,
          tax: generatedReceiptPDF.receiptData.tax,
          total: generatedReceiptPDF.receiptData.total,
          paymentMethod: generatedReceiptPDF.receiptData.paymentMethod,
          transactionId: generatedReceiptPDF.receiptData.transactionId,
          items: generatedReceiptPDF.receiptData.items.map((item: any) => ({
            description: item.description,
            amount: item.amount,
          })),
          type: 'pdf', // Mark this as a PDF receipt
          createdAt: new Date().toISOString(),
        };

        const receiptDocRef = await addDoc(collection(db, 'generatedReceipts'), receiptDoc);
        console.log('✅ PDF receipt data stored successfully with ID:', receiptDocRef.id);

      } catch (updateError) {
        console.error('❌ Failed to update candidate document:', updateError);
        console.log('🔍 Attempting fallback: creating status document for userId:', userId);
        // If we can't update the existing document, create a new status document
        await addDoc(collection(db, 'candidateStatus'), {
          userId: userId,
          candidateId: candidateId,
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
        console.log('✅ Fallback status document created successfully');
      }

      console.log('✅ PDF receipt generated successfully');
      return generatedReceiptPDF;
    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
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
        businessName: generatedReceipt.receiptData.businessName || 'Unknown Business', // Ensure we have a business name
        amount: Number(generatedReceipt.receiptData.total) || 0, // Ensure amount is a number
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
      console.log('🔍 Adding receipt to receipts collection for userId:', userId);
      console.log('🔍 Receipt document structure:', {
        userId: receiptDoc.userId,
        businessName: receiptDoc.businessName,
        amount: receiptDoc.amount,
        amountType: typeof receiptDoc.amount
      });
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptDoc);
      console.log('✅ Receipt added to receipts collection with ID:', receiptRef.id);

      // Update candidate status - need to verify ownership first
      console.log('🔍 Updating candidate status for candidateId:', candidateId);
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      const candidateSnap = await getDoc(candidateRef);

      if (!candidateSnap.exists()) {
        console.error('❌ Candidate document not found:', candidateId);
        throw new Error('Transaction candidate not found');
      }

      const candidateData = candidateSnap.data();
      if (candidateData?.userId !== userId) {
        console.error('❌ User ID mismatch - candidate belongs to different user');
        throw new Error('Permission denied: candidate belongs to different user');
      }

      await updateDoc(candidateRef, {
        status: 'approved',
        receiptId: receiptRef.id,
      });
      console.log('✅ Candidate status updated to approved');

      console.log('✅ Generated receipt saved as regular receipt');
      return receiptRef.id;
    } catch (error) {
      console.error('❌ Error saving generated receipt:', error);
      throw error;
    }
  }

  /**
   * Save generated PDF receipt as a regular receipt in the system
   */
  public async saveGeneratedPDFReceiptAsReceipt(
    userId: string,
    generatedReceiptPDF: GeneratedReceiptPDF,
    candidateId: string
  ): Promise<string> {
    try {
      // Create receipt document for Firebase with PDF data
      const receiptDoc = {
        userId,
        pdfUrl: generatedReceiptPDF.receiptPdfUrl,
        pdfPath: generatedReceiptPDF.receiptPdfPath,
        businessName: generatedReceiptPDF.receiptData.businessName || 'Unknown Business',
        amount: Number(generatedReceiptPDF.receiptData.total) || 0,
        date: generatedReceiptPDF.receiptData.date,
        category: 'Generated from Bank Transaction',
        items: generatedReceiptPDF.receiptData.items,
        receiptData: generatedReceiptPDF.receiptData, // Store complete receipt data for regeneration
        metadata: {
          source: 'bank_transaction',
          originalTransactionId: generatedReceiptPDF.receiptData.transactionId,
          generatedAt: new Date(),
          type: 'pdf',
        },
        type: 'pdf', // Mark as PDF receipt
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('🔍 Adding PDF receipt to receipts collection for userId:', userId);
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptDoc);
      console.log('✅ PDF receipt added to receipts collection with ID:', receiptRef.id);

      // Update candidate status
      console.log('🔍 Updating candidate status for candidateId:', candidateId);
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      const candidateSnap = await getDoc(candidateRef);

      if (!candidateSnap.exists()) {
        console.error('❌ Candidate document not found:', candidateId);
        throw new Error('Transaction candidate not found');
      }

      const candidateData = candidateSnap.data();
      if (candidateData?.userId !== userId) {
        console.error('❌ User ID mismatch - candidate belongs to different user');
        throw new Error('Permission denied: candidate belongs to different user');
      }

      await updateDoc(candidateRef, {
        status: 'approved',
        receiptId: receiptRef.id,
      });
      console.log('✅ Candidate status updated to approved');

      console.log('✅ Generated PDF receipt saved as regular receipt');
      return receiptRef.id;
    } catch (error) {
      console.error('❌ Error saving generated PDF receipt:', error);
      throw error;
    }
  }

  /**
   * Regenerate PDF when a receipt is edited
   */
  public async regeneratePDFForReceipt(receiptId: string, userId: string): Promise<void> {
    try {
      console.log('🔄 Regenerating PDF for receipt:', receiptId);
      
      // Get the receipt document
      const receiptRef = doc(db, 'receipts', receiptId);
      const receiptSnap = await getDoc(receiptRef);

      if (!receiptSnap.exists()) {
        throw new Error('Receipt not found');
      }

      const receiptData = receiptSnap.data();
      
      // Verify ownership
      if (receiptData?.userId !== userId) {
        throw new Error('Permission denied: receipt belongs to different user');
      }

      // Only regenerate if it's a PDF receipt
      if (receiptData?.type !== 'pdf' || !receiptData?.receiptData) {
        console.log('ℹ️ Receipt is not a PDF receipt, skipping regeneration');
        return;
      }

      // Delete old PDF file
      if (receiptData.pdfPath) {
        await this.pdfReceiptService.deletePDFReceipt(receiptData.pdfPath);
      }

      // Build fresh receipt data from current receipt fields
      const freshReceiptData = {
        businessName: receiptData.vendor || receiptData.businessName || 'Unknown Business',
        address: receiptData.receiptData?.address || '123 Business St, City, State 12345',
        date: receiptData.date ? new Date(receiptData.date.toDate ? receiptData.date.toDate() : receiptData.date).toLocaleDateString() : new Date().toLocaleDateString(),
        time: receiptData.date ? new Date(receiptData.date.toDate ? receiptData.date.toDate() : receiptData.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        description: receiptData.description || '', // Include the description field
        items: receiptData.extractedData?.items?.map((item: any) => ({
          description: item.description || 'Item',
          amount: Number(item.amount) || Number(item.price * item.quantity) || 0,
          quantity: item.quantity || 1
        })) || [{
          description: receiptData.description || 'Purchase',
          amount: Number(receiptData.amount) || 0,
          quantity: 1
        }],
        subtotal: Number(receiptData.amount) || 0,
        tax: 0, // Calculate tax if needed
        total: Number(receiptData.amount) || 0,
        paymentMethod: receiptData.receiptData?.paymentMethod || 'Card Payment',
        transactionId: receiptData.metadata?.originalTransactionId || receiptId,
        receiptId: receiptId,
      };

      // Regenerate PDF with fresh receipt data
      const regeneratedPDF = await this.pdfReceiptService.regeneratePDFReceipt(
        freshReceiptData,
        receiptData.metadata?.originalTransactionId || receiptId
      );

      // Update receipt document with new PDF path
      await updateDoc(receiptRef, {
        pdfUrl: regeneratedPDF.receiptPdfUrl,
        pdfPath: regeneratedPDF.receiptPdfPath,
        updatedAt: new Date(),
      });

      console.log('✅ PDF regenerated successfully for receipt:', receiptId);
    } catch (error) {
      console.error('❌ Error regenerating PDF for receipt:', error);
      throw error;
    }
  }

  /**
   * Get bank connections for a user
   */
  public async getBankConnections(userId: string): Promise<BankConnection[]> {
    try {
      // Try to get from local storage first for quick access
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`;
      console.log('🔍 Getting bank connections with key:', key);
      const localConnections = await AsyncStorage.getItem(key);
      if (localConnections) {
        const connections = JSON.parse(localConnections);
        console.log(`📱 Found ${connections.length} local bank connections for user:`, userId);
        // Log basic info for debugging
        connections.forEach((conn: BankConnection, index: number) => {
          console.log(`  Connection ${index + 1}: ${conn.institutionName} (${conn.accounts.length} accounts) - Active: ${conn.isActive}`);
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
   * Supports multiple bank connections for comprehensive transaction coverage
   */
  public async saveBankConnectionLocally(connection: BankConnection): Promise<void> {
    try {
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${connection.userId}`;

      // Get existing connections
      const existingConnectionsString = await AsyncStorage.getItem(key);
      let connections: BankConnection[] = [];
      
      if (existingConnectionsString) {
        connections = JSON.parse(existingConnectionsString);
      }

      // Check if this connection already exists (by access token or institution)
      const existingIndex = connections.findIndex(conn => 
        conn.accessToken === connection.accessToken || 
        (conn.institutionName === connection.institutionName && 
         conn.accounts.some(acc1 => connection.accounts.some(acc2 => acc1.accountId === acc2.accountId)))
      );

      if (existingIndex >= 0) {
        // Update existing connection
        connections[existingIndex] = connection;
        console.log('💾 Updated existing bank connection');
      } else {
        // Add new connection
        connections.push(connection);
        console.log('💾 Added new bank connection');
      }

      await AsyncStorage.setItem(key, JSON.stringify(connections));
      console.log(`💾 Total bank connections: ${connections.length}`);
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
   * Disconnect a bank account
   */
  public async disconnectBankAccount(userId: string, connectionId: string): Promise<void> {
    try {
      console.log('🔌 Disconnecting bank account...', connectionId);

      // Get the bank connection to get access token and account IDs
      const connection = await this.getBankConnection(userId, connectionId);
      if (!connection) {
        throw new Error('Bank connection not found');
      }

      // Extract account IDs from this connection
      const accountIds = connection.accounts.map(account => account.accountId);
      console.log('🔍 Account IDs to remove transactions for:', accountIds);

      // Disconnect from Plaid
      await this.plaidService.disconnectBankAccount(connection.accessToken);

      // Update connection status in Firestore
      const connectionQuery = query(
        collection(db, 'bankConnections'),
        where('id', '==', connectionId),
        where('userId', '==', userId)
      );
      const connectionDocs = await getDocs(connectionQuery);

      if (!connectionDocs.empty) {
        const connectionDoc = connectionDocs.docs[0];
        await updateDoc(connectionDoc.ref, {
          isActive: false,
          disconnectedAt: new Date(),
        });
      }

      // Clear from local storage
      await this.removeBankConnectionLocally(userId, connectionId);

      // Clear transaction data from the specific disconnected accounts
      await this.clearTransactionCacheForAccounts(userId, accountIds);

      console.log('✅ Bank account disconnected successfully');
    } catch (error) {
      console.error('❌ BankService Error disconnecting bank account:', error);
      throw error;
    }
  }

  /**
   * Get a specific bank connection
   */
  public async getBankConnection(userId: string, connectionId: string): Promise<BankConnection | null> {
    try {
      const connections = await this.getBankConnections(userId);
      return connections.find(conn => conn.id === connectionId) || null;
    } catch (error) {
      console.error('Error getting bank connection:', error);
      return null;
    }
  }

  /**
   * Remove bank connection from local storage
   */
  private async removeBankConnectionLocally(userId: string, connectionId: string): Promise<void> {
    try {
      const connections = await this.getBankConnections(userId);
      const updatedConnections = connections.filter(conn => conn.id !== connectionId);

      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedConnections));

      console.log('🗑️ Removed bank connection from local storage:', connectionId);
    } catch (error) {
      console.error('Error removing bank connection locally:', error);
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
        const candidates = cacheData.candidates || [];
        // Filter out rejected candidates
        const activeCandidates = candidates.filter((c: TransactionCandidate) => c.status !== 'rejected');
        console.log(`📱 Filtered out rejected candidates: ${candidates.length} -> ${activeCandidates.length}`);
        return activeCandidates;
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

  /**
   * Clear transaction data (cache and Firestore) for specific account IDs
   */
  public async clearTransactionCacheForAccounts(userId: string, accountIds: string[]): Promise<void> {
    try {
      console.log('🗑️ Clearing transactions for account IDs:', accountIds);

      // 1. Clean up Firestore transaction candidates for these accounts
      const candidatesQuery = query(
        collection(db, 'transactionCandidates'),
        where('userId', '==', userId)
      );
      const candidatesSnapshot = await getDocs(candidatesQuery);
      
      const deletePromises: Promise<void>[] = [];
      const candidateIds: string[] = [];
      
      let totalCandidates = candidatesSnapshot.docs.length;
      let matchedCandidates = 0;
      
      candidatesSnapshot.docs.forEach(doc => {
        const data = doc.data() as TransactionCandidate;
        const transactionAccountId = data.transaction?.account_id;
        
        if (transactionAccountId && accountIds.includes(transactionAccountId)) {
          console.log('🗑️ Deleting Firestore candidate for account:', transactionAccountId, 'transaction:', data.transaction?.name);
          candidateIds.push(doc.id);
          deletePromises.push(deleteDoc(doc.ref));
          matchedCandidates++;
        }
      });

      // Wait for all Firestore deletions to complete
      await Promise.all(deletePromises);
      console.log(`✅ Deleted ${deletePromises.length} of ${totalCandidates} transaction candidates from Firestore (matched ${matchedCandidates})`);

      // 2. Clean up associated generated receipts to avoid permission errors
      if (candidateIds.length > 0) {
        try {
          const generatedReceiptsQuery = query(
            collection(db, 'generatedReceipts'),
            where('userId', '==', userId)
          );
          const receiptsSnapshot = await getDocs(generatedReceiptsQuery);
          
          const receiptDeletePromises: Promise<void>[] = [];
          receiptsSnapshot.docs.forEach(doc => {
            const data = doc.data();
            if (data.candidateId && candidateIds.includes(data.candidateId)) {
              console.log('🗑️ Deleting generated receipt for candidate:', data.candidateId);
              receiptDeletePromises.push(deleteDoc(doc.ref));
            }
          });
          
          await Promise.all(receiptDeletePromises);
          console.log(`✅ Deleted ${receiptDeletePromises.length} generated receipts from Firestore`);
        } catch (receiptError) {
          console.warn('⚠️ Could not clean up generated receipts:', receiptError);
        }
      }

      // 3. Clear ALL AsyncStorage cache to ensure no orphaned data remains
      console.log('🗑️ Clearing ALL transaction cache to prevent orphaned data...');
      await this.clearTransactionCache(userId);

      console.log('✅ Successfully cleaned up transactions for disconnected accounts');
    } catch (error) {
      console.error('❌ Error clearing transaction cache for accounts:', error);
      throw error;
    }
  }

  /**
   * Dismiss/reject a transaction candidate
   */
  public async dismissCandidate(candidateId: string, userId: string): Promise<void> {
    try {
      console.log('🗑️ Dismissing candidate:', candidateId);
      
      // Update the candidate status in Firestore
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      await updateDoc(candidateRef, {
        status: 'rejected'
      });

      // Update cache to remove this candidate
      const cacheKey = `transaction_candidates_${userId}`;
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const cacheData = JSON.parse(cached);
        if (cacheData.candidates && Array.isArray(cacheData.candidates)) {
          const updatedCandidates = cacheData.candidates.filter((c: any) => c._id !== candidateId);
          const updatedCacheData = {
            ...cacheData,
            candidates: updatedCandidates
          };
          await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedCacheData));
        }
      }
      
      console.log('✅ Successfully dismissed candidate:', candidateId);
    } catch (error) {
      console.error('❌ Error dismissing candidate:', error);
      throw error;
    }
  }
}

export default BankReceiptService;
