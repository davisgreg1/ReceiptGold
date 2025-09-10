#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Generate GoogleService-Info.plist from environment variables
function generateGoogleServicesPlist() {
  const requiredEnvVars = [
    'EXPO_PUBLIC_FIREBASE_API_KEY',
    'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
    'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'EXPO_PUBLIC_FIREBASE_APP_ID',
    'EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID'
  ];

  // Check if all required environment variables are available
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    process.exit(1);
  }

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>API_KEY</key>
	<string>${process.env.EXPO_PUBLIC_FIREBASE_API_KEY}</string>
	<key>GCM_SENDER_ID</key>
	<string>${process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}</string>
	<key>PLIST_VERSION</key>
	<string>1</string>
	<key>BUNDLE_ID</key>
	<string>com.receiptgold.app</string>
	<key>PROJECT_ID</key>
	<string>${process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID}</string>
	<key>STORAGE_BUCKET</key>
	<string>${process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET}</string>
	<key>IS_ADS_ENABLED</key>
	<false/>
	<key>IS_ANALYTICS_ENABLED</key>
	<false/>
	<key>IS_APPINVITE_ENABLED</key>
	<true/>
	<key>IS_GCM_ENABLED</key>
	<true/>
	<key>IS_SIGNIN_ENABLED</key>
	<true/>
	<key>GOOGLE_APP_ID</key>
	<string>${process.env.EXPO_PUBLIC_FIREBASE_APP_ID}</string>
</dict>
</plist>`;

  // Write the plist file
  const outputPath = path.join(process.cwd(), 'GoogleService-Info.plist');
  fs.writeFileSync(outputPath, plistContent);
  console.log('✅ GoogleService-Info.plist generated successfully');
}

generateGoogleServicesPlist();