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
      
      // Then, create receipt image using DALL-E
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
      
      // Parse the JSON response
      const receiptData = JSON.parse(receiptDataText);
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
   * Generate a receipt image using DALL-E
   */
  private async generateReceiptImage(receiptData: GeneratedReceipt['receiptData']): Promise<string> {
    try {
      const itemsList = receiptData.items.map(item =>
        `${item.description}: $${item.amount.toFixed(2)}`
      ).join(', ');

      const prompt = `
Create a realistic receipt image with the following details:

Business: ${receiptData.businessName}
Address: ${receiptData.address}
Date: ${receiptData.date} at ${receiptData.time}
Items: ${itemsList}
Subtotal: $${receiptData.subtotal.toFixed(2)}
Tax: $${receiptData.tax.toFixed(2)}
Total: $${receiptData.total.toFixed(2)}
Payment: ${receiptData.paymentMethod}

Make it look like a clean, professional printed receipt with:
- White background
- Clear black text
- Proper receipt formatting
- Business header
- Itemized list
- Tax calculation
- Total clearly shown
- Transaction ID at bottom
`;

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
          size: '1024x1024',
          quality: 'standard',
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Generated receipt image with DALL-E');
      return data.data[0].url;
    } catch (error) {
      console.error('❌ Error generating receipt image:', error);
      // Fallback to placeholder image
      const placeholderImageUrl = 'https://via.placeholder.com/400x600/ffffff/000000?text=Receipt+Image';
      console.log('Using placeholder image as fallback');
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
