import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  Timestamp,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { 
  TeamInvitation, 
  TeamMember, 
  TeamStats, 
  CreateTeamInvitationRequest,
  TeamMemberRole,
  TeamMemberStatus,
  InvitationStatus
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
      const token = generateSecureToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expire in 7 days

      const invitation: Omit<TeamInvitation, 'id'> = {
        accountHolderId,
        accountHolderEmail: '', // Will be filled by Cloud Function
        accountHolderName: request.accountHolderName,
        inviteEmail: request.inviteEmail.toLowerCase(),
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

      return invitations;
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

      if (new Date() > invitation.expiresAt.toDate()) {
        throw new Error('Invitation has expired');
      }

      // Create team member
      const teamMember: Omit<TeamMember, 'id'> = {
        accountHolderId: invitation.accountHolderId,
        accountHolderEmail: invitation.accountHolderEmail,
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
      const q = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('accountHolderId', '==', accountHolderId),
        where('status', '==', 'active'),
        orderBy('joinedAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const members: TeamMember[] = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        members.push({
          id: doc.id,
          accountHolderId: data.accountHolderId,
          accountHolderEmail: data.accountHolderEmail,
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

      return members;
    } catch (error) {
      console.error('❌ Error getting team members:', error);
      throw new Error('Failed to get team members');
    }
  }

  static async getTeamMemberByUserId(
    accountHolderId: string, 
    userId: string
  ): Promise<TeamMember | null> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('accountHolderId', '==', accountHolderId),
        where('userId', '==', userId),
        where('status', '==', 'active')
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
        userId: data.userId,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        status: data.status,
        joinedAt: data.joinedAt?.toDate() || new Date(),
        lastActiveAt: data.lastActiveAt?.toDate() || new Date(),
        permissions: data.permissions,
      };
    } catch (error) {
      console.error('❌ Error getting team member by user ID:', error);
      return null;
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
  static isTeamMember(userId: string, accountHolderId: string): Promise<boolean> {
    return this.getTeamMemberByUserId(accountHolderId, userId)
      .then(member => member !== null)
      .catch(() => false);
  }

  static async getAccountHolderForTeamMember(userId: string): Promise<string | null> {
    try {
      const q = query(
        collection(db, this.COLLECTIONS.MEMBERS),
        where('userId', '==', userId),
        where('status', '==', 'active')
      );
      
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const memberData = snapshot.docs[0].data();
        return memberData.accountHolderId || null;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting account holder for team member:', error);
      return null;
    }
  }

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