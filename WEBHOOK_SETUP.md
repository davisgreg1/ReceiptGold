# Firebase Functions Webhook Setup Guide

## Overview

Your Firebase Functions are now set up to handle both **Stripe** and **Plaid** webhooks securely. This guide covers the setup and configuration.

## 🚀 What's Been Implemented

### ✅ Stripe Webhook Handler
- **Endpoint**: `/stripeWebhook`
- **Signature verification** with webhook secrets
- **Handles events**: subscriptions, payments, checkouts
- **Automatic user subscription updates**
- **Robust error handling and logging**

### ✅ Plaid Webhook Handler
- **Endpoint**: `/plaidWebhook` 
- **IP allowlisting validation** (no signature verification)
- **Handles events**: transactions, items, auth, accounts
- **Automatic transaction monitoring**
- **User notifications for connection issues**

### ✅ Security Features
- **Raw body handling** for proper signature verification
- **Environment variable-based secrets**
- **Request method validation (POST only)**
- **Comprehensive error handling**
- **Webhook retry-friendly responses**

## 🔧 Environment Variables Setup

### ⚠️ Migration from functions.config() to .env

Firebase is deprecating `functions.config()` in March 2026. We're now using the modern `.env` approach.

### Required Environment Variables

Create or update your `/functions/.env` file:

```bash
# functions/.env
# Environment Variables for Cloud Functions
# This file replaces functions.config() which is deprecated as of March 2026

# App Configuration
APP_URL=https://yourapp.com

# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...  # or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Plaid Configuration  
PLAID_CLIENT_ID=your_plaid_client_id
PLAID_SECRET=your_plaid_secret  # production or sandbox
PLAID_ENVIRONMENT=sandbox  # or "development" or "production"

# Receipt Tier Limits
FREE_TIER_MAX_RECEIPTS=10
STARTER_TIER_MAX_RECEIPTS=50
GROWTH_TIER_MAX_RECEIPTS=150
PROFESSIONAL_TIER_MAX_RECEIPTS=-1

# Environment
NODE_ENV=production
```

### ❌ Deprecated (Don't use after March 2026)

```bash
# These commands are deprecated!
firebase functions:config:set stripe.secret_key="sk_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

## 📡 Webhook URL Setup

### Firebase Functions URLs

After deployment, your webhook endpoints will be:

```
https://us-central1-[your-project-id].cloudfunctions.net/stripeWebhook
https://us-central1-[your-project-id].cloudfunctions.net/plaidWebhook
```

### Stripe Dashboard Setup

1. Go to **Stripe Dashboard > Developers > Webhooks**
2. **Add endpoint**: `https://us-central1-[project-id].cloudfunctions.net/stripeWebhook`
3. **Select events**:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `checkout.session.completed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. **Copy webhook secret** and add to environment variables

### Plaid Dashboard Setup

1. Go to **Plaid Dashboard > Team Settings > API**
2. **Add webhook URL**: `https://us-central1-[project-id].cloudfunctions.net/plaidWebhook`
3. **Select webhook types**:
   - `TRANSACTIONS`
   - `ITEM`
   - `AUTH` 
   - `ACCOUNTS`
4. **Note**: Plaid uses IP allowlisting instead of webhook secrets for security

## 🧪 Testing Webhooks

### Test Configuration Endpoint

```bash
curl https://us-central1-[project-id].cloudfunctions.net/testWebhookConfig
```

This returns:
```json
{
  "stripe": {
    "webhookConfigured": true,
    "hasSecretKey": true,
    "hasWebhookSecret": true
  },
  "plaid": {
    "configured": true,
    "hasClientId": true,
    "hasSecret": true,
    "environment": "sandbox",
    "note": "Plaid uses IP allowlisting instead of webhook secrets"
  },
  "environment": "production"
}
```

### Debug Webhook Endpoint

For troubleshooting webhook delivery:

```bash
curl -X POST https://us-central1-[project-id].cloudfunctions.net/debugWebhook
```

## 🔐 Security Best Practices

### ✅ Implemented Security Features

1. **Security Verification**
   - Stripe: Uses `stripe-signature` header with webhook secret
   - Plaid: Uses IP allowlisting (configured in Plaid Dashboard)

2. **Raw Body Handling**
   - Properly extracts raw request body for signature verification
   - Handles Firebase Functions v2 `rawBody` property

3. **Error Handling**
   - Returns 200 for successful processing (prevents retries)
   - Returns 400 for signature failures  
   - Logs detailed error information

4. **Environment Configuration**
   - Secrets stored as environment variables
   - No hardcoded credentials in code

### 📊 Webhook Event Handling

#### Stripe Events
- **Subscription created/updated**: Updates user tier and limits
- **Payment succeeded**: Activates subscription 
- **Payment failed**: Marks subscription as past due
- **Checkout completed**: Links subscription to user

#### Plaid Events
- **New transactions**: Triggers receipt analysis
- **Item errors**: Notifies user to reconnect bank
- **Auth updates**: Maintains connection status
- **Account changes**: Syncs account information

## 🚀 Deployment

### Prerequisites
1. **Ensure .env file exists** in `/functions/.env` with all required variables
2. **Build and deploy**:

```bash
cd functions
npm run build
firebase deploy --only functions
```

### ✅ .env Automatic Deployment
- Firebase Functions v6+ automatically loads `.env` files during deployment
- No additional configuration needed
- Environment variables are securely encrypted in production

### Migration Benefits
- ✅ **Future-proof**: Ready for post-March 2026
- ✅ **Version control**: Easy to track environment changes  
- ✅ **Local development**: Same config for local and production
- ✅ **Automatic loading**: No extra setup required

## 📝 Database Collections Used

The webhooks interact with these Firestore collections:

- `subscriptions` - User subscription data
- `users` - User profiles and settings
- `receipts` - Generated receipts from transactions
- `plaid_items` - Connected bank accounts
- `transaction_updates` - Pending transaction processing
- `user_notifications` - User alerts and notices
- `billing_history` - Payment records

## 🔍 Monitoring and Logging

All webhook events are logged with:
- ✅ Success indicators
- ❌ Error details with stack traces  
- 📊 Processing metrics
- 🔄 Event type and ID tracking

Check Firebase Functions logs:
```bash
firebase functions:log
```

## 🆘 Troubleshooting

### Common Issues

1. **Signature verification failing**
   - Check webhook secret configuration
   - Verify raw body handling
   - Confirm endpoint URL matches exactly

2. **User not found errors**
   - Ensure customer metadata includes `userId`
   - Check Firestore user document exists

3. **Transaction processing errors**
   - Verify Plaid item exists in database
   - Check user permissions for linked accounts

### Support

For webhook-specific issues, check the Firebase Functions logs and the detailed error messages included in each handler.