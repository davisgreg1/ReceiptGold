import { db } from '../config/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import * as FileSystem from 'expo-file-system';
import { PlaidTransaction } from './PlaidService';
import { MerchantInfo } from './MerchantLogoService';
import { Receipt } from './firebaseService';

export interface GeneratedReceiptData {
  transaction: PlaidTransaction;
  merchantInfo: MerchantInfo;
  receiptNumber: string;
  pdfFilePath: string;
  htmlContent?: string;
}

export class FirebaseReceiptIntegration {
  private static instance: FirebaseReceiptIntegration;

  private constructor() {}

  public static getInstance(): FirebaseReceiptIntegration {
    if (!FirebaseReceiptIntegration.instance) {
      FirebaseReceiptIntegration.instance = new FirebaseReceiptIntegration();
    }
    return FirebaseReceiptIntegration.instance;
  }

  /**
   * Save a generated receipt to Firestore so it appears in the main receipts list
   */
  public async saveReceiptToFirestore(
    receiptData: GeneratedReceiptData,
    userId: string
  ): Promise<string> {
    try {
      console.log('💾 Saving generated receipt to Firestore...');
      console.log('💾 Receipt data pdfFilePath:', receiptData.pdfFilePath);
      console.log('💾 Checking if PDF file exists at saved path...');
      
      // Verify the PDF file exists before saving to Firestore
      const pdfFileInfo = await FileSystem.getInfoAsync(receiptData.pdfFilePath);
      console.log('💾 PDF file info at save time:', pdfFileInfo);
      
      if (!pdfFileInfo.exists) {
        console.warn('⚠️ PDF file does not exist at the time of Firestore save!');
      }

      // Create a simple thumbnail placeholder
      const thumbnailUrl = this.createReceiptThumbnailPlaceholder(receiptData);

      // Create receipt data in Firestore format (omit undefined fields)
      const baseReceiptData = {
        userId,
        vendor: receiptData.merchantInfo.name,
        amount: Math.abs(receiptData.transaction.amount), // Convert to positive amount
        currency: receiptData.transaction.iso_currency_code || 'USD',
        date: new Date(receiptData.transaction.date),
        description: receiptData.transaction.name,
        category: receiptData.transaction.category?.[0] || 'General',
        tags: ['auto-generated', 'plaid', receiptData.merchantInfo.source, receiptData.receiptNumber],
        images: [{
          url: thumbnailUrl,
          thumbnail: thumbnailUrl,
          size: 1024, // Placeholder size
          uploadedAt: new Date(),
        }],
        extractedData: {
          vendor: receiptData.merchantInfo.name,
          amount: Math.abs(receiptData.transaction.amount),
          date: receiptData.transaction.date,
          confidence: 1.0, // High confidence since it's from bank data
          items: [{
            description: receiptData.transaction.name,
            amount: Math.abs(receiptData.transaction.amount),
            quantity: 1
          }]
        },
        tax: {
          deductible: false, // User can update this later
          deductionPercentage: 0,
          taxYear: new Date().getFullYear(),
          category: 'business' // Default category
        },
        status: 'processed' as const,
        processingErrors: [],
        // Add PDF file path for generated receipts
        pdfFilePath: receiptData.pdfFilePath,
        pdfUri: receiptData.pdfFilePath, // Just use the path directly, no need to add file://
      };

      console.log('💾 Base receipt data with PDF:', {
        pdfFilePath: baseReceiptData.pdfFilePath,
        pdfUri: baseReceiptData.pdfUri
      });

      // Add optional fields only if they have values
      const firestoreReceipt = {
        ...baseReceiptData,
        ...(receiptData.transaction.category?.[1] && { subcategory: receiptData.transaction.category[1] }),
        // Don't include businessId at all if we don't have one
        // Don't include tax in extractedData since Plaid doesn't provide it
      } as Omit<Receipt, 'receiptId' | 'createdAt' | 'updatedAt'>;

      console.log('💾 Final Firestore receipt data:', {
        ...firestoreReceipt,
        pdfFilePath: firestoreReceipt.pdfFilePath,
        pdfUri: firestoreReceipt.pdfUri
      });

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'receipts'), {
        ...firestoreReceipt,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Update the document with its own ID
      await updateDoc(doc(db, 'receipts', docRef.id), {
        receiptId: docRef.id,
      });

      console.log('✅ Receipt saved to Firestore with ID:', docRef.id);
      return docRef.id;

    } catch (error) {
      console.error('❌ Failed to save receipt to Firestore:', error);
      throw error;
    }
  }

  /**
   * Create a simple SVG thumbnail placeholder for the receipt
   */
  private createReceiptThumbnailPlaceholder(receiptData: GeneratedReceiptData): string {
    // Instead of creating a complex SVG, let's return a simple data URL
    // that won't require base64 encoding
    const merchantName = receiptData.merchantInfo.name.substring(0, 20);
    const amount = Math.abs(receiptData.transaction.amount).toFixed(2);
    const date = new Date(receiptData.transaction.date).toLocaleDateString();
    
    // Create a simple text-based placeholder URL
    // This will be handled gracefully by the image component
    return `https://via.placeholder.com/200x250/f8f9fa/495057?text=${encodeURIComponent(`$${amount}`)}`;
  }

  /**
   * Update an existing receipt in Firestore
   */
  public async updateReceiptInFirestore(
    receiptId: string,
    updates: Partial<Receipt>
  ): Promise<void> {
    try {
      await updateDoc(doc(db, 'receipts', receiptId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Receipt updated in Firestore:', receiptId);
    } catch (error) {
      console.error('❌ Failed to update receipt in Firestore:', error);
      throw error;
    }
  }

  /**
   * Delete a generated receipt from Firestore
   */
  public async deleteReceiptFromFirestore(receiptId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'receipts', receiptId), {
        status: 'error',
        processingErrors: ['Deleted by user'],
        updatedAt: serverTimestamp(),
      });
      
      console.log('✅ Receipt marked as deleted in Firestore:', receiptId);
    } catch (error) {
      console.error('❌ Failed to delete receipt from Firestore:', error);
      throw error;
    }
  }
}
