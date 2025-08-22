import * as React from 'react';
import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useBusiness } from '../context/BusinessContext';
import { BusinessData } from '../types/business';
import { useSubscription } from '../context/SubscriptionContext';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { useStripePayments } from '../hooks/useStripePayments';
import { useAuth } from '../context/AuthContext';

type BusinessManagementScreenNavigationProp = StackNavigationProp<any>;

interface BusinessCardProps {
  business: BusinessData;
  isSelected: boolean;
  onSelect: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  showActions?: boolean;
}

const BusinessCard: React.FC<BusinessCardProps> = ({
  business,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  showActions = true,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.businessCard,
        {
          backgroundColor: theme.background.secondary,
          borderColor: isSelected ? theme.gold.primary : theme.border.primary,
          borderWidth: isSelected ? 2 : 1,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {/* Selected Indicator */}
      {isSelected && (
        <View style={[styles.selectedBadge, { backgroundColor: theme.gold.primary }]}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </View>
      )}

      {/* Business Info */}
      <View style={styles.businessInfo}>
        <View style={styles.businessHeader}>
          <Text style={[styles.businessName, { color: theme.text.primary }]}>
            {business.name}
          </Text>
          <Text style={[styles.businessType, { color: theme.text.secondary }]}>
            {business.type}
          </Text>
        </View>

        {business.industry && (
          <Text style={[styles.businessIndustry, { color: theme.text.tertiary }]}>
            {business.industry}
          </Text>
        )}

        {/* Business Stats */}
        <View style={styles.businessStats}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {business.stats.totalReceipts}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Receipts
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              ${business.stats.totalAmount.toFixed(2)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Total
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {business.stats.lastReceiptDate
                ? new Date(business.stats.lastReceiptDate).toLocaleDateString()
                : 'None'
              }
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Last Receipt
            </Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      {showActions && onEdit && onDelete && (
        <View style={styles.businessActions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.background.tertiary }]}
            onPress={onEdit}
          >
            <Ionicons name="create-outline" size={20} color={theme.text.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#ff4444' }]}
            onPress={onDelete}
          >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
};

const BusinessManagementScreen: React.FC = () => {
  const navigation = useNavigation<BusinessManagementScreenNavigationProp>();
  const { theme } = useTheme();
  const {
    businesses,
    selectedBusiness,
    loading,
    error,
    selectBusiness,
    deleteBusiness,
    canCreateBusiness,
    refreshBusinesses,
  } = useBusiness();
  const { subscription, canAccessFeature } = useSubscription();
  const { showError, showSuccess, showWarning, showInfo, hideAlert } = useCustomAlert();
  const { handleSubscriptionWithCloudFunction } = useStripePayments();
  const { user } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refreshBusinesses();
    }, [refreshBusinesses])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBusinesses();
    setRefreshing(false);
  };

  const handleCreateBusiness = () => {
    if (!canCreateBusiness()) {
      showWarning(
        'Business Limit Reached',
        `You have reached the maximum number of businesses (${subscription.limits.maxBusinesses === -1 ? 'unlimited' : subscription.limits.maxBusinesses}) for your subscription plan. Please upgrade to create more businesses.`,
        {
          primaryButtonText: 'Upgrade',
          secondaryButtonText: 'Cancel',
          onPrimaryPress: async () => {
            // Close the alert first, then show upgrade process
            hideAlert();
            await handleUpgradeToProfessional();
          },
        }
      );
      return;
    }

    navigation.navigate('CreateBusiness');
  };

  const isMultiBusinessUser = canAccessFeature('multiBusinessManagement');

  const handleUpgradeToProfessional = async () => {
    if (!user?.email) {
      showError('Error', 'User email not found. Please try logging in again.');
      return;
    }

    if (upgrading) return; // Prevent multiple clicks

    console.log('Starting upgrade process...');
    setUpgrading(true);

    // Add a small delay to ensure loading state is visible
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const success = await handleSubscriptionWithCloudFunction(
        'professional',
        user.email,
        user.displayName || 'User',
        undefined, // customerId - let Stripe create if needed
        (type, title, message) => {
          if (type === 'error') showError(title, message);
          else if (type === 'success') showSuccess(title, message);
          else if (type === 'warning') showWarning(title, message);
          else showInfo(title, message);
        }
      );

      if (success) {
        // Refresh the screen to update UI with new subscription
        refreshBusinesses();
      }
    } catch (error) {
      showError(
        'Upgrade Failed',
        'Failed to start Professional subscription. Please try again.'
      );
    } finally {
      console.log('Upgrade process completed, clearing loading state');
      setUpgrading(false);
    }
  };

  const handleSelectBusiness = (business: BusinessData) => {
    if (business.id) {
      selectBusiness(business.id);
      showSuccess(
        'Business Selected',
        `"${business.name}" is now your active business. All new receipts will be associated with this business.`
      );
    }
  };

  const handleEditBusiness = (business: BusinessData) => {
    navigation.navigate('CreateBusiness', {
      businessId: business.id,
      mode: 'edit'
    });
  };

  const handleDeleteBusiness = (business: BusinessData) => {
    showWarning(
      'Delete Business',
      `Are you sure you want to delete "${business.name}"? This action cannot be undone. All receipts associated with this business will become unassigned.`,
      {
        primaryButtonText: 'Delete',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: async () => {
          try {
            if (business.id) {
              await deleteBusiness(business.id);
              showSuccess(
                'Business Deleted',
                `"${business.name}" has been deleted.`
              );
            }
          } catch (err) {
            showError(
              'Error',
              err instanceof Error ? err.message : 'Failed to delete business'
            );
          }
        },
      }
    );
  };

  if (loading && businesses.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading businesses...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>

      {/* Business Stats Header */}
      <View style={[styles.statsHeader, { backgroundColor: theme.background.secondary }]}>
        {businesses.length > 0 ? (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.gold.primary }]}>
                  {businesses.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                  {businesses.length === 1 ? 'Business' : 'Businesses'}
                </Text>
              </View>
              
              <View style={[styles.divider, { backgroundColor: theme.border.primary }]} />
              
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.text.primary }]}>
                  {businesses.reduce((sum, business) => sum + business.stats.totalReceipts, 0)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                  Total Receipts
                </Text>
              </View>
            </View>

            {!isMultiBusinessUser && (
              <TouchableOpacity 
                style={[
                  styles.upgradePrompt, 
                  { 
                    backgroundColor: theme.gold.primary + '20', 
                    borderColor: theme.gold.primary,
                    opacity: upgrading ? 0.7 : 1
                  }
                ]}
                onPress={handleUpgradeToProfessional}
                disabled={upgrading}
              >
                <Ionicons name="star-outline" size={16} color={theme.gold.primary} />
                <Text style={[styles.upgradeText, { color: theme.gold.primary }]}>
                  {upgrading ? 'Processing upgrade...' : 'Upgrade to Professional to create multiple businesses'}
                </Text>
                {upgrading ? (
                  <ActivityIndicator size="small" color={theme.gold.primary} />
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.gold.primary} />
                )}
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <View style={styles.singleBusinessHeader}>
              <View style={styles.singleBusinessTitle}>
                <Ionicons name="business-outline" size={24} color={theme.gold.primary} />
                <Text style={[styles.singleBusinessTitleText, { color: theme.text.primary }]}>
                  Business Setup
                </Text>
              </View>
              <Text style={[styles.singleBusinessDescription, { color: theme.text.secondary }]}>
                Get started by creating your business profile to organize your receipts and expenses.
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Error State */}
      {error && (
        <View style={[styles.errorContainer, { backgroundColor: '#ff444420', borderColor: '#ff4444' }]}>
          <Ionicons name="warning-outline" size={20} color="#ff4444" />
          <Text style={[styles.errorText, { color: '#ff4444' }]}>
            {error}
          </Text>
        </View>
      )}

      {/* Business List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.gold.primary}
          />
        }
      >
        {businesses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="business-outline"
              size={64}
              color={theme.text.tertiary}
              style={styles.emptyIcon}
            />
            <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
              Create Your Business
            </Text>
            <Text style={[styles.emptyDescription, { color: theme.text.secondary }]}>
              Set up your business information to start tracking receipts and expenses.
            </Text>
            <TouchableOpacity
              style={[styles.createFirstButton, { backgroundColor: theme.gold.primary }]}
              onPress={handleCreateBusiness}
            >
              <Text style={styles.createFirstButtonText}>Create Business</Text>
            </TouchableOpacity>
          </View>
        ) : (
          businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              isSelected={selectedBusiness?.id === business.id}
              onSelect={() => handleSelectBusiness(business)}
              onEdit={() => handleEditBusiness(business)}
              onDelete={() => handleDeleteBusiness(business)}
              showActions={true}
            />
          ))
        )}

        {/* Create New Business Button */}
        {businesses.length > 0 && (
          <TouchableOpacity
            style={[styles.createButton, { backgroundColor: theme.gold.primary }]}
            onPress={handleCreateBusiness}
          >
            <Ionicons name="add" size={20} color="#FFFFFF" />
            <Text style={styles.createButtonText}>Create New Business</Text>
          </TouchableOpacity>
        )}

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
    marginTop: 12,
    fontSize: 16,
  },
  statsHeader: {
    margin: 20,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingTop: 0,
  },
  businessCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative',
  },
  selectedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  businessInfo: {
    flex: 1,
    marginRight: 60,
  },
  businessHeader: {
    marginBottom: 8,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  businessType: {
    fontSize: 14,
    fontWeight: '500',
  },
  businessIndustry: {
    fontSize: 14,
    marginBottom: 12,
  },
  businessStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  businessActions: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIcon: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  createFirstButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  singleBusinessHeader: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  singleBusinessTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  singleBusinessTitleText: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
  singleBusinessDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  selectionConfirmation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});

export default BusinessManagementScreen;