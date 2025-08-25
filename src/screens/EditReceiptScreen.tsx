import * as React from 'react';
import { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../components/Text';
import { PDFViewer } from '../components/PDFViewer';
import { receiptService } from '../services/firebaseService';
import { format } from 'date-fns';
import { CategoryPicker } from '../components/CategoryPicker';
import { ReceiptCategory } from '../services/ReceiptCategoryService';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { FirebaseErrorScenarios } from '../utils/firebaseErrorHandler';
import { formatCurrency } from '../utils/formatCurrency';
import { BankReceiptService } from '../services/BankReceiptService';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import BusinessSelector from '../components/BusinessSelector';
import { Receipt } from '../services/firebaseService';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

interface FormItem {
  description: string;
  quantity: number;
  price: number;
  amount: number;
  tax: number;
}

type RootStackParamList = {
  EditReceipt: { receipt: Receipt };
};

type EditReceiptScreenProps = NativeStackScreenProps<RootStackParamList, 'EditReceipt'>;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  
  // Modern Card Style
  card: {
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: -0.3,
  },
  
  // Image/PDF Container
  mediaContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 8,
    minHeight: 300,
  },
  image: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  pdfContainer: {
    flex: 1,
    minHeight: 300,
  },
  pdfViewer: {
    flex: 1,
  },
  regenerateContainer: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 215, 0, 0.2)',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  regenerateText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
  },
  regenerateInfoContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 8,
  },
  regenerateInfoText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Form Fields
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  inputContainer: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    minHeight: 50,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
    margin: 0,
    padding: 0,
  },
  
  // Date Picker
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    minHeight: 50,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Tax Section
  taxContainer: {
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  checkboxText: {
    fontSize: 16,
    fontWeight: '500',
  },
  
  // Items Section
  itemCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemField: {
    marginBottom: 16,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.8,
  },
  itemInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: 1,
    minHeight: 42,
  },
  itemTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 4,
  },
  itemTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.7,
  },
  itemTotalValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  
  // Add Button
  addButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Save Button
  saveButtonContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  saveButton: {
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.3,
  },
});

