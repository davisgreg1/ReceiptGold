import * as React from 'react';
import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useBusiness } from '../context/BusinessContext';
import { BusinessData } from '../types/business';
import { useSubscription } from '../context/SubscriptionContext';

interface BusinessSelectorProps {
  selectedBusinessId?: string | null;
  onBusinessSelect: (businessId: string | null) => void;
  placeholder?: string;
  allowUnassigned?: boolean;
  disabled?: boolean;
  style?: any;
}

interface BusinessOptionProps {
  business: BusinessData | null;
  isSelected: boolean;
  onSelect: () => void;
}

const BusinessOption: React.FC<BusinessOptionProps> = ({
  business,
  isSelected,
  onSelect,
}) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.businessOption,
        {
          backgroundColor: isSelected
            ? theme.gold.primary + '20'
            : theme.background.secondary,
          borderColor: isSelected ? theme.gold.primary : theme.border.primary,
        },
      ]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      {isSelected && (
        <View style={styles.checkmarkContainer}>
          <Ionicons
            name="checkmark-circle"
            size={20}
            color={theme.gold.primary}
          />
        </View>
      )}
      <View style={styles.businessOptionContent}>
        {business ? (
          <>
            <View style={styles.businessIcon}>
              <Ionicons
                name="business"
                size={20}
                color={isSelected ? theme.gold.primary : theme.text.secondary}
              />
            </View>
            <View style={styles.businessDetails}>
              <Text
                style={[
                  styles.businessName,
                  {
                    color: isSelected ? theme.gold.primary : theme.text.primary,
                    fontWeight: isSelected ? '600' : '500',
                  },
                ]}
                numberOfLines={1}
              >
                {business.name}
              </Text>
              <Text
                style={[
                  styles.businessType,
                  {
                    color: isSelected ? theme.gold.primary : theme.text.secondary,
                  },
                ]}
                numberOfLines={1}
              >
                {business.type} • {business.industry || 'No industry'}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.businessIcon}>
              <Ionicons
                name="remove-circle-outline"
                size={20}
                color={isSelected ? theme.gold.primary : theme.text.secondary}
              />
            </View>
            <View style={styles.businessDetails}>
              <Text
                style={[
                  styles.businessName,
                  {
                    color: isSelected ? theme.gold.primary : theme.text.primary,
                    fontWeight: isSelected ? '600' : '500',
                  },
                ]}
              >
                No Business
              </Text>
              <Text
                style={[
                  styles.businessType,
                  {
                    color: isSelected ? theme.gold.primary : theme.text.secondary,
                  },
                ]}
              >
                Personal receipt
              </Text>
            </View>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const BusinessSelector: React.FC<BusinessSelectorProps> = ({
  selectedBusinessId,
  onBusinessSelect,
  placeholder = 'Select business',
  allowUnassigned = true,
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const { businesses, accessibleBusinesses, loading, getBusinessById } = useBusiness();
  const { canAccessFeature } = useSubscription();
  const hasMultiBusinessAccess = canAccessFeature('multiBusinessManagement');
  
  const [modalVisible, setModalVisible] = useState(false);

  const selectedBusiness = selectedBusinessId ? getBusinessById(selectedBusinessId) : null;

  const handleSelect = (businessId: string | null) => {
    onBusinessSelect(businessId);
    setModalVisible(false);
  };

  const handleSelectorPress = () => {
    setModalVisible(true);
  };

  const renderSelectedBusiness = () => {
    if (selectedBusiness) {
      return (
        <View style={styles.selectedBusinessContent}>
          <Ionicons name="business" size={16} color={theme.text.secondary} />
          <Text
            style={[styles.selectedBusinessText, { color: theme.text.primary }]}
            numberOfLines={1}
          >
            {selectedBusiness.name}
          </Text>
        </View>
      );
    }

    if (selectedBusinessId === null) {
      return (
        <View style={styles.selectedBusinessContent}>
          <Ionicons name="remove-circle-outline" size={16} color={theme.text.secondary} />
          <Text
            style={[styles.selectedBusinessText, { color: theme.text.primary }]}
          >
            No Business
          </Text>
        </View>
      );
    }

    return (
      <Text style={[styles.placeholderText, { color: theme.text.tertiary }]}>
        {placeholder}
      </Text>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
        onPress={() => !disabled && handleSelectorPress()}
        disabled={disabled}
        activeOpacity={0.7}
      >
        {renderSelectedBusiness()}
        
        <Ionicons
          name="chevron-down"
          size={16}
          color={theme.text.secondary}
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
          backgroundColor: theme.background.primary,
        }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { borderBottomColor: theme.border.primary }]}>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                Select Business
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Business List */}
            <ScrollView 
              style={styles.modalScroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.gold.primary} />
                  <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
                    Loading businesses...
                  </Text>
                </View>
              ) : (
                <>
                  {/* Unassigned Option */}
                  {allowUnassigned && (
                    <BusinessOption
                      business={null}
                      isSelected={selectedBusinessId === null}
                      onSelect={() => handleSelect(null)}
                    />
                  )}

                  {/* Business Options */}
                  {accessibleBusinesses.map((business) => (
                    <BusinessOption
                      key={business.id}
                      business={business}
                      isSelected={selectedBusinessId === business.id}
                      onSelect={() => handleSelect(business.id || null)}
                    />
                  ))}

                  {/* Empty State */}
                  {accessibleBusinesses.length === 0 && (
                    <View style={styles.emptyState}>
                      <Ionicons
                        name="business-outline"
                        size={48}
                        color={theme.text.tertiary}
                        style={styles.emptyIcon}
                      />
                      <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                        No Businesses
                      </Text>
                      <Text style={[styles.emptyDescription, { color: theme.text.secondary }]}>
                        Create a business to organize your receipts.
                      </Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Upgrade Prompt */}
            {!hasMultiBusinessAccess && businesses.length > 1 && (
              <View style={[styles.upgradePrompt, { backgroundColor: theme.gold.primary + '20', borderColor: theme.gold.primary }]}>
                <Ionicons name="star" size={20} color={theme.gold.primary} />
                <Text style={[styles.upgradeText, { color: theme.gold.primary }]}>
                  You have {businesses.length} businesses. Upgrade to Professional to access all of them.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Container styles can be overridden by parent
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
  },
  selectedBusinessContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectedBusinessText: {
    fontSize: 16,
    marginLeft: 8,
    flex: 1,
  },
  placeholderText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', // Darker overlay for better contrast
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    height: '70%', // Fixed height instead of maxHeight
    minHeight: 400, // Ensure minimum height
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
    paddingBottom: 30,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  businessOption: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 64,
  },
  businessOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkmarkContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  businessIcon: {
    marginRight: 12,
  },
  businessDetails: {
    flex: 1,
  },
  businessName: {
    fontSize: 16,
    marginBottom: 2,
  },
  businessType: {
    fontSize: 14,
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
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  upgradeText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});

export default BusinessSelector;