import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getMonthlyReceiptCount } from './getMonthlyReceipts';

export async function debugSubscriptionState(userId: string) {
  try {
    // Get subscription document
    const subscriptionRef = doc(db, 'subscriptions', userId);
    const subscriptionDoc = await getDoc(subscriptionRef);
    const subscriptionData = subscriptionDoc.data();

    // Get current monthly count
    const currentCount = await getMonthlyReceiptCount(userId);

    // Get all receipts to analyze them
    const receiptsQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', userId)
    );
    const receiptsSnapshot = await getDocs(receiptsQuery);

    // Analyze receipts
    const receiptsAnalysis = {
      total: receiptsSnapshot.size,
      excluded: 0,
      deleted: 0,
      thisMonth: 0,
      afterReset: 0
    };

    const resetDate = subscriptionData?.lastMonthlyCountResetAt?.toDate();
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    console.log('🔍 DETAILED SUBSCRIPTION DEBUG:');
    console.log('Current Tier:', subscriptionData?.currentTier || 'trial');
    console.log('Last Monthly Count Reset At:', resetDate);
    console.log('Current Monthly Receipt Count:', currentCount);
    console.log('Start of Current Month:', startOfMonth);
    
    const receiptDetails: Array<{
      id: string;
      createdAt: Date;
      isExcluded: boolean;
      isDeleted: boolean;
      isThisMonth: boolean;
      isAfterReset: boolean;
      vendor: string;
      amount: number;
    }> = [];
    
    receiptsSnapshot.docs.forEach((receiptDoc) => {
      const data = receiptDoc.data();
      const createdAt = data.createdAt?.toDate() || data.createdAt;
      const isExcluded = data.excludeFromMonthlyCount === true;
      const isDeleted = data.status === 'deleted';
      const isThisMonth = createdAt >= startOfMonth;
      const isAfterReset = resetDate ? createdAt >= resetDate : true;
      
      if (isExcluded) receiptsAnalysis.excluded++;
      if (isDeleted) receiptsAnalysis.deleted++;
      if (isThisMonth) receiptsAnalysis.thisMonth++;
      if (isAfterReset) receiptsAnalysis.afterReset++;

      receiptDetails.push({
        id: receiptDoc.id.substring(0, 8),
        createdAt,
        isExcluded,
        isDeleted,
        isThisMonth,
        isAfterReset,
        vendor: data.vendor,
        amount: data.amount
      });
    });

    console.log('📊 RECEIPTS ANALYSIS:', receiptsAnalysis);
    console.log('📝 RECEIPT DETAILS:', receiptDetails);
    
    // Check if there's a discrepancy
    if (resetDate) {
      const now = new Date();
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      console.log('Days since last reset:', daysSinceReset);
      
      const shouldCount = receiptsSnapshot.docs.filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate() || data.createdAt;
        return createdAt >= resetDate && !data.excludeFromMonthlyCount;
      }).length;
      
      console.log('Expected count (receipts after reset, not excluded):', shouldCount);
      console.log('Actual count from getMonthlyReceiptCount:', currentCount);
      console.log('Counts match:', shouldCount === currentCount);
    }

    return {
      currentTier: subscriptionData?.currentTier || 'trial',
      lastResetDate: resetDate,
      currentCount,
      receiptsAnalysis,
      receiptDetails,
      subscriptionData
    };
  } catch (error) {
    console.error('Error debugging subscription state:', error);
    throw error;
  }
}
