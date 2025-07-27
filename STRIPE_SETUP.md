# Stripe React Native Setup for ReceiptGold

## ✅ What's Been Set Up

### 1. Dependencies
- `@stripe/stripe-react-native` - Already installed in package.json

### 2. Environment Variables
- Added `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` to `.env.example`
- You need to add this to your actual `.env` file with your Stripe publishable key

### 3. Components & Services Created

#### StripeWrapper Component (`src/components/StripeWrapper.tsx`)
- Wraps your app with Stripe provider
- Handles Stripe initialization
- Includes merchant ID and URL scheme for deep linking

#### Stripe Service (`src/services/stripe.ts`)
- Handles customer creation via Cloud Functions
- Manages checkout sessions
- Provides subscription tier configurations
- Formats prices for display

#### Stripe Hook (`src/hooks/useStripePayments.ts`)
- Easy-to-use hook for components
- Handles subscription flow
- Manages alerts and redirects

### 4. App Integration
- Updated `App.tsx` to include StripeWrapper
- Updated `PricingLanding.tsx` to use Stripe payments
- Firebase Functions integration for backend operations

## 🔧 Configuration Needed

### 1. Environment Variables
Add to your `.env` file:
```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
```

### 2. Stripe Dashboard Setup
1. Create products in Stripe Dashboard
2. Get price IDs for each subscription tier
3. Update price IDs in `src/services/stripe.ts`:
   - `price_starter_monthly`
   - `price_growth_monthly` 
   - `price_professional_monthly`

### 3. Cloud Functions
Make sure your Firebase Cloud Functions include:
- `createStripeCustomer`
- `createCheckoutSession`
- `stripeWebhook` (for handling subscription events)

### 4. Deep Linking (Optional)
Configure URL scheme in `app.json`:
```json
{
  "expo": {
    "scheme": "receiptgold"
  }
}
```

## 🚀 How It Works

1. User selects a subscription tier in PricingLanding
2. `handleSubscription` is called with user details
3. Stripe customer is created (or retrieved) via Cloud Function
4. Checkout session is created via Cloud Function
5. User is redirected to Stripe Checkout
6. Webhook handles successful payments
7. Subscription status is updated in Firestore

## 🧪 Testing

1. Use Stripe test keys during development
2. Use test card numbers (4242 4242 4242 4242)
3. Monitor webhook events in Stripe Dashboard
4. Test subscription flows in the app

## 📱 Features Included

- Subscription tier management
- Customer creation
- Checkout sessions
- Price formatting
- Error handling
- Loading states
- Success/failure alerts

The setup is now ready for testing with your Stripe test environment!
