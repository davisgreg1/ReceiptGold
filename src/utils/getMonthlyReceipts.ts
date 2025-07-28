import { collection, query, where, getDocs, Query, QuerySnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function getMonthlyReceiptCount(userId: string): Promise<number> {
  // Get current month's receipt count - count ALL receipts created this month
  // regardless of their status (we want to count deleted ones too)
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  // Query all receipts created this month, including deleted ones
  // Important: We count ALL receipts created, even if deleted, as they count towards monthly usage
  const monthlyUsageQuery = query(
    collection(db, 'receipts'),
    where('userId', '==', userId),
    where('createdAt', '>=', startOfMonth)
  );
  
  const monthlyUsageSnapshot = await getDocs(monthlyUsageQuery);
  return monthlyUsageSnapshot.size;
}
