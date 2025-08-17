import { PlaidTransaction } from './PlaidService';

export interface GeneratedReceipt {
  receiptImageUrl: string;
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

export class HTMLReceiptService {
  private static instance: HTMLReceiptService;

  private constructor() {}

  public static getInstance(): HTMLReceiptService {
    if (!HTMLReceiptService.instance) {
      HTMLReceiptService.instance = new HTMLReceiptService();
    }
    return HTMLReceiptService.instance;
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
    const category = this.categorizeBusinessName(businessName);
    
    if (amount <= 5) {
      return [{ description: category.singleItem, amount }];
    } else if (amount <= 15) {
      const item1Amount = Math.round((amount * 0.6) * 100) / 100;
      const item2Amount = Math.round((amount - item1Amount) * 100) / 100;
      return [
        { description: category.items[0], amount: item1Amount },
        { description: category.items[1], amount: item2Amount }
      ];
    } else {
      const item1Amount = Math.round((amount * 0.4) * 100) / 100;
      const item2Amount = Math.round((amount * 0.35) * 100) / 100;
      const item3Amount = Math.round((amount - item1Amount - item2Amount) * 100) / 100;
      return [
        { description: category.items[0], amount: item1Amount },
        { description: category.items[1], amount: item2Amount },
        { description: category.items[2] || 'Additional Item', amount: item3Amount }
      ];
    }
  }

  /**
   * Categorize business and return appropriate items
   */
  private categorizeBusinessName(businessName: string) {
    const name = businessName.toLowerCase();
    
    if (name.includes('coffee') || name.includes('starbucks') || name.includes('cafe')) {
      return {
        singleItem: 'Large Coffee',
        items: ['Large Latte', 'Blueberry Muffin', 'Bottled Water']
      };
    } else if (name.includes('gas') || name.includes('shell') || name.includes('chevron') || name.includes('exxon')) {
      return {
        singleItem: 'Fuel',
        items: ['Gasoline', 'Energy Drink', 'Snacks']
      };
    } else if (name.includes('grocery') || name.includes('market') || name.includes('food')) {
      return {
        singleItem: 'Groceries',
        items: ['Organic Bananas', 'Whole Milk 1 Gal', 'Bread Loaf']
      };
    } else if (name.includes('restaurant') || name.includes('pizza') || name.includes('burger')) {
      return {
        singleItem: 'Meal',
        items: ['Chicken Sandwich', 'French Fries', 'Soft Drink']
      };
    } else {
      return {
        singleItem: 'Purchase',
        items: ['Item 1', 'Item 2', 'Item 3']
      };
    }
  }

  /**
   * Generate HTML for receipt
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
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            
            body {
                margin: 0;
                padding: 20px;
                background: white;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
            }

            .receipt {
                width: 300px;
                background: white;
                font-family: 'Courier Prime', monospace;
                font-size: 11px;
                line-height: 1.3;
                padding: 15px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                position: relative;
                border-radius: 3px;
                color: #333;
            }

            .receipt::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: 
                    radial-gradient(circle at 20% 30%, rgba(255,248,220,0.3) 0%, transparent 50%),
                    radial-gradient(circle at 80% 70%, rgba(245,245,220,0.2) 0%, transparent 50%),
                    linear-gradient(45deg, transparent 30%, rgba(0,0,0,0.02) 30%, rgba(0,0,0,0.02) 70%, transparent 70%);
                pointer-events: none;
                border-radius: 3px;
            }

            .receipt-header {
                text-align: center;
                border-bottom: 1px dashed #666;
                padding-bottom: 10px;
                margin-bottom: 10px;
                position: relative;
                z-index: 1;
            }

            .store-name {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
                text-transform: uppercase;
            }

            .store-info {
                font-size: 9px;
                color: #666;
                margin-bottom: 2px;
            }

            .receipt-body {
                margin-bottom: 10px;
                position: relative;
                z-index: 1;
            }

            .receipt-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 15px;
                font-size: 9px;
            }

            .items-list {
                margin-bottom: 10px;
            }

            .item-line {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
            }

            .item-name {
                flex: 1;
                text-transform: uppercase;
            }

            .item-price {
                text-align: right;
                min-width: 50px;
            }

            .receipt-totals {
                border-top: 1px dashed #666;
                padding-top: 8px;
                margin-top: 8px;
            }

            .total-line {
                display: flex;
                justify-content: space-between;
                margin-bottom: 3px;
            }

            .total-line.final {
                font-weight: bold;
                font-size: 12px;
                border-top: 1px solid #333;
                padding-top: 3px;
                margin-top: 5px;
            }

            .receipt-footer {
                text-align: center;
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px dashed #666;
                font-size: 9px;
                color: #666;
                position: relative;
                z-index: 1;
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
                    <div class="total-line" style="margin-top: 8px;">
                        <span>CARD:</span>
                        <span>$${receiptData.total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div class="receipt-footer">
                <div>Thank you for shopping with us!</div>
                <div>Customer Service: (555) 123-4567</div>
                <div style="margin-top: 8px;">**** 4023 APPROVED</div>
                <div>AUTH: 123456</div>
            </div>
        </div>
    </body>
    </html>
    `;
  }

  /**
   * Generate receipt from transaction using HTML approach
   */
  public async generateReceiptFromTransaction(transaction: PlaidTransaction): Promise<GeneratedReceipt> {
    try {
      console.log('🎨 Generating HTML receipt for transaction...');
      
      // Generate receipt data
      const receiptData = this.generateReceiptData(transaction);
      
      // Generate HTML
      const htmlContent = this.generateReceiptHTML(receiptData);
      
      // Convert HTML to image using a web service or WebView
      const receiptImageUrl = await this.convertHTMLToImage(htmlContent);
      
      console.log('✅ HTML receipt generated successfully');
      return {
        receiptImageUrl,
        receiptData
      };
    } catch (error) {
      console.error('❌ Error generating HTML receipt:', error);
      throw error;
    }
  }

  /**
   * Convert HTML to image (this would use WebView in React Native)
   */
  private async convertHTMLToImage(htmlContent: string): Promise<string> {
    try {
      const serverUrl = process.env.HTML_TO_IMAGE_SERVER_URL || 'http://localhost:3001';
      
      console.log('🎨 Converting HTML to image via server...');
      
      const response = await fetch(`${serverUrl}/convert-html-to-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html: htmlContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Server error: ${errorData.message || response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success || !result.imageUrl) {
        throw new Error('Invalid response from HTML to image server');
      }

      console.log('✅ HTML converted to image successfully');
      return result.imageUrl;
      
    } catch (error) {
      console.error('❌ Error converting HTML to image:', error);
      
      // Fallback: return a placeholder image
      console.log('⚠️ Using placeholder image as fallback');
      return this.getPlaceholderImage();
    }
  }

  private getPlaceholderImage(): string {
    // Simple 1x1 transparent PNG as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  }
}

export default HTMLReceiptService;
