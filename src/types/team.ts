export type TeamMemberRole = 'teammate' | 'admin';
export type TeamMemberStatus = 'active' | 'suspended' | 'pending';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TeamInvitation {
  id?: string;
  accountHolderId: string; // Professional user who sent invite
  accountHolderEmail: string; // For easy identification
  accountHolderName: string; // Display name of account holder
  businessId: string; // Business this team member will be associated with
  businessName: string; // For easy identification
  inviteEmail: string;
  status: InvitationStatus;
  token: string; // Secure invitation token
  expiresAt: Date;
  createdAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  role: TeamMemberRole;
}

export interface TeamMember {
  id?: string;
  accountHolderId: string; // Professional user who owns the account
  accountHolderEmail: string; // For easy identification
  businessId: string; // Business this team member is associated with
  businessName: string; // For easy identification
  userId: string; // Firebase Auth UID of the team member
  email: string;
  displayName?: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  joinedAt: Date;
  lastActiveAt: Date;
  permissions: TeamPermissions;
}

export interface TeamPermissions {
  canCreateReceipts: boolean;
  canEditOwnReceipts: boolean;
  canDeleteOwnReceipts: boolean;
  canViewTeamReceipts: boolean; // For future expansion
}

export interface TeamStats {
  totalMembers: number;
  activeMembers: number;
  pendingInvitations: number;
  totalTeamReceipts: number;
}

export interface CreateTeamInvitationRequest {
  inviteEmail: string;
  role: TeamMemberRole;
  accountHolderName: string;
  businessId: string;
  businessName: string;
}

export interface AcceptTeamInvitationRequest {
  token: string;
  password: string;
  displayName?: string;
}

// Extended receipt interface for team attribution
export interface TeamAwareReceipt {
  id?: string;
  // ... existing receipt fields
  createdBy: string; // userId of creator
  createdByEmail: string; // For easy identification
  createdByName?: string; // Display name of creator
  teamAccountId?: string; // Account holder's ID if created by teammate
  isTeamReceipt: boolean; // Quick flag to identify team receipts
}

export interface TeamReceiptFilter {
  accountHolderId?: string;
  createdBy?: string;
  isTeamReceipt?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}