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

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- iOS Simulator or Android Emulator

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ReceiptGold.git
cd ReceiptGold

# Install dependencies
npm install

# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on Web
npm run web
```

### Environment Setup

Create a `.env` file in the root directory:

```env
# Firebase Configuration
FIREBASE_API_KEY=your_api_key_here
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=your_app_id

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...

# Google Cloud Vision API
GOOGLE_CLOUD_VISION_API_KEY=your_vision_api_key
```

## 📁 Project Structure

```
ReceiptGold/
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
├── app.json              # Expo configuration
├── App.tsx               # Main app component
└── package.json          # Dependencies
```

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
