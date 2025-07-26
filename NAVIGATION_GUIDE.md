# ReceiptGold Navigation Structure

## Overview
Your app now uses a modern React Navigation setup with bottom tabs as the main navigation pattern, which is perfect for a receipt/expense management app.

## Navigation Architecture

### 1. **Bottom Tab Navigator** (Main Navigation)
- **Home Tab** 🏠 - Dashboard with quick actions and pricing
- **Receipts Tab** 📄 - Receipt management (scan, view, edit)
- **Reports Tab** 📊 - Analytics and tax reports
- **Settings Tab** ⚙️ - Profile, billing, preferences

### 2. **Stack Navigators** (For each tab)
Each tab has its own stack navigator for drilling down into details:

#### Home Stack
- `Home` - Main dashboard with quick actions
- `Subscription` - Pricing and subscription management

#### Receipts Stack
- `ReceiptsList` - List of all receipts
- `ReceiptDetail` - View/edit individual receipt
- `ScanReceipt` - Camera interface for scanning (modal)
- `EditReceipt` - Edit receipt details

#### Reports Stack
- `ReportsDashboard` - Overview of reports
- `TaxReport` - Tax-specific reports
- `ExpenseReport` - Expense categorization reports
- `CategoryReport` - Category-based analytics

#### Settings Stack
- `SettingsHome` - Main settings screen
- `Profile` - User profile management
- `Billing` - Subscription and billing
- `Notifications` - Push notification preferences
- `Help` - Support and help documentation

## Key Features

### Type Safety
- Full TypeScript support with properly typed navigation params
- Custom hooks for each navigator (`useHomeNavigation`, `useReceiptsNavigation`, etc.)
- Navigation helpers for common actions

### User Experience
- Themed navigation bar that adapts to light/dark mode
- Gold accent color for active tabs
- Proper modal presentation for camera/scanning flows
- Intuitive iconography and labeling

### Quick Actions
The Home screen now includes quick action buttons that navigate to:
- Scan Receipt (jumps to Receipts tab)
- View Reports (jumps to Reports tab)

## Next Steps

### Immediate Implementation
1. **Receipt Scanning Screen** - Camera interface for capturing receipts
2. **Receipt List Screen** - Display all captured receipts
3. **Reports Dashboard** - Basic analytics and summaries

### Future Screens to Build
1. **Receipt Detail/Edit** - Full receipt management
2. **Tax Report Generator** - Export tax-ready reports
3. **Settings/Profile** - User preferences and account management
4. **Billing/Subscription** - Plan management and payment

### Navigation Enhancements
- Deep linking support for sharing specific receipts/reports
- Tab badges for unprocessed receipts or pending actions
- Modal flows for onboarding new users

## Usage Examples

```typescript
// In any screen, use the navigation hooks
const navigation = useReceiptsNavigation();

// Navigate to scan receipt
navigation.navigate('ScanReceipt');

// Navigate with parameters
navigation.navigate('ReceiptDetail', { receiptId: '123' });

// Use navigation helpers
navigationHelpers.switchToReceiptsTab(tabNavigation);
```

## Benefits of This Structure

1. **Scalable** - Easy to add new screens without restructuring
2. **User-Friendly** - Bottom tabs are familiar and accessible
3. **Platform Native** - Follows iOS/Android navigation patterns
4. **Type-Safe** - Prevents navigation errors at compile time
5. **Maintainable** - Clear separation of concerns between features
