import { PlaidService, PlaidTransaction } from './PlaidService';
import ReceiptServiceFactory, { ReceiptService } from './ReceiptServiceFactory';
import { GeneratedReceipt } from './HTMLReceiptService'; // Using HTMLReceiptService as the common interface
import { PDFReceiptService, GeneratedReceiptPDF } from './PDFReceiptService';
import { NotificationService } from './NotificationService';
import { TeamService } from './TeamService';
import { doc, collection, addDoc, updateDoc, getDoc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
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
  
  // Transaction lookback period (90 days in milliseconds)
  private static TRANSACTION_LOOKBACK_PERIOD = 90 * 24 * 60 * 60 * 1000;
  
  // Incremental sync settings
  private static INCREMENTAL_SYNC_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days for incremental
  private static FULL_SYNC_INTERVAL = 24 * 60 * 60 * 1000; // Force full sync after 24 hours
  private static QUICK_SYNC_INTERVAL = 10 * 60 * 1000; // 10 minutes for cache validity

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
   * Smart sync that determines the optimal sync strategy based on last sync time and data freshness
   */
  public async smartSync(
    userId: string, 
    statusCallback?: (status: string | null) => void,
    forceFullSync = false
  ): Promise<TransactionCandidate[]> {
    try {
      statusCallback?.('📊 Checking sync requirements...');

      // Check if we have cached data
      const cachedCandidates = await this.getCachedTransactionCandidates(userId);
      const lastSyncTime = await this.getLastSyncTime(userId);
      const now = Date.now();

      // If forced full sync is requested
      if (forceFullSync) {
        statusCallback?.('🔄 Performing requested full sync...');
        return await this.monitorTransactions(userId, statusCallback);
      }

      // If we have fresh cached data (within quick sync interval)
      if (cachedCandidates.length > 0 && lastSyncTime && (now - lastSyncTime < BankReceiptService.QUICK_SYNC_INTERVAL)) {
        statusCallback?.('⚡ Using cached data - recent sync detected');
        statusCallback?.(null); // Clear status after 2 seconds
        setTimeout(() => statusCallback?.(null), 2000);
        return cachedCandidates;
      }

      // If we have data but it's getting stale (within full sync interval but beyond quick sync)
      if (cachedCandidates.length > 0 && lastSyncTime && (now - lastSyncTime < BankReceiptService.FULL_SYNC_INTERVAL)) {
        statusCallback?.('⚡ Using cached data with background refresh...');
        
        // Return cached data immediately for fast UX
        const backgroundSync = async () => {
          try {
            await this.incrementalSync(userId, () => {}); // Background sync without UI updates
            console.log('🔄 Background incremental sync completed');
          } catch (error) {
            console.error('Background sync failed:', error);
          }
        };
        
        // Start background sync but don't wait for it
        backgroundSync();
        
        statusCallback?.(null);
        return cachedCandidates;
      }

      // If it's been too long or no cache exists, do incremental sync first
      if (lastSyncTime && (now - lastSyncTime < BankReceiptService.FULL_SYNC_INTERVAL)) {
        statusCallback?.('⚡ Performing incremental sync...');
        return await this.incrementalSync(userId, statusCallback);
      }

      // Otherwise, do a full sync
      statusCallback?.('🔄 Performing full sync...');
      return await this.monitorTransactions(userId, statusCallback);

    } catch (error) {
      console.error('Smart sync error:', error);
      // Fallback to cached data if available
      const cachedCandidates = await this.getCachedTransactionCandidates(userId);
      if (cachedCandidates.length > 0) {
        statusCallback?.('⚠️ Using cached data due to sync error');
        return cachedCandidates;
      }
      throw error;
    }
  }

  /**
   * Incremental sync - only fetch recent transactions (last 7 days)
   */
  private async incrementalSync(
    userId: string,
    statusCallback?: (status: string | null) => void
  ): Promise<TransactionCandidate[]> {
    try {
      const bankConnections = await this.getBankConnections(userId);
      const activeConnections = bankConnections.filter(conn => conn.isActive && conn.accessToken);

      if (activeConnections.length === 0) {
        console.log('ℹ️ No active connections for incremental sync');
        return [];
      }

      statusCallback?.('⚡ Fetching recent transactions...');

      const candidates: TransactionCandidate[] = [];
      const startDate = new Date(Date.now() - BankReceiptService.INCREMENTAL_SYNC_PERIOD);
      const endDate = new Date();

      for (let i = 0; i < activeConnections.length; i++) {
        const connection = activeConnections[i];
        statusCallback?.(`⚡ Syncing ${connection.institutionName} (${i + 1}/${activeConnections.length})`);

        try {
          const transactions = await this.plaidService.fetchRecentTransactions(
            connection.accessToken,
            startDate.toISOString().split('T')[0], // YYYY-MM-DD format
            endDate.toISOString().split('T')[0]
          );

          // Filter for potential receipt candidates (purchases, excluding transfers)
          const receiptCandidates = transactions.filter((transaction: any) => {
            return transaction.amount > 0 && // Purchases (positive amounts in Plaid)
                   transaction.amount >= 1 && // Minimum $1
                   transaction.amount <= 10000 && // Maximum $10,000
                   !transaction.category?.includes('Transfer') &&
                   !transaction.category?.includes('Deposit') &&
                   !transaction.category?.includes('Payroll') &&
                   !transaction.category?.includes('Interest');
          });

          // Convert to candidates
          receiptCandidates.forEach((transaction: any) => {
            candidates.push({
              transaction,
              status: 'pending' as const,
              createdAt: new Date(),
              userId,
            });
          });

        } catch (error) {
          console.error(`Error fetching incremental data for ${connection.institutionName}:`, error);
          // Continue with other connections
        }
      }

      // Update last sync time
      await this.updateLastSyncTime(userId);
      
      // Merge with existing cached data, removing duplicates
      const existingCandidates = await this.getCachedTransactionCandidates(userId);
      const mergedCandidates = this.mergeCandidates(existingCandidates, candidates);

      // Cache the merged result
      await this.cacheTransactionCandidates(userId, mergedCandidates);

      statusCallback?.(`✅ Found ${candidates.length} new transactions`);
      statusCallback?.(null);

      return mergedCandidates;

    } catch (error) {
      console.error('Incremental sync error:', error);
      throw error;
    }
  }

  /**
   * Merge candidates, removing duplicates based on transaction ID
   */
  private mergeCandidates(existing: TransactionCandidate[], newCandidates: TransactionCandidate[]): TransactionCandidate[] {
    const existingIds = new Set(existing.map(c => c.transaction.transaction_id));
    const uniqueNew = newCandidates.filter(c => !existingIds.has(c.transaction.transaction_id));
    
    // Combine and sort by date (newest first)
    const merged = [...existing, ...uniqueNew].sort((a, b) => 
      new Date(b.transaction.date).getTime() - new Date(a.transaction.date).getTime()
    );

    // Limit to reasonable number to prevent memory issues
    const MAX_CANDIDATES = 1000;
    return merged.slice(0, MAX_CANDIDATES);
  }

  /**
   * Get last sync time for a user
   */
  private async getLastSyncTime(userId: string): Promise<number | null> {
    try {
      const timestamp = await AsyncStorage.getItem(`${BankReceiptService.LAST_SYNC_KEY}_${userId}`);
      return timestamp ? new Date(timestamp).getTime() : null;
    } catch (error) {
      console.error('Error getting last sync time:', error);
      return null;
    }
  }

  /**
   * Monitor for new transactions and create receipt candidates
   */
  public async monitorTransactions(
    userId: string, 
    statusCallback?: (status: string | null) => void
  ): Promise<TransactionCandidate[]> {
    try {
      const bankConnections = await this.getBankConnections(userId);
      
      // Filter for only active connections with valid access tokens
      const activeConnections = bankConnections.filter(conn => conn.isActive && conn.accessToken);
      
      // Log invalid connections that need to be cleaned up
      const invalidConnections = bankConnections.filter(conn => conn.isActive && !conn.accessToken);
      if (invalidConnections.length > 0) {
        console.warn(`⚠️ Found ${invalidConnections.length} invalid connections without access tokens:`);
        invalidConnections.forEach(conn => {
          console.warn(`  - ${conn.institutionName} (${conn.id}) - needs to be re-linked`);
        });
      }

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
      console.log(`🔍 Processing ${activeConnections.length} active connections:`);
      
      statusCallback?.('🔍 Preparing to sync transactions...');
      
      activeConnections.forEach((conn, index) => {
        console.log(`  Connection ${index + 1}: ${conn.institutionName}`);
        console.log(`    - ID: ${conn.id}`);
        console.log(`    - Access Token: ${conn.accessToken ? 'present (' + conn.accessToken.substring(0, 20) + '...)' : 'MISSING'}`);
        console.log(`    - Active: ${conn.isActive}`);
      });

      const candidates: TransactionCandidate[] = [];

      for (const connection of activeConnections) {
        console.log(`📡 Fetching transactions for ${connection.institutionName}...`);
        statusCallback?.(`📱 Syncing with ${connection.institutionName}`);
        
        // Get transactions from the last 12 months
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - BankReceiptService.TRANSACTION_LOOKBACK_PERIOD).toISOString().split('T')[0];

        if (!connection.accessToken) {
          console.error(`❌ No access token for connection ${connection.institutionName} (${connection.id})`);
          console.log(`🗑️ This connection is invalid and should be removed`);
          continue; // Skip this connection
        }

        const transactions = await this.plaidService.fetchRecentTransactions(
          connection.accessToken,
          startDate,
          endDate
        );

        statusCallback?.(`Found ${transactions.length} transactions from ${connection.institutionName}`);

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
              // Check the status of existing candidate
              const existingCandidate = existingSnap.docs[0].data();
              if (existingCandidate.status === 'rejected') {
                // Skip rejected transactions - don't recreate them
                console.log(`⏭️ Skipping rejected transaction: ${transaction.transaction_id}`);
                continue;
              }
              // If it exists but not rejected, add it to candidates with the document ID
              const candidateWithId = {
                ...existingCandidate,
                _id: existingSnap.docs[0].id
              } as TransactionCandidate & { _id: string };
              candidates.push(candidateWithId);
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

          // Save candidate to Firebase and get the document ID
          const candidateDocRef = await addDoc(collection(db, 'transactionCandidates'), candidate);
          
          // Add document ID to candidate for local use
          const candidateWithId = {
            ...candidate,
            _id: candidateDocRef.id
          };
          
          candidates.push(candidateWithId);
        }
      }

      // Update last sync time
      await this.updateLastSyncTime(userId);
      
      statusCallback?.(`🔄 Organizing ${candidates.length} transactions...`);

      // Cache the candidates locally for faster access
      await this.cacheTransactionCandidates(userId, candidates);

      // Send notification if there are new candidates
      if (candidates.length > 0) {
        await this.sendTransactionNotification(candidates.length);
        statusCallback?.(`✨ Ready! Found ${candidates.length} transactions`);
      } else {
        statusCallback?.(`Sync complete - no new transactions`);
      }

      // Clear status after a brief delay to show completion
      setTimeout(() => {
        statusCallback?.(null);
      }, 2500);

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
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      console.log('🔍 Auth state check - currentUser exists:', !!currentUser);
      console.log('🔍 Auth state check - currentUser.uid:', currentUser?.uid);
      console.log('🔍 Auth state check - provided userId:', userId);
      console.log('🔍 Auth state check - user authenticated:', !!currentUser?.uid);
      
      if (!currentUser) {
        console.error('❌ User not authenticated - currentUser is null');
        throw new Error('User must be authenticated to generate receipts');
      }
      
      if (!currentUser.uid) {
        console.error('❌ User UID is missing');
        throw new Error('User UID is missing - authentication required');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      // Add a small delay to ensure auth state is properly synchronized
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Double-check auth state after delay
      const currentUserAfterDelay = auth.currentUser;
      console.log('🔍 Auth state after delay - currentUser exists:', !!currentUserAfterDelay);
      console.log('🔍 Auth state after delay - currentUser.uid:', currentUserAfterDelay?.uid);
      
      if (!currentUserAfterDelay || currentUserAfterDelay.uid !== userId) {
        console.error('❌ Auth state changed after delay');
        throw new Error('Authentication state is unstable');
      }
      
      // Verify the user has a valid ID token
      try {
        const idToken = await currentUserAfterDelay.getIdToken();
        console.log('🔍 Auth token verification - token exists:', !!idToken);
        console.log('🔍 Auth token verification - token length:', idToken?.length);
      } catch (tokenError) {
        console.error('❌ Failed to get auth token:', tokenError);
        throw new Error('Failed to get authentication token');
      }
      
      console.log('✅ User authentication and token verified for:', currentUser.uid);
      
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
      
      // Try to update directly first (works if document has correct userId)
      console.log('🔍 Attempting direct update of candidate status...');
      try {
        await updateDoc(candidateRef, {
          status: 'generated',
          generatedAt: new Date().toISOString(),
        });
        console.log('✅ Successfully updated candidate status directly');
      } catch (updateError: any) {
        console.log('⚠️ Direct update failed, trying fallback approach:', updateError?.message);
        
        // Fallback: Try to read the document to understand the issue
        try {
          console.log('🔍 Attempting to read candidate document for debugging...');
          const candidateSnap = await getDoc(candidateRef);
          
          if (!candidateSnap.exists()) {
            console.error('❌ Candidate document not found:', candidateId);
            throw new Error('Transaction candidate not found');
          }

          const candidateData = candidateSnap.data();
          console.log('🔍 Candidate document data:', {
            hasUserId: !!candidateData?.userId,
            candidateUserId: candidateData?.userId,
            currentUserId: currentUser.uid,
            match: candidateData?.userId === currentUser.uid
          });

          if (candidateData?.userId !== currentUser.uid) {
            console.error('❌ User ID mismatch - candidate belongs to different user');
            throw new Error('Permission denied: candidate belongs to different user');
          }
          
          // If we got here, there's some other issue
          throw new Error(`Failed to update candidate: ${updateError?.message}`);
          
        } catch (readError: any) {
          console.error('❌ Both update and read failed - likely permission issue');
          console.error('❌ Candidate document not found:', candidateId);
          console.error('❌ Will attempt fallback status creation');
          
          // Create a fallback status document immediately
          try {
            await addDoc(collection(db, 'candidateStatus'), {
              userId: currentUser.uid,
              candidateId: candidateId,
              status: 'generated',
              generatedAt: new Date().toISOString(),
              error: 'Original candidate document not found or inaccessible',
            });
            console.log('✅ Created fallback status document for missing candidate');
          } catch (fallbackError: any) {
            console.error('❌ Even fallback status creation failed:', fallbackError);
            // Continue anyway - the main PDF generation should still work
          }
        }
      }

      // Store the PDF receipt data
      try {
        // Store the PDF receipt data in Firestore
        console.log('🔍 Storing PDF receipt data for userId:', currentUser.uid);
        console.log('🔍 Auth state before receipt storage - user:', currentUser.uid);
        console.log('🔍 Auth state before receipt storage - authenticated:', !!currentUser);
        const receiptDoc = {
          userId: currentUser.uid,
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

        console.log('🔍 About to store receipt document with data:', {
          userId: receiptDoc.userId,
          candidateId: receiptDoc.candidateId,
          businessName: receiptDoc.businessName,
          total: receiptDoc.total,
          itemCount: receiptDoc.items.length
        });
        
        let receiptDocRef;
        try {
          receiptDocRef = await addDoc(collection(db, 'generatedReceipts'), receiptDoc);
          console.log('✅ PDF receipt data stored successfully with ID:', receiptDocRef.id);
        } catch (receiptStorageError: any) {
          console.error('❌ Failed to store receipt document:', receiptStorageError);
          console.error('❌ Receipt storage error details:', {
            code: receiptStorageError?.code,
            message: receiptStorageError?.message,
            userId: currentUser.uid,
            candidateId: candidateId
          });
          throw new Error(`Failed to store receipt: ${receiptStorageError?.message || 'Unknown error'}`);
        }
        
        // Verify the document was actually created by reading it back
        try {
          const verificationDoc = await getDoc(receiptDocRef);
          if (verificationDoc.exists()) {
            console.log('✅ Receipt document verification successful');
            console.log('🔍 Stored document data preview:', {
              userId: verificationDoc.data()?.userId,
              businessName: verificationDoc.data()?.businessName,
              total: verificationDoc.data()?.total
            });
          } else {
            console.error('❌ Receipt document not found after creation');
          }
        } catch (verificationError: any) {
          console.error('❌ Failed to verify receipt document:', verificationError);
          console.error('❌ Verification error details:', {
            code: verificationError?.code,
            message: verificationError?.message
          });
        }

      } catch (updateError) {
        console.error('❌ Failed to update candidate document:', updateError);
        console.log('🔍 Attempting fallback: creating status document for userId:', currentUser.uid);
        // If we can't update the existing document, create a new status document
        try {
          await addDoc(collection(db, 'candidateStatus'), {
            userId: currentUser.uid,
            candidateId: candidateId,
            status: 'generated',
            generatedAt: new Date().toISOString(),
          });
          console.log('✅ Fallback status document created successfully');
          // Don't throw error - fallback worked and PDF was generated successfully
        } catch (fallbackError: any) {
          console.error('❌ Even fallback status creation failed:', fallbackError);
          // Still don't throw - the main PDF generation succeeded
        }
      }

      console.log('✅ PDF receipt generated successfully');
      return generatedReceiptPDF;
    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
      throw error;
    }
  }


  /**
   * Save generated PDF receipt as a regular receipt in the system
   */
  public async saveGeneratedPDFReceiptAsReceipt(
    userId: string,
    generatedReceiptPDF: GeneratedReceiptPDF,
    candidateId: string,
    business?: any
  ): Promise<string> {
    try {
      // Check if the current user is a team member and get team attribution
      const teamMember = await TeamService.getTeamMembershipByUserId(userId);
      let teamAttribution = undefined;
      
      if (teamMember) {
        teamAttribution = {
          accountHolderId: teamMember.accountHolderId,
          createdByUserId: userId,
          createdByEmail: teamMember.email,
          createdByName: teamMember.displayName,
          isTeamReceipt: true,
        };
      }

      // Create receipt document for Firebase with PDF data
      const receiptDoc = {
        userId: teamMember?.accountHolderId || userId, // Store under account holder's userId
        pdfUrl: generatedReceiptPDF.receiptPdfUrl,
        pdfPath: generatedReceiptPDF.receiptPdfPath,
        vendor: generatedReceiptPDF.receiptData.businessName || 'Unknown Business', // Merchant/vendor name (Amazon, Starbucks, etc.)
        amount: Number(generatedReceiptPDF.receiptData.total) || 0,
        date: generatedReceiptPDF.receiptData.date,
        description: generatedReceiptPDF.receiptData.description || '', // Add description from PDF receipt data
        category: 'Generated from Bank Transaction',
        items: generatedReceiptPDF.receiptData.items,
        tax: {
          deductible: true, // Bank receipts are typically business expenses, so default to deductible
          deductionPercentage: 0, // Start with 0, let user set the actual deduction percentage
          category: 'business_expense',
          taxYear: new Date().getFullYear(),
          amount: generatedReceiptPDF.receiptData.tax || 0, // Store the actual tax amount from receipt
        },
        // Set user's business if one is selected (for expense categorization)
        businessId: business?.id || null,
        businessName: business?.businessName || null,
        receiptData: generatedReceiptPDF.receiptData, // Store complete receipt data for regeneration
        metadata: {
          source: 'bank_transaction',
          originalTransactionId: generatedReceiptPDF.receiptData.transactionId,
          generatedAt: new Date(),
          type: 'pdf',
        },
        ...(teamAttribution && { teamAttribution }), // Add team attribution if applicable
        type: 'pdf', // Mark as PDF receipt
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      console.log('🔍 Adding PDF receipt to receipts collection for userId:', userId);
      const receiptRef = await addDoc(collection(db, 'receipts'), receiptDoc);
      console.log('✅ PDF receipt added to receipts collection with ID:', receiptRef.id);

      // Update candidate status (non-critical - don't fail if this fails)
      console.log('🔍 Updating candidate status for candidateId:', candidateId);
      try {
        const candidateRef = doc(db, 'transactionCandidates', candidateId);
        const candidateSnap = await getDoc(candidateRef);

        if (!candidateSnap.exists()) {
          console.error('❌ Candidate document not found:', candidateId);
          console.log('🔍 Creating fallback status document instead');
          await addDoc(collection(db, 'candidateStatus'), {
            userId: userId,
            candidateId: candidateId,
            status: 'approved',
            receiptId: receiptRef.id,
            approvedAt: new Date().toISOString(),
          });
          console.log('✅ Fallback status document created');
        } else {
          const candidateData = candidateSnap.data();
          if (candidateData?.userId !== userId) {
            console.error('❌ User ID mismatch - candidate belongs to different user');
            console.log('🔍 Creating fallback status document instead');
            await addDoc(collection(db, 'candidateStatus'), {
              userId: userId,
              candidateId: candidateId,
              status: 'approved',
              receiptId: receiptRef.id,
              approvedAt: new Date().toISOString(),
            });
            console.log('✅ Fallback status document created');
          } else {
            await updateDoc(candidateRef, {
              status: 'approved',
              receiptId: receiptRef.id,
            });
            console.log('✅ Candidate status updated to approved');
          }
        }
      } catch (candidateError: any) {
        console.error('❌ Failed to update candidate status:', candidateError);
        console.log('🔍 Receipt was saved successfully, candidate status update failed');
        // Don't throw error - the main receipt saving succeeded
      }

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
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ User not authenticated');
        throw new Error('User must be authenticated to regenerate receipts');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      console.log('✅ User authentication verified for PDF regeneration:', currentUser.uid);
      
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
        splitTender: receiptData.extractedData?.splitTender?.isSplitTender ? {
          isSplitTender: true,
          payments: receiptData.extractedData.splitTender.payments.map((payment: any) => ({
            method: payment.method,
            amount: Number(payment.amount) || 0,
            last4: payment.last4
          }))
        } : undefined,
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

      // Try to get from Firestore as fallback
      // Note: This will only work if the user has proper permissions (professional tier)
      console.log('📱 No local bank connections found, checking Firestore...');
      return await this.getBankConnectionsFromFirestore(userId);
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
      
      // Also sync to Firestore
      await this.syncBankConnectionsToFirestore(connection.userId, connections);
    } catch (error) {
      console.error('Error saving bank connection locally:', error);
    }
  }

  /**
   * Get bank connections from Firestore
   */
  private async getBankConnectionsFromFirestore(userId: string): Promise<BankConnection[]> {
    try {
      console.log('📱 Attempting to get bank connections from Firestore for user:', userId);
      const bankConnectionRef = doc(db, 'bankConnections', userId);
      const bankConnectionSnap = await getDoc(bankConnectionRef);
      
      if (!bankConnectionSnap.exists()) {
        console.log('📱 No bank connections found in Firestore for user:', userId);
        return [];
      }
      
      const data = bankConnectionSnap.data();
      const firestoreConnections = data?.connections || [];
      
      console.log(`🔥 Found ${firestoreConnections.length} bank connections in Firestore`);
      
      // Note: Firestore connections don't have access tokens, so they're read-only
      // This is mainly for displaying connection info, not for making API calls
      return firestoreConnections.map((conn: any) => ({
        ...conn,
        connectedAt: conn.connectedAt instanceof Date ? conn.connectedAt.toISOString() : conn.connectedAt,
        lastSyncAt: conn.lastSyncAt instanceof Date ? conn.lastSyncAt.toISOString() : conn.lastSyncAt,
      }));
    } catch (error: any) {
      // Handle permission errors gracefully for non-professional users
      if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
        console.log('🚫 Bank connections not accessible - user may not have professional tier permissions');
        return [];
      }
      console.error('❌ Error getting bank connections from Firestore:', error);
      return [];
    }
  }

  /**
   * Sync bank connections to Firestore
   */
  private async syncBankConnectionsToFirestore(userId: string, connections: BankConnection[]): Promise<void> {
    try {
      console.log('🔄 Syncing bank connections to Firestore...');
      
      // Create a sanitized version without sensitive data for Firestore
      const sanitizedConnections = connections.map(conn => {
        // Filter out undefined values - Firestore doesn't accept them
        const sanitized: any = {
          id: conn.id,
          userId: conn.userId,
          institutionName: conn.institutionName,
          accounts: conn.accounts.map(acc => {
            const account: any = {
              accountId: acc.accountId,
              name: acc.name,
              type: acc.type,
            };
            
            // Only add optional fields if they have values
            if (acc.subtype !== undefined) {
              account.subtype = acc.subtype;
            }
            if (acc.mask !== undefined) {
              account.mask = acc.mask;
            }
            
            return account;
          }),
          isActive: conn.isActive,
          // Don't store access tokens in Firestore
        };

        // Only add optional fields if they have values
        if (conn.institutionId !== undefined) {
          sanitized.institutionId = conn.institutionId;
        }
        if (conn.connectedAt !== undefined) {
          sanitized.connectedAt = conn.connectedAt;
        }
        if (conn.lastSyncAt !== undefined) {
          sanitized.lastSyncAt = conn.lastSyncAt;
        }

        return sanitized;
      });

      const bankConnectionRef = doc(db, 'bankConnections', userId);
      await setDoc(bankConnectionRef, {
        userId: userId,
        connections: sanitizedConnections,
        updatedAt: new Date(),
      });
      
      console.log(`🔥 Synced ${connections.length} bank connections to Firestore`);
    } catch (error) {
      console.error('❌ Error syncing bank connections to Firestore:', error);
      // Don't throw error - local storage should still work even if Firestore sync fails
    }
  }

  /**
   * Manually sync existing local bank connections to Firestore
   * This is useful for migrating existing connections to the cloud
   */
  public async syncLocalConnectionsToFirestore(userId: string): Promise<void> {
    try {
      console.log('🔄 Manual sync: Moving local bank connections to Firestore...');
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ User not authenticated');
        throw new Error('User must be authenticated to sync connections');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      console.log('✅ User authentication verified for sync:', currentUser.uid);
      
      // Get existing local connections
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`;
      const localConnections = await AsyncStorage.getItem(key);
      
      if (!localConnections) {
        console.log('📱 No local connections found to sync');
        return;
      }
      
      const connections: BankConnection[] = JSON.parse(localConnections);
      console.log(`📱 Found ${connections.length} local connections to sync`);
      
      // Sync to Firestore
      await this.syncBankConnectionsToFirestore(userId, connections);
      console.log('✅ Manual sync completed successfully');
    } catch (error) {
      console.error('❌ Error during manual sync:', error);
      throw error;
    }
  }

  /**
   * Test Plaid webhook notifications using sandbox
   */
  public async testPlaidWebhook(
    webhookType: 'DEFAULT_UPDATE' | 'NEW_ACCOUNTS_AVAILABLE' | 'SMS_MICRODEPOSITS_VERIFICATION' | 'LOGIN_REPAIRED',
    accessToken: string,
    webhookCode?: string
  ): Promise<any> {
    try {
      console.log('🧪 Triggering Plaid webhook test:', { webhookType, webhookCode });
      
      // Import Firebase Functions
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const app = (await import('../config/firebase')).default;
      
      const functions = getFunctions(app);
      const testPlaidWebhook = httpsCallable(functions, 'testPlaidWebhook');
      
      const result = await testPlaidWebhook({
        webhookType,
        webhookCode,
        accessToken
      });
      
      console.log('✅ Webhook test result:', result.data);
      return result.data;
    } catch (error) {
      console.error('❌ Error testing webhook:', error);
      throw error;
    }
  }

  /**
   * Sync local bank connection to plaid_items collection for webhook processing
   */
  public async syncBankConnectionToPlaidItems(userId: string): Promise<void> {
    try {
      console.log('🔄 Syncing bank connection to plaid_items collection...');
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ User not authenticated');
        throw new Error('User must be authenticated to sync connections');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      console.log('✅ User authentication verified for plaid sync:', currentUser.uid);
      
      // Get local connections
      const connections = await this.getBankConnections(userId);
      if (connections.length === 0) {
        console.log('📱 No bank connections found to sync');
        return;
      }

      // Import Firebase
      const { doc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../config/firebase');

      for (const connection of connections) {
        console.log(`🔄 Syncing connection: ${connection.id} (${connection.institutionName})`);
        
        // Create plaid_items document for webhook processing
        const plaidItemRef = doc(db, 'plaid_items', connection.id);
        await setDoc(plaidItemRef, {
          itemId: connection.id,
          userId: connection.userId,
          institutionId: connection.institutionId,
          institutionName: connection.institutionName,
          accessToken: connection.accessToken, // Needed for API calls
          accounts: connection.accounts.map(acc => ({
            accountId: acc.accountId,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
          })),
          isActive: connection.isActive,
          status: 'good',
          needsReauth: false,
          connectedAt: connection.connectedAt,
          lastSyncAt: connection.lastSyncAt,
          createdAt: new Date(),
          updatedAt: new Date(),
        }, { merge: true });

        console.log(`✅ Synced ${connection.institutionName} to plaid_items collection`);
      }

      console.log(`🎉 Successfully synced ${connections.length} bank connections to plaid_items`);
    } catch (error) {
      console.error('❌ Error syncing to plaid_items:', error);
      throw error;
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

      // Clear transaction cache
      await this.clearTransactionCache(userId);

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
   * Dismiss/reject a transaction candidate
   */
  public async dismissCandidate(candidateId: string, userId: string): Promise<void> {
    try {
      console.log('🗑️ Dismissing candidate:', candidateId);
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ User not authenticated');
        throw new Error('User must be authenticated to dismiss candidates');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      console.log('✅ User authentication verified for dismissal:', currentUser.uid);
      
      // Try to update candidate status directly (works if document has correct userId)
      const candidateRef = doc(db, 'transactionCandidates', candidateId);
      console.log('🔍 Attempting direct dismissal of candidate...');
      
      try {
        await updateDoc(candidateRef, {
          status: 'rejected'
        });
        console.log('✅ Successfully dismissed candidate directly');
      } catch (updateError: any) {
        console.log('⚠️ Direct dismissal failed, trying fallback approach:', updateError?.message);
        
        // Fallback: Try to read the document to understand the issue
        try {
          console.log('🔍 Attempting to read candidate document for debugging...');
          const candidateSnap = await getDoc(candidateRef);
          
          if (!candidateSnap.exists()) {
            console.error('❌ Candidate document not found:', candidateId);
            throw new Error('Transaction candidate not found');
          }

          const candidateData = candidateSnap.data();
          console.log('🔍 Candidate document data:', {
            hasUserId: !!candidateData?.userId,
            candidateUserId: candidateData?.userId,
            currentUserId: currentUser.uid,
            match: candidateData?.userId === currentUser.uid
          });

          if (candidateData?.userId !== currentUser.uid) {
            console.error('❌ User ID mismatch - candidate belongs to different user');
            throw new Error('Permission denied: candidate belongs to different user');
          }
          
          // If we got here, there's some other issue
          throw new Error(`Failed to dismiss candidate: ${updateError?.message}`);
          
        } catch (readError: any) {
          console.error('❌ Both update and read failed - likely permission issue');
          console.log('⚠️ Candidate may have incorrect userId or missing permissions');
          // Don't throw - continue with cache cleanup
        }
      }

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

  /**
   * Refresh account information for a bank connection when account IDs don't match transactions
   */
  public async refreshConnectionAccounts(userId: string, connectionId: string): Promise<boolean> {
    try {
      console.log('🔄 Refreshing account information for connection:', connectionId);
      
      // Verify user authentication before proceeding
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('❌ User not authenticated');
        throw new Error('User must be authenticated to refresh connections');
      }
      
      if (currentUser.uid !== userId) {
        console.error('❌ User ID mismatch - current user:', currentUser.uid, 'provided userId:', userId);
        throw new Error('User ID mismatch - authentication required');
      }
      
      // Get the connection from stored connections
      const connections = await this.getBankConnections(userId);
      const connection = connections.find(conn => conn.id === connectionId);
      
      if (!connection) {
        console.error('❌ Connection not found:', connectionId);
        return false;
      }
      
      // Fetch fresh account information from Plaid
      const freshAccounts = await this.plaidService.getAccounts(connection.accessToken);
      console.log('🔄 Fetched', freshAccounts.length, 'fresh accounts from Plaid');
      
      // Update the connection with fresh account information
      const updatedConnection = {
        ...connection,
        accounts: freshAccounts.map(account => ({
          accountId: account.account_id,
          name: account.name,
          type: account.type,
          subtype: account.subtype,
          mask: account.mask || '',
        })),
        lastSyncAt: new Date(),
      };
      
      // Update in local storage
      const updatedConnections = connections.map(conn => 
        conn.id === connectionId ? updatedConnection : conn
      );
      
      const key = `${BankReceiptService.BANK_CONNECTIONS_KEY}_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedConnections));
      
      // Sync to Firestore
      await this.syncBankConnectionsToFirestore(userId, updatedConnections);
      
      console.log('✅ Successfully refreshed account information for:', connection.institutionName);
      return true;
      
    } catch (error) {
      console.error('❌ Error refreshing connection accounts:', error);
      return false;
    }
  }
}

export default BankReceiptService;
