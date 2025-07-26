# Firebase Authentication Setup Guide

## 1. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "ReceiptGold")
4. Follow the setup wizard

## 2. Enable Authentication

1. In your Firebase project, go to "Authentication" in the left sidebar
2. Click "Get started"
3. Go to the "Sign-in method" tab
4. Enable "Email/Password" authentication method

## 3. Get Your Firebase Configuration

1. Go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click the web app icon `</>`
4. Register your app with a nickname (e.g., "ReceiptGold Mobile")
5. Copy the Firebase configuration object

## 4. Configure Environment Variables

1. Copy the `.env.example` file to create a new `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual Firebase configuration values:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-actual-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

**Important Notes:**
- The `.env` file is already included in `.gitignore` and will not be committed to version control
- Use the `EXPO_PUBLIC_` prefix for environment variables that need to be accessible in your React Native app
- Never commit your actual Firebase credentials to version control

## 5. Test Authentication

After updating the configuration, your app should now support:

- ✅ User registration with email/password
- ✅ User sign in with email/password
- ✅ Password reset via email
- ✅ Automatic sign out
- ✅ Persistent authentication state

## Features Included

### Sign In Screen
- Email and password input
- Form validation
- Error handling
- Navigation to sign up and forgot password

### Sign Up Screen  
- Email and password input
- Password confirmation
- Minimum password length validation
- Error handling

### Forgot Password Screen
- Email input for password reset
- Email validation
- Success confirmation
- Navigation back to sign in

### Authentication State Management
- Automatic authentication state persistence
- Loading states during auth operations
- User context available throughout the app

## Security Notes

- ✅ Firebase configuration is now stored in environment variables
- ✅ The `.env` file is automatically ignored by git
- ✅ Use `.env.example` as a template for team members
- ✅ Environment variables are validated at startup
- Consider using different Firebase projects for development/staging/production
- Review Firebase Authentication documentation for advanced security settings
- Monitor your Firebase usage in the Firebase Console
