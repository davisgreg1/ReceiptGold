import * as FileSystem from 'expo-file-system';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { PDFReceiptService } from './PDFReceiptService';
import { BankReceiptService } from './BankReceiptService';

export class PDFRecoveryService {
  private pdfReceiptService: PDFReceiptService;
  private bankReceiptService: BankReceiptService;

  constructor() {
    this.pdfReceiptService = PDFReceiptService.getInstance();
    this.bankReceiptService = BankReceiptService.getInstance();
  }

  /**
   * Check if a PDF file exists at the given path
   */
  async checkPDFExists(pdfPath: string): Promise<boolean> {
    try {
      if (!pdfPath) return false;
      
      const fileInfo = await FileSystem.getInfoAsync(pdfPath);
      return fileInfo.exists;
    } catch (error) {
      console.error('Error checking PDF existence:', error);
      return false;
    }
  }

  /**
   * Attempt to recover/regenerate a missing PDF file
   */
  async recoverMissingPDF(receiptId: string, userId: string): Promise<string | null> {
    try {
      console.log('🔄 Attempting to recover missing PDF for receipt:', receiptId);

      // Get the receipt data from Firestore
      const receiptRef = doc(db, 'receipts', receiptId);
      const receiptSnap = await getDoc(receiptRef);

      if (!receiptSnap.exists()) {
        console.error('Receipt document not found:', receiptId);
        return null;
      }

      const receiptData = receiptSnap.data();

      // Check if this is a bank-generated receipt that can be regenerated
      if (receiptData.metadata?.source === 'bank_transaction' && receiptData.metadata?.originalTransactionId) {
        console.log('🔄 Regenerating PDF for bank transaction receipt...');
        
        try {
          // Use the existing regeneration method
          await this.bankReceiptService.regeneratePDFForReceipt(receiptId, userId);
          
          // Get the updated receipt data with new PDF path
          const updatedReceiptSnap = await getDoc(receiptRef);
          const updatedReceiptData = updatedReceiptSnap.data();
          
          if (updatedReceiptData?.pdfPath) {
            console.log('✅ PDF successfully regenerated:', updatedReceiptData.pdfPath);
            return updatedReceiptData.pdfPath;
          }
        } catch (regenerationError) {
          console.error('❌ Failed to regenerate PDF:', regenerationError);
        }
      }

      // If we can't regenerate, try to create a basic replacement PDF from available data
      console.log('🔄 Creating replacement PDF from receipt data...');
      
      const replacementPDF = await this.createReplacementPDF(receiptData, receiptId);
      
      if (replacementPDF) {
        // Update the receipt with the new PDF path
        await updateDoc(receiptRef, {
          pdfPath: replacementPDF,
          pdfUrl: replacementPDF,
          updatedAt: new Date(),
          recoveredPDF: true, // Mark as a recovered PDF
        });
        
        console.log('✅ Replacement PDF created:', replacementPDF);
        return replacementPDF;
      }

      return null;
    } catch (error) {
      console.error('❌ Error recovering missing PDF:', error);
      return null;
    }
  }

  /**
   * Create a replacement PDF from available receipt data
   */
  private async createReplacementPDF(receiptData: any, receiptId: string): Promise<string | null> {
    try {
      // Create receipt data structure for PDF generation
      const pdfReceiptData = {
        businessName: receiptData.vendor || receiptData.businessName || 'Unknown Business',
        address: receiptData.receiptData?.address || '123 Business St, City, State 12345',
        date: receiptData.date ? new Date(receiptData.date.toDate ? receiptData.date.toDate() : receiptData.date).toLocaleDateString() : new Date().toLocaleDateString(),
        time: receiptData.date ? new Date(receiptData.date.toDate ? receiptData.date.toDate() : receiptData.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        description: receiptData.description || 'Receipt Transaction',
        items: receiptData.extractedData?.items?.map((item: any) => ({
          description: item.description || 'Item',
          amount: Number(item.amount) || Number(item.price * item.quantity) || 0,
        })) || [{
          description: receiptData.description || 'Purchase',
          amount: Number(receiptData.amount) || 0,
        }],
        subtotal: Number(receiptData.amount) || 0,
        tax: receiptData.tax?.amount || 0,
        total: Number(receiptData.amount) || 0,
        paymentMethod: receiptData.receiptData?.paymentMethod || 'Card Payment',
        transactionId: receiptData.metadata?.originalTransactionId || receiptId,
      };

      // Generate the replacement PDF
      const regeneratedPDF = await this.pdfReceiptService.regeneratePDFReceipt(
        pdfReceiptData,
        receiptData.metadata?.originalTransactionId || receiptId
      );

      return regeneratedPDF.receiptPdfPath;
    } catch (error) {
      console.error('❌ Error creating replacement PDF:', error);
      return null;
    }
  }


  /**
   * Get user-friendly error message for missing PDF
   */
  getMissingPDFErrorMessage(receiptData?: any): string {
    if (receiptData?.metadata?.source === 'bank_transaction') {
      return 'This PDF receipt is no longer available on your device. You can regenerate it by editing the receipt or going back to the Bank Transactions screen.';
    }
    
    return 'This PDF file is no longer available. This can happen after app updates or when device storage is cleaned. Try regenerating the receipt if possible.';
  }
}

export const pdfRecoveryService = new PDFRecoveryService();
