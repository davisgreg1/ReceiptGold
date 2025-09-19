// Script to cleanup test user data

const admin = require("firebase-admin");
const path = require("path");

// Load service account key
const serviceAccount = require(path.join(
  __dirname,
  "../db/ReceiptGoldAdminReceipt.json"
));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

const TEST_USER_ID = "test-user-12345";

async function deleteCollection(collectionName: string, userId: string) {
  const query = db.collection(collectionName).where("userId", "==", userId);
  const snapshot = await query.get();

  if (snapshot.empty) {
    console.log(`   ℹ️  No documents found in ${collectionName}`);
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc: any) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`   ✓ Deleted ${snapshot.size} documents from ${collectionName}`);
  return snapshot.size;
}

async function cleanupTestData() {
  try {
    console.log("🧹 Starting test data cleanup...\n");

    let totalDeleted = 0;

    // 1. Delete user document
    console.log("👤 Cleaning up user data...");
    const userRef = db.collection("users").doc(TEST_USER_ID);
    const userDoc = await userRef.get();
    if (userDoc.exists) {
      await userRef.delete();
      console.log("   ✓ Deleted user document");
      totalDeleted++;
    } else {
      console.log("   ℹ️  User document not found");
    }

    // 2. Delete subscription
    console.log("📋 Cleaning up subscription data...");
    const subscriptionRef = db.collection("subscriptions").doc(TEST_USER_ID);
    const subscriptionDoc = await subscriptionRef.get();
    if (subscriptionDoc.exists) {
      await subscriptionRef.delete();
      console.log("   ✓ Deleted subscription document");
      totalDeleted++;
    } else {
      console.log("   ℹ️  Subscription document not found");
    }

    // 3. Delete receipts
    console.log("📄 Cleaning up receipts...");
    const receiptsDeleted = await deleteCollection("receipts", TEST_USER_ID);
    totalDeleted += receiptsDeleted;

    // 4. Delete businesses
    console.log("🏢 Cleaning up businesses...");
    const businessesDeleted = await deleteCollection(
      "businesses",
      TEST_USER_ID
    );
    totalDeleted += businessesDeleted;

    // 5. Delete reports
    console.log("📊 Cleaning up reports...");
    const reportsDeleted = await deleteCollection("reports", TEST_USER_ID);
    totalDeleted += reportsDeleted;

    // 6. Delete usage data
    console.log("📈 Cleaning up usage data...");
    const usageQuery = db
      .collection("usage")
      .where("userId", "==", TEST_USER_ID);
    const usageSnapshot = await usageQuery.get();

    if (!usageSnapshot.empty) {
      const batch = db.batch();
      usageSnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`   ✓ Deleted ${usageSnapshot.size} usage documents`);
      totalDeleted += usageSnapshot.size;
    } else {
      console.log("   ℹ️  No usage documents found");
    }

    console.log(
      `\n✅ Cleanup completed! Deleted ${totalDeleted} documents total.`
    );
    console.log(
      "\n⚠️  Note: You may also want to delete the Firebase Auth user:"
    );
    console.log(`   Email: testuser@receiptgold.com`);
    console.log(`   UID: ${TEST_USER_ID}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error during cleanup:", error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  cleanupTestData();
}

module.exports = { cleanupTestData };
