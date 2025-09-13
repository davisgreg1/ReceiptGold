const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'receiptgold'
});

const deviceToken = 'eyJkZXZpY2VJZCI6IjIzQTM0MCIsIm1vZGVsTmFtZSI6ImlQaG9uZSAxNSBQcm8gTWF4Iiwib3NWZXJzaW9uIjoiMjYuMCIsInBsYXRmb3JtIjoiaW9zIn0=';

console.log('🔄 Adding device token to database...');

admin.firestore().collection('device_tracking').doc(deviceToken).set({
  hasCreatedAccount: true,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  testDevice: true,
  manuallyAdded: true,
  note: 'Added for blocking test'
}).then(() => {
  console.log('✅ SUCCESS: Device token added to database');
  console.log('📱 Device Token:', deviceToken.substring(0, 30) + '...');
  console.log('🔒 Next signup attempt from this device should be BLOCKED');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Error adding device token:', error);
  process.exit(1);
});