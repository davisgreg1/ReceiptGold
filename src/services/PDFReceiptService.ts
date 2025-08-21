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
    items: Array<{
      description: string;
      amount: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod: string;
    transactionId: string;
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
    const items = this.generateItemsFromAmount(transaction.amount, businessName);
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
  private generateItemsFromAmount(amount: number, businessName: string): Array<{ description: string; amount: number }> {
    const items: Array<{ description: string; amount: number }> = [];
    const category = this.categorizeBusinessName(businessName);
    
    if (amount <= 10) {
      // Single small item
      items.push({
        description: category.items[0] || 'Item',
        amount: amount
      });
    } else if (amount <= 50) {
      // 2-3 items
      const itemCount = Math.floor(Math.random() * 2) + 2;
      let remainingAmount = amount;
      
      for (let i = 0; i < itemCount - 1; i++) {
        const itemAmount = Math.round((remainingAmount * (0.2 + Math.random() * 0.4)) * 100) / 100;
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
      // Multiple items for larger amounts
      const itemCount = Math.min(Math.floor(Math.random() * 4) + 3, category.items.length);
      let remainingAmount = amount;
      
      for (let i = 0; i < itemCount - 1; i++) {
        const itemAmount = Math.round((remainingAmount * (0.1 + Math.random() * 0.3)) * 100) / 100;
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
    } else {
      return {
        category: 'general',
        items: ['Purchase', 'Service Fee', 'Product', 'Item', 'Transaction']
      };
    }
  }

  /**
   * Generate HTML for PDF receipt
   */
  private generateReceiptHTML(receiptData: any): string {
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

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
                <div class="store-info">(555) 123-4567</div>
            </div>

            <div class="receipt-body">
                <div class="receipt-info">
                    <div>
                        <div>Receipt #: ${receiptData.transactionId.substr(-8)}</div>
                        <div>Register: 3</div>
                        <div>Cashier: Sarah M.</div>
                    </div>
                    <div>
                        <div>${currentDate}</div>
                        <div>${currentTime}</div>
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
                    <div class="total-line" style="margin-top: 10px;">
                        <span>PAYMENT METHOD:</span>
                        <span>${receiptData.paymentMethod}</span>
                    </div>
                </div>
            </div>

            <div class="receipt-footer">
                <div>Thank you for shopping with us!</div>
                <div>Customer Service: (555) 123-4567</div>
                <div style="margin-top: 10px;">**** 4023 APPROVED</div>
                <div>AUTH: 123456</div>
                <div style="margin-top: 10px;">Generated by ReceiptGold</div>
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
      
      // Generate receipt data
      const receiptData = this.generateReceiptData(transaction);
      
      // Generate HTML content
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

      // Generate a permanent file path for the PDF
      const fileName = `receipt_${transaction.transaction_id}_${Date.now()}.pdf`;
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

      console.log('✅ PDF receipt generated successfully at:', permanentPath);
      
      return {
        receiptPdfUrl: permanentPath,
        receiptPdfPath: permanentPath,
        receiptData
      };
    } catch (error) {
      console.error('❌ Error generating PDF receipt:', error);
      throw error;
    }
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
