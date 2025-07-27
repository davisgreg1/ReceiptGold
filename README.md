# ReceiptGold 📱💰

Premium receipt management app for LLCs with OCR scanning and expense tracking.

![ReceiptGold Logo](./assets/icon.png)

## 🚀 Features

- **Beautiful UI**: Black & Gold theme with dark/light mode support
- **Receipt Generation**: Create professional receipts instantly
- **OCR Scanning**: Scan receipts and auto-extract data (Premium feature)
- **LLC Focus**: Specifically designed for new LLC owners
- **Expense Tracking**: Categorize and track business expenses
- **Tax Compliance**: Built-in guidance for tax deductions
- **Cloud Sync**: Firebase backend for secure data storage

## 🛠️ Tech Stack

- **Frontend**: React Native with Expo
- **Language**: TypeScript
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Navigation**: React Navigation 6
- **State Management**: React Context + AsyncStorage
- **UI Components**: React Native Paper + Custom components
- **Payment Processing**: Stripe (for premium features)
- **OCR**: Google Cloud Vision API

## 📱 Platform Support

- ✅ iOS (iPhone & iPad)
- ✅ Android
- ✅ Web (Progressive Web App)

## 🎨 Design System

### Color Palette

- **Primary**: Black (#000000) & Gold (#FFD700)
- **Dark Theme**: Rich blacks with bright gold accents
- **Light Theme**: Clean whites with darker gold accents
- **Status Colors**: Success, Error, Warning, Info

### Typography

- **Headers**: Bold, prominent sizing
- **Body**: Readable, accessible contrast
- **Accents**: Gold highlighting for important elements

## 🚀 Quick Start

For complete setup instructions, see the **[Complete Setup Guide](#-complete-setup-guide)** section below.

```bash
# Quick start for development
git clone https://github.com/YOUR_USERNAME/ReceiptGold.git
cd ReceiptGold
npm install
cd functions && npm install && cd ..
npm start
```

**Note**: You'll need to configure Firebase and Stripe keys before the backend functions work properly. See the detailed setup guide below.

## �️ Complete Setup Guide

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Expo CLI
- Firebase CLI
- iOS Simulator or Android Emulator (for mobile testing)

### 1. Initial Project Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ReceiptGold.git
cd ReceiptGold

# Install root dependencies
npm install

# Install Firebase Functions dependencies
cd functions
npm install
cd ..
```

### 2. Firebase Configuration

#### Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project named "receiptgold"
3. Enable Authentication, Firestore, Storage, and Functions

#### Initialize Firebase in Project
```bash
# Login to Firebase (if not already logged in)
firebase login

# Initialize Firebase (choose existing project)
firebase init

# Select these services:
# - Functions: Configure and deploy Cloud Functions
# - Firestore: Deploy rules and create indexes
# - Storage: Deploy rules
# - Emulators: Set up local emulators for development
```

#### Set up Environment Variables
Create `/functions/.env` file:
```bash
cd functions
cat > .env << 'EOF'
# Stripe Configuration for Cloud Functions
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Environment
NODE_ENV=development
EOF
cd ..
```

Create root `.env` file:
```bash
cat > .env << 'EOF'
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=receiptgold.firebaseapp.com
FIREBASE_PROJECT_ID=receiptgold
FIREBASE_STORAGE_BUCKET=receiptgold.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=your_app_id

# Stripe Configuration (Client-side)
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Google Cloud Vision API
GOOGLE_CLOUD_VISION_API_KEY=your_vision_api_key
EOF
```

### 3. Build and Test Firebase Functions

```bash
# Navigate to functions directory
cd functions

# Build the TypeScript functions
npm run build

# Start Firebase emulator for local testing
npm run serve
# Alternative: firebase emulators:start --only functions

# The emulator will start on:
# - Functions: http://127.0.0.1:5002
# - Emulator UI: http://127.0.0.1:4002
```

### 4. Stripe Integration Setup

#### Create Stripe Products
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create products for subscription tiers:
   - **Starter Plan**: $9.99/month
   - **Growth Plan**: $29.99/month  
   - **Professional Plan**: $99.99/month

#### Test Webhook Integration
```bash
# Install Stripe CLI (if not installed)
# macOS: brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local functions emulator
stripe listen --forward-to http://127.0.0.1:5002/receiptgold/us-central1/stripeWebhook

# Test webhook endpoint
curl -X POST http://127.0.0.1:5002/receiptgold/us-central1/debugWebhook
```

### 5. Deploy to Firebase (Production)

```bash
# Deploy functions to Firebase
cd functions
firebase deploy --only functions

# Deploy Firestore rules and indexes
firebase deploy --only firestore

# Deploy storage rules
firebase deploy --only storage

# Deploy everything
firebase deploy
```

### 6. Start Development

```bash
# Return to root directory
cd /path/to/ReceiptGold

# Start the Expo development server
npm start

# Run on iOS
npm run ios

# Run on Android  
npm run android

# Run on Web
npm run web
```

### 7. Testing and Verification

#### Test Firebase Functions
```bash
# Test health check endpoint
curl http://127.0.0.1:5002/receiptgold/us-central1/healthCheck

# Test Stripe connection (requires authentication)
# Use the emulator UI at http://127.0.0.1:4002/functions
```

#### Verify Emulator Status
- **Emulator UI**: http://127.0.0.1:4002/
- **Functions**: http://127.0.0.1:5002/
- **Authentication**: http://127.0.0.1:9099/
- **Firestore**: http://127.0.0.1:8080/

### 8. Common Issues and Solutions

#### Firebase Functions Issues
```bash
# If functions fail to load due to missing dependencies
cd functions
npm install
npm run build

# If Stripe keys are missing
# Check that functions/.env file exists and contains valid keys

# If ports are in use
# Update firebase.json emulator ports configuration
```

#### Expo/React Native Issues
```bash
# Clear Expo cache
npx expo start --clear

# Reset Metro bundler cache
npx react-native start --reset-cache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

### Project Structure Overview

```
ReceiptGold/
├── functions/              # Firebase Cloud Functions
│   ├── src/index.ts       # Main functions file
│   ├── package.json       # Functions dependencies
│   └── .env              # Functions environment variables
├── assets/                # App assets
├── src/                   # React Native source code
├── firebase.json          # Firebase configuration
├── firestore.rules       # Firestore security rules
├── storage.rules         # Storage security rules
├── .firebaserc           # Firebase project settings
├── .env                  # Client environment variables
└── package.json          # Root dependencies
```

---

## 📁 Project Structure

```
ReceiptGold/
├── functions/              # Firebase Cloud Functions (Backend)
│   ├── src/index.ts       # Main functions file with Stripe integration
│   ├── package.json       # Functions dependencies
│   └── .env              # Backend environment variables
├── assets/                 # Images, fonts, icons
│   ├── images/
│   │   └── logo/          # Logo variations
│   ├── icon.png           # App icon
│   └── splash.png         # Splash screen
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # App screens
│   ├── navigation/        # Navigation configuration
│   ├── theme/            # Theme system & colors
│   ├── types/            # TypeScript type definitions
│   └── utils/            # Utility functions
├── firebase.json          # Firebase project configuration
├── firestore.rules       # Database security rules
├── storage.rules         # File storage security rules
├── .firebaserc           # Firebase project settings
├── .env                  # Client-side environment variables
├── app.json              # Expo configuration
├── App.tsx               # Main app component
└── package.json          # Frontend dependencies
```

## 🔥 Firebase & Backend

This project includes a full Firebase backend with Cloud Functions for:
- User authentication and management
- Stripe subscription handling
- Receipt processing and OCR
- Business analytics and reporting

**Key endpoints:**
- `/stripeWebhook` - Handles Stripe subscription events
- `/createStripeCustomer` - Creates Stripe customers
- `/createCheckoutSession` - Generates payment sessions
- `/generateReport` - Creates expense reports

See the [Complete Setup Guide](#-complete-setup-guide) for detailed configuration instructions.

## 💳 Stripe Integration

Integrated subscription management with multiple tiers:
- **Free**: 10 receipts, basic features
- **Starter**: Unlimited receipts, $9.99/month
- **Growth**: Multiple businesses, advanced reporting, $29.99/month
- **Professional**: API access, white-label, $99.99/month

## 🤖 OCR & Vision

Google Cloud Vision API integration for:
- Receipt text extraction
- Amount and vendor detection
- Date parsing and validation
- Item-level categorization

## 🔥 Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication, Firestore, and Storage
3. Download the configuration and add to `.env`
4. Set up Firestore security rules
5. Configure Storage rules for receipt images

## 💳 Stripe Integration

1. Create a Stripe account at [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get your publishable and secret keys
3. Set up webhooks for subscription management
4. Configure products for premium features

## 🤖 OCR Setup (Google Cloud Vision)

1. Create a Google Cloud project
2. Enable the Vision API
3. Create service account credentials
4. Add API key to environment variables

## 📈 Roadmap

### Phase 1: MVP (Current)

- [x] Basic app structure
- [x] Splash screen with branding
- [x] Theme system (dark/light)
- [x] Home screen placeholder
- [ ] Receipt generation
- [ ] User authentication

### Phase 2: Core Features

- [ ] Receipt creation form
- [ ] PDF generation and export
- [ ] User profile management
- [ ] Local data storage

### Phase 3: Premium Features

- [ ] OCR receipt scanning
- [ ] Cloud data sync
- [ ] Subscription management
- [ ] Advanced categorization

### Phase 4: Advanced Features

- [ ] Expense reporting
- [ ] Tax document generation
- [ ] Accounting software integration
- [ ] Team collaboration

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- **Email**: support@receiptgold.com
- **Documentation**: [Link to docs]
- **Issues**: [GitHub Issues](https://github.com/YOUR_USERNAME/ReceiptGold/issues)

## 🙏 Acknowledgments

- React Native and Expo teams
- Firebase for backend services
- Stripe for payment processing
- Google Cloud Vision for OCR capabilities
- The open-source community

---

**ReceiptGold** - _Premium Receipt Management for Modern LLCs_

Made with ❤️ and ☕
