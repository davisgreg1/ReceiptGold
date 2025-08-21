import { FirebaseReceiptIntegration, GeneratedReceiptData } from '../services/FirebaseReceiptIntegration';
import { PlaidTransaction } from '../services/PlaidService';
import { MerchantInfo } from '../services/MerchantLogoService';

/**
 * Test the Firestore integration without Buffer dependency
 */
export async function testFirestoreIntegration() {
  console.log('🧪 Testing Firestore Receipt Integration...');

  const mockTransaction: PlaidTransaction = {
    account_id: 'test-account',
    amount: 25.99,
    iso_currency_code: 'USD',
    unofficial_currency_code: null,
    category: ['Food and Drink', 'Coffee Shop'],
    category_id: 'food-coffee',
    date: '2025-01-21',
    datetime: '2025-01-21T10:30:00Z',
    location: {
      address: '123 Main St',
      city: 'San Francisco',
      country: 'US',
      lat: 37.7749,
      lon: -122.4194,
      postal_code: '94102',
      region: 'CA',
      store_number: null
    },
    merchant_name: 'Blue Bottle Coffee',
    name: 'BLUE BOTTLE COFFEE',
    payment_channel: 'in store',
    pending: false,
    account_owner: null,
    transaction_id: 'test-txn-firestore-123',
    transaction_type: 'place'
  };

  const mockMerchantInfo: MerchantInfo = {
    name: 'Blue Bottle Coffee',
    logoUrl: 'https://logo.clearbit.com/bluebottlecoffee.com',
    category: 'Food and Drink',
    source: 'clearbit'
  };

  const mockGeneratedReceiptData: GeneratedReceiptData = {
    transaction: mockTransaction,
    merchantInfo: mockMerchantInfo,
    receiptNumber: 'RG-20250121-TEST123',
    pdfFilePath: '/path/to/test-receipt.pdf',
    htmlContent: '<html><body><h1>Test Receipt</h1></body></html>'
  };

  try {
    const integration = FirebaseReceiptIntegration.getInstance();
    
    console.log('✅ FirebaseReceiptIntegration instance created');
    console.log('✅ Mock data prepared');
    
    // Test the thumbnail creation (this was causing the Buffer error)
    console.log('🖼️  Testing thumbnail generation...');
    const thumbnailUrl = (integration as any).createReceiptThumbnailPlaceholder(mockGeneratedReceiptData);
    console.log('✅ Thumbnail URL generated:', thumbnailUrl.substring(0, 50) + '...');
    
    console.log('🎉 Firestore integration test passed! No Buffer errors.');
    
    return {
      success: true,
      thumbnailUrl,
      receiptData: mockGeneratedReceiptData
    };

  } catch (error) {
    console.error('❌ Firestore integration test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test thumbnail generation specifically
 */
export function testThumbnailGeneration() {
  console.log('🖼️  Testing thumbnail generation without Buffer...');
  
  const testData = {
    merchantInfo: { name: 'Test Merchant' },
    transaction: { amount: 42.99, date: '2025-01-21' },
    receiptNumber: 'RG-TEST-123'
  } as GeneratedReceiptData;

  try {
    const integration = FirebaseReceiptIntegration.getInstance();
    const thumbnail = (integration as any).createReceiptThumbnailPlaceholder(testData);
    
    console.log('✅ Thumbnail generated successfully:', thumbnail);
    console.log('✅ No Buffer dependency issues');
    
    return { success: true, thumbnail };
  } catch (error) {
    console.error('❌ Thumbnail generation failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
