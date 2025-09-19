import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  setDoc,
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  limit,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  TeamInvitation, 
  TeamMember, 
  TeamStats, 
  CreateTeamInvitationRequest,
  TeamMemberRole
} from '../types/team';
import { generateSecureToken } from '../utils/security';

export class TeamService {
  private static readonly COLLECTIONS = {
    INVITATIONS: 'teamInvitations',
    MEMBERS: 'teamMembers',
  };

  // Team Invitation Methods
  static async createInvitation(
    accountHolderId: string, 
    request: CreateTeamInvitationRequest
  ): Promise<TeamInvitation> {
    try {
      const inviteEmail = request.inviteEmail.toLowerCase();
      
      // Validation: Check if email already exists as a team member
      console.log('🔍 Checking for existing team member with email:', inviteEmail);
      const existingMemberQuery = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('email', '==', inviteEmail),
        where('status', '==', 'active'),
        limit(5) // Add explicit limit for security rules
      );
      const existingMemberSnapshot = await getDocs(existingMemberQuery);
      
      if (!existingMemberSnapshot.empty) {
        throw new Error('This email address is already registered as a team member');
      }
      
      // Validation: Check if there's already a pending invitation for this email
      console.log('🔍 Checking for existing pending invitation with email:', inviteEmail);
      const existingInvitationQuery = query(
        collection(db, this.COLLECTIONS.INVITATIONS),
        where('inviteEmail', '==', inviteEmail),
        where('status', '==', 'pending'),
        where('expiresAt', '>', new Date()), // Only check non-expired invitations
        limit(5) // Add explicit limit for security rules
      );
      const existingInvitationSnapshot = await getDocs(existingInvitationQuery);
      
      if (!existingInvitationSnapshot.empty) {
        throw new Error('There is already a pending invitation for this email address');
      }
      
      // Validation: Check if this email belongs to an existing user (account holder)
      console.log('🔍 Checking if email belongs to an existing user account:', inviteEmail);
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', inviteEmail),
        limit(5) // Add explicit limit for security rules
      );
      const usersSnapshot = await getDocs(usersQuery);
      
      if (!usersSnapshot.empty) {
        throw new Error('This email address is already registered as a user account. Users cannot be invited as team members.');
      }

      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

      const invitation: Omit<TeamInvitation, 'id'> = {
        accountHolderId,
        accountHolderEmail: '', // Will be filled by Cloud Function
        accountHolderName: request.accountHolderName,
        businessId: request.businessId,
        businessName: request.businessName,
        inviteEmail: inviteEmail, // Use the already normalized email
        status: 'pending',
        token,
        expiresAt,
        createdAt: new Date(),
        role: request.role,
      };

      const docRef = await addDoc(collection(db, this.COLLECTIONS.INVITATIONS), {
        ...invitation,
        expiresAt: Timestamp.fromDate(expiresAt),
        createdAt: serverTimestamp(),
      });

