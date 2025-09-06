# 🚀 Production Environment Setup Guide

## Quick Switch Commands

```bash
# Switch to development
npm run env:dev

# Switch to production  
npm run env:prod

# Check current environment
npm run env:status
```

## Method 1: Environment Files (Recommended) ⭐

### Files Created:
- `.env.development` - Sandbox/development config
- `.env.production` - Production config  
- `scripts/switch-env.js` - Environment switcher

### Usage:
```bash
# Development (sandbox)
npm run env:dev
npm run dev

# Production  
npm run env:prod
npm start
```

### Setup Steps:

1. **Fill in your production values in `.env.production`:**
   ```bash
   # Edit production config
   code .env.production
   ```

2. **Update these specific values:**
   - `EXPO_PUBLIC_PLAID_CLIENT_ID` → Your production Plaid client ID
   - `EXPO_PUBLIC_PLAID_SECRET` → Your production Plaid secret  
   - `EXPO_PUBLIC_API_BASE_URL` → Your production API URL
   - Firebase project IDs and API keys
   - Stripe live publishable key

3. **Switch environment:**
   ```bash
   npm run env:prod
   ```

## Method 2: EAS Build Profiles (Expo)

Configure different environments in `eas.json`:

```bash
# Build for development
eas build --profile development

# Build for production
eas build --profile production
```

Environment variables are injected during build time.

## Method 3: Manual .env Management

### Traditional approach:
```bash
# Backup current .env
cp .env .env.backup

# Copy production config
cp .env.production .env

# Or edit directly
code .env
```

## Backend (Firebase Functions)

### Development:
```bash
cd functions
# Uses functions/.env (current sandbox config)
firebase deploy --only functions
```

### Production:
```bash
cd functions
# Copy production config
cp .env.production .env
firebase deploy --only functions
```

## 🔐 Security Checklist

- [ ] **Never commit production secrets** to git
- [ ] **Use different Firebase projects** for dev/prod
- [ ] **Use Plaid sandbox vs production** environments
- [ ] **Use Stripe test vs live** keys
- [ ] **Set up proper webhook URLs** for production

## 📋 Production Deployment Checklist

### Mobile App:
- [ ] `npm run env:prod`
- [ ] Update version in `app.json`
- [ ] `eas build --profile production`
- [ ] `eas submit --profile production`

### Backend:
- [ ] Update `functions/.env` with production values
- [ ] `cd functions && npm run build`
- [ ] `firebase deploy --only functions`

### API Server:
- [ ] Update production API URL in mobile app
- [ ] Deploy server to production environment
- [ ] Update Plaid/Stripe webhook URLs

## 🛠️ Troubleshooting

**Environment not switching?**
```bash
# Check current environment
npm run env:status

# Force switch
rm .env && npm run env:prod
```

**Functions deployment failing?**
```bash
# Check functions environment
cd functions && cat .env | head -5

# Verify secrets are set
firebase functions:config:get
```

**Build failing with environment issues?**
```bash
# Clear cache and try again
expo r -c
npm run env:prod
```

## 🎯 Recommended Workflow

### Daily Development:
```bash
npm run env:dev  # Ensure dev environment
npm run dev      # Start development
```

### Production Release:
```bash
npm run env:prod           # Switch to production
eas build --profile production
eas submit --profile production
```

This setup gives you one-command environment switching while keeping your secrets secure! 🔒