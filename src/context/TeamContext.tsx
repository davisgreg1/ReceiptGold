import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { TeamService } from '../services/TeamService';
import {
  TeamInvitation,
  TeamMember,
  TeamStats,
  CreateTeamInvitationRequest,
  AcceptTeamInvitationRequest,
} from '../types/team';

interface TeamContextType {
  // State
  teamMembers: TeamMember[];
  teamInvitations: TeamInvitation[];
  teamStats: TeamStats | null;
  loading: boolean;
  error: string | null;
  
  // Team member info
  isTeamMember: boolean;
  currentMembership: TeamMember | null;
  accountHolderId: string | null; // ID of the account this user belongs to
  
  // Actions
  inviteTeammate: (request: CreateTeamInvitationRequest) => Promise<TeamInvitation>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  acceptInvitation: (request: AcceptTeamInvitationRequest) => Promise<TeamMember>;
  removeTeamMember: (memberId: string) => Promise<void>;
  refreshTeamData: () => Promise<void>;
  
  // Utilities
  canInviteMembers: () => boolean;
  canManageTeam: () => boolean;
  hasReachedMemberLimit: () => boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { subscription, canAccessFeature } = useSubscription();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Team member info
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<TeamMember | null>(null);
  const [accountHolderId, setAccountHolderId] = useState<string | null>(null);

  // Load team data when user changes
  useEffect(() => {
    if (user?.uid && canAccessFeature('teamManagement')) {
      loadTeamData();
    } else {
      // Clear data when user logs out or loses team access
      clearTeamData();
    }
  }, [user, canAccessFeature]);

  const clearTeamData = useCallback(() => {
    setTeamMembers([]);
    setTeamInvitations([]);
    setTeamStats(null);
    setIsTeamMember(false);
    setCurrentMembership(null);
    setAccountHolderId(null);
    setError(null);
  }, []);

  const loadTeamData = useCallback(async () => {
    if (!user?.uid) return;

    setLoading(true);
    setError(null);

    try {
      // Check if current user is a team member first
      const membership = await TeamService.getTeamMembershipByUserId(user.uid);
      if (membership) {
        setIsTeamMember(true);
        setCurrentMembership(membership);
        setAccountHolderId(membership.accountHolderId);
        
        // Update last active
        await TeamService.updateMemberLastActive(membership.id!);
        return; // Team members don't need to load team management data
      }

      // User is an account holder, load team management data
      setIsTeamMember(false);
      setCurrentMembership(null);
      setAccountHolderId(user.uid);

      const [members, invitations, stats] = await Promise.all([
        TeamService.getTeamMembers(user.uid),
        TeamService.getInvitationsForAccount(user.uid),
        TeamService.getTeamStats(user.uid),
      ]);

      setTeamMembers(members);
      setTeamInvitations(invitations);
      setTeamStats(stats);
    } catch (err) {
      console.error('Error loading team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshTeamData = useCallback(async () => {
    await loadTeamData();
  }, [loadTeamData]);

  const inviteTeammate = useCallback(async (request: CreateTeamInvitationRequest): Promise<TeamInvitation> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    if (!canInviteMembers()) {
      throw new Error('Cannot invite team members with current subscription');
    }

    if (hasReachedMemberLimit()) {
      throw new Error('Team member limit reached');
    }

    try {
      const invitation = await TeamService.createInvitation(user.uid, request);
      
      // Refresh invitations list
      const updatedInvitations = await TeamService.getInvitationsForAccount(user.uid);
      setTeamInvitations(updatedInvitations);
      
      return invitation;
    } catch (error) {
      console.error('Error inviting teammate:', error);
      throw error;
    }
  }, [user, canInviteMembers, hasReachedMemberLimit]);

  const revokeInvitation = useCallback(async (invitationId: string): Promise<void> => {
    try {
      await TeamService.revokeInvitation(invitationId);
      
      // Refresh invitations list
      if (user?.uid) {
        const updatedInvitations = await TeamService.getInvitationsForAccount(user.uid);
        setTeamInvitations(updatedInvitations);
      }
    } catch (error) {
      console.error('Error revoking invitation:', error);
      throw error;
    }
  }, [user]);

  const acceptInvitation = useCallback(async (request: AcceptTeamInvitationRequest): Promise<TeamMember> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    try {
      // Get invitation details first
      const invitation = await TeamService.getInvitationByToken(request.token);
      if (!invitation) {
        throw new Error('Invalid invitation token');
      }

      const member = await TeamService.acceptInvitation(
        invitation.id!,
        user.uid,
        request.displayName
      );

      // Update context state to reflect that user is now a team member
      setIsTeamMember(true);
      setCurrentMembership(member);
      setAccountHolderId(member.accountHolderId);

      return member;
    } catch (error) {
      console.error('Error accepting invitation:', error);
      throw error;
    }
  }, [user]);

  const removeTeamMember = useCallback(async (memberId: string): Promise<void> => {
    try {
      await TeamService.removeMember(memberId);
      
      // Refresh team data
      await refreshTeamData();
    } catch (error) {
      console.error('Error removing team member:', error);
      throw error;
    }
  }, [refreshTeamData]);

  // Utility functions
  const canInviteMembers = useCallback((): boolean => {
    return canAccessFeature('teamManagement') && !isTeamMember;
  }, [canAccessFeature, isTeamMember]);

  const canManageTeam = useCallback((): boolean => {
    return canAccessFeature('teamManagement') && !isTeamMember;
  }, [canAccessFeature, isTeamMember]);

  const hasReachedMemberLimit = useCallback((): boolean => {
    const maxMembers = subscription.limits.maxTeamMembers;
    if (maxMembers === -1) return false; // Unlimited
    
    const currentCount = teamMembers.length + teamInvitations.filter(
      inv => inv.status === 'pending' && inv.expiresAt > new Date()
    ).length;
    
    return currentCount >= maxMembers;
  }, [subscription.limits.maxTeamMembers, teamMembers.length, teamInvitations]);

  const contextValue: TeamContextType = {
    // State
    teamMembers,
    teamInvitations,
    teamStats,
    loading,
    error,
    
    // Team member info
    isTeamMember,
    currentMembership,
    accountHolderId,
    
    // Actions
    inviteTeammate,
    revokeInvitation,
    acceptInvitation,
    removeTeamMember,
    refreshTeamData,
    
    // Utilities
    canInviteMembers,
    canManageTeam,
    hasReachedMemberLimit,
  };

  return (
    <TeamContext.Provider value={contextValue}>
      {children}
    </TeamContext.Provider>
  );
};

export const useTeam = () => {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error('useTeam must be used within a TeamProvider');
  }
  return context;
};