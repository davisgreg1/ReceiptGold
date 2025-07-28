import * as admin from 'firebase-admin';
import * as path from 'path';
import { URL } from 'url';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'receiptgold-467121',
      storageBucket: 'receiptgold-467121.appspot.com'
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

interface Receipt {
  id: string;
  userId: string;
  images: Array<{
    url: string;
    thumbnail?: string;
    size: number;
    uploadedAt: Date;
  }>;
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';
}

async function auditUserStorage(userId: string) {
  console.log(`\nAuditing storage for user ${userId}...`);
  
  try {
    // Get all receipts for the user from Firestore
    const receiptsSnapshot = await db.collection('receipts')
      .where('userId', '==', userId)
      .where('status', '!=', 'deleted')
      .get();
    
    const receipts = receiptsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Receipt[];

    console.log(`Found ${receipts.length} active receipts in Firestore`);

    // Get all images in the user's storage folder
    const [files] = await bucket.getFiles({
      prefix: `receipts/${userId}/`
    });

    console.log(`Found ${files.length} images in Storage`);

    // Map of receipt images from Firestore
    const firestoreImages = new Set<string>();
    receipts.forEach(receipt => {
      receipt.images.forEach(image => {
        // Extract filename from URL or path
        const url = new URL(image.url);
        const filename = path.basename(url.pathname);
        firestoreImages.add(filename);
      });
    });

    // Map of images in Storage
    const storageImages = new Set<string>();
    files.forEach(file => {
      const filename = path.basename(file.name);
      storageImages.add(filename);
    });

    // Find orphaned images (in storage but not in Firestore)
    const orphanedImages = new Set([...storageImages].filter(x => !firestoreImages.has(x)));
    
    // Find missing images (in Firestore but not in storage)
    const missingImages = new Set([...firestoreImages].filter(x => !storageImages.has(x)));

    console.log('\nAudit Results:');
    console.log('-------------');
    console.log(`Total Firestore Receipts: ${receipts.length}`);
    console.log(`Total Storage Images: ${files.length}`);
    console.log(`Orphaned Images: ${orphanedImages.size}`);
    console.log(`Missing Images: ${missingImages.size}`);

    if (orphanedImages.size > 0) {
      console.log('\nOrphaned Images:');
      orphanedImages.forEach(filename => {
        console.log(`- ${filename}`);
      });
    }

    if (missingImages.size > 0) {
      console.log('\nMissing Images:');
      missingImages.forEach(filename => {
        console.log(`- ${filename}`);
      });
    }

    // Ask for confirmation before cleanup
    if (orphanedImages.size > 0) {
      console.log('\nWould you like to delete orphaned images? (y/n)');
      process.stdin.once('data', async (data) => {
        const answer = data.toString().trim().toLowerCase();
        if (answer === 'y') {
          console.log('\nDeleting orphaned images...');
          for (const filename of orphanedImages) {
            const file = bucket.file(`receipts/${userId}/${filename}`);
            try {
              await file.delete();
              console.log(`Deleted ${filename}`);
            } catch (error) {
              console.error(`Error deleting ${filename}:`, error);
            }
          }
          console.log('Cleanup completed.');
        } else {
          console.log('Skipping cleanup.');
        }
        process.exit(0);
      });
    } else {
      console.log('\nNo cleanup needed.');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error during audit:', error);
    process.exit(1);
  }
}

// Get userId from command line argument or use the one from your log
const userId = process.argv[2] || 'yj9zaoNHRANbWuHfky8if1nANCl2';
auditUserStorage(userId);
