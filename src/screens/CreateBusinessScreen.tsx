import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
  Dimensions,
  TouchableWithoutFeedback,
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
      defaultCurrency: 'USD' as const,
      taxYear: new Date().getFullYear(),
      categories: [] as string[],
    },
  });

  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [showIOSIndustryPicker, setShowIOSIndustryPicker] = useState(false);
  
  // Keyboard and scroll handling
  const scrollViewRef = useRef<ScrollView>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [screenHeight, setScreenHeight] = useState(Dimensions.get('window').height);
  const inputRefs = useRef<{ [key: string]: TextInput | null }>({});

  const industries = BusinessService.getIndustryOptions();

  // Populate form with existing business data in edit mode
  useEffect(() => {
    if (isEditMode && existingBusiness) {
      // Format phone number when loading existing data
      const formatPhoneNumber = (phone: string) => {
        if (!phone) return '';
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length >= 6) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
        } else if (digits.length >= 3) {
          return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
        } else {
          return digits;
        }
      };

      setFormData({
        name: existingBusiness.name,
        type: existingBusiness.type,
        taxId: existingBusiness.taxId || '',
        industry: existingBusiness.industry || '',
        phone: formatPhoneNumber(existingBusiness.phone || ''),
        address: existingBusiness.address || {
          street: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'US',
        },
        settings: existingBusiness.settings || {
          defaultCurrency: 'USD' as const,
          taxYear: new Date().getFullYear(),
          categories: [] as string[],
        },
      });
    }
  }, [isEditMode, existingBusiness]);

  // Keyboard handling
  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      setKeyboardHeight(event.endCoordinates.height);
    };

    const keyboardWillHide = () => {
      setKeyboardHeight(0);
    };

    const dimensionChange = ({ window }: { window: any }) => {
      setScreenHeight(window.height);
    };

    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      keyboardWillShow
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      keyboardWillHide
    );
    const dimensionListener = Dimensions.addEventListener('change', dimensionChange);

    return () => {
      keyboardWillShowListener?.remove();
      keyboardWillHideListener?.remove();
      dimensionListener?.remove();
    };
  }, []);

  // Function to scroll to input when focused - simplified approach
  const scrollToInput = (inputKey: string) => {
    if (scrollViewRef.current) {
      // Use a simple estimation approach to avoid native measurement issues
      setTimeout(() => {
        const estimatedInputPosition = getInputEstimatedPosition(inputKey);
        const targetY = Math.max(0, estimatedInputPosition - 80); // 80px from top
        
        scrollViewRef.current?.scrollTo({
          y: targetY,
          animated: true,
        });
      }, Platform.OS === 'ios' ? 200 : 150);
    }
  };

  // Estimate input position based on form layout
  const getInputEstimatedPosition = (inputKey: string): number => {
    const positions = {
      // Business Information section starts around 60px
      'name': 60,        // First input in business info
      'taxId': 200,      // After business name + business type + some spacing
      
      // Contact Information section starts around 400px
      'phone': 480,      // First input in contact info section
      'street': 580,     // After phone number
      'city': 680,       // After street address
      'state': 680,      // Same row as city
      'zipCode': 780,    // After city/state row
      'taxYear': 880,    // After zip code
    };
    
    return positions[inputKey] || 0;
  };

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
          defaultCurrency: 'USD' as const,
          taxYear: new Date().getFullYear(),
          categories: [] as string[],
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

    // Trim all text inputs before validation and submission
    const trimmedFormData = {
      ...formData,
      name: formData.name.trim(),
      industry: formData.industry?.trim() || '',
      address: {
        ...formData.address,
        street: formData.address?.street?.trim() || '',
        city: formData.address?.city?.trim() || '',
        state: formData.address?.state?.trim() || '',
      }
    };

    // Validate form with trimmed data
    const errors = BusinessService.validateBusinessData(trimmedFormData);
    if (errors.length > 0) {
      showError('Validation Error', errors.join('\n'));
      return;
    }

    setLoading(true);

    try {
      // Ensure settings has proper structure for business creation/update
      const businessData = {
        ...trimmedFormData,
        settings: {
          defaultCurrency: trimmedFormData.settings?.defaultCurrency || 'USD',
          taxYear: trimmedFormData.settings?.taxYear || new Date().getFullYear(),
          categories: trimmedFormData.settings?.categories || [],
        }
      };

      if (isEditMode && businessId) {
        // Update existing business
        await updateBusiness(businessId, businessData);
      } else {
        // Create new business
        await createBusiness(businessData);
      }
      
      // Navigate back after successful creation/update
      navigation.goBack();
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

  const handleTaxIdChange = (text: string) => {
    // Remove all non-digits
    const digits = text.replace(/\D/g, '');
    
    // Limit to 9 digits for EIN format
    if (digits.length > 9) {
      return; // Don't update if more than 9 digits
    }
    
    // Format as EIN (XX-XXXXXXX)
    let formatted = '';
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}-${digits.slice(2)}`;
    } else {
      formatted = digits;
    }
    
    updateFormData('taxId', formatted);
  };

  const handlePhoneNumberChange = (text: string) => {
    // Remove all non-digits from the new input
    const digits = text.replace(/\D/g, '');
    
    // If user is trying to add more than 10 digits, don't update at all
    if (digits.length > 10) {
      return; // Don't call updateFormData
    }
    
    // Format the phone number
    let formatted = '';
    if (digits.length >= 6) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length >= 3) {
      formatted = `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      formatted = digits;
    }
    
    updateFormData('phone', formatted);
  };

  const handleZipCodeChange = (text: string) => {
    // Remove all non-digits from the new input
    const digits = text.replace(/\D/g, '');
    
    // If user is trying to add more than 9 digits (ZIP+4 format), don't update at all
    if (digits.length > 9) {
      return; // Don't call updateFormData
    }
    
    // Format the zip code
    let formatted = '';
    if (digits.length > 5) {
      // ZIP+4 format: 12345-6789
      formatted = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    } else {
      // Basic ZIP: 12345
      formatted = digits;
    }
    
    updateFormData('address.zipCode', formatted);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(40, keyboardHeight > 0 ? 20 : 40) }
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
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
                ref={(ref) => { inputRefs.current['name'] = ref; }}
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
                maxLength={100}
                onFocus={() => scrollToInput('name')}
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
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowIOSPicker(true);
                    }}
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
                ref={(ref) => { inputRefs.current['taxId'] = ref; }}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.taxId}
                onChangeText={handleTaxIdChange}
                onFocus={() => scrollToInput('taxId')}
                placeholder="XX-XXXXXXX"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
                maxLength={10}
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
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity 
                    style={styles.iosPickerButton}
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowIOSIndustryPicker(true);
                    }}
                  >
                    <Text style={[styles.iosPickerText, { color: formData.industry ? theme.text.primary : theme.text.tertiary }]}>
                      {formData.industry || "Select industry..."}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                  </TouchableOpacity>
                ) : (
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
                )}
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
                ref={(ref) => { inputRefs.current['phone'] = ref; }}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.phone || ''}
                onChangeText={handlePhoneNumberChange}
                onFocus={() => scrollToInput('phone')}
                placeholder="(555) 123-4567"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="phone-pad"
                maxLength={14}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Street Address
              </Text>
              <TextInput
                ref={(ref) => { inputRefs.current['street'] = ref; }}
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
                onFocus={() => scrollToInput('street')}
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
                  ref={(ref) => { inputRefs.current['city'] = ref; }}
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
                  onFocus={() => scrollToInput('city')}
                  placeholder="City"
                  placeholderTextColor={theme.text.tertiary}
                />
              </View>

              <View style={styles.inputGroupQuarter}>
                <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                  State
                </Text>
                <TextInput
                  ref={(ref) => { inputRefs.current['state'] = ref; }}
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background.primary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary,
                    },
                  ]}
                  value={formData.address?.state || ''}
                  onChangeText={(text) => updateFormData('address.state', text.toUpperCase().trim())}
                  onFocus={() => scrollToInput('state')}
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
                ref={(ref) => { inputRefs.current['zipCode'] = ref; }}
                style={[
                  styles.textInput,
                  {
                    backgroundColor: theme.background.primary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                value={formData.address?.zipCode || ''}
                onChangeText={handleZipCodeChange}
                onFocus={() => scrollToInput('zipCode')}
                placeholder="12345 or 12345-6789"
                placeholderTextColor={theme.text.tertiary}
                keyboardType="numeric"
                maxLength={10}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.secondary }]}>
                Tax Year
              </Text>
              <TextInput
                ref={(ref) => { inputRefs.current['taxYear'] = ref; }}
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
                onFocus={() => scrollToInput('taxYear')}
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
      </TouchableWithoutFeedback>

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

      {/* iOS Industry Picker Modal */}
      {showIOSIndustryPicker && Platform.OS === 'ios' && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.iosPickerModal, { backgroundColor: theme.background.secondary }]}>
            <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border.primary }]}>
              <TouchableOpacity onPress={() => setShowIOSIndustryPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.iosPickerTitle, { color: theme.text.primary }]}>Industry</Text>
              <TouchableOpacity onPress={() => setShowIOSIndustryPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.gold.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={formData.industry}
              onValueChange={(value) => updateFormData('industry', value)}
              style={[styles.iosPickerWheel, { backgroundColor: theme.background.secondary }]}
              itemStyle={{ color: theme.text.primary, fontSize: 18 }}
            >
              <Picker.Item label="Select industry..." value="" color={theme.text.tertiary} />
              {industries.map((industry) => (
                <Picker.Item 
                  key={industry} 
                  label={industry} 
                  value={industry} 
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