import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTeam } from '../context/TeamContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { TeamMember, TeamInvitation } from '../types/team';

interface TeamMemberCardProps {
  member: TeamMember;
  onRemove?: () => void;
  showActions?: boolean;
}

const TeamMemberCard: React.FC<TeamMemberCardProps> = ({
  member,
  onRemove,
  showActions = true,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.memberCard,
        {
          backgroundColor: theme.background.secondary,
          borderColor: theme.border.primary,
        },
      ]}
    >
      <View style={styles.memberInfo}>
        <View style={[styles.memberIcon, { backgroundColor: theme.gold.primary + '20' }]}>
          <Ionicons name="person" size={24} color={theme.gold.primary} />
        </View>
        
        <View style={styles.memberDetails}>
          <Text style={[styles.memberName, { color: theme.text.primary }]}>
            {member.displayName || member.email}
          </Text>
          <Text style={[styles.memberEmail, { color: theme.text.secondary }]}>
            {member.email}
          </Text>
          <Text style={[styles.memberRole, { color: theme.text.tertiary }]}>
            {member.role.charAt(0).toUpperCase() + member.role.slice(1)} • 
            Joined {new Date(member.joinedAt).toLocaleDateString()}
          </Text>
        </View>
      </View>

      {showActions && onRemove && (
        <TouchableOpacity
          style={[styles.removeButton, { borderColor: theme.status.error }]}
          onPress={onRemove}
        >
          <Ionicons name="remove-circle-outline" size={20} color={theme.status.error} />
        </TouchableOpacity>
      )}
    </View>
  );
};

interface TeamInvitationCardProps {
  invitation: TeamInvitation;
  onRevoke?: () => void;
}

