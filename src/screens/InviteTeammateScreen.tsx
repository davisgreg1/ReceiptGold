import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useTeam } from '../context/TeamContext';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useBusiness } from '../context/BusinessContext';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { TeamMemberRole } from '../types/team';
import { isValidEmail } from '../utils/security';

export const InviteTeammateScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { inviteTeammate, hasReachedMemberLimit, isTeamMember, currentMembership, accountHolderId } = useTeam();
  const { subscription, canAccessFeature } = useSubscription();
  const { accessibleBusinesses, selectedBusiness } = useBusiness();
  const { showError, showSuccess } = useCustomAlert();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<TeamMemberRole>('teammate');
  const [selectedBusinessId, setSelectedBusinessId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Auto-select the currently selected business if only one is available
  React.useEffect(() => {
    if (accessibleBusinesses.length === 1) {
      setSelectedBusinessId(accessibleBusinesses[0].id!);
    } else if (selectedBusiness && !selectedBusinessId) {
      setSelectedBusinessId(selectedBusiness.id!);
    }
  }, [accessibleBusinesses, selectedBusiness, selectedBusinessId]);

  const handleInvite = async () => {
    if (!email.trim()) {
      showError('Email Required', 'Please enter an email address.');
      return;
    }

    if (!isValidEmail(email.trim())) {
      showError('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!selectedBusinessId) {
      showError('Business Required', 'Please select a business for this team member.');
      return;
    }

    if (hasReachedMemberLimit()) {
      showError('Member Limit Reached', 'You have reached the maximum number of team members for your subscription plan.');
      return;
    }

    // Debug logging
    console.log('🔍 Debug info before invitation:');
    console.log('- User ID:', user?.uid);
    console.log('- User email:', user?.email);
    console.log('- User displayName:', user?.displayName);
    console.log('- Invite email:', email.trim().toLowerCase());
    console.log('- Role:', role);
    console.log('- Subscription tier:', subscription.currentTier);
    console.log('- Can access team management:', canAccessFeature('teamManagement'));
    console.log('- Team management feature enabled:', subscription.features.teamManagement);
    console.log('- Is team member:', isTeamMember);
    console.log('- Current membership:', currentMembership);
    console.log('- Account holder ID:', accountHolderId);

    setLoading(true);
    try {
      const selectedBusiness = accessibleBusinesses.find(b => b.id === selectedBusinessId);
      if (!selectedBusiness) {
        throw new Error('Selected business not found');
      }

      await inviteTeammate({
        inviteEmail: email.trim().toLowerCase(),
        role,
        accountHolderName: user?.displayName || user?.email || 'Account Holder',
        businessId: selectedBusinessId,
        businessName: selectedBusiness.name,
      });

      showSuccess(
        'Invitation Sent',
        `Team invitation has been sent to ${email.trim()}. They will receive an email with instructions to join your team.`,
        {
          onPrimaryPress: () => {
            navigation.goBack();
          },
        }
      );
    } catch (error: any) {
      console.error('Invitation error details:', error);
      const errorMessage = error.message || 'Failed to send team invitation. Please try again.';
      console.log('Error message being shown:', errorMessage);
      showError(
        'Invitation Failed',
        errorMessage
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.content}>
          {/* Info Section */}
          <View style={[styles.infoCard, { backgroundColor: theme.background.secondary }]}>
            <View style={[styles.infoIcon, { backgroundColor: theme.gold.primary + '20' }]}>
              <Ionicons name="people" size={24} color={theme.gold.primary} />
            </View>
            <Text style={[styles.infoTitle, { color: theme.text.primary }]}>
              Team Collaboration
            </Text>
            <Text style={[styles.infoDescription, { color: theme.text.secondary }]}>
              Invite team members to help manage receipts on your account. They'll be able to add and manage their own receipts while you maintain full oversight.
            </Text>
          </View>

          {/* Business Selection */}
          {accessibleBusinesses.length > 1 && (
            <View style={styles.formSection}>
              <Text style={[styles.label, { color: theme.text.primary }]}>
                Business *
              </Text>
              <View style={styles.businessSelector}>
                {accessibleBusinesses.map((business) => (
                  <TouchableOpacity
                    key={business.id}
                    style={[
                      styles.businessOption,
                      {
                        backgroundColor: selectedBusinessId === business.id ? theme.gold.primary + '20' : theme.background.secondary,
                        borderColor: selectedBusinessId === business.id ? theme.gold.primary : theme.border.primary,
                      }
                    ]}
                    onPress={() => setSelectedBusinessId(business.id!)}
                    disabled={loading}
                  >
                    <View style={[
                      styles.radioButton,
                      {
                        borderColor: selectedBusinessId === business.id ? theme.gold.primary : theme.border.primary,
                        backgroundColor: selectedBusinessId === business.id ? theme.gold.primary : 'transparent',
                      }
                    ]}>
                      {selectedBusinessId === business.id && (
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      )}
                    </View>
                    <View style={styles.businessInfo}>
                      <Text style={[styles.businessName, { color: theme.text.primary }]}>
                        {business.name}
                      </Text>
                      <Text style={[styles.businessType, { color: theme.text.secondary }]}>
                        {business.type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.text.primary }]}>
              Email Address *
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.background.secondary,
                  borderColor: theme.border.primary,
                  color: theme.text.primary,
                }
              ]}
              placeholder="teammate@company.com"
              placeholderTextColor={theme.text.tertiary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Role Selection */}
          <View style={styles.formSection}>
            <Text style={[styles.label, { color: theme.text.primary }]}>
              Role
            </Text>
            
            <TouchableOpacity
              style={[
                styles.roleOption,
                {
                  backgroundColor: role === 'teammate' ? theme.gold.primary + '20' : theme.background.secondary,
                  borderColor: role === 'teammate' ? theme.gold.primary : theme.border.primary,
                }
              ]}
              onPress={() => setRole('teammate')}
              disabled={loading}
            >
              <View style={styles.roleHeader}>
                <View style={[
                  styles.radioButton,
                  {
                    borderColor: role === 'teammate' ? theme.gold.primary : theme.border.primary,
                    backgroundColor: role === 'teammate' ? theme.gold.primary : 'transparent',
                  }
                ]}>
                  {role === 'teammate' && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.roleTitle, { color: theme.text.primary }]}>
                  Teammate
                </Text>
                <View style={[styles.recommendedBadge, { backgroundColor: theme.gold.primary }]}>
                  <Text style={styles.recommendedText}>
                    Recommended
                  </Text>
                </View>
              </View>
              <Text style={[styles.roleDescription, { color: theme.text.secondary }]}>
                Can add and manage their own receipts only. Perfect for team members who need to submit receipts.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roleOption,
                {
                  backgroundColor: role === 'admin' ? theme.gold.primary + '20' : theme.background.secondary,
                  borderColor: role === 'admin' ? theme.gold.primary : theme.border.primary,
                }
              ]}
              onPress={() => setRole('admin')}
              disabled={loading}
            >
              <View style={styles.roleHeader}>
                <View style={[
                  styles.radioButton,
                  {
                    borderColor: role === 'admin' ? theme.gold.primary : theme.border.primary,
                    backgroundColor: role === 'admin' ? theme.gold.primary : 'transparent',
                  }
                ]}>
                  {role === 'admin' && (
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                  )}
                </View>
                <Text style={[styles.roleTitle, { color: theme.text.primary }]}>
                  Admin
                </Text>
              </View>
              <Text style={[styles.roleDescription, { color: theme.text.secondary }]}>
                Can add receipts and view all team receipts. Best for managers who need oversight of team submissions.
              </Text>
            </TouchableOpacity>
          </View>

          {/* Send Invitation Button */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[
                styles.inviteButton,
                {
                  backgroundColor: loading || !email.trim() || !selectedBusinessId ? theme.gold.primary + '60' : theme.gold.primary,
                  borderWidth: 1,
                  borderColor: theme.gold.primary,
                }
              ]}
              onPress={handleInvite}
              disabled={loading || !email.trim() || !selectedBusinessId}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="mail" size={20} color="#FFFFFF" />
                  <Text style={styles.inviteButtonText}>
                    Send Invitation
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Permissions Info */}
          <View style={[styles.permissionsCard, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.permissionsTitle, { color: theme.text.primary }]}>
              {role === 'admin' ? 'What admins can do:' : 'What teammates can do:'}
            </Text>
            <View style={styles.permissionsList}>
              <View style={styles.permissionItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.status.success} />
                <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                  Add new receipts to your account
                </Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="checkmark-circle" size={16} color={theme.status.success} />
                <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                  Edit and delete their own receipts
                </Text>
              </View>
              {role === 'admin' && (
                <>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.status.success} />
                    <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                      View all team receipts and analytics
                    </Text>
                  </View>
                  <View style={styles.permissionItem}>
                    <Ionicons name="checkmark-circle" size={16} color={theme.status.success} />
                    <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                      Add new teammates to the team
                    </Text>
                  </View>
                </>
              )}
              <View style={styles.permissionItem}>
                <Ionicons name="close-circle" size={16} color={theme.status.error} />
                <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                  Cannot access team management
                </Text>
              </View>
              <View style={styles.permissionItem}>
                <Ionicons name="close-circle" size={16} color={theme.status.error} />
                <Text style={[styles.permissionText, { color: theme.text.secondary }]}>
                  Cannot access subscription settings
                </Text>
              </View>
            </View>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100, // Extra padding to ensure content is visible above tab bar
  },
  content: {
    paddingHorizontal: 20,
  },
  infoCard: {
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  roleOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  roleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  recommendedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  roleDescription: {
    fontSize: 14,
    lineHeight: 18,
    marginLeft: 32,
  },
  permissionsCard: {
    padding: 16,
    borderRadius: 12,
  },
  permissionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  permissionsList: {
    gap: 8,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
    flex: 1,
  },
  buttonSection: {
    marginBottom: 24,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  businessSelector: {
    gap: 12,
  },
  businessOption: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessInfo: {
    flex: 1,
    marginLeft: 12,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  businessType: {
    fontSize: 14,
    textTransform: 'capitalize',
  },
});

export default InviteTeammateScreen;