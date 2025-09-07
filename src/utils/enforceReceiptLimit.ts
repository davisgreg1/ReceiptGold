import { db } from '../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TeamService } from '../services/TeamService';

export async function enforceReceiptLimit(
  userId: string | undefined,
  maxReceipts: number,
  onLimitExceeded: () => void
): Promise<boolean> {
  if (!userId) return false;
  if (maxReceipts === -1) return true; // Unlimited plan

  // Check if user is a team member - team members get unlimited receipts
  try {
    const teamMembership = await TeamService.getTeamMembershipByUserId(userId);
    if (teamMembership && teamMembership.status === 'active') {
      return true; // Team members have unlimited receipts
    }
  } catch (error) {
    console.error('Error checking team membership:', error);
    // Continue with normal limit check if team check fails
  }
  
  // Get current month's receipt count
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  
  try {
    // Query all receipts created this month
    const monthlyQuery = query(
      collection(db, 'receipts'),
      where('userId', '==', userId),
      where('createdAt', '>=', startOfMonth)
    );
    
    const snapshot = await getDocs(monthlyQuery);
    const currentCount = snapshot.size;
    
    // Strict check - must be under the limit
    if (currentCount >= maxReceipts) {
      onLimitExceeded();
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error checking receipt limit:', error);
    // If we can't verify the limit, prevent access to be safe
    onLimitExceeded();
    return false;
  }
}
