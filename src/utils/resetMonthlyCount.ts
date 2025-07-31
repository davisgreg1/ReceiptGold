import { doc, updateDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function resetMonthlyCount(userId: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    
    // Get receipts created this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', userId),
      where('createdAt', '>=', startOfMonth)
    );
    
    const receiptsSnapshot = await getDocs(receiptsQuery);
    
    // Mark all receipts from this month as not counting towards the monthly limit
    receiptsSnapshot.docs.forEach(receiptDoc => {
      batch.update(doc(db, 'receipts', receiptDoc.id), {
        excludeFromMonthlyCount: true,
        monthlyCountExcludedAt: new Date()
      });
    });
    
    // Update user's subscription to record when the reset happened
    const userSubDoc = doc(db, 'subscriptions', userId);
    batch.update(userSubDoc, {
      lastMonthlyCountResetAt: new Date()
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Error resetting monthly count:', error);
    throw error;
  }
}
