import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { PlaidTransaction } from './PlaidService';

export interface GeneratedReceiptPDF {
  receiptPdfUrl: string;
  receiptPdfPath: string;
  receiptData: {
    businessName: string;
    address: string;
    date: string;
    time: string;
    description?: string; // Add optional description field
    items: Array<{
      description: string;
      amount: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    transactionId: string;
    fallback?: boolean; // Optional flag for fallback receipts
    splitTender?: {
      isSplitTender: boolean;
      payments: Array<{
        method: 'cash' | 'credit' | 'debit' | 'gift_card' | 'check' | 'other';
        amount: number;
        last4?: string;
      }>;
    };
  };
}

export class PDFReceiptService {
  private static instance: PDFReceiptService;

  private constructor() {}

  public static getInstance(): PDFReceiptService {
    if (!PDFReceiptService.instance) {
      PDFReceiptService.instance = new PDFReceiptService();
    }
    return PDFReceiptService.instance;
  }

  /**
   * Generate receipt data from Plaid transaction
   */
  private generateReceiptData(transaction: PlaidTransaction) {
    const businessName = transaction.merchant_name || transaction.name || 'Unknown Store';
    const address = transaction.location 
      ? `${transaction.location.address || '123 Main St'}, ${transaction.location.city}, ${transaction.location.region} ${transaction.location.postal_code || ''}`
      : '123 Main St, San Francisco, CA 94102';

    // Generate realistic items based on transaction amount
    const items = this.generateItemsFromAmount(transaction.amount, businessName, transaction.name);
    const subtotal = Math.round((transaction.amount * 0.925) * 100) / 100;
    const tax = Math.round((transaction.amount * 0.075) * 100) / 100;

    return {
      businessName,
      address,
      date: transaction.date,
      time: transaction.datetime 
        ? new Date(transaction.datetime).toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            hour12: true 
          })
        : '12:30 PM',
      description: transaction.name || '', // Add transaction name as description
      items,
      subtotal,
      tax,
      total: transaction.amount,
      paymentMethod: 'Credit Card',
      transactionId: transaction.transaction_id,
    };
  }

  /**
   * Generate realistic items based on transaction amount and merchant
   */
  private generateItemsFromAmount(amount: number, businessName: string, transactionName?: string): Array<{ description: string; amount: number }> {
    const items: Array<{ description: string; amount: number }> = [];
    const category = this.categorizeBusinessName(businessName);

    // For small amounts or when we have a specific transaction name, use it directly
    if (amount <= 15 || (transactionName && transactionName !== businessName)) {
      items.push({
        description: transactionName || category.items[0] || businessName,
        amount: amount
      });
    } else if (amount <= 50) {
      // 2-3 items for medium amounts
      const itemCount = Math.floor(Math.random() * 2) + 2;
      let remainingAmount = amount;

      for (let i = 0; i < itemCount - 1; i++) {
        const itemAmount = Math.round((remainingAmount * (0.3 + Math.random() * 0.4)) * 100) / 100;
        items.push({
          description: category.items[i % category.items.length],
          amount: itemAmount
        });
        remainingAmount -= itemAmount;
      }

      // Last item gets remaining amount
      items.push({
        description: category.items[(itemCount - 1) % category.items.length],
        amount: Math.round(remainingAmount * 100) / 100
      });
    } else {
      // Multiple items for larger amounts, but limit to available items
      const maxItems = Math.min(category.items.length, 4);
      const itemCount = Math.floor(Math.random() * (maxItems - 1)) + 2;
      let remainingAmount = amount;

      for (let i = 0; i < itemCount - 1; i++) {
        const itemAmount = Math.round((remainingAmount * (0.15 + Math.random() * 0.25)) * 100) / 100;
        items.push({
          description: category.items[i],
          amount: itemAmount
        });
        remainingAmount -= itemAmount;
      }

      // Last item gets remaining amount
      items.push({
        description: category.items[itemCount - 1],
        amount: Math.round(remainingAmount * 100) / 100
      });
    }

    return items;
  }

  /**
   * Categorize business and return appropriate items
   */
  private categorizeBusinessName(businessName: string) {
    const name = businessName.toLowerCase();
    
    if (name.includes('starbucks') || name.includes('coffee') || name.includes('cafe')) {
      return {
        category: 'cafe',
        items: ['Grande Latte', 'Croissant', 'Espresso Shot', 'Blueberry Muffin', 'Green Tea']
      };
    } else if (name.includes('walmart') || name.includes('target') || name.includes('grocery') || name.includes('market')) {
      return {
        category: 'grocery',
        items: ['Organic Bananas', 'Whole Milk', 'Bread', 'Chicken Breast', 'Mixed Vegetables', 'Pasta', 'Tomato Sauce']
      };
    } else if (name.includes('gas') || name.includes('shell') || name.includes('exxon') || name.includes('bp')) {
      return {
        category: 'gas',
        items: ['Regular Gas', 'Car Wash', 'Air Freshener']
      };
    } else if (name.includes('restaurant') || name.includes('burger') || name.includes('pizza') || name.includes('food')) {
      return {
        category: 'restaurant',
        items: ['Cheeseburger', 'French Fries', 'Soft Drink', 'Garden Salad', 'Chicken Wings']
      };
    } else if (name.includes('pharmacy') || name.includes('cvs') || name.includes('walgreens')) {
      return {
        category: 'pharmacy',
        items: ['Prescription', 'Vitamins', 'Hand Sanitizer', 'Tissues']
      };
    } else if (name.includes('hotel') || name.includes('inn') || name.includes('resort')) {
      return {
        category: 'hotel',
        items: ['Room Charge', 'Resort Fee', 'Parking', 'Wi-Fi Access']
      };
    } else if (name.includes('uber') || name.includes('lyft') || name.includes('taxi')) {
      return {
        category: 'rideshare',
        items: ['Trip Fare', 'Service Fee', 'Tip']
      };
    } else if (name.includes('amazon') || name.includes('online') || name.includes('shipping')) {
      return {
        category: 'online',
        items: ['Product Purchase', 'Shipping Fee', 'Tax']
      };
    } else if (name.includes('office') || name.includes('supply') || name.includes('depot')) {
      return {
        category: 'office',
        items: ['Office Supplies', 'Paper', 'Printing Services', 'Ink Cartridge']
      };
    } else {
      // For unknown merchants, use the actual transaction name if available
      const transactionName = businessName || 'Business Expense';
      return {
        category: 'general',
        items: [transactionName, 'Service Charge', 'Business Expense']
      };
    }
  }

  /**
   * Generate HTML for PDF receipt
   */
  private generateReceiptHTML(receiptData: any): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Receipt</title>
        <style>
            body {
                margin: 0;
                padding: 20px;
                background: white;
                display: flex;
                justify-content: center;
                align-items: flex-start;
                min-height: 100vh;
                font-family: 'Courier New', monospace;
            }

            .receipt {
                width: 300px;
                background: white;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                line-height: 1.4;
                padding: 20px;
                border: 1px solid #000;
                color: #333;
            }

            .receipt-header {
                text-align: center;
                border-bottom: 1px dashed #666;
                padding-bottom: 15px;
                margin-bottom: 15px;
            }

            .store-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
                text-transform: uppercase;
            }

            .store-info {
                font-size: 11px;
                color: #666;
                margin-bottom: 3px;
            }

            .receipt-body {
                margin-bottom: 15px;
            }

            .receipt-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 20px;
                font-size: 10px;
            }

            .items-list {
                margin-bottom: 15px;
            }

            .item-line {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                border-bottom: 1px dotted #ccc;
                padding-bottom: 2px;
            }

            .item-name {
                flex: 1;
                text-transform: uppercase;
                font-size: 11px;
            }

            .item-price {
                text-align: right;
                min-width: 60px;
                font-size: 11px;
            }

            .receipt-totals {
                border-top: 1px dashed #666;
                padding-top: 10px;
                margin-top: 10px;
            }

            .total-line {
                display: flex;
                justify-content: space-between;
                margin-bottom: 5px;
                font-size: 11px;
            }

            .total-line.final {
                font-weight: bold;
                font-size: 14px;
                border-top: 1px solid #333;
                padding-top: 5px;
                margin-top: 8px;
            }

            .receipt-footer {
                text-align: center;
                margin-top: 20px;
                padding-top: 15px;
                border-top: 1px dashed #666;
                font-size: 10px;
                color: #666;
            }

            .receipt-footer div {
                margin-bottom: 3px;
            }
        </style>
    </head>
    <body>
        <div class="receipt">
            <div class="receipt-header">
                <div class="store-name">${receiptData.businessName}</div>
                <div class="store-info">${receiptData.address}</div>
            </div>

            <div class="receipt-body">
                <div class="receipt-info">
                    <div>
                        <div>Receipt #: ${receiptData.transactionId.substr(-8)}</div>
                        <div>Date: ${receiptData.date}</div>
                        <div>Time: ${receiptData.time}</div>
                    </div>
                    <div>
                        <div>Transaction ID:</div>
                        <div>${receiptData.transactionId.substr(-12)}</div>
                    </div>
                </div>

                <div class="items-list">
                    ${receiptData.items.map((item: any) => `
                        <div class="item-line">
                            <span class="item-name">${item.description}</span>
                            <span class="item-price">$${item.amount.toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>

                ${receiptData.description ? `
                    <div style="margin: 15px 0; padding: 10px; border-top: 1px dotted #ccc; border-bottom: 1px dotted #ccc;">
                        <div style="font-size: 11px; font-weight: bold; margin-bottom: 5px;">DESCRIPTION:</div>
                        <div style="font-size: 11px;">${receiptData.description}</div>
                    </div>
                ` : ''}

                <div class="receipt-totals">
                    <div class="total-line">
                        <span>SUBTOTAL:</span>
                        <span>$${receiptData.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="total-line">
                        <span>TAX:</span>
                        <span>$${receiptData.tax.toFixed(2)}</span>
                    </div>
                    <div class="total-line final">
                        <span>TOTAL:</span>
                        <span>$${receiptData.total.toFixed(2)}</span>
                    </div>
                    
                    ${receiptData.splitTender?.isSplitTender ? `
                        <div style="border-top: 1px dashed #666; padding-top: 10px; margin-top: 10px;">
                            <div class="total-line" style="font-weight: bold; margin-bottom: 8px;">
                                <span>PAYMENT METHODS:</span>
                                <span></span>
                            </div>
                            ${receiptData.splitTender.payments.map((payment: any) => `
                                <div class="total-line" style="font-size: 10px; margin-bottom: 3px;">
                                    <span>${payment.method.replace('_', ' ').toUpperCase()}${payment.last4 ? ` ****${payment.last4}` : ''}:</span>
                                    <span>$${payment.amount.toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <div class="total-line" style="margin-top: 10px;">
                            <span>PAYMENT METHOD:</span>
                            <span>${receiptData.paymentMethod}</span>
                        </div>
                    `}
                </div>
            </div>

            <div class="receipt-footer">
                <div>Thank you for your business!</div>
                <div style="margin-top: 10px;">Generated by ReceiptGold</div>
                <div style="margin-top: 5px;">Transaction recorded: ${receiptData.date}</div>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate PDF receipt from transaction
   */
  public async generatePDFReceiptFromTransaction(transaction: PlaidTransaction): Promise<GeneratedReceiptPDF> {
    try {
      console.log('📄 Generating PDF receipt for transaction...');
      
      // Check if Print is available
      if (!Print || !Print.printToFileAsync) {
        console.warn('⚠️ expo-print not available, creating text receipt instead');
        return await this.createFallbackTextReceipt(transaction);
      }
      
      console.log('🔍 Platform:', Platform.OS);
      console.log('🔍 expo-print available:', !!Print.printToFileAsync);
      
      // Generate receipt data
      console.log('🔍 Generating receipt data...');
      const receiptData = this.generateReceiptData(transaction);
      
      // Generate HTML content
      console.log('🔍 Generating HTML content...');
      const htmlContent = this.generateReceiptHTML(receiptData);
      console.log('🔍 HTML content length:', htmlContent.length);
      
      // Create PDF from HTML with timeout
      console.log('🔍 Starting PDF generation with expo-print...');
      
      // Shorter timeout for better UX - 10 seconds instead of 30
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF generation took too long. Please try again.')), 10000);
      });
      
      const printPromise = Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        margins: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
        },
      });
      
      console.log('🔍 Waiting for PDF generation to complete...');
      
      let uri: string;
      try {
        const result = await Promise.race([printPromise, timeoutPromise]);
        uri = result.uri;
        console.log('✅ PDF generated at temporary location:', uri);
      } catch (error) {
        // If PDF generation fails, throw a user-friendly error
        if (error instanceof Error && error.message.includes('took too long')) {
          throw new Error('PDF generation is taking longer than expected. This might be due to device performance or network issues. Please try again.');
        }
        throw new Error('Failed to generate PDF. Please check your device storage and try again.');
      }

      // Generate a permanent file path for the PDF
      const fileName = `receipt_${transaction.transaction_id}_${Date.now()}.pdf`;
      const permanentPath = `${FileSystem.documentDirectory}receipts/${fileName}`;
      
      console.log('🔍 Creating permanent directory and copying file...');
      
      // Create receipts directory if it doesn't exist
      const receiptsDir = `${FileSystem.documentDirectory}receipts/`;
      const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
      if (!dirInfo.exists) {
        console.log('🔍 Creating receipts directory...');
        await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });
      }

      // Copy the temporary PDF to permanent location
      console.log('🔍 Copying PDF from temporary to permanent location...');
      await FileSystem.copyAsync({
        from: uri,
        to: permanentPath
      });

      // Clean up temporary file
      console.log('🔍 Cleaning up temporary file...');
      try {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (cleanupError) {
        console.warn('⚠️ Failed to delete temporary file (non-critical):', cleanupError);
      }

      console.log('✅ PDF receipt generated successfully at:', permanentPath);
      
      return {
        receiptPdfUrl: permanentPath,
        receiptPdfPath: permanentPath,
        receiptData
      };
    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
      
      // Try to create a fallback text-based receipt
      try {
        console.log('🔄 Attempting to create fallback text receipt...');
        const fallbackReceipt = await this.createFallbackTextReceipt(transaction);
        return fallbackReceipt;
      } catch (fallbackError) {
        console.error('❌ Fallback receipt creation also failed:', fallbackError);
        throw new Error('Unable to generate receipt. Please check your device storage and internet connection, then try again.');
      }
    }
  }

  /**
   * Create a simple text-based receipt as fallback when PDF generation fails
   */
  private async createFallbackTextReceipt(transaction: PlaidTransaction): Promise<GeneratedReceiptPDF> {
    try {
      const receiptData = this.generateReceiptData(transaction);
      
      // Create simple text content
      const textContent = this.generateReceiptText(receiptData);
      
      // Generate a text file instead of PDF
      const fileName = `receipt_${transaction.transaction_id}_${Date.now()}.txt`;
      const textPath = `${FileSystem.documentDirectory}receipts/${fileName}`;
      
      // Create receipts directory if it doesn't exist
      const receiptsDir = `${FileSystem.documentDirectory}receipts/`;
      const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });
      }

      // Write text file
      await FileSystem.writeAsStringAsync(textPath, textContent);

      console.log('✅ Fallback text receipt created at:', textPath);
      
      return {
        receiptPdfUrl: textPath,
        receiptPdfPath: textPath,
        receiptData: {
          ...receiptData,
          fallback: true, // Flag to indicate this is a fallback receipt
        }
      };
    } catch (error) {
      console.error('❌ Error creating fallback receipt:', error);
      throw error;
    }
  }

  /**
   * Generate simple text content for fallback receipts
   */
  private generateReceiptText(receiptData: any): string {
    return `
RECEIPT
=======

Business: ${receiptData.businessName}
Address: ${receiptData.address}
Date: ${receiptData.date}
Time: ${receiptData.time}

${receiptData.description ? `Description: ${receiptData.description}\n` : ''}
Items:
------
${receiptData.items.map((item: any) => `${item.description}: $${item.amount.toFixed(2)}`).join('\n')}

Summary:
--------
Subtotal: $${receiptData.subtotal.toFixed(2)}
Tax: $${receiptData.tax.toFixed(2)}
TOTAL: $${receiptData.total.toFixed(2)}

${receiptData.splitTender?.isSplitTender ? `
Payment Methods:
----------------
${receiptData.splitTender.payments.map((payment: any) => 
  `${payment.method.replace('_', ' ').toUpperCase()}${payment.last4 ? ` ****${payment.last4}` : ''}: $${payment.amount.toFixed(2)}`
).join('\n')}
` : `Payment Method: ${receiptData.paymentMethod || 'N/A'}`}

Transaction ID: ${receiptData.transactionId || 'N/A'}
Receipt ID: ${receiptData.receiptId || 'N/A'}

---
Generated by ReceiptGold
${new Date().toISOString()}
    `.trim();
  }

  /**
   * Regenerate PDF receipt from existing receipt data
   */
  public async regeneratePDFReceipt(receiptData: any, originalTransactionId: string): Promise<GeneratedReceiptPDF> {
    try {
      console.log('🔄 Regenerating PDF receipt...');
      
      // Generate HTML content from existing data
      const htmlContent = this.generateReceiptHTML(receiptData);
      
      // Create PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        margins: {
          left: 10,
          right: 10,
          top: 10,
          bottom: 10,
        },
      });

      // Generate a new file path for the regenerated PDF
      const fileName = `receipt_${originalTransactionId}_${Date.now()}.pdf`;
      const permanentPath = `${FileSystem.documentDirectory}receipts/${fileName}`;
      
      // Create receipts directory if it doesn't exist
      const receiptsDir = `${FileSystem.documentDirectory}receipts/`;
      const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });
      }

      // Copy the temporary PDF to permanent location
      await FileSystem.copyAsync({
        from: uri,
        to: permanentPath
      });

      // Clean up temporary file
      await FileSystem.deleteAsync(uri, { idempotent: true });

      console.log('✅ PDF receipt regenerated successfully at:', permanentPath);
      
      return {
        receiptPdfUrl: permanentPath,
        receiptPdfPath: permanentPath,
        receiptData
      };
    } catch (error) {
      console.error('❌ Error regenerating PDF receipt:', error);
      throw error;
    }
  }

  /**
   * Delete PDF file from storage
   */
  public async deletePDFReceipt(pdfPath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(pdfPath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(pdfPath);
        console.log('🗑️ PDF receipt deleted:', pdfPath);
      }
    } catch (error) {
      console.error('❌ Error deleting PDF receipt:', error);
      // Don't throw error for deletion failures
    }
  }
}
