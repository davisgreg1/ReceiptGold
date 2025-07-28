# Firebase Schema for ReceiptGold Freemium Model

## Collections Structure

### 1. **users** Collection
```javascript
{
  userId: "firebase_auth_uid",
  email: "user@example.com",
  displayName: "John Doe",
  createdAt: "2025-01-15T10:30:00Z",
  lastLoginAt: "2025-01-20T14:22:00Z",
  
  // Profile Information
  profile: {
    firstName: "John",
    lastName: "Doe",
    businessName: "John's LLC",
    businessType: "LLC", // LLC, Corporation, Sole Proprietorship, etc.
    taxId: "12-3456789", // EIN or SSN (encrypted)
    phone: "+1234567890",
    address: {
      street: "123 Main St",
      city: "Anytown",
      state: "CA",
      zipCode: "12345",
      country: "US"
    }
  },
  
  // App Settings
  settings: {
    theme: "light", // light, dark, auto
    notifications: {
      email: true,
      push: true,
      taxReminders: true,
      receiptReminders: true
    },
    defaultCurrency: "USD",
    taxYear: 2025
  }
}
```

### 2. **subscriptions** Collection
```javascript
{
  userId: "firebase_auth_uid",
  
  // Current Subscription
  currentTier: "starter", // free, starter, growth, professional
  status: "active", // active, canceled, expired, past_due
  
  // Billing Information
  billing: {
    customerId: "stripe_customer_id",
    subscriptionId: "stripe_subscription_id",
    priceId: "stripe_price_id",
    currentPeriodStart: "2025-01-15T00:00:00Z",
    currentPeriodEnd: "2025-02-15T00:00:00Z",
    cancelAtPeriodEnd: false,
    trialEnd: null
  },
  
  // Feature Limits (calculated based on tier)
  limits: {
    maxReceipts: -1, // -1 = unlimited, number = limit
    maxBusinesses: 1,
    apiCallsPerMonth: 0 // 0 = no API access
  },
  
  // Feature Access
  features: {
    advancedReporting: true,
    taxPreparation: true,
    accountingIntegrations: true,
    prioritySupport: true,
    multiBusinessManagement: false,
    whiteLabel: false,
    apiAccess: false,
    dedicatedManager: false
  },
  
  // Subscription History
  history: [
    {
      tier: "free",
      startDate: "2025-01-01T00:00:00Z",
      endDate: "2025-01-15T00:00:00Z",
      reason: "upgrade"
    }
  ],
  
  // Metadata
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-20T14:22:00Z"
}
```

### 3. **receipts** Collection
```javascript
{
  receiptId: "auto_generated_id",
  userId: "firebase_auth_uid",
  businessId: "business_id", // for multi-business users
  
  // Receipt Information
  vendor: "Amazon",
  amount: 129.99,
  currency: "USD",
  date: "2025-01-20T00:00:00Z",
  description: "Office supplies",
  
  // Categorization
  category: "office_supplies", // predefined categories
  subcategory: "software",
  tags: ["tax-deductible", "recurring"],
  
  // Receipt Images/Files
  images: [
    {
      url: "gs://receiptgold/receipts/user123/receipt456/image1.jpg",
      thumbnail: "gs://receiptgold/thumbnails/user123/receipt456/thumb1.jpg",
      size: 1024000, // bytes
      uploadedAt: "2025-01-20T10:30:00Z"
    }
  ],
  
  // OCR/Extraction Data
  extractedData: {
    vendor: "Amazon.com",
    amount: 129.99,
    tax: 10.40,
    date: "2025-01-20",
    confidence: 0.95,
    items: [
      {
        description: "Office Chair",
        amount: 119.59,
        quantity: 1
      }
    ]
  },
  
  // Tax Information
  tax: {
    deductible: true,
    deductionPercentage: 100,
    taxYear: 2025,
    category: "business_expense"
  },
  
  // Status
  status: "processed", // uploaded, processing, processed, error
  processingErrors: [],
  
  // Metadata
  createdAt: "2025-01-20T10:30:00Z",
  updatedAt: "2025-01-20T14:22:00Z"
}
```

