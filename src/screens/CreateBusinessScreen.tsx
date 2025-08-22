import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useBusiness } from '../context/BusinessContext';
import { BusinessService } from '../services/BusinessService';
import { CreateBusinessRequest } from '../types/business';
import { useCustomAlert } from '../hooks/useCustomAlert';

type CreateBusinessScreenNavigationProp = StackNavigationProp<any>;
type CreateBusinessScreenRouteProp = RouteProp<{
  CreateBusiness: {
    businessId?: string;
    mode?: 'create' | 'edit';
  };
}, 'CreateBusiness'>;

const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Limited Liability Company (LLC)',
  'Corporation',
  'S Corporation',
  'Partnership',
  'Limited Partnership',
  'Limited Liability Partnership (LLP)',
  'Nonprofit Organization',
  'Cooperative',
  'Professional Corporation (PC)',
];

const CreateBusinessScreen: React.FC = () => {
  const navigation = useNavigation<CreateBusinessScreenNavigationProp>();
  const route = useRoute<CreateBusinessScreenRouteProp>();
  const { theme } = useTheme();
  const { createBusiness, updateBusiness, getBusinessById, canCreateBusiness } = useBusiness();
  const { showError, showSuccess, hideAlert } = useCustomAlert();
  
  const { businessId, mode = 'create' } = route.params || {};
  const isEditMode = mode === 'edit' && businessId;
  const existingBusiness = isEditMode ? getBusinessById(businessId!) : null;

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CreateBusinessRequest>({
    name: '',
    type: 'LLC',
    taxId: '',
    industry: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
    },
    settings: {
      defaultCurrency: 'USD',
      taxYear: new Date().getFullYear(),
      categories: [],
    },
  });

  const [showIOSPicker, setShowIOSPicker] = useState(false);

  const businessTypes = BusinessService.getBusinessTypes();
  const industries = BusinessService.getIndustryOptions();

  // Populate form with existing business data in edit mode
  useEffect(() => {
    if (isEditMode && existingBusiness) {
      setFormData({
        name: existingBusiness.name,
        type: existingBusiness.type,
        taxId: existingBusiness.taxId || '',
        industry: existingBusiness.industry || '',
        phone: existingBusiness.phone || '',
        address: existingBusiness.address || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US',
        },
        settings: existingBusiness.settings || {
          defaultCurrency: 'USD',
          taxYear: new Date().getFullYear(),
          categories: [],
        },
      });
    }
  }, [isEditMode, existingBusiness]);

  const updateFormData = (field: string, value: any) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        address: {
          ...prev.address!,
          [addressField]: value,
        },
      }));
    } else if (field.startsWith('settings.')) {
      const settingsField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings!,
          [settingsField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = async () => {
    // Skip business limit check in edit mode
    if (!isEditMode && !canCreateBusiness()) {
      showError(
        'Business Limit Reached',
        'You have reached the maximum number of businesses for your subscription plan. Please upgrade to create more businesses.'
      );
      return;
    }

    // Validate form
    const errors = BusinessService.validateBusinessData(formData);
    if (errors.length > 0) {
      showError('Validation Error', errors.join('\n'));
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && businessId) {
        // Update existing business
        await updateBusiness(businessId, formData);
        showSuccess(
          'Success',
          'Business updated successfully!',
          {
            primaryButtonText: 'OK',
            onPrimaryPress: () => {
              hideAlert();
              navigation.goBack();
            },
          }
        );
      } else {
        // Create new business
        await createBusiness(formData);
        showSuccess(
          'Success',
          'Business created successfully!',
          {
            primaryButtonText: 'OK',
            onPrimaryPress: () => {
              hideAlert();
              navigation.goBack();
            },
          }
        );
      }
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} business:`, error);
      showError(
        'Error',
        error instanceof Error ? error.message : `Failed to ${isEditMode ? 'update' : 'create'} business`
      );
    } finally {
      setLoading(false);
    }
  };

  const formatTaxId = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Format as EIN (XX-XXXXXXX) or SSN (XXX-XX-XXXX)
    if (digits.length <= 9) {
      // EIN format
      if (digits.length >= 3) {
        return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      }
      return digits;
    } else {
      // SSN format
      if (digits.length >= 6) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`;
      } else if (digits.length >= 4) {
        return `${digits.slice(0, 3)}-${digits.slice(3)}`;
      }
      return digits;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Information */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Business Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Business Name *
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.name}
                onChangeText={(text) => updateFormData('name', text)}
                placeholder="Enter business name"
                placeholderTextColor={theme.text.tertiary}
                autoCapitalize="words"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Business Type *
              </Text>
              <View style={[
                styles.pickerContainer,
                {
                  backgroundColor: theme.background.primary,
                  borderColor: theme.border.primary,
                },
              ]}>
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity 
                    style={styles.iosPickerButton}
                    onPress={() => setShowIOSPicker(true)}
                  >
                    <Text style={[styles.iosPickerText, { color: theme.text.primary }]}>
                      {formData.type}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                  </TouchableOpacity>
                ) : (
                  <Picker
                    selectedValue={formData.type}
                    onValueChange={(value) => updateFormData('type', value)}
                    style={[styles.picker, { color: theme.text.primary }]}
                  >
                    {BUSINESS_TYPES.map((type, index) => (
                      <Picker.Item
                        key={index}
                        label={type}
                        value={type}
                      />
                    ))}
                  </Picker>
                )}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Tax ID (EIN)
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.taxId}
                onChangeText={(text) => updateFormData('taxId', formatTaxId(text))}
                placeholder="XX-XXXXXXX or XXX-XX-XXXX"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
                maxLength={11}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Industry
              </Text>
              <View style={[
                styles.pickerContainer,
                {
                  backgroundColor: theme.background.primary,
                  borderColor: theme.border.primary,
                },
              ]}>
                <Picker
                  selectedValue={formData.industry}
                  onValueChange={(value) => updateFormData('industry', value)}
                  style={[styles.picker, { color: theme.text.primary }]}
                >
                  <Picker.Item label="Select industry..." value="" />
                  {industries.map((industry, index) => (
                    <Picker.Item
                      key={index}
                      label={industry}
                      value={industry}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          {/* Contact Information */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Contact Information
            </Text>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Phone Number
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.phone || ''}
                onChangeText={(text) => updateFormData('phone', text)}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Street Address
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.address?.street || ''}
                onChangeText={(text) => updateFormData('address.street', text)}
                placeholder="123 Main Street"
                placeholderTextColor={theme.text.tertiary}
              />
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputGroupHalf}>
                <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                  City
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background.primary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary,
                    },
                  ]}
                  value={formData.address?.city || ''}
                  onChangeText={(text) => updateFormData('address.city', text)}
                  placeholder="City"
                  placeholderTextColor={theme.text.tertiary}
                />
              </View>

              <View style={styles.inputGroupQuarter}>
                <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                  State
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background.primary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary,
                    },
                  ]}
                  value={formData.address?.state || ''}
                  onChangeText={(text) => updateFormData('address.state', text.toUpperCase())}
                  placeholder="CA"
                  placeholderTextColor={theme.text.tertiary}
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                ZIP Code
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.address?.zipCode || ''}
                onChangeText={(text) => updateFormData('address.zipCode', text)}
                placeholder="12345"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Tax Year
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.settings?.taxYear?.toString() || ''}
                onChangeText={(text) => updateFormData('settings.taxYear', parseInt(text) || new Date().getFullYear())}
                placeholder="2024"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[
              styles.createButton,
              {
                backgroundColor: theme.gold.primary,
                opacity: loading ? 0.6 : 1,
              },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.createButtonText}>
                {isEditMode ? 'Update Business' : 'Create Business'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* iOS Business Type Picker Modal */}
      {showIOSPicker && Platform.OS === 'ios' && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.iosPickerModal, { backgroundColor: theme.background.secondary }]}>
            <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border.primary }]}>
              <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.iosPickerTitle, { color: theme.text.primary }]}>Business Type</Text>
              <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.gold.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={formData.type}
              onValueChange={(value) => updateFormData('type', value)}
              style={[styles.iosPickerWheel, { backgroundColor: theme.background.secondary }]}
              itemStyle={{ color: theme.text.primary, fontSize: 18 }}
            >
              {BUSINESS_TYPES.map((type) => (
                <Picker.Item 
                  key={type} 
                  label={type} 
                  value={type} 
                  color={theme.text.primary}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputGroupHalf: {
    flex: 1,
    marginRight: 8,
  },
  inputGroupQuarter: {
    flex: 0.4,
    marginLeft: 8,
  },
  inputRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: Platform.OS === 'ios' ? 'hidden' : 'visible',
  },
  picker: {
    height: Platform.OS === 'ios' ? 48 : 56,
  },
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginBottom: 20,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '500',
    marginRight: 8,
  },
  createButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iosPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 12,
  },
  iosPickerText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iosPickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iosPickerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  iosPickerWheel: {
    height: 200,
  },
});

export default CreateBusinessScreen;