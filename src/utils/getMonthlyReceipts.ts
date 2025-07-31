import { collection, query, where, getDocs, Query, QuerySnapshot, getDoc, doc } from 'firebase/firestore';
import { db } from '../config/firebase';

export async function getMonthlyReceiptCount(userId: string): Promise<number> {
  try {

    // First, get the subscription info
    const subscriptionDoc = await getDoc(doc(db, 'subscriptions', userId));
    const subscriptionData = subscriptionDoc.data();
    console.log("🚀 ~ getMonthlyReceiptCount ~ subscriptionData:", subscriptionData)

    // Get the most recent monthly count reset date
    const lastMonthlyCountResetAt = subscriptionData?.lastMonthlyCountResetAt?.toDate(); // July 1, 2025

    // If no reset date, try to use the billing period start date
    let countFromDate: Date;

    if (lastMonthlyCountResetAt) {
      countFromDate = lastMonthlyCountResetAt;
    } else if (subscriptionData?.billing?.currentPeriodStart) {
      // Use the subscription billing period start
      const periodStart = subscriptionData.billing.currentPeriodStart;
      countFromDate = periodStart.toDate ? periodStart.toDate() : new Date(periodStart);
    } else {
      // Fallback to start of current month
      countFromDate = new Date();
      countFromDate.setDate(1);
      countFromDate.setHours(0, 0, 0, 0);
    }

    // Query all receipts created since the counting start date
    const monthlyUsageQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', userId),
      where('createdAt', '>=', countFromDate)
    );

    const monthlyUsageSnapshot = await getDocs(monthlyUsageQuery);
    
    console.log("🚀 ~ getMonthlyReceiptCount ~ Total receipts found:", monthlyUsageSnapshot.size);
    console.log("🚀 ~ getMonthlyReceiptCount ~ Counting from date:", countFromDate);
    
    // Filter out only receipts excluded from monthly count (e.g., when upgrading tiers)
    // Note: We don't exclude deleted receipts because they still count toward monthly usage
    const validReceipts = monthlyUsageSnapshot.docs.filter(doc => {
      const data = doc.data();
      const receiptDate = data.createdAt?.toDate?.() || data.createdAt;
      const isExcluded = data.excludeFromMonthlyCount === true;
      const isDeleted = data.status === 'deleted';
      
      console.log("🚀 ~ Receipt:", {
        id: doc.id.substring(0, 8) + '...',
        createdAt: receiptDate,
        isAfterCountDate: receiptDate >= countFromDate,
        excludeFromMonthlyCount: data.excludeFromMonthlyCount,
        status: data.status,
        isExcluded,
        isDeleted,
        willInclude: !isExcluded // Deleted receipts still count toward monthly usage
      });
      
      return !isExcluded; // Only exclude receipts marked as excluded, not deleted ones
    });

    console.log("🚀 ~ getMonthlyReceiptCount ~ Valid (non-excluded) receipts:", validReceipts.length);
    
    // Log all receipt documents for debugging
    console.log("🚀 ~ All receipts in Firestore for user:", userId);
    monthlyUsageSnapshot.docs.forEach((doc, index) => {
      const data = doc.data();
      console.log(`Receipt ${index + 1}:`, {
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        imageUrl: data.imageUrl,
        excludeFromMonthlyCount: data.excludeFromMonthlyCount
      });
    });

    return validReceipts.length;
  } catch (error) {
    console.error('Error getting monthly receipt count:', error);
    return 0;
  }
}
