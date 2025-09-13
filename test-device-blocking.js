const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'receiptgold',
  });
}

const db = admin.firestore();

async function markDeviceAsUsed() {
  const deviceToken = 'eyJkZXZpY2VJZCI6InRlc3QtZGV2aWNlLUZJTkFMLUJMT0NLIiwibW9kZWxOYW1lIjoiaVBob25lIiwib3NWZXJzaW9uIjoiMTcuMCIsInBsYXRmb3JtIjoiaW9zIn0=';
  
  try {
    await db.collection('device_tracking').doc(deviceToken).set({
      hasCreatedAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Device marked as having created account:', deviceToken);
  } catch (error) {
    console.error('❌ Error marking device:', error);
  } finally {
    process.exit(0);
  }
}

markDeviceAsUsed();