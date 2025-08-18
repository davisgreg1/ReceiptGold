import { PlaidTransaction } from './PlaidService';
const util = require('util');

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

export class OpenAIReceiptService {
  private static instance: OpenAIReceiptService;
  private apiKey: string;

  private constructor() {
    this.apiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY || '';
  }

  public static getInstance(): OpenAIReceiptService {
    if (!OpenAIReceiptService.instance) {
      OpenAIReceiptService.instance = new OpenAIReceiptService();
    }
    return OpenAIReceiptService.instance;
  }

  /**
   * Generate a receipt image from a Plaid transaction
   */
  public async generateReceiptFromTransaction(transaction: PlaidTransaction): Promise<GeneratedReceipt> {
    try {
      // First, generate receipt data using GPT
      const receiptData = await this.generateReceiptData(transaction);
      
      // Then, create receipt image using OpenAI DALL-E
      const receiptImageUrl = await this.generateReceiptImage(receiptData);

      return {
        receiptImageUrl,
        receiptData
      };
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  }

  /**
   * Generate structured receipt data from transaction
   */
  private async generateReceiptData(transaction: PlaidTransaction): Promise<GeneratedReceipt['receiptData']> {
    try {
      const prompt = `
Based on this transaction data, generate realistic receipt information:

Transaction Details:
- Merchant: ${transaction.merchant_name || transaction.name}
- Amount: $${transaction.amount}
- Date: ${transaction.date}
- Category: ${transaction.category?.join(', ')}
- Location: ${transaction.location?.city}, ${transaction.location?.region}

Generate a JSON response with realistic receipt data including:
- businessName (use merchant name or create realistic one)
- address (use location or generate realistic address)
- date and time
- 1-3 items that would total to the transaction amount
- subtotal, tax (realistic %), and total
- paymentMethod (based on transaction type)
- transactionId

Make the items and details realistic for the merchant type and amount.
`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a receipt generator. Return only valid JSON with realistic receipt data.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const receiptDataText = data.choices[0].message.content;
      console.log('🔍 OpenAI raw response:', receiptDataText);
      
      // Parse the JSON response
      let receiptData;
      try {
        receiptData = JSON.parse(receiptDataText);
        console.log('🔍 Parsed receipt data:', JSON.stringify(receiptData, null, 2));
      } catch (parseError) {
        console.error('❌ Failed to parse OpenAI JSON response:', parseError);
        console.log('Raw response text:', receiptDataText);
        throw new Error('Failed to parse OpenAI response as JSON');
      }
      
      // Validate that the parsed data has the expected structure
      if (!receiptData.items || !Array.isArray(receiptData.items)) {
        console.warn('⚠️ OpenAI response missing items array, falling back to mock data');
        return this.generateMockReceiptData(transaction);
      }
      
      // console.log(util.inspect(receiptData, { depth: null, colors: true }));
      console.log('✅ Generated receipt data with OpenAI');
      return receiptData;
    } catch (error) {
      console.error('❌ Error generating receipt data:', error);
      // Fallback to mock data if OpenAI fails
      return this.generateMockReceiptData(transaction);
    }
  }

  /**
   * Fallback method to generate mock receipt data
   */
  private generateMockReceiptData(transaction: PlaidTransaction): GeneratedReceipt['receiptData'] {
    return {
      businessName: transaction.merchant_name || transaction.name,
      address: transaction.location ? 
        `${transaction.location.address || '123 Main St'}, ${transaction.location.city}, ${transaction.location.region} ${transaction.location.postal_code}` :
        '123 Main St, San Francisco, CA 94102',
      date: transaction.date,
      time: transaction.datetime ? 
        new Date(transaction.datetime).toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit',
          hour12: true 
        }) : 
        '12:30 PM',
      items: this.generateMockItems(transaction),
      subtotal: Math.round((transaction.amount * 0.92) * 100) / 100,
      tax: Math.round((transaction.amount * 0.08) * 100) / 100,
      total: transaction.amount,
      paymentMethod: 'Credit Card',
      transactionId: transaction.transaction_id,
    };
  }

  /**
   * Generate mock items based on transaction category and amount
   */
  private generateMockItems(transaction: PlaidTransaction): Array<{ description: string; amount: number }> {
    const categories = transaction.category || [];
    const totalAmount = transaction.amount;
    
    // Generate items based on category
    if (categories.some(cat => cat.toLowerCase().includes('restaurant') || cat.toLowerCase().includes('food'))) {
      if (totalAmount < 15) {
        return [{ description: 'Coffee & Pastry', amount: totalAmount }];
      } else if (totalAmount < 30) {
        return [
          { description: 'Sandwich', amount: Math.round((totalAmount * 0.7) * 100) / 100 },
          { description: 'Drink', amount: Math.round((totalAmount * 0.3) * 100) / 100 },
        ];
      } else {
        return [
          { description: 'Main Course', amount: Math.round((totalAmount * 0.6) * 100) / 100 },
          { description: 'Appetizer', amount: Math.round((totalAmount * 0.25) * 100) / 100 },
          { description: 'Beverage', amount: Math.round((totalAmount * 0.15) * 100) / 100 },
        ];
      }
    } else if (categories.some(cat => cat.toLowerCase().includes('grocery') || cat.toLowerCase().includes('supermarket'))) {
      return [
        { description: 'Groceries', amount: Math.round((totalAmount * 0.8) * 100) / 100 },
        { description: 'Produce', amount: Math.round((totalAmount * 0.2) * 100) / 100 },
      ];
    } else if (categories.some(cat => cat.toLowerCase().includes('coffee'))) {
      return [
        { description: 'Coffee', amount: Math.round((totalAmount * 0.7) * 100) / 100 },
        { description: 'Tip', amount: Math.round((totalAmount * 0.3) * 100) / 100 },
      ];
    } else {
      // Generic items
      return [{ description: transaction.name, amount: totalAmount }];
    }
  }

  /**
   * Generate a receipt image using OpenAI DALL-E
   */
  private async generateReceiptImage(receiptData: GeneratedReceipt['receiptData']): Promise<string> {
    try {
      console.log('🎨 Generating receipt image with OpenAI DALL-E...');
      
      const itemsList = Array.isArray(receiptData.items)
        ? receiptData.items.map(item => {
            const amount = typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00';
            return `${item.description}: $${amount}`;
          }).join(', ')
        : '';

      const subtotal = typeof receiptData.subtotal === 'number' ? receiptData.subtotal.toFixed(2) : '0.00';
      const tax = typeof receiptData.tax === 'number' ? receiptData.tax.toFixed(2) : '0.00';
      const total = typeof receiptData.total === 'number' ? receiptData.total.toFixed(2) : '0.00';
      
      // Enhanced prompt for better receipt generation
      const prompt = `Create a paper mock receipt image with the following exact details:

BUSINESS: ${receiptData.businessName}
ADDRESS: ${receiptData.address}
DATE: ${receiptData.date}
TIME: ${receiptData.time}

ITEMS PURCHASED:
${receiptData.items.map(item => `• ${item.description} - $${(typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00')}`).join('\n')}

SUBTOTAL: $${subtotal}
TAX: $${tax}
TOTAL: $${total}
PAYMENT: ${receiptData.paymentMethod}
TRANSACTION ID: ${receiptData.transactionId}

Style requirements:
- White paper receipt background with slight texture
- Black thermal printer text style
- Professional retail receipt layout
- Clear, legible fonts
- Proper spacing and alignment
- Authentic receipt paper proportions (tall and narrow)
- All text must be clearly readable
- No blurry or distorted text
- Clean, professional appearance`;
      console.log("🚀 ~ OpenAIReceiptService ~ generateReceiptImage ~ prompt:", prompt)

      console.log('📝 Sending request to OpenAI DALL-E 3...');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: prompt,
          n: 1,
          size: '1024x1792', // Taller format for receipt
          quality: 'hd', // Higher quality
          style: 'natural', // More realistic style
        }),
      });

      console.log('📡 OpenAI API Response status:', response.status);
      console.log('📡 OpenAI API Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ OpenAI API Response received (full):', JSON.stringify(data, null, 2));
      
      // Validate the response structure
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        console.error('❌ Invalid OpenAI response structure:', data);
        throw new Error('Invalid response from OpenAI API - missing data array');
      }
      
      if (!data.data[0].url) {
        console.error('❌ Missing URL in OpenAI response:', data.data[0]);
        throw new Error('Invalid response from OpenAI API - missing image URL');
      }
      
      console.log('✅ Generated receipt image with OpenAI DALL-E 3');
      console.log('🔗 Image URL received:', data.data[0].url.substring(0, 50) + '...');
      
      return data.data[0].url;
    } catch (error) {
      console.error('❌ Error generating receipt image with OpenAI:', error);
      
      // Calculate values for fallback
      const subtotalFallback = typeof receiptData.subtotal === 'number' ? receiptData.subtotal.toFixed(2) : '0.00';
      const taxFallback = typeof receiptData.tax === 'number' ? receiptData.tax.toFixed(2) : '0.00';
      const totalFallback = typeof receiptData.total === 'number' ? receiptData.total.toFixed(2) : '0.00';
      
      // Enhanced fallback with receipt-style placeholder
      const placeholderImageUrl = `data:image/svg+xml;base64,${btoa(`
        <svg width="400" height="600" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="600" fill="#ffffff" stroke="#cccccc"/>
          <text x="200" y="50" text-anchor="middle" font-family="monospace" font-size="16" font-weight="bold">${receiptData.businessName}</text>
          <text x="200" y="80" text-anchor="middle" font-family="monospace" font-size="12">${receiptData.address}</text>
          <line x1="50" y1="100" x2="350" y2="100" stroke="#000000"/>
          <text x="200" y="130" text-anchor="middle" font-family="monospace" font-size="14">${receiptData.date} ${receiptData.time}</text>
          <text x="50" y="180" font-family="monospace" font-size="12">ITEMS:</text>
          ${receiptData.items.map((item, i) => `
            <text x="50" y="${200 + (i * 20)}" font-family="monospace" font-size="11">${item.description}</text>
            <text x="350" y="${200 + (i * 20)}" text-anchor="end" font-family="monospace" font-size="11">$${(typeof item.amount === 'number' ? item.amount.toFixed(2) : '0.00')}</text>
          `).join('')}
          <line x1="50" y1="${220 + (receiptData.items.length * 20)}" x2="350" y2="${220 + (receiptData.items.length * 20)}" stroke="#000000"/>
          <text x="50" y="${250 + (receiptData.items.length * 20)}" font-family="monospace" font-size="12">SUBTOTAL: $${subtotalFallback}</text>
          <text x="50" y="${270 + (receiptData.items.length * 20)}" font-family="monospace" font-size="12">TAX: $${taxFallback}</text>
          <text x="50" y="${290 + (receiptData.items.length * 20)}" font-family="monospace" font-size="14" font-weight="bold">TOTAL: $${totalFallback}</text>
          <text x="200" y="${330 + (receiptData.items.length * 20)}" text-anchor="middle" font-family="monospace" font-size="11">Payment: ${receiptData.paymentMethod}</text>
          <text x="200" y="${350 + (receiptData.items.length * 20)}" text-anchor="middle" font-family="monospace" font-size="10">Transaction: ${receiptData.transactionId}</text>
        </svg>
      `)}`;
      
      console.log('🔄 Using enhanced SVG fallback receipt');
      return placeholderImageUrl;
    }
  }

  /**
   * Download and convert image to base64
   */
  public async downloadAndConvertImage(imageUrl: string): Promise<string> {
    try {
      console.log('Downloading and converting image to base64:', imageUrl);
      
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }
      
      // Convert to blob then to base64
      const blob = await response.blob();
      
      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result as string;
          console.log('✅ Image converted to base64');
          resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('❌ Error downloading and converting image:', error);
      // Return the URL as-is if conversion fails
      return imageUrl;
    }
  }
}
