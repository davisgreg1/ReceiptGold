import ReceiptServiceFactory from './src/services/ReceiptServiceFactory';
import { PlaidTransaction } from './src/services/PlaidService';

/**
 * Test script to verify receipt service switching functionality
 * Run with: node test-receipt-services.js
 */

// Mock transaction for testing
const mockTransaction: PlaidTransaction = {
  transaction_id: 'test_123',
  account_id: 'account_123',
  amount: 25.99,
  date: '2025-08-17',
  datetime: null,
  name: 'Test Coffee Shop',
  merchant_name: 'Test Coffee Shop',
  category: ['Food and Drink', 'Restaurants', 'Coffee Shop'],
  account_owner: null,
  category_id: '13005043',
  unofficial_currency_code: null,
  iso_currency_code: 'USD',
  payment_channel: 'in store',
  location: {
    address: '123 Main St',
    city: 'San Francisco',
    region: 'CA',
    postal_code: '94102',
    country: 'US',
    lat: 37.7749,
    lon: -122.4194,
    store_number: null
  },
  pending: false,
  transaction_type: 'place'
};

async function testReceiptServices() {
  console.log('🧪 Testing Receipt Service Factory...\n');

  // Get current service info
  const serviceInfo = ReceiptServiceFactory.getServiceInfo();
  console.log('📊 Current Service Configuration:');
  console.log(`   Active Service: ${serviceInfo.currentService}`);
  console.log(`   AI Available: ${serviceInfo.aiServiceAvailable}`);
  console.log(`   HTML Available: ${serviceInfo.htmlServiceAvailable}`);
  console.log(`   Recommendation: ${serviceInfo.recommendation}\n`);

  try {
    // Test current service
    console.log(`🔄 Testing ${serviceInfo.currentService.toUpperCase()} service...`);
    const currentService = ReceiptServiceFactory.getReceiptService();
    const receipt = await currentService.generateReceiptFromTransaction(mockTransaction);
    
    console.log('✅ Receipt generated successfully!');
    console.log(`   Business: ${receipt.receiptData.businessName}`);
    console.log(`   Total: $${receipt.receiptData.total}`);
    console.log(`   Items: ${receipt.receiptData.items.length}`);
    console.log(`   Image URL length: ${receipt.receiptImageUrl.length} chars`);
    console.log(`   Image type: ${receipt.receiptImageUrl.startsWith('data:image') ? 'Base64' : 'URL'}\n`);

    // Test force switching (if both services available)
    if (serviceInfo.aiServiceAvailable && serviceInfo.htmlServiceAvailable) {
      console.log('🔄 Testing service switching...');
      
      // Test AI service
      console.log('   Testing AI service...');
      const aiService = ReceiptServiceFactory.forceServiceType('ai');
      const aiReceipt = await aiService.generateReceiptFromTransaction(mockTransaction);
      console.log(`   ✅ AI service works (${aiReceipt.receiptImageUrl.length} chars)`);
      
      // Test HTML service  
      console.log('   Testing HTML service...');
      const htmlService = ReceiptServiceFactory.forceServiceType('html');
      const htmlReceipt = await htmlService.generateReceiptFromTransaction(mockTransaction);
      console.log(`   ✅ HTML service works (${htmlReceipt.receiptImageUrl.length} chars)`);
      
      console.log('\n🎉 Both services working correctly!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n💡 Troubleshooting:');
    if (serviceInfo.currentService === 'ai' && !serviceInfo.aiServiceAvailable) {
      console.error('   - Set EXPO_PUBLIC_OPENAI_API_KEY in your .env file');
    }
    if (serviceInfo.currentService === 'html') {
      console.error('   - Make sure HTML-to-image server is running on port 3001');
      console.error('   - Or set RECEIPT_SERVICE_TYPE=ai to use AI service instead');
    }
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  testReceiptServices();
}

export { testReceiptServices };
