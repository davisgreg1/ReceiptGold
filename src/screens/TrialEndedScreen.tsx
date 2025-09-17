import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useRevenueCatPayments } from '../hooks/useRevenueCatPayments';
import { revenueCatService, SUBSCRIPTION_TIERS } from '../services/revenuecatService';
import { useInAppNotifications } from '../components/InAppNotificationProvider';
import { useConfettiContext } from '../context/ConfettiContext';
import { formatCurrency } from '../utils/formatCurrency';
import { useCustomAlert } from '../components/CustomAlert';
import { AccountService } from '../services/AccountService';

interface TrialEndedScreenProps {
  onSignOut: () => void;
  onDeleteAccount: () => void;
}

export const TrialEndedScreen: React.FC<TrialEndedScreenProps> = ({
  onSignOut,
  onDeleteAccount,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { currentReceiptCount, refreshSubscription } = useSubscription();
  const { handleSubscriptionWithRevenueCat } = useRevenueCatPayments();
  const { showNotification } = useInAppNotifications();
  const { triggerConfetti } = useConfettiContext();
  const { showAlert, showError, showSuccess } = useCustomAlert();

  const [loading, setLoading] = useState(false);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [pricing, setPricing] = useState<any>({});

  // Password dialog state for account deletion
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch pricing from RevenueCat
  useEffect(() => {
    const fetchPricing = async () => {
      try {
        const pricingData = await revenueCatService.getRevenueCatPricing();
        setPricing(pricingData);
      } catch (error) {
        console.error('Failed to fetch pricing:', error);
      }
    };
    fetchPricing();
  }, []);

  // Calculate trial accomplishments
  const getTrialStats = () => {
    const estimatedSavings = currentReceiptCount * 15; // Assume $15 saved per receipt in organization
    return {
      receiptsAdded: currentReceiptCount,
      estimatedSavings: estimatedSavings,
      daysUsed: 3, // Since trial is 3 days
    };
  };

  const handleUpgrade = async (tierKey: string) => {
    if (!user?.email) {
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'You must be logged in to upgrade',
        primaryButtonText: 'OK'
      });
      return;
    }

    setUpgrading(tierKey);
    try {
      const success = await handleSubscriptionWithRevenueCat(
        tierKey as any,
        'monthly',
        user.email,
        user.displayName || 'User'
      );

      if (success) {
        triggerConfetti();
        showNotification({
          type: 'success',
          title: 'Welcome to ReceiptGold!',
          message: 'Your subscription has been activated successfully.',
        });

        // Force refresh subscription state to trigger navigation
        // Add retry mechanism since RevenueCat webhook might take time to update Firestore
        let retryCount = 0;
        const maxRetries = 5;

        while (retryCount < maxRetries) {
          console.log(`🔄 Attempting subscription refresh (${retryCount + 1}/${maxRetries})...`);

          await refreshSubscription();

          // Wait a bit for the webhook to process
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Check if user is still on trial ended screen
          // If subscription updated properly, the AppNavigator should have navigated away
          retryCount++;

          if (retryCount < maxRetries) {
            console.log(`⏳ Waiting for subscription to update... retry in 1s`);
          }
        }

        console.log('✅ Subscription refresh attempts completed');
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
      showAlert({
        type: 'error',
        title: 'Error',
        message: 'Failed to process payment. Please check your payment details and try again.',
        primaryButtonText: 'OK'
      });
    } finally {
      setUpgrading(null);
    }
  };

  const handleDeleteAccount = () => {
    if (!user) {
      showError('Error', 'No user found. Please try logging in again.');
      return;
    }
    setShowDeleteDialog(true);
  };

  // Process the actual account deletion
  const processAccountDeletion = async () => {
    if (!deletePassword.trim()) {
      showError('Error', 'Password is required to delete your account.');
      return;
    }

    setIsDeleting(true);
    try {
      await AccountService.deleteAccount(user!, deletePassword);

      // Close dialog and clear form
      setShowDeleteDialog(false);
      setDeletePassword('');
      setShowPassword(false);

      // Immediately sign out the user since their account no longer exists
      onSignOut();

      showSuccess(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.'
      );
    } catch (error: any) {
      showError('Error', error.message || 'Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel account deletion
  const cancelAccountDeletion = () => {
    setShowDeleteDialog(false);
    setDeletePassword('');
    setShowPassword(false);
  };

  const getPlanInfo = (tierKey: string) => {
    const getPrice = () => {
      const tierPricing = pricing[tierKey];
      if (tierPricing?.monthly?.price) {
        return tierPricing.monthly.price;
      }
      const tierConfig = SUBSCRIPTION_TIERS[tierKey as keyof typeof SUBSCRIPTION_TIERS];
      if (tierConfig?.monthlyPrice) {
        return `$${tierConfig.monthlyPrice.toFixed(2)}`;
      }
      return 'Contact Support';
    };

    const plans = {
      starter: {
        name: 'Starter',
        price: getPrice(),
        color: '#3B82F6',
        features: ['50 receipts per month', 'Basic expense tracking', 'Email support'],
        recommended: false,
      },
      growth: {
        name: 'Growth',
        price: getPrice(),
        color: '#8B5CF6',
        features: ['150 receipts per month', 'Advanced reporting', 'Tax prep tools', 'Priority support'],
        recommended: true,
      },
      professional: {
        name: 'Professional',
        price: getPrice(),
        color: '#F59E0B',
        features: ['Unlimited receipts', 'Multi-business management', 'Team collaboration', 'Dedicated support'],
        recommended: false,
      },
    };

    return plans[tierKey as keyof typeof plans] || plans.starter;
  };

  const stats = getTrialStats();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: theme.gold.background }]}>
            <Text style={[styles.logo, { color: theme.gold.primary }]}>📊</Text>
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Your trial has ended, but the journey continues!
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Thanks for trying ReceiptGold. Here's what you accomplished:
          </Text>
        </View>

        {/* Trial Accomplishments */}
        <View style={[styles.accomplishmentsCard, {
          backgroundColor: theme.gold.background,
          borderColor: theme.gold.primary
        }]}>
          <Text style={[styles.accomplishmentsTitle, { color: theme.text.primary }]}>
            Your Trial Success
          </Text>
          <View style={styles.statsRow}>
            <View style={[styles.statItem, { backgroundColor: `${theme.gold.primary}15` }]}>
              <Text style={styles.statIcon}>📄</Text>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                {stats.receiptsAdded}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Receipts{'\n'}Organized
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: `${theme.gold.primary}15` }]}>
              <Text style={styles.statIcon}>💰</Text>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                {formatCurrency(stats.estimatedSavings)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Value{'\n'}Organized
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: `${theme.gold.primary}15` }]}>
              <Text style={styles.statIcon}>📊</Text>
              <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                {stats.daysUsed}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Days{'\n'}Active
              </Text>
            </View>
          </View>
        </View>

        {/* Continue Your Journey */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
          Continue Your Financial Journey
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.text.secondary }]}>
          Choose a plan that grows with your business
        </Text>

        {/* Subscription Plans */}
        <View style={styles.plansContainer}>
          {['starter', 'growth', 'professional'].map((tierKey) => {
            const plan = getPlanInfo(tierKey);
            const isUpgrading = upgrading === tierKey;

            return (
              <View
                key={tierKey}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: theme.background.secondary,
                    borderColor: plan.recommended ? plan.color : theme.border.primary,
                    borderWidth: plan.recommended ? 2 : 1,
                  },
                ]}
              >
                {plan.recommended && (
                  <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                    <Text style={styles.recommendedText}>Most Popular</Text>
                  </View>
                )}

                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: theme.text.primary }]}>
                    {plan.name}
                  </Text>
                  <Text style={[styles.planPrice, { color: theme.text.primary }]}>
                    {plan.price}
                    <Text style={[styles.planPeriod, { color: theme.text.secondary }]}>
                      /month
                    </Text>
                  </Text>
                </View>

                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <Ionicons
                        name="checkmark-circle"
                        size={16}
                        color={theme.status.success}
                      />
                      <Text style={[styles.featureText, { color: theme.text.secondary }]}>
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.upgradeButton,
                    {
                      backgroundColor: plan.recommended ? plan.color : theme.background.tertiary,
                      borderColor: plan.color,
                      borderWidth: plan.recommended ? 0 : 1,
                    },
                  ]}
                  onPress={() => handleUpgrade(tierKey)}
                  disabled={isUpgrading}
                >
                  <Text
                    style={[
                      styles.upgradeButtonText,
                      {
                        color: plan.recommended ? 'white' : plan.color,
                      },
                    ]}
                  >
                    {isUpgrading ? 'Processing...' : `Choose ${plan.name}`}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        {/* Alternative Actions */}
        <View style={styles.alternativeActions}>
          <Text style={[styles.alternativeTitle, { color: theme.text.secondary }]}>
            Not ready to subscribe?
          </Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.border.primary }]}
              onPress={onSignOut}
            >
              <Ionicons name="log-out-outline" size={20} color={theme.text.secondary} />
              <Text style={[styles.actionButtonText, { color: theme.text.secondary }]}>
                Sign Out
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { borderColor: theme.status.error }]}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash-outline" size={20} color={theme.status.error} />
              <Text style={[styles.actionButtonText, { color: theme.status.error }]}>
                Delete Account
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Custom Delete Account Dialog */}
      {showDeleteDialog && (
        <Modal
          transparent
          visible={showDeleteDialog}
          animationType="fade"
          onRequestClose={cancelAccountDeletion}
        >
          <View style={deleteDialogStyles.overlay}>
            <View style={[deleteDialogStyles.dialog, { backgroundColor: theme.background.secondary }]}>
              <Text style={[deleteDialogStyles.title, { color: theme.text.primary }]}>
                Delete Account
              </Text>
              <Text style={[deleteDialogStyles.message, { color: theme.text.secondary }]}>
                This action cannot be undone. All your receipts, data, and account information will be permanently deleted.
              </Text>
              <Text style={[deleteDialogStyles.passwordLabel, { color: theme.text.secondary }]}>
                Please enter your password to confirm:
              </Text>

              <View style={deleteDialogStyles.passwordContainer}>
                <TextInput
                  style={[
                    deleteDialogStyles.passwordInput,
                    {
                      color: theme.text.primary,
                      backgroundColor: theme.background.tertiary,
                      borderColor: theme.border.primary,
                    },
                  ]}
                  placeholder="Current password"
                  placeholderTextColor={theme.text.tertiary}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={deleteDialogStyles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.text.tertiary}
                  />
                </TouchableOpacity>
              </View>

              <View style={deleteDialogStyles.buttons}>
                <TouchableOpacity
                  style={[deleteDialogStyles.button, { borderColor: theme.border.primary }]}
                  onPress={cancelAccountDeletion}
                  disabled={isDeleting}
                >
                  <Text style={[deleteDialogStyles.cancelButtonText, { color: theme.text.primary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[deleteDialogStyles.button, deleteDialogStyles.deleteButton]}
                  onPress={processAccountDeletion}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={deleteDialogStyles.deleteButtonText}>Delete Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  accomplishmentsCard: {
    borderRadius: 20,
    borderWidth: 2,
    padding: 20,
    marginBottom: 32,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  accomplishmentsTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    gap: 8,
    flexWrap: 'nowrap',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 10,
    minHeight: 90,
    maxWidth: '30%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
    lineHeight: 28,
  },
  statLabel: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
    fontWeight: '500',
    paddingHorizontal: 1,
    width: '100%',
    flexShrink: 1,
    numberOfLines: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  plansContainer: {
    gap: 16,
    marginBottom: 32,
  },
  planCard: {
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  planName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  planPeriod: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  alternativeActions: {
    alignItems: 'center',
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  alternativeTitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
});

// Styles for the delete account dialog
const deleteDialogStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dialog: {
    width: '85%',
    maxWidth: 350,
    borderRadius: 16,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  passwordLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48,
    fontSize: 16,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deleteButton: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});