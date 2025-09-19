import { TeamService } from './TeamService';
import { createReceiptDocument } from '../../db';

interface ReceiptData {
  businessId?: string | null;
  vendor?: string;
  amount?: number;
  currency?: string;
  date?: any;
  description?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  images?: Array<{
    url: string;
    size: number;
    uploadedAt: Date;
  }>;
  extractedData?: {
    vendor?: string;
    amount?: number;
    tax?: number;
    date?: string;
    confidence?: number;
    items?: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
  tax?: {
    deductible?: boolean;
    deductionPercentage?: number;
    taxYear?: number;
    category?: string;
  };
}

export class ReceiptTeamService {
  /**
   * Create a receipt with proper team attribution handling
   * If the user is a team member, the receipt will be stored under the account holder
   * and proper attribution will be added
   */
  static async createReceiptWithTeamAttribution(
    userId: string,
    receiptData: ReceiptData
  ) {
    try {
      // Check if the current user is a team member
      const teamMember = await TeamService.getTeamMembershipByUserId(userId);
      
      let teamAttribution = undefined;
      let effectiveUserId = userId;
      
      if (teamMember) {
        // User is a team member - store receipt under account holder
        effectiveUserId = teamMember.accountHolderId;
        teamAttribution = {
          accountHolderId: teamMember.accountHolderId,
          createdByUserId: userId,
          createdByEmail: teamMember.email,
          createdByName: teamMember.displayName,
          isTeamReceipt: true,
        };
        
        // Ensure receipt is associated with the team member's business
        if (!receiptData.businessId) {
          receiptData.businessId = teamMember.businessId;
        }
      }

      // Create the receipt with team attribution
      const receiptRef = await createReceiptDocument(
        effectiveUserId,
        receiptData as any,
        teamAttribution
      );

      return receiptRef;
    } catch (error) {
      console.error('Error creating receipt with team attribution:', error);
      throw error;
    }
  }

  /**
   * Get team attribution info for the current user
   * Returns null if user is not a team member
   */
  static async getTeamAttributionForUser(userId: string) {
    try {
      const teamMember = await TeamService.getTeamMembershipByUserId(userId);
      
      if (!teamMember) {
        return null;
      }

      return {
        accountHolderId: teamMember.accountHolderId,
        createdByUserId: userId,
        createdByEmail: teamMember.email,
        createdByName: teamMember.displayName,
        businessId: teamMember.businessId,
        businessName: teamMember.businessName,
        isTeamReceipt: true,
      };
    } catch (error) {
      console.error('Error getting team attribution:', error);
      return null;
    }
  }

  /**
   * Check if a user is a team member and should store receipts under account holder
   */
  static async isTeamMember(userId: string): Promise<boolean> {
    try {
      const teamMember = await TeamService.getTeamMembershipByUserId(userId);
      return teamMember !== null;
    } catch (error) {
      console.error('Error checking team membership:', error);
      return false;
    }
  }

  /**
   * Get the effective user ID for receipt storage
   * Returns account holder ID if user is a team member, otherwise returns the user ID
   */
  static async getEffectiveUserIdForReceipts(userId: string): Promise<string> {
    try {
      const teamMember = await TeamService.getTeamMembershipByUserId(userId);
      return teamMember?.accountHolderId || userId;
    } catch (error) {
      console.error('Error getting effective user ID:', error);
      return userId;
    }
  }
}