import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { TeamService } from '../services/TeamService';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCustomAlert } from '../hooks/useCustomAlert';
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
  const { user, logout } = useAuth();
  const { subscription, canAccessFeature, loading: subscriptionLoading } = useSubscription();
  const { showInfo } = useCustomAlert();
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamInvitations, setTeamInvitations] = useState<TeamInvitation[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Team member info
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<TeamMember | null>(null);
  const [accountHolderId, setAccountHolderId] = useState<string | null>(null);
  
  // Refs to prevent infinite loops
  const isLoadingRef = useRef(false);
  const lastMembershipIdRef = useRef<string | null>(null);

  // Load team data when user changes (only depend on user, not subscription)
  useEffect(() => {
    if (user?.uid) {
      // Always check if user is a team member, regardless of teamManagement feature
      loadTeamData();
    } else {
      // Clear data when user logs out
      clearTeamData();
    }
  }, [user?.uid]); // Only depend on user.uid to prevent loops

  const clearTeamData = useCallback(() => {
    setTeamMembers([]);
    setTeamInvitations([]);
    setTeamStats(null);
    setIsTeamMember(false);
    setCurrentMembership(null);
    setAccountHolderId(null);
    setError(null);
  }, []);

  const handleTeamMemberRevocation = useCallback(async () => {
    console.log('🔒 Handling team member revocation - signing out user');
    
    // Clear team data immediately
    clearTeamData();
    
    // Show notification to user about revocation (no interaction required)
    showInfo('Access Revoked', 'Your team access has been revoked. Signing out automatically...');
    
    // Sign out the user after a brief delay to allow notification to be seen
    setTimeout(() => {
      logout();
    }, 2000);
  }, [clearTeamData, logout, showInfo]);

  // Monitor team member status in real-time for revocation detection
  useEffect(() => {
    if (!user?.uid || !isTeamMember || !currentMembership?.id) {
      lastMembershipIdRef.current = null;
      return;
    }

    // Prevent setting up duplicate listeners
    if (lastMembershipIdRef.current === currentMembership.id) {
      return;
    }

    lastMembershipIdRef.current = currentMembership.id;
    console.log('🔍 Setting up real-time team membership monitoring for:', currentMembership.id);

    // Listen to changes in the team member document
    const unsubscribe = onSnapshot(
      doc(db, 'teamMembers', currentMembership.id),
      (doc) => {
        if (!doc.exists()) {
          // Team member document was deleted - user was removed
          console.log('🚨 Team member document deleted - user was revoked');
          handleTeamMemberRevocation();
          return;
        }

        const data = doc.data();
        
        // Check if status changed to inactive/revoked
        if (data.status !== 'active') {
          console.log('🚨 Team member status changed to:', data.status);
          handleTeamMemberRevocation();
          return;
        }

        // Update current membership data if it changed
        const updatedMembership: TeamMember = {
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
          joinedAt: data.joinedAt?.toDate ? data.joinedAt.toDate() : new Date(data.joinedAt),
          lastActiveAt: data.lastActiveAt?.toDate ? data.lastActiveAt.toDate() : new Date(data.lastActiveAt),
          permissions: data.permissions,
        };

        setCurrentMembership(updatedMembership);
      },
      (error) => {
        console.error('❌ Error monitoring team membership:', error);
        // If there's an error accessing the document, it might mean the user was revoked
        if (error.code === 'permission-denied') {
          console.log('🚨 Permission denied - user may have been revoked');
          handleTeamMemberRevocation();
        }
      }
    );

    return unsubscribe;
  }, [user?.uid, isTeamMember, currentMembership?.id]); // Removed handleTeamMemberRevocation to prevent loops

  const loadTeamData = useCallback(async () => {
    if (!user?.uid) {
      console.log('🔍 TeamContext.loadTeamData: No user.uid, returning early');
      return;
    }

    // Prevent concurrent loading
    if (isLoadingRef.current) {
      console.log('🔍 TeamContext.loadTeamData: Already loading, skipping');
      return;
    }

    isLoadingRef.current = true;
    console.log('🔍 TeamContext.loadTeamData: Starting for user:', user.uid);
    setLoading(true);
    setError(null);

    try {
      // Check if current user is a team member first
      console.log('🔍 TeamContext.loadTeamData: Checking if user is team member...');
      const membership = await TeamService.getTeamMembershipByUserId(user.uid);
      console.log('🔍 TeamContext.loadTeamData: Membership result:', membership);
      if (membership) {
        setIsTeamMember(true);
        setCurrentMembership(membership);
        setAccountHolderId(membership.accountHolderId);
        
        // Update last active
        await TeamService.updateMemberLastActive(membership.id!);
        
        // Admin team members need to load team management data
        if (membership.role === 'admin') {
          const [members, invitations, stats] = await Promise.all([
            TeamService.getTeamMembers(membership.accountHolderId),
            TeamService.getInvitationsForAccount(membership.accountHolderId),
            TeamService.getTeamStats(membership.accountHolderId),
          ]);

          console.log('🚀 ~ TeamContext ~ loadTeamData (admin member) members:', members);
          console.log('🚀 ~ TeamContext ~ loadTeamData (admin member) invitations:', invitations);
          console.log('🚀 ~ TeamContext ~ loadTeamData (admin member) stats:', stats);

          setTeamMembers(members);
          setTeamInvitations(invitations);
          setTeamStats(stats);
        }
        
        return; // Regular team members don't need to load team management data
      }

      // User is an account holder, load team management data only if they have the feature
      console.log('🔍 TeamContext.loadTeamData: User is account holder, not team member');
      setIsTeamMember(false);
      setCurrentMembership(null);
      setAccountHolderId(user.uid);
      console.log('🔍 TeamContext.loadTeamData: Set accountHolderId to:', user.uid);

      console.log('🔍 TeamContext.loadTeamData: Checking canAccessFeature teamManagement...');
      const hasTeamFeature = canAccessFeature('teamManagement');
      console.log('🔍 TeamContext.loadTeamData: canAccessFeature result:', hasTeamFeature);
      
      if (hasTeamFeature) {
        console.log('🔍 TeamContext.loadTeamData: Loading team data for account holder...');
        const [members, invitations, stats] = await Promise.all([
          TeamService.getTeamMembers(user.uid),
          TeamService.getInvitationsForAccount(user.uid),
          TeamService.getTeamStats(user.uid),
        ]);

        console.log('🚀 ~ TeamContext ~ loadTeamData members:', members);
        console.log('🚀 ~ TeamContext ~ loadTeamData invitations:', invitations);
        console.log('🚀 ~ TeamContext ~ loadTeamData stats:', stats);

        setTeamMembers(members);
        setTeamInvitations(invitations);
        setTeamStats(stats);
      } else {
        // Clear team management data for users without the feature
        setTeamMembers([]);
        setTeamInvitations([]);
        setTeamStats(null);
      }
    } catch (err) {
      console.error('Error loading team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load team data');
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user]);

  const refreshTeamData = useCallback(async () => {
    // For refresh operations, don't clear existing data during loading
    // to prevent UI flicker
    if (!user?.uid) {
      console.log('🔍 TeamContext.refreshTeamData: No user.uid, returning early');
      return;
    }

    console.log('🔍 TeamContext.refreshTeamData: Starting refresh for user:', user.uid);
    setError(null);
    // Don't set loading to true for refresh to prevent UI flicker

    try {
      // Check if current user is a team member first
      console.log('🔍 TeamContext.refreshTeamData: Checking if user is team member...');
      const membership = await TeamService.getTeamMembershipByUserId(user.uid);
      console.log('🔍 TeamContext.refreshTeamData: Membership result:', membership);
      if (membership) {
        setIsTeamMember(true);
        setCurrentMembership(membership);
        setAccountHolderId(membership.accountHolderId);
        
        // Update last active
        await TeamService.updateMemberLastActive(membership.id!);
        
        // Admin team members need to load team management data
        if (membership.role === 'admin') {
          const [members, invitations, stats] = await Promise.all([
            TeamService.getTeamMembers(membership.accountHolderId),
            TeamService.getInvitationsForAccount(membership.accountHolderId),
            TeamService.getTeamStats(membership.accountHolderId),
          ]);

          console.log('🚀 ~ TeamContext ~ refreshTeamData (admin member) members:', members);
          console.log('🚀 ~ TeamContext ~ refreshTeamData (admin member) invitations:', invitations);
          console.log('🚀 ~ TeamContext ~ refreshTeamData (admin member) stats:', stats);

          setTeamMembers(members);
          setTeamInvitations(invitations);
          setTeamStats(stats);
        }
        
        return; // Regular team members don't need to load team management data
      }

      // User is an account holder, load team management data only if they have the feature
      console.log('🔍 TeamContext.refreshTeamData: User is account holder, not team member');
      setIsTeamMember(false);
      setCurrentMembership(null);
      setAccountHolderId(user.uid);
      console.log('🔍 TeamContext.refreshTeamData: Set accountHolderId to:', user.uid);

      console.log('🔍 TeamContext.refreshTeamData: Checking canAccessFeature teamManagement...');
      const hasTeamFeature = canAccessFeature('teamManagement');
      console.log('🔍 TeamContext.refreshTeamData: canAccessFeature result:', hasTeamFeature);
      
      if (hasTeamFeature) {
        console.log('🔍 TeamContext.refreshTeamData: Loading team data for account holder...');
        const [members, invitations, stats] = await Promise.all([
          TeamService.getTeamMembers(user.uid),
          TeamService.getInvitationsForAccount(user.uid),
          TeamService.getTeamStats(user.uid),
        ]);

        console.log('🚀 ~ TeamContext ~ refreshTeamData members:', members);
        console.log('🚀 ~ TeamContext ~ refreshTeamData invitations:', invitations);
        console.log('🚀 ~ TeamContext ~ refreshTeamData stats:', stats);

        setTeamMembers(members);
        setTeamInvitations(invitations);
        setTeamStats(stats);
      } else {
        // Clear team management data for users without the feature
        setTeamMembers([]);
        setTeamInvitations([]);
        setTeamStats(null);
      }
    } catch (err) {
      console.error('Error refreshing team data:', err);
      setError(err instanceof Error ? err.message : 'Failed to refresh team data');
    }
  }, [user, canAccessFeature]);

  const hasReachedMemberLimit = useCallback((): boolean => {
    const maxMembers = subscription.limits.maxTeamMembers;
    const pendingInvitations = teamInvitations.filter(
      inv => inv.status === 'pending' && inv.expiresAt > new Date()
    ).length;
    const currentCount = teamMembers.length + pendingInvitations;
    
    console.log('🔍 hasReachedMemberLimit check:');
    console.log('  - maxMembers:', maxMembers);
    console.log('  - teamMembers.length:', teamMembers.length);
    console.log('  - pendingInvitations:', pendingInvitations);
    console.log('  - currentCount:', currentCount);
    console.log('  - isTeamMember:', isTeamMember);
    console.log('  - currentMembership?.role:', currentMembership?.role);
    
    if (maxMembers === -1) {
      console.log('  ✅ Unlimited members - returning false');
      return false; // Unlimited
    }
    
    const hasReached = currentCount >= maxMembers;
    console.log('  hasReachedMemberLimit result:', hasReached);
    return hasReached;
  }, [subscription.limits.maxTeamMembers, teamInvitations, teamMembers.length]);

  const inviteTeammate = useCallback(async (request: CreateTeamInvitationRequest): Promise<TeamInvitation> => {
    if (!user?.uid) {
      throw new Error('User must be authenticated');
    }

    // Check invitation permissions directly to avoid stale closures
    const canInvite = !subscriptionLoading && (
      (!isTeamMember && canAccessFeature('teamManagement')) || // Account holders
      (isTeamMember && currentMembership?.role === 'admin')    // Admin team members
    );
    
    if (!canInvite) {
      throw new Error('You do not have permission to invite team members');
    }

    if (hasReachedMemberLimit()) {
      throw new Error('Team member limit reached');
    }

    try {
      console.log('🚀 ~ TeamContext ~ inviteTeammate ~ creating invitation for:', request.inviteEmail);
      
      // Determine the correct account holder ID
      const accountHolderIdToUse = isTeamMember && currentMembership 
        ? currentMembership.accountHolderId 
        : user.uid;
      
      const invitation = await TeamService.createInvitation(accountHolderIdToUse, request);
      console.log('🚀 ~ TeamContext ~ inviteTeammate ~ created invitation:', invitation);
      
      // Refresh invitations list using the correct account holder ID
      const updatedInvitations = await TeamService.getInvitationsForAccount(accountHolderIdToUse);
      console.log('🚀 ~ TeamContext ~ inviteTeammate ~ updated invitations:', updatedInvitations);
      setTeamInvitations(updatedInvitations);
      
      return invitation;
    } catch (error) {
      console.error('Error inviting teammate:', error);
      throw error;
    }
  }, [user?.uid, subscriptionLoading, isTeamMember, currentMembership, canAccessFeature, hasReachedMemberLimit]);

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
    console.log('🔍 canInviteMembers check:');
    console.log('  - subscriptionLoading:', subscriptionLoading);
    console.log('  - isTeamMember:', isTeamMember);
    console.log('  - currentMembership?.role:', currentMembership?.role);
    console.log('  - canAccessFeature(teamManagement):', canAccessFeature('teamManagement'));
    
    if (subscriptionLoading) {
      console.log('  ❌ Returning false - subscription still loading');
      return false;
    }
    
    // Account holders can always invite if they have the feature
    if (!isTeamMember && canAccessFeature('teamManagement')) {
      console.log('  ✅ Returning true - Account holder with team management feature');
      return true;
    }
    
    // Admin team members can also invite team members
    if (isTeamMember && currentMembership?.role === 'admin') {
      console.log('  ✅ Returning true - Admin team member');
      return true;
    }
    
    console.log('  ❌ Returning false - No permissions matched');
    return false;
  }, [subscriptionLoading, isTeamMember, currentMembership?.role, canAccessFeature]);

  const canManageTeam = useCallback((): boolean => {
    // Account holders can always manage teams if they have the feature
    if (!isTeamMember && canAccessFeature('teamManagement')) {
      return true;
    }
    
    // Admin team members can also manage teams
    if (isTeamMember && currentMembership?.role === 'admin') {
      return true;
    }
    
    return false;
  }, [isTeamMember, currentMembership?.role, canAccessFeature]);

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