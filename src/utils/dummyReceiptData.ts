import Constants from 'expo-constants';

export const USE_DUMMY_DATA = Constants.expoConfig?.extra?.USE_DUMMY_DATA === 'true';

export interface DummyReceiptData {
  vendor: string;
  amount: number;
  currency: string;
  date: Date;
  description: string;
  category: string;
  tags: string[];
  extractedData: {
    vendor: string;
    amount: number;
    tax: number;
    date: string;
    confidence: number;
    items: {
      description: string;
      amount: number;
      quantity: number;
    }[];
  };
  tax: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
  };
  status: 'processed';
  processingErrors: string[];
}

const dummyVendors = [
  'Starbucks Coffee',
  'McDonald\'s',
  'Target',
  'Home Depot',
  'Walmart',
  'CVS Pharmacy',
  'Shell Gas Station',
  'Amazon Fresh',
  'Uber Eats',
  'Best Buy',
  'Office Depot',
  'Whole Foods Market',
  'Chipotle Mexican Grill',
  'Apple Store',
  'FedEx Office',
];

const dummyCategories = [
  'food_beverage',
  'office_supplies',
  'transportation',
  'healthcare',
  'business_expense',
  'utilities',
  'entertainment',
  'retail',
  'fuel',
  'technology',
];

const dummyItems = [
  { description: 'Coffee', basePrice: 4.50 },
  { description: 'Sandwich', basePrice: 8.99 },
  { description: 'Office Supplies', basePrice: 15.99 },
  { description: 'Gas', basePrice: 45.20 },
  { description: 'Groceries', basePrice: 67.43 },
  { description: 'Lunch', basePrice: 12.75 },
  { description: 'Printer Paper', basePrice: 19.99 },
  { description: 'USB Cable', basePrice: 24.99 },
  { description: 'Parking', basePrice: 8.00 },
  { description: 'Software License', basePrice: 99.99 },
];

const getRandomElement = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomAmount = (min: number = 5, max: number = 150): number => {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
};

const getRandomDate = (): Date => {
  const now = new Date();
  const pastDays = Math.floor(Math.random() * 30); // Last 30 days
  const date = new Date(now);
  date.setDate(date.getDate() - pastDays);
  date.setHours(
    Math.floor(Math.random() * 24), 
    Math.floor(Math.random() * 60), 
    Math.floor(Math.random() * 60)
  );
  return date;
};

export const generateDummyReceiptData = (): DummyReceiptData => {
  const vendor = getRandomElement(dummyVendors);
  const category = getRandomElement(dummyCategories);
  const amount = getRandomAmount();
  const tax = Math.round(amount * 0.08 * 100) / 100; // 8% tax
  const date = getRandomDate();
  
  // Generate 1-3 items
  const itemCount = Math.floor(Math.random() * 3) + 1;
  const items = Array.from({ length: itemCount }, () => {
    const item = getRandomElement(dummyItems);
    const quantity = Math.floor(Math.random() * 3) + 1;
    const itemAmount = Math.round(item.basePrice * quantity * 100) / 100;
    
    return {
      description: item.description,
      amount: itemAmount,
      quantity,
    };
  });

  return {
    vendor,
    amount,
    currency: 'USD',
    date,
    description: `Receipt from ${vendor}`,
    category,
    tags: ['dummy-data', 'auto-generated'],
    extractedData: {
      vendor,
      amount,
      tax,
      date: date.toISOString(),
      confidence: 0.95, // High confidence for dummy data
      items,
    },
    tax: {
      deductible: true,
      deductionPercentage: 100,
      taxYear: new Date().getFullYear(),
      category,
    },
    status: 'processed',
    processingErrors: [],
  };
};

export const logDummyDataStatus = () => {
  if (USE_DUMMY_DATA) {
    console.log('🎭 DUMMY DATA MODE ENABLED - Using generated receipt data instead of OCR');
  } else {
    console.log('🔍 OCR MODE ENABLED - Using real OCR analysis');
  }
};
