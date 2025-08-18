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
   * Generate receipt from transaction using native approach
   */
  public async generateReceiptFromTransaction(transaction: PlaidTransaction): Promise<GeneratedReceipt> {
    try {
      console.log('🎨 Generating native receipt for transaction (no external service)...');
      
      // Generate receipt data
      const receiptData = this.generateReceiptData(transaction);
      
      // Generate receipt image natively (bypassing HTML conversion)
      const receiptImageUrl = await this.generateNativeReceiptImageFromData(receiptData);
      
      console.log('✅ Native receipt generated successfully');
      return {
        receiptImageUrl,
        receiptData
      };
    } catch (error) {
      console.error('❌ Error generating native receipt:', error);
      throw error;
    }
  }

  /**
   * Generate receipt image directly from structured data (bypassing HTML)
   */
  private async generateNativeReceiptImageFromData(receiptData: any): Promise<string> {
    console.log('🎨 Creating native receipt image from structured data...');
    
    // Create SVG receipt directly from data
    const receiptSVG = this.createReceiptSVG(receiptData);
    console.log('🔍 Generated SVG length:', receiptSVG.length);
    
    // Convert SVG to base64 data URL
    const base64Image = `data:image/svg+xml;base64,${btoa(receiptSVG)}`;
    console.log('🔍 Base64 data URL created, length:', base64Image.length);
    
    // For React Native compatibility, also try a simpler approach
    // React Native Image component doesn't always handle complex SVG data URLs well
    // So we also show a text-based receipt as backup
    console.log('ℹ️ Text-based receipt fallback available if SVG doesn\'t display');
    
    console.log('✅ Native receipt image created');
    return base64Image;
  }

  /**
   * Convert HTML to image using React Native Canvas or fallback to base64 data URL
   */
  private async convertHTMLToImage(htmlContent: string): Promise<string> {
    try {
      // For React Native, we'll create a simple receipt layout directly
      // instead of converting HTML. This is much more efficient.
      console.log('🎨 Generating receipt image natively (no external service)...');
      
      // Create a simple base64 data URL for a receipt image
      // This is a placeholder - in a real app, you might use react-native-svg 
      // or react-native-canvas to create the actual image
      const receiptImageBase64 = await this.generateNativeReceiptImage(htmlContent);
      
      console.log('✅ Native receipt image generated successfully');
      return receiptImageBase64;
      
    } catch (error) {
      console.error('❌ Error generating native receipt image:', error);
      if (error instanceof Error) {
        console.error('❌ Error type:', error.constructor.name);
        console.error('❌ Error message:', error.message);
      }
      
      // Fallback: return a placeholder image
      console.log('⚠️ Using placeholder image as fallback');
      return this.getPlaceholderImage();
    }
  }

  /**
   * Generate receipt image natively without external services
   */
  private async generateNativeReceiptImage(htmlContent: string): Promise<string> {
    // Parse the receipt data from the HTML or use structured data
    // For now, we'll create a simple text-based receipt representation
    
    console.log('🎨 Creating native receipt image...');
    
    // Extract receipt data (you could also pass structured data directly)
    const receiptData = this.parseReceiptDataFromHTML(htmlContent);
    
    // Create a simple SVG-based receipt (which can be converted to base64)
    const receiptSVG = this.createReceiptSVG(receiptData);
    
    // Convert SVG to base64 data URL
    const base64Image = `data:image/svg+xml;base64,${btoa(receiptSVG)}`;
    
    return base64Image;
  }

  /**
   * Parse receipt data from HTML content
   */
  private parseReceiptDataFromHTML(htmlContent: string): any {
    // Extract data from the generateReceiptData method's output
    // Look for patterns in the HTML to extract actual data
    try {
      // Try to extract business name
      const businessMatch = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const businessName = businessMatch ? businessMatch[1].trim() : 'Unknown Business';
      
      // Try to extract address
      const addressMatch = htmlContent.match(/<p[^>]*class=".*address.*"[^>]*>(.*?)<\/p>/i);
      const address = addressMatch ? addressMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      
      // Try to extract date
      const dateMatch = htmlContent.match(/Date:\s*([^<\n]+)/i);
      const date = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString();
      
      // Try to extract time
      const timeMatch = htmlContent.match(/Time:\s*([^<\n]+)/i);
      const time = timeMatch ? timeMatch[1].trim() : new Date().toLocaleTimeString();
      
      // Try to extract total
      const totalMatch = htmlContent.match(/Total:\s*\$?([\d,]+\.?\d*)/i);
      const total = totalMatch ? parseFloat(totalMatch[1].replace(/,/g, '')) : 0;
      
      return {
        businessName,
        address,
        date,
        time,
        items: [
          { description: 'Transaction Amount', amount: total }
        ],
        subtotal: total * 0.93, // Approximate subtotal
        tax: total * 0.07, // Approximate tax
        total
      };
    } catch (error) {
      console.warn('⚠️ Could not parse HTML data, using defaults');
      return {
        businessName: 'Receipt',
        address: '',
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        items: [
          { description: 'Transaction', amount: 0 }
        ],
        subtotal: 0,
        tax: 0,
        total: 0
      };
    }
  }

  /**
   * Create SVG receipt representation
   */
  private createReceiptSVG(receiptData: any): string {
    const width = 300;
    const height = 400;
    
    // Use actual receipt data
    const businessName = receiptData.businessName || 'Receipt';
    const address = receiptData.address || '';
    const date = receiptData.date || new Date().toLocaleDateString();
    const time = receiptData.time || new Date().toLocaleTimeString();
    const items = receiptData.items || [{ description: 'Transaction', amount: receiptData.total || 0 }];
    const subtotal = receiptData.subtotal || 0;
    const tax = receiptData.tax || 0;
    const total = receiptData.total || 0;
    
    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <style>
            .receipt-text { font-family: 'Courier New', monospace; font-size: 12px; fill: black; }
            .receipt-title { font-family: 'Courier New', monospace; font-size: 14px; fill: black; font-weight: bold; }
            .receipt-line { stroke: black; stroke-width: 1; }
          </style>
        </defs>
        
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="white" stroke="black" stroke-width="2"/>
        
        <!-- Header -->
        <text x="${width/2}" y="25" text-anchor="middle" class="receipt-title">${businessName}</text>
        ${address ? `<text x="${width/2}" y="40" text-anchor="middle" class="receipt-text">${address}</text>` : ''}
        
        <!-- Date/Time -->
        <text x="10" y="70" class="receipt-text">Date: ${date}</text>
        <text x="10" y="85" class="receipt-text">Time: ${time}</text>
        
        <!-- Line separator -->
        <line x1="10" y1="95" x2="${width-10}" y2="95" class="receipt-line"/>
        
        <!-- Items -->
        ${items.map((item: any, index: number) => {
          const y = 115 + (index * 15);
          return `
            <text x="10" y="${y}" class="receipt-text">${item.description}</text>
            <text x="${width-10}" y="${y}" text-anchor="end" class="receipt-text">$${(item.amount || 0).toFixed(2)}</text>
          `;
        }).join('')}
        
        <!-- Totals line separator -->
        <line x1="10" y1="${135 + (items.length * 15)}" x2="${width-10}" y2="${135 + (items.length * 15)}" class="receipt-line"/>
        
        <!-- Subtotal, Tax, Total -->
        ${subtotal > 0 ? `
        <text x="10" y="${155 + (items.length * 15)}" class="receipt-text">Subtotal:</text>
        <text x="${width-10}" y="${155 + (items.length * 15)}" text-anchor="end" class="receipt-text">$${subtotal.toFixed(2)}</text>
        
        <text x="10" y="${170 + (items.length * 15)}" class="receipt-text">Tax:</text>
        <text x="${width-10}" y="${170 + (items.length * 15)}" text-anchor="end" class="receipt-text">$${tax.toFixed(2)}</text>
        ` : ''}
        
        <text x="10" y="${190 + (items.length * 15)}" class="receipt-title">Total:</text>
        <text x="${width-10}" y="${190 + (items.length * 15)}" text-anchor="end" class="receipt-title">$${total.toFixed(2)}</text>
        
        <!-- Footer -->
        <text x="${width/2}" y="${height-30}" text-anchor="middle" class="receipt-text">Thank you for your business!</text>
        <text x="${width/2}" y="${height-15}" text-anchor="middle" class="receipt-text">Generated by ReceiptGold</text>
      </svg>
    `;
  }

  private getPlaceholderImage(): string {
    // Simple 1x1 transparent PNG as fallback
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  }
}

export default HTMLReceiptService;