export const EditReceiptScreen: React.FC<EditReceiptScreenProps> = ({ route, navigation }) => {
  const initialReceipt = route.params.receipt;
  const [receipt, setReceipt] = useState(initialReceipt);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
  const { theme } = useTheme();
  const { user } = useAuth();
  const { selectedBusiness } = useBusiness();
  const { showError, showSuccess, showFirebaseError, hideAlert } = useCustomAlert();
  const bankReceiptService = BankReceiptService.getInstance();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Helper function to safely parse dates
  const safeParseDate = (dateValue: any): Date => {
    if (!dateValue) {
      return new Date();
    }
    
    // Handle Firebase Timestamp
    if (dateValue.toDate && typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle string or number dates
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  };

  const [formData, setFormData] = useState({
    vendor: receipt.vendor || '',
    amount: receipt.amount?.toString() || '0',
    date: safeParseDate(receipt.date),
    description: receipt.description || '',
    category: receipt.category || 'business_expense',
    currency: receipt.currency || 'USD',
    businessId: receipt.businessId ?? (selectedBusiness?.id || null),
    items: (receipt.extractedData?.items || []).map(item => ({
      description: item.description,
      quantity: item.quantity,
      price: item.amount / (item.quantity || 1),
      amount: item.amount,
      tax: 0
    })),
    tax: {
      ...receipt.tax,
      deductible: receipt.tax?.deductible ?? true,
      deductionPercentage: receipt.tax?.deductionPercentage ?? 100,
      category: receipt.tax?.category || 'business_expense',
      taxYear: receipt.tax?.taxYear || new Date().getFullYear(),
    }
  });

  console.log('Initial receipt data:', {
    receiptId: receipt.receiptId,
    vendor: receipt.vendor,
    amount: receipt.amount,
    businessId: receipt.businessId,
    businessIdType: typeof receipt.businessId,
    fullReceipt: receipt
  });

  console.log('Initial formData:', {
    vendor: receipt.vendor || '',
    amount: receipt.amount?.toString() || '0',
    businessId: receipt.businessId ?? (selectedBusiness?.id || null),
  });

  // Only sync formData when receipt is updated after save (not on initial load)
  React.useEffect(() => {
    // Only update if this is clearly an update after save, not initial load
    const isAfterSave = receipt.updatedAt && receipt.createdAt && 
                       receipt.updatedAt.getTime() > receipt.createdAt.getTime();
    
    if (!isAfterSave) {
      console.log('Skipping formData sync - initial load or no save detected');
      return;
    }
    
    console.log('Syncing formData after save:', {
      receiptVendor: receipt.vendor,
      receiptBusinessId: receipt.businessId,
    });
    
    setFormData(prevFormData => ({
      ...prevFormData,
      vendor: receipt.vendor || '',
      amount: receipt.amount?.toString() || '0',
      date: safeParseDate(receipt.date),
      description: receipt.description || '',
      category: receipt.category || 'business_expense',
      currency: receipt.currency || 'USD',
      businessId: receipt.businessId ?? null,
    }));
  }, [receipt, selectedBusiness?.id]);

  // Refresh receipt data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const fetchLatestReceipt = async () => {
        if (route.params?.receipt?.receiptId) {
          try {
            console.log('Refreshing receipt data on focus:', route.params.receipt.receiptId);
            const latestReceipt = await receiptService.getReceiptById(route.params.receipt.receiptId);
            
            if (latestReceipt) {
              // Update both receipt and formData with latest data
              const refreshedReceipt = {
                ...latestReceipt,
                date: safeParseDate(latestReceipt.date),
                createdAt: safeParseDate(latestReceipt.createdAt),
                updatedAt: safeParseDate(latestReceipt.updatedAt),
              };
              
              setReceipt(refreshedReceipt);
              setFormData(prevFormData => ({
                ...prevFormData,
                vendor: refreshedReceipt.vendor || '',
                amount: refreshedReceipt.amount?.toString() || '0',
                date: safeParseDate(refreshedReceipt.date),
                description: refreshedReceipt.description || '',
                category: refreshedReceipt.category || 'business_expense',
                currency: refreshedReceipt.currency || 'USD',
                businessId: refreshedReceipt.businessId ?? null,
              }));
              
              console.log('Receipt refreshed:', {
                vendor: refreshedReceipt.vendor,
                businessId: refreshedReceipt.businessId,
              });
            }
          } catch (error) {
            console.error('Failed to refresh receipt:', error);
          }
        }
      };
      
      fetchLatestReceipt();
    }, [route.params?.receipt?.receiptId])
  );

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!receipt) return false;
    
    // Compare current form data with original receipt data
    const originalAmount = receipt.amount?.toString() || '';
    const originalVendor = receipt.vendor || '';
    const originalDescription = receipt.description || '';
    const originalCategory = receipt.category || 'business_expense';
    const originalCurrency = receipt.currency || 'USD';
    
    return (
      formData.amount !== originalAmount ||
      formData.vendor !== originalVendor ||
      formData.description !== originalDescription ||
      formData.category !== originalCategory ||
      formData.currency !== originalCurrency ||
      formData.businessId !== (receipt.businessId ?? null) ||
      JSON.stringify(formData.items) !== JSON.stringify(receipt.extractedData?.items || []) ||
      formData.tax.deductible !== (receipt.tax?.deductible || false) ||
      formData.tax.deductionPercentage !== (receipt.tax?.deductionPercentage || 0) ||
      formData.tax.taxYear !== (receipt.tax?.taxYear || new Date().getFullYear())
    );
  }, [formData, receipt]);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.vendor || !formData.amount) {
        showError('Error', 'Vendor and amount are required');
        return;
      }

      // Create updated receipt data
      const updatedReceiptBase = {
        vendor: formData.vendor,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
        category: formData.category, // Use the main category from Basic Information
        currency: formData.currency,
        extractedData: {
          vendor: formData.vendor,
          amount: parseFloat(formData.amount),
          date: formData.date.toISOString(),
          items: formData.items.map((item: FormItem) => ({
            description: item.description,
            amount: item.price * item.quantity,
            quantity: item.quantity,
            tax: item.tax || 0
          })),
          confidence: receipt.extractedData?.confidence || 1,
        },
        tax: {
          deductible: formData.tax.deductible,
          deductionPercentage: formData.tax.deductionPercentage,
          taxYear: formData.tax.taxYear,
          category: formData.category, // Use the main category for tax as well
        },
        updatedAt: new Date(),
      };

      // Create the update object - convert null businessId to undefined so Firestore can delete the field
      const updatedReceipt: Partial<Receipt> = {
        ...updatedReceiptBase,
        businessId: formData.businessId || undefined
      };

      console.log('Saving receipt with data:', {
        formDataVendor: formData.vendor,
        formDataAmount: formData.amount,
        formDataBusinessId: formData.businessId,
        updatedReceiptVendor: updatedReceipt.vendor,
        updatedReceiptBusinessId: updatedReceipt.businessId,
        receiptId: receipt.receiptId
      });

      // Update the receipt with only the changed fields
      await receiptService.updateReceipt(receipt.receiptId, updatedReceipt);
      
      // Update local receipt state with the saved changes
      setReceipt(prevReceipt => {
        const newReceipt = {
          ...prevReceipt,
          ...updatedReceipt,
          updatedAt: new Date()
        };
        
        console.log('Receipt state updated:', {
          oldVendor: prevReceipt.vendor,
          newVendor: newReceipt.vendor,
          oldBusinessId: prevReceipt.businessId,
          newBusinessId: newReceipt.businessId
        });
        
        return newReceipt;
      });

      console.log('Receipt state updated. New businessId:', updatedReceipt.businessId);
      
      // If this is a PDF receipt from bank transaction, regenerate PDF with updated data
      if ((receipt as any).metadata?.source === 'bank_transaction' && (receipt as any).type === 'pdf') {
        try {
          console.log('🔄 Auto-regenerating PDF after data update...');
          await bankReceiptService.regeneratePDFForReceipt(receipt.receiptId, user?.uid || '');
          console.log('✅ PDF regenerated successfully after update');
        } catch (pdfError) {
          console.error('⚠️ Failed to regenerate PDF after update:', pdfError);
          // Don't show error to user as the main save was successful
        }
      }
      
      showSuccess(
        'Success',
        'Receipt updated successfully',
        {
          primaryButtonText: 'OK',
          onPrimaryPress: () => {
            hideAlert();
            navigation.goBack();
          },
        }
      );
    } catch (error) {
      console.error('Error updating receipt:', error);
      showFirebaseError(error, FirebaseErrorScenarios.FIRESTORE.UPDATE);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          description: '',
          quantity: 1,
          price: 0,
          amount: 0,
          tax: 0,
        }
      ]
    }));
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_: FormItem, i: number) => i !== index)
    }));
  };

  const handleUpdateItem = (index: number, field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map((item: FormItem, i: number) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'price') {
            updatedItem.amount = parseFloat(updatedItem.quantity.toString()) * parseFloat(updatedItem.price.toString());
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]} edges={['top']}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Media Section */}
        <View style={[styles.card, { backgroundColor: theme.background.elevated }]}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Receipt
          </Text>
          <View style={[styles.mediaContainer, { backgroundColor: theme.background.secondary }]}>
            {(receipt as any).type === 'pdf' ? (
              // PDF Preview with Modal
              <View style={styles.pdfContainer}>
                <PDFViewer 
                  key={`pdf-${receipt.receiptId}-${receipt.updatedAt?.toISOString() || 'default'}`}
                  pdfFilePath={(receipt as any).pdfPath}
                  style={styles.pdfViewer}
                  showShare={false}
                />
                {(receipt as any).metadata?.source === 'bank_transaction' && hasUnsavedChanges && (
                  <View style={styles.regenerateContainer}>
                    <View style={styles.regenerateInfoContainer}>
                      <Text style={[styles.regenerateInfoText, { color: theme.text.secondary }]}>
                        You have unsaved changes. Save to regenerate the PDF with updated information.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            ) : (
              // Image Preview
              <Image
                source={{ uri: receipt.images[0]?.url }}
                style={styles.image}
              />
            )}
          </View>
        </View>

        {/* Basic Information */}
        <View style={[styles.card, { backgroundColor: theme.background.elevated }]}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Basic Information</Text>
          
          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Vendor</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.secondary,
            }]}>
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                value={formData.vendor}
                onChangeText={(text) => setFormData(prev => ({ ...prev, vendor: text }))}
                placeholder="Enter vendor name"
                placeholderTextColor={theme.text.secondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Amount</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.secondary,
            }]}>
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                value={formData.amount}
                onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={theme.text.secondary}
              />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Business</Text>
            <BusinessSelector
              key={`business-selector-${formData.businessId}`}
              selectedBusinessId={formData.businessId}
              onBusinessSelect={(businessId) => setFormData(prev => ({
                ...prev,
                businessId: businessId || null
              }))}
              placeholder="Select business (optional)"
              allowUnassigned={true}
              style={[styles.inputContainer, { 
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.secondary,
              }]}
            />
            <Text style={{ color: theme.text.secondary, fontSize: 12, marginTop: 4 }}>
              Debug: {formData.businessId ? `Selected: ${formData.businessId}` : 'No business selected'}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <CategoryPicker
              selectedCategory={formData.category as ReceiptCategory}
              onCategorySelect={(category) => setFormData(prev => ({
                ...prev,
                category
              }))}
              label="Category"
              aiSuggestedCategory={receipt.category as ReceiptCategory}
              aiConfidence={0.85}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Date</Text>
            <TouchableOpacity
              style={[styles.dateButton, { 
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.secondary,
              }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[styles.dateText, { color: theme.text.primary }]}>
                {format(formData.date, 'MMM d, yyyy')}
              </Text>
              <Ionicons name="calendar-outline" size={20} color={theme.text.secondary} />
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={formData.date}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_event: any, selectedDate: Date | undefined) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setFormData(prev => ({ ...prev, date: selectedDate }));
                }
              }}
            />
          )}

          <View style={styles.fieldGroup}>
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Description</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.secondary,
            }]}>
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                value={formData.description}
                onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
                placeholder="Enter description"
                placeholderTextColor={theme.text.secondary}
                multiline={true}
                numberOfLines={2}
              />
            </View>
          </View>
        </View>

        {/* Tax Information */}
        <View style={[styles.card, { backgroundColor: theme.background.elevated }]}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Tax Information</Text>
          <View style={[styles.taxContainer, { backgroundColor: theme.background.secondary }]}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFormData(prev => ({
                ...prev,
                tax: { ...prev.tax, deductible: !prev.tax.deductible }
              }))}
            >
              <View style={[styles.checkbox, {
                backgroundColor: formData.tax.deductible ? theme.gold.primary : theme.background.primary,
                borderColor: formData.tax.deductible ? theme.gold.primary : theme.border.primary,
              }]}>
                {formData.tax.deductible && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
              <Text style={[styles.checkboxText, { color: theme.text.primary }]}>Tax Deductible</Text>
            </TouchableOpacity>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Deduction Percentage</Text>
              <View style={[styles.inputContainer, { 
                backgroundColor: theme.background.primary,
                borderColor: theme.border.secondary,
              }]}>
                <TextInput
                  style={[styles.input, { color: theme.text.primary }]}
                  value={formData.tax.deductionPercentage.toString()}
                  onChangeText={(text) => setFormData(prev => ({
                    ...prev,
                    tax: { ...prev.tax, deductionPercentage: parseInt(text) || 0 }
                  }))}
                  keyboardType="number-pad"
                  placeholder="100"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Tax Year</Text>
              <View style={[styles.inputContainer, { 
                backgroundColor: theme.background.primary,
                borderColor: theme.border.secondary,
              }]}>
                <TextInput
                  style={[styles.input, { color: theme.text.primary }]}
                  value={formData.tax.taxYear.toString()}
                  onChangeText={(text) => setFormData(prev => ({
                    ...prev,
                    tax: { ...prev.tax, taxYear: parseInt(text) || new Date().getFullYear() }
                  }))}
                  keyboardType="number-pad"
                  placeholder={new Date().getFullYear().toString()}
                  placeholderTextColor={theme.text.secondary}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Items Section */}
        <View style={[styles.card, { backgroundColor: theme.background.elevated }]}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Items</Text>
          {formData.items.map((item: FormItem, index: number) => (
            <View
              key={index}
              style={[styles.itemCard, { 
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.secondary,
              }]}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemTitle, { color: theme.text.primary }]}>
                  Item {index + 1}
                </Text>
                <TouchableOpacity 
                  onPress={() => handleRemoveItem(index)}
                  style={[styles.removeButton, { backgroundColor: theme.status.error + '20' }]}
                >
                  <Text style={[styles.removeButtonText, { color: theme.status.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemField}>
                <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Description</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.secondary,
                  }]}
                  value={item.description}
                  onChangeText={(text) => handleUpdateItem(index, 'description', text)}
                  placeholder="Item description"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemField}>
                <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Quantity</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.secondary,
                  }]}
                  value={item.quantity?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'quantity', text)}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemField}>
                <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Price</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.secondary,
                  }]}
                  value={item.price?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'price', text)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemField}>
                <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Tax</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.secondary,
                  }]}
                  value={item.tax?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'tax', text)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={[styles.itemTotal, { borderTopColor: theme.border.secondary }]}>
                <Text style={[styles.itemTotalLabel, { color: theme.text.secondary }]}>
                  Item Total
                </Text>
                <Text style={[styles.itemTotalValue, { color: theme.gold.primary }]}>
                  {formatCurrency(item.quantity * item.price)}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addButton, { 
              borderColor: theme.gold.primary,
              backgroundColor: theme.gold.background,
            }]}
            onPress={handleAddItem}
          >
            <Ionicons name="add-circle-outline" size={20} color={theme.gold.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.addButtonText, { color: theme.gold.primary }]}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, { 
            backgroundColor: theme.gold.primary,
            opacity: loading ? 0.7 : 1,
          }]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={18} color="white" style={{ marginRight: 6 }} />
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