const TeamInvitationCard: React.FC<TeamInvitationCardProps> = ({
  invitation,
  onRevoke,
}) => {
  const { theme } = useTheme();
  
  const isExpired = new Date() > new Date(invitation.expiresAt);

  return (
    <View
      style={[
        styles.invitationCard,
        {
          backgroundColor: theme.background.secondary,
          borderColor: isExpired ? theme.status.error : theme.border.primary,
          opacity: isExpired ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.invitationInfo}>
        <View style={[styles.invitationIcon, { 
          backgroundColor: isExpired ? theme.status.error + '20' : theme.gold.primary + '20' 
        }]}>
          <Ionicons 
            name={isExpired ? "time-outline" : "mail-outline"} 
            size={24} 
            color={isExpired ? theme.status.error : theme.gold.primary} 
          />
        </View>
        
        <View style={styles.invitationDetails}>
          <Text style={[styles.invitationEmail, { color: theme.text.primary }]}>
            {invitation.inviteEmail}
          </Text>
          <Text style={[styles.invitationStatus, { color: theme.text.secondary }]}>
            {isExpired ? 'Expired' : 'Pending'} • 
            Invited {new Date(invitation.createdAt).toLocaleDateString()}
          </Text>
          <Text style={[styles.invitationExpiry, { color: theme.text.tertiary }]}>
            {isExpired 
              ? 'Expired on ' + new Date(invitation.expiresAt).toLocaleDateString()
              : 'Expires on ' + new Date(invitation.expiresAt).toLocaleDateString()
            }
          </Text>
        </View>
      </View>

      {onRevoke && invitation.status === 'pending' && (
        <TouchableOpacity
          style={[styles.revokeButton, { borderColor: theme.status.warning }]}
          onPress={onRevoke}
        >
          <Ionicons name="close-circle-outline" size={20} color={theme.status.warning} />
        </TouchableOpacity>
      )}
    </View>
  );
};

export const TeamManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { subscription } = useSubscription();
  const {
    teamMembers,
    teamInvitations,
    teamStats,
    loading,
    error,
    refreshTeamData,
    removeTeamMember,
    revokeInvitation,
    canInviteMembers,
    hasReachedMemberLimit,
  } = useTeam();
  
  const { showError, showSuccess, showWarning } = useCustomAlert();
  const [refreshing, setRefreshing] = useState(false);
  const lastRefreshRef = useRef<number>(0);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTeamData();
      lastRefreshRef.current = Date.now(); // Update cache timestamp
    } catch (err) {
      console.error('Error refreshing team data:', err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshTeamData]);

  const handleInviteTeammate = () => {
    if (!canInviteMembers()) {
      showError('Upgrade Required', 'Team management is available for Professional tier users only.');
      return;
    }

    if (hasReachedMemberLimit()) {
      showError(
        'Member Limit Reached', 
        `You have reached the maximum number of team members (${subscription.limits.maxTeamMembers}) for your subscription plan.`
      );
      return;
    }

    // Navigate to invitation screen - we'll create this next
    navigation.navigate('InviteTeammate' as never);
  };

  const handleRemoveMember = useCallback((member: TeamMember) => {
    showWarning(
      'Remove Team Member',
      `Are you sure you want to remove ${member.displayName || member.email} from your team? They will no longer have access to your account.`,
      {
        primaryButtonText: 'Remove',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: async () => {
          try {
            if (member.id) {
              await removeTeamMember(member.id);
              lastRefreshRef.current = Date.now(); // Update cache timestamp after member removal
              showSuccess('Member Removed', 'Team member has been successfully removed.');
            }
          } catch (error) {
            showError('Error', 'Failed to remove team member. Please try again.');
          }
        },
      }
    );
  }, [removeTeamMember, showWarning, showSuccess, showError]);

  const handleRevokeInvitation = useCallback((invitation: TeamInvitation) => {
    showWarning(
      'Revoke Invitation',
      `Are you sure you want to revoke the invitation to ${invitation.inviteEmail}?`,
      {
        primaryButtonText: 'Revoke',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: async () => {
          try {
            if (invitation.id) {
              await revokeInvitation(invitation.id);
              lastRefreshRef.current = Date.now(); // Update cache timestamp after invitation revocation
            }
          } catch (error) {
            showError('Error', 'Failed to revoke invitation. Please try again.');
          }
        },
      }
    );
  }, [revokeInvitation, showWarning, showSuccess, showError]);

  if (loading && teamMembers.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading team data...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const pendingInvitations = teamInvitations.filter(
    inv => inv.status === 'pending' && new Date(inv.expiresAt) > new Date()
  );

  console.log('🚀 ~ TeamManagementScreen ~ teamInvitations:', teamInvitations);
  console.log('🚀 ~ TeamManagementScreen ~ pendingInvitations:', pendingInvitations);
  console.log('🚀 ~ TeamManagementScreen ~ teamMembers:', teamMembers);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header Stats */}
      <View style={[styles.statsHeader, { backgroundColor: theme.background.secondary }]}>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
              {teamStats?.totalMembers || 0}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Team Members
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.border.primary }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text.primary }]}>
              {pendingInvitations.length}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Pending Invites
            </Text>
          </View>
          
          <View style={[styles.divider, { backgroundColor: theme.border.primary }]} />
          
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.text.primary }]}>
              {subscription.limits.maxTeamMembers === -1 ? '∞' : subscription.limits.maxTeamMembers}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Member Limit
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold.primary}
          />
        }
      >
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.status.error + '20' }]}>
            <Text style={[styles.errorText, { color: theme.status.error }]}>
              {error}
            </Text>
          </View>
        )}

        {/* Team Members Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Team Members ({teamMembers.length})
            </Text>
          </View>

          {teamMembers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="people-outline"
                size={64}
                color={theme.text.tertiary}
                style={styles.emptyIcon}
              />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                No Team Members Yet
              </Text>
              <Text style={[styles.emptyDescription, { color: theme.text.secondary }]}>
                Invite team members to help manage receipts and collaborate on your account.
              </Text>
            </View>
          ) : (
            teamMembers.map((member) => (
              <TeamMemberCard
                key={member.id}
                member={member}
                onRemove={() => handleRemoveMember(member)}
                showActions={true}
              />
            ))
          )}
        </View>

        {/* Pending Invitations Section */}
        {teamInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
                Pending Invitations ({pendingInvitations.length})
              </Text>
            </View>

            {teamInvitations.map((invitation) => (
              <TeamInvitationCard
                key={invitation.id}
                invitation={invitation}
                onRevoke={() => handleRevokeInvitation(invitation)}
              />
            ))}
          </View>
        )}

        {/* Invite Button */}
        <TouchableOpacity
          style={[
            styles.inviteButton,
            { 
              backgroundColor: theme.gold.primary,
              opacity: hasReachedMemberLimit() ? 0.6 : 1,
            }
          ]}
          onPress={handleInviteTeammate}
          disabled={hasReachedMemberLimit()}
        >
          <Ionicons name="person-add" size={20} color="#FFFFFF" />
          <Text style={styles.inviteButtonText}>
            Invite Team Member
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  statsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  content: {
    flex: 1,
  },
  errorContainer: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  section: {
    marginVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 14,
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  invitationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginVertical: 6,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  invitationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  invitationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  invitationDetails: {
    flex: 1,
  },
  invitationEmail: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  invitationStatus: {
    fontSize: 14,
    marginBottom: 2,
  },
  invitationExpiry: {
    fontSize: 12,
  },
  revokeButton: {
    padding: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 20,
    padding: 16,
    borderRadius: 12,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default TeamManagementScreen;