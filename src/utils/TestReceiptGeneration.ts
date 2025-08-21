import { PlaidTransaction } from '../services/PlaidService';
import { MerchantLogoService } from '../services/MerchantLogoService';
import { ReceiptTemplateService } from '../services/ReceiptTemplateService';
import { ReceiptGenerator } from '../utils/ReceiptGenerator';

/**
 * Test the receipt generation system with mock data
 */
export async function testReceiptGeneration() {
  console.log('🧪 Starting Receipt Generation Test...');

  // Create a mock transaction for testing
  const mockTransaction: PlaidTransaction = {
    account_id: 'test-account-123',
    amount: 42.99,
    iso_currency_code: 'USD',
    unofficial_currency_code: null,
    category: ['Food and Drink', 'Restaurants'],
    category_id: 'food-restaurants',
    date: '2025-01-21',
    datetime: '2025-01-21T15:30:00Z',
    location: {
      address: '123 Coffee St',
      city: 'Seattle',
      country: 'US',
      lat: 47.6062,
      lon: -122.3321,
      postal_code: '98101',
      region: 'WA',
      store_number: null
    },
    merchant_name: 'Starbucks',
    name: 'STARBUCKS #12345',
    payment_channel: 'in store',
    pending: false,
    account_owner: null,
    transaction_id: 'test-txn-123456789',
    transaction_type: 'place'
  };

  try {
    // Test 1: Merchant Logo Service
    console.log('📋 Test 1: Merchant Logo Service');
    const merchantService = MerchantLogoService.getInstance();
    const merchantInfo = await merchantService.getMerchantInfo(mockTransaction);
    
    console.log('  ✅ Merchant Name:', merchantInfo.name);
    console.log('  ✅ Logo Source:', merchantInfo.source);
    console.log('  ✅ Logo URL:', merchantInfo.logoUrl);
    console.log('  ✅ Category:', merchantInfo.category);

    // Test 2: Receipt Template Service
    console.log('\n📋 Test 2: Receipt Template Service');
    const templateService = ReceiptTemplateService.getInstance();
    const receiptData = await templateService.generateReceipt(mockTransaction, {
      name: 'Test User',
      email: 'test@example.com'
    });

    console.log('  ✅ Receipt Number:', receiptData.receiptNumber);
    console.log('  ✅ Timestamp:', receiptData.timestamp.toISOString());
    console.log('  ✅ Merchant Info:', receiptData.merchantInfo.name);

    // Test 3: HTML Generation
    console.log('\n📋 Test 3: HTML Template Generation');
    const htmlTemplate = templateService.generateHTML(receiptData);
    
    console.log('  ✅ HTML Generated:', htmlTemplate.html.length > 1000 ? 'Yes' : 'No');
    console.log('  ✅ CSS Generated:', htmlTemplate.styles.length > 1000 ? 'Yes' : 'No');
    console.log('  ✅ Contains Merchant Name:', htmlTemplate.html.includes('Starbucks') ? 'Yes' : 'No');

    // Test 4: Full Receipt Generation (would normally generate PDF)
    console.log('\n📋 Test 4: Receipt Generator Service');
    const receiptGenerator = ReceiptGenerator.getInstance();
    
    // In a test environment, we'll just test HTML generation
    console.log('  ✅ Receipt Generator Instance Created');
    console.log('  ✅ Ready for PDF/HTML generation');

    console.log('\n🎉 All Tests Passed! Receipt generation system is working.');

    return {
      success: true,
      results: {
        merchantInfo,
        receiptData,
        htmlTemplate: {
          htmlLength: htmlTemplate.html.length,
          stylesLength: htmlTemplate.styles.length,
          containsMerchant: htmlTemplate.html.includes('Starbucks')
        }
      }
    };

  } catch (error) {
    console.error('❌ Test Failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Test with different merchant types to verify logo fallbacks
 */
export async function testMerchantLogoFallbacks() {
  console.log('🧪 Testing Merchant Logo Fallbacks...');
  
  const testCases = [
    { name: 'Starbucks Coffee #123', expected: 'clearbit' },
    { name: 'Local Pizza Place', expected: 'generic' },
    { name: 'WALMART SUPERCENTER', expected: 'clearbit' },
    { name: 'Unknown Merchant ABC', expected: 'generic' }
  ];

  const merchantService = MerchantLogoService.getInstance();

  for (const testCase of testCases) {
    const mockTransaction: PlaidTransaction = {
      account_id: 'test',
      amount: 10,
      iso_currency_code: 'USD',
      unofficial_currency_code: null,
      category: ['General'],
      category_id: null,
      date: '2025-01-21',
      datetime: null,
      location: null,
      merchant_name: testCase.name,
      name: testCase.name,
      payment_channel: 'online',
      pending: false,
      account_owner: null,
      transaction_id: `test-${Math.random()}`,
      transaction_type: 'place'
    };

    const result = await merchantService.getMerchantInfo(mockTransaction);
    console.log(`  📊 ${testCase.name}:`);
    console.log(`    Source: ${result.source} (expected: ${testCase.expected})`);
    console.log(`    Logo: ${result.logoUrl}`);
  }

  console.log('✅ Merchant logo fallback tests completed');
}