      return {
        id: docRef.id,
        ...invitation,
      };
    } catch (error) {
      console.error('❌ Error creating team invitation:', error);
      throw new Error('Failed to create team invitation');
    }
  }

  static async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.INVITATIONS),
        where('token', '==', token),
        where('status', '==', 'pending')
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      return {
        id: doc.id,
        accountHolderId: data.accountHolderId,
        accountHolderEmail: data.accountHolderEmail,
        accountHolderName: data.accountHolderName,
        businessId: data.businessId,
        businessName: data.businessName,
        inviteEmail: data.inviteEmail,
        status: data.status,
        token: data.token,
        expiresAt: data.expiresAt.toDate(),
        createdAt: data.createdAt?.toDate() || new Date(),
        acceptedAt: data.acceptedAt?.toDate(),
        revokedAt: data.revokedAt?.toDate(),
        role: data.role,
      };
    } catch (error) {
      console.error('❌ Error getting invitation by token:', error);
      return null;
    }
  }

  static async getInvitationsForAccount(accountHolderId: string): Promise<TeamInvitation[]> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.INVITATIONS),
        where('accountHolderId', '==', accountHolderId),
        orderBy('createdAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const invitations: TeamInvitation[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        invitations.push({
          id: doc.id,
          accountHolderId: data.accountHolderId,
          accountHolderEmail: data.accountHolderEmail,
          accountHolderName: data.accountHolderName,
          businessId: data.businessId,
          businessName: data.businessName,
          inviteEmail: data.inviteEmail,
          status: data.status,
          token: data.token,
          expiresAt: data.expiresAt.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
          acceptedAt: data.acceptedAt?.toDate(),
          revokedAt: data.revokedAt?.toDate(),
          role: data.role,
        });
      });

      // Filter to only show pending invitations that haven't expired
      const activeInvitations = invitations.filter(invitation => 
        invitation.status === 'pending' && invitation.expiresAt > new Date()
      );
      
      return activeInvitations;
    } catch (error) {
      console.error('❌ Error getting invitations for account:', error);
      throw new Error('Failed to get team invitations');
    }
  }

  static async acceptInvitation(
    invitationId: string,
    userId: string,
    displayName?: string
  ): Promise<TeamMember> {
    try {
      const invitationRef = doc(db, this.COLLECTIONS.INVITATIONS, invitationId);
      const invitationSnap = await getDoc(invitationRef);

      if (!invitationSnap.exists()) {
        throw new Error('Invitation not found');
      }

      const invitation = invitationSnap.data() as TeamInvitation;

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        throw new Error('Invitation is no longer valid');
      }

      if (new Date() > invitation.expiresAt) {
        throw new Error('Invitation has expired');
      }

      // Validation: Check if accepting user has an active subscription
      const subscriptionDoc = await getDoc(doc(db, 'subscriptions', userId));

      if (subscriptionDoc.exists()) {
        const subscriptionData = subscriptionDoc.data();

        // Check if user has any active subscription or trial
        if (subscriptionData?.status === 'active' && subscriptionData?.currentTier !== 'trial') {
          throw new Error('Users with active subscriptions cannot become team members. Please cancel your subscription first.');
        }
      }

      // Create team member
      const teamMember: Omit<TeamMember, 'id'> = {
        accountHolderId: invitation.accountHolderId,
        accountHolderEmail: invitation.accountHolderEmail,
        businessId: invitation.businessId,
        businessName: invitation.businessName,
        userId,
        email: invitation.inviteEmail,
        displayName,
        role: invitation.role,
        status: 'active',
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        permissions: this.getDefaultPermissions(invitation.role),
      };

      const memberDocRef = await addDoc(collection(db, this.COLLECTIONS.MEMBERS), {
        ...teamMember,
        joinedAt: serverTimestamp(),
        lastActiveAt: serverTimestamp(),
      });

      // Update invitation status
      await updateDoc(invitationRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp(),
      });

      return {
        id: memberDocRef.id,
        ...teamMember,
      };
    } catch (error) {
      console.error('❌ Error accepting invitation:', error);
      throw error;
    }
  }

  static async revokeInvitation(invitationId: string): Promise<void> {
    try {
      const invitationRef = doc(db, this.COLLECTIONS.INVITATIONS, invitationId);
      await updateDoc(invitationRef, {
        status: 'revoked',
        revokedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error revoking invitation:', error);
      throw new Error('Failed to revoke invitation');
    }
  }

  // Team Member Methods
  static async getTeamMembers(accountHolderId: string): Promise<TeamMember[]> {
    try {
      console.log('🔍 TeamService.getTeamMembers called with accountHolderId:', accountHolderId);
      
      const q = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('accountHolderId', '==', accountHolderId),
        where('status', '==', 'active'),
        orderBy('joinedAt', 'asc')
      );

      const snapshot = await getDocs(q);
      console.log('🔍 TeamService.getTeamMembers snapshot.size:', snapshot.size);
      console.log('🔍 TeamService.getTeamMembers snapshot.empty:', snapshot.empty);
      
      const members: TeamMember[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        members.push({
          id: doc.id,
          accountHolderId: data.accountHolderId,
          accountHolderEmail: data.accountHolderEmail,
          businessId: data.businessId,
          businessName: data.businessName,
          userId: data.userId,
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          status: data.status,
          joinedAt: data.joinedAt?.toDate() || new Date(),
          lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
          permissions: data.permissions,
        });
      });

      console.log('🔍 TeamService.getTeamMembers returning members:', members.length, 'members');
      console.log('🔍 TeamService.getTeamMembers members details:', members);
      return members;
    } catch (error) {
      console.error('❌ Error getting team members:', error);
      throw new Error('Failed to get team members');
    }
  }


  static async removeMember(memberId: string): Promise<void> {
    try {
      const memberRef = doc(db, this.COLLECTIONS.MEMBERS, memberId);
      await updateDoc(memberRef, {
        status: 'suspended',
      });
    } catch (error) {
      console.error('❌ Error removing team member:', error);
      throw new Error('Failed to remove team member');
    }
  }

  static async updateMemberLastActive(memberId: string): Promise<void> {
    try {
      const memberRef = doc(db, this.COLLECTIONS.MEMBERS, memberId);
      await updateDoc(memberRef, {
        lastActiveAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('❌ Error updating member last active:', error);
      // Don't throw - this is non-critical
    }
  }

  // Team Stats Methods
  static async getTeamStats(accountHolderId: string): Promise<TeamStats> {
    try {
      const [members, invitations] = await Promise.all([
        this.getTeamMembers(accountHolderId),
        this.getInvitationsForAccount(accountHolderId),
      ]);

      const pendingInvitations = invitations.filter(
        inv => inv.status === 'pending' && inv.expiresAt > new Date()
      );

      return {
        totalMembers: members.length,
        activeMembers: members.filter(member => member.status === 'active').length,
        pendingInvitations: pendingInvitations.length,
        totalTeamReceipts: 0, // Will be calculated by receipt service
      };
    } catch (error) {
      console.error('❌ Error getting team stats:', error);
      throw new Error('Failed to get team stats');
    }
  }

  // Utility Methods

  static async getTeamMembershipByUserId(userId: string): Promise<TeamMember | null> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return {
          id: doc.id,
          ...doc.data()
        } as TeamMember;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting team membership:', error);
      return null;
    }
  }

  private static getDefaultPermissions(role: TeamMemberRole) {
    switch (role) {
      case 'teammate':
        return {
          canCreateReceipts: true,
          canEditOwnReceipts: true,
          canDeleteOwnReceipts: true,
          canViewTeamReceipts: false,
        };
      case 'admin':
        return {
          canCreateReceipts: true,
          canEditOwnReceipts: true,
          canDeleteOwnReceipts: true,
          canViewTeamReceipts: true,
        };
      default:
        return {
          canCreateReceipts: false,
          canEditOwnReceipts: false,
          canDeleteOwnReceipts: false,
          canViewTeamReceipts: false,
        };
    }
  }

}