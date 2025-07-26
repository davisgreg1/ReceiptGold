# ReceiptGold Freemium Model - User Capabilities & Firebase Implementation

## What Users Can Do by Tier

### 🆓 **Free Tier Users**

#### ✅ **Core Features Available:**
1. **Receipt Management** (Limited)
   - Upload up to **10 receipts per month**
   - Basic receipt scanning with OCR
   - Manual receipt entry
   - View receipt list with basic details
   - Edit receipt information

2. **Basic Categorization**
   - Use predefined expense categories
   - Add basic tags
   - Mark receipts as tax-deductible

3. **Simple Reporting**
   - Current month expense summary
   - Basic category breakdown
   - Receipt count and total amounts
   - View individual receipt details

4. **Educational Content**
   - Tax tips and LLC guidance
   - Best practices for expense tracking
   - Category explanations

5. **Account Management**
   - User profile setup
   - Basic settings (theme, notifications)
   - Single business/entity management

#### ❌ **Limitations:**
- Maximum 10 receipts per month
- No advanced reporting (multi-month, trends)
- No tax preparation tools
- No accounting software integrations
- Basic email support only
- No API access
- No multi-business management

---

### 💰 **Starter Plan ($9/month)**

#### ✅ **Everything in Free PLUS:**
1. **Unlimited Receipt Storage**
   - No monthly limits on receipt uploads
   - Unlimited cloud storage
   - Batch upload capabilities

2. **Enhanced Features**
   - LLC-specific expense categories
   - Advanced compliance features
   - Email support with faster response

3. **Improved Reporting**
   - Full year reporting
   - Export to PDF/CSV
   - Monthly/quarterly summaries

#### Still Limited:
- No advanced analytics
- No tax preparation tools
- No integrations

---

### 📈 **Growth Plan ($19/month)**

#### ✅ **Everything in Starter PLUS:**
1. **Advanced Reporting & Analytics**
   - Multi-year trend analysis
   - Category-wise spending insights
   - Profit/loss tracking
   - Custom date range reports

2. **Tax Preparation Tools**
   - Tax-ready report generation
   - Deduction optimization suggestions
   - Schedule C preparation assistance
   - Tax year organization

3. **Integrations**
   - QuickBooks integration
   - Xero integration
   - Other accounting software connections
   - Bank transaction import

4. **Priority Support**
   - Faster response times
   - Phone support
   - Priority feature requests

5. **Advanced Features**
   - Quarterly tax reminders
   - Expense trend analysis
   - Mileage tracking
   - Receipt photo enhancement

---

### 💼 **Professional Plan ($39/month)**

#### ✅ **Everything in Growth PLUS:**
1. **Multi-Business Management**
   - Manage multiple LLCs/businesses
   - Separate books for each entity
   - Cross-business reporting
   - Entity switching interface

2. **Enterprise Features**
   - White-label options (custom branding)
   - API access for custom integrations
   - Webhook notifications
   - Custom compliance workflows

3. **Premium Support**
   - Dedicated account manager
   - Priority phone support
   - Custom training sessions
   - Feature customization requests

4. **Advanced Tools**
   - Bulk client management (for accountants)
   - Advanced tax optimization
   - Custom category creation
   - Advanced user permissions

---

## Firebase Schema Implementation

### **Data Flow & Usage Tracking**

#### **1. When User Uploads Receipt:**
```javascript
// Check current usage
const usage = await usageService.getCurrentUsage(userId);
const canUpload = await usageService.canUserPerformAction(userId, 'addReceipt');

if (!canUpload) {
  // Show upgrade prompt
  showUpgradeModal();
  return;
}

// Create receipt
const receiptId = await receiptService.createReceipt({
  userId,
  vendor: "Amazon",
  amount: 129.99,
  // ... other receipt data
});

// Usage automatically updated via firebaseService
```

#### **2. When User Generates Report:**
```javascript
// Check if user can generate reports
const canGenerate = await usageService.canUserPerformAction(userId, 'generateReport');

if (!canGenerate) {
  // Show upgrade prompt for advanced reporting
  showReportUpgradeModal();
  return;
}

// Generate report based on subscription tier
const reportData = await generateReport(userId, {
  type: subscription.tier === 'free' ? 'basic' : 'advanced',
  period: subscription.tier === 'free' ? 'current_month' : dateRange,
});
```

#### **3. Feature Access Control:**
```javascript
// In any component
const { canAccessFeature } = useSubscription();

// Check specific features
const canUseAdvancedReports = canAccessFeature('advancedReporting');
const canUseTaxTools = canAccessFeature('taxPreparation');
const canUseIntegrations = canAccessFeature('accountingIntegrations');

// Conditionally render UI
{canUseAdvancedReports ? (
  <AdvancedReportsComponent />
) : (
  <UpgradePrompt feature="Advanced Reporting" />
)}
```

### **Database Collections Usage:**

#### **users** - Profile & Settings
```javascript
// Stores user profile, business info, app preferences
await userService.createProfile({
  userId: "firebase_auth_uid",
  email: "user@example.com",
  profile: {
    businessName: "John's LLC",
    businessType: "LLC",
  },
  settings: {
    theme: "light",
    defaultCurrency: "USD",
  }
});
```

#### **subscriptions** - Plan Management
```javascript
// Managed by backend/Cloud Functions, read-only for users
// Updated when user upgrades/downgrades
// Determines feature access and limits
```

#### **receipts** - Core Data
```javascript
// Every receipt upload creates a document
await receiptService.createReceipt({
  userId: "firebase_auth_uid",
  vendor: "Amazon",
  amount: 129.99,
  category: "office_supplies",
  images: [{ url: "gs://bucket/receipt.jpg" }],
  tax: { deductible: true, taxYear: 2025 }
});
```

#### **usage** - Limit Enforcement
```javascript
// Tracks monthly usage against limits
// Auto-created/updated on receipt uploads
// Used for limit enforcement and billing
{
  userId: "firebase_auth_uid",
  month: "2025-01",
  receiptsUploaded: 8,
  limits: { maxReceipts: 10 }
}
```

### **Security & Access Control:**

#### **Firestore Rules Example:**
```javascript
// Users can only access their own data
match /receipts/{receiptId} {
  allow read, write: if request.auth.uid == resource.data.userId;
}

// Subscription data is read-only (Cloud Functions manage)
match /subscriptions/{userId} {
  allow read: if request.auth.uid == userId;
  allow write: if false; // Only backend can write
}
```

## Key Business Logic

### **1. Usage Limit Enforcement:**
- Before any action, check `usage` collection for current limits
- Block actions if limits exceeded
- Show appropriate upgrade prompts

### **2. Feature Gates:**
- Use `PremiumGate` component to wrap premium features
- Check subscription tier before showing advanced functionality
- Graceful degradation for free users

### **3. Upgrade Flow:**
- Beautiful upgrade modals with clear value propositions
- One-click upgrade with Stripe integration
- Immediate feature unlock upon payment

### **4. Data Migration:**
- When users upgrade, all existing data remains
- New features become available immediately
- No data loss or migration needed

This schema supports a complete freemium SaaS model with proper usage tracking, feature gating, and seamless upgrade experiences!