### 4. **businesses** Collection (for Multi-Business Users)
```javascript
{
  businessId: "auto_generated_id",
  userId: "firebase_auth_uid",
  
  // Business Information
  name: "John's Consulting LLC",
  type: "LLC",
  taxId: "12-3456789",
  industry: "consulting",
  
  // Address
  address: {
    street: "456 Business Ave",
    city: "Commerce City",
    state: "CA",
    zipCode: "54321",
    country: "US"
  },
  
  // Settings
  settings: {
    defaultCurrency: "USD",
    taxYear: 2025,
    categories: ["custom_category_1", "custom_category_2"]
  },
  
  // Stats (calculated)
  stats: {
    totalReceipts: 45,
    totalAmount: 5430.22,
    lastReceiptDate: "2025-01-20T00:00:00Z"
  },
  
  // Metadata
  isActive: true,
  createdAt: "2025-01-15T10:30:00Z",
  updatedAt: "2025-01-20T14:22:00Z"
}
```

### 5. **reports** Collection
```javascript
{
  reportId: "auto_generated_id",
  userId: "firebase_auth_uid",
  businessId: "business_id",
  
  // Report Information
  type: "tax_summary", // tax_summary, expense_report, category_breakdown
  title: "Q4 2024 Tax Summary",
  period: {
    startDate: "2024-10-01T00:00:00Z",
    endDate: "2024-12-31T23:59:59Z"
  },
  
  // Report Data
  data: {
    totalExpenses: 12450.00,
    deductibleExpenses: 11200.00,
    categories: {
      "office_supplies": 2300.00,
      "travel": 4500.00,
      "meals": 1800.00
    },
    receiptCount: 78
  },
  
  // Generated Files
  files: [
    {
      type: "pdf",
      url: "gs://receiptgold/reports/user123/report456.pdf",
      size: 245000,
      generatedAt: "2025-01-20T15:30:00Z"
    }
  ],
  
  // Status
  status: "completed", // generating, completed, error
  
  // Metadata
  createdAt: "2025-01-20T15:00:00Z",
  updatedAt: "2025-01-20T15:30:00Z"
}
```

### 6. **categories** Collection (Master Categories)
```javascript
{
  categoryId: "office_supplies",
  name: "Office Supplies",
  description: "General office supplies and equipment",
  taxDeductible: true,
  icon: "📝",
  
  // Subcategories
  subcategories: [
    "software",
    "hardware",
    "stationery",
    "furniture"
  ],
  
  // Keywords for auto-categorization
  keywords: ["office", "supplies", "desk", "chair", "computer"],
  
  // Metadata
  isActive: true,
  sortOrder: 1
}
```

### 7. **usage** Collection (for Tracking Free Tier Limits)
```javascript
{
  userId: "firebase_auth_uid",
  month: "2025-01", // YYYY-MM format
  
  // Usage Statistics
  receiptsUploaded: 8,
  apiCalls: 0,
  reportsGenerated: 2,
  
  // Limits for current tier
  limits: {
    maxReceipts: 10,
    maxApiCalls: 0,
    maxReports: 1
  },
  
  // Reset date for limits
  resetDate: "2025-02-01T00:00:00Z",
  
  // Metadata
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-20T14:22:00Z"
}
```

## Security Rules Example

```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Subscription data - read only for users, write only via Cloud Functions
    match /subscriptions/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only Cloud Functions can write
    }
    
    // Receipts - users can only access their own receipts
    match /receipts/{receiptId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    // Usage tracking - read only for users
    match /usage/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only Cloud Functions can write
    }
    
    // Categories are public read
    match /categories/{categoryId} {
      allow read: if true;
      allow write: if false; // Admin only
    }
  }
}
```

## Cloud Functions for Business Logic

### 1. **Subscription Management**
```javascript
// Update user limits when subscription changes
exports.onSubscriptionChange = functions.firestore
  .document('subscriptions/{userId}')
  .onWrite(async (change, context) => {
    // Update user limits based on new subscription tier
  });
```

### 2. **Usage Tracking**
```javascript
// Track receipt uploads and enforce limits
exports.onReceiptCreate = functions.firestore
  .document('receipts/{receiptId}')
  .onCreate(async (snap, context) => {
    // Check if user has reached their receipt limit
    // Update usage statistics
  });
```

### 3. **Billing Integration**
```javascript
// Handle Stripe webhooks
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  // Handle subscription.created, subscription.updated, etc.
});
```

This schema supports:
- ✅ Freemium model with usage tracking
- ✅ Multiple subscription tiers
- ✅ Receipt storage and categorization
- ✅ Multi-business management
- ✅ Tax reporting
- ✅ Usage limits enforcement
- ✅ Billing integration ready
