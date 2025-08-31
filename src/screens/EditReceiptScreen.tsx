import * as React from 'react';
import { useState, useMemo, useRef } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Modal,
  FlatList,
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
import { SplitTenderInfo, SplitTenderPayment } from '../types/receipt';
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
  fieldLabelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  characterCount: {
    fontSize: 12,
    fontWeight: '500',
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
  
  // Payment Method Dropdown
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdownContainer: {
    width: '80%',
    maxHeight: '60%',
    borderRadius: 16,
    padding: 8,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginVertical: 2,
  },
  dropdownItemIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 16,
  },
  dropdownItemText: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  dropdownItemSelected: {
    opacity: 0.7,
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
  const [showPaymentMethodDropdown, setShowPaymentMethodDropdown] = useState(false);
  const [selectedPaymentIndex, setSelectedPaymentIndex] = useState<number | null>(null);
  const [paymentAmountInputs, setPaymentAmountInputs] = useState<{[key: number]: string}>({});

  // Payment method options with display info
  const paymentMethodOptions = [
    { value: 'cash', label: 'Cash', icon: '💵', color: '#4CAF50' },
    { value: 'credit', label: 'Credit Card', icon: '💳', color: '#2196F3' },
    { value: 'debit', label: 'Debit Card', icon: '💳', color: '#FF9800' },
    { value: 'gift_card', label: 'Gift Card', icon: '🎁', color: '#9C27B0' },
    { value: 'check', label: 'Check', icon: '📝', color: '#795548' },
    { value: 'other', label: 'Other', icon: '💰', color: '#607D8B' },
  ] as const;

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

  // Helper function to format amount with 2 decimal places
  const formatAmountForDisplay = (amount: number | undefined): string => {
    if (amount === undefined || amount === null) return '0.00';
    return Number(amount).toFixed(2);
  };

  const [formData, setFormData] = useState({
    vendor: receipt.vendor || (receipt as any).businessName || '',
    amount: formatAmountForDisplay(receipt.amount),
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
      deductionPercentage: receipt.tax?.deductionPercentage ?? 0,
      category: receipt.tax?.category || 'business_expense',
      taxYear: receipt.tax?.taxYear || new Date().getFullYear(),
      amount: (receipt.tax as any)?.amount ?? 0,
    },
    taxAmountDisplay: ((receipt.tax as any)?.amount ?? 0).toFixed(2),
    splitTender: receipt.extractedData?.splitTender || {
      isSplitTender: false,
      confidence: 1.0,
      payments: [],
      totalVerified: false,
      detectedPatterns: []
    },
  });

  console.log('Initial receipt data:', {
    receiptId: receipt.receiptId,
    vendor: receipt.vendor,
    businessName: (receipt as any).businessName,
    finalVendor: receipt.vendor || (receipt as any).businessName || '',
    amount: receipt.amount,
    businessId: receipt.businessId,
    businessIdType: typeof receipt.businessId,
    fullTaxObject: receipt.tax,
    taxAmount: (receipt.tax as any)?.amount,
    extractedData: receipt.extractedData,
    splitTender: receipt.extractedData?.splitTender,
  });

  console.log('Initial formData:', {
    vendor: receipt.vendor || (receipt as any).businessName || '',
    amount: formatAmountForDisplay(receipt.amount),
    businessId: receipt.businessId ?? (selectedBusiness?.id || null),
    taxObject: {
      deductible: receipt.tax?.deductible ?? true,
      deductionPercentage: receipt.tax?.deductionPercentage ?? 0,
      category: receipt.tax?.category || 'business_expense',
      taxYear: receipt.tax?.taxYear || new Date().getFullYear(),
      amount: (receipt.tax as any)?.amount ?? 0,
    }
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
      vendor: receipt.vendor || (receipt as any).businessName || '',
      amount: formatAmountForDisplay(receipt.amount),
      date: safeParseDate(receipt.date),
      description: receipt.description || '',
      category: receipt.category || 'business_expense',
      currency: receipt.currency || 'USD',
      businessId: receipt.businessId ?? null,
      taxAmountDisplay: ((receipt.tax as any)?.amount ?? 0).toFixed(2),
      splitTender: receipt.extractedData?.splitTender || {
        isSplitTender: false,
        confidence: 1.0,
        payments: [],
        totalVerified: false,
        detectedPatterns: []
      },
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
                amount: formatAmountForDisplay(refreshedReceipt.amount),
                date: safeParseDate(refreshedReceipt.date),
                description: refreshedReceipt.description || '',
                category: refreshedReceipt.category || 'business_expense',
                currency: refreshedReceipt.currency || 'USD',
                businessId: refreshedReceipt.businessId ?? null,
                taxAmountDisplay: ((refreshedReceipt.tax as any)?.amount ?? 0).toFixed(2),
                splitTender: refreshedReceipt.extractedData?.splitTender || {
                  isSplitTender: false,
                  confidence: 1.0,
                  payments: [],
                  totalVerified: false,
                  detectedPatterns: []
                },
              }));
              
              console.log('Receipt refreshed:', {
                vendor: refreshedReceipt.vendor,
                businessId: refreshedReceipt.businessId,
                splitTender: refreshedReceipt.extractedData?.splitTender,
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

  // Check if split-tender amounts are valid
  const isSplitTenderValid = useMemo(() => {
    if (!formData.splitTender.isSplitTender) return true;
    
    const totalPayments = formData.splitTender.payments.reduce((sum, p) => sum + p.amount, 0);
    const receiptTotal = parseFloat(formData.amount) || 0;
    const tolerance = 0.01; // Allow for small rounding differences
    
    return Math.abs(totalPayments - receiptTotal) <= tolerance;
  }, [formData.splitTender, formData.amount]);

  // Track if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    if (!receipt) return false;
    
    // Compare current form data with original receipt data
    const originalAmount = formatAmountForDisplay(receipt.amount);
    const originalVendor = receipt.vendor || '';
    const originalDescription = receipt.description || '';
    const originalCategory = receipt.category || 'business_expense';
    const originalCurrency = receipt.currency || 'USD';
    
    // Compare items properly - transform original items to match formData structure for comparison
    const originalItems = (receipt.extractedData?.items || []).map(item => ({
      description: item.description,
      quantity: item.quantity,
      price: item.amount / (item.quantity || 1),
      amount: item.amount,
      tax: 0
    }));
    
    const itemsChanged = JSON.stringify(formData.items) !== JSON.stringify(originalItems);
    
    // Debug logging for unsaved changes detection
    const hasChanges = (
      formData.amount !== originalAmount ||
      formData.vendor !== originalVendor ||
      formData.description !== originalDescription ||
      formData.category !== originalCategory ||
      formData.currency !== originalCurrency ||
      formData.businessId !== (receipt.businessId ?? null) ||
      itemsChanged ||
      formData.tax.deductible !== (receipt.tax?.deductible || false) ||
      formData.tax.deductionPercentage !== (receipt.tax?.deductionPercentage || 0) ||
      formData.tax.taxYear !== (receipt.tax?.taxYear || new Date().getFullYear()) ||
      formData.tax.amount !== ((receipt.tax as any)?.amount || 0)
    );
    
    // Only log when there are changes to avoid spam
    if (hasChanges) {
      console.log('🔄 Unsaved changes detected:', {
        amountChanged: formData.amount !== originalAmount,
        vendorChanged: formData.vendor !== originalVendor,
        descriptionChanged: formData.description !== originalDescription,
        categoryChanged: formData.category !== originalCategory,
        currencyChanged: formData.currency !== originalCurrency,
        businessIdChanged: formData.businessId !== (receipt.businessId ?? null),
        itemsChanged,
        taxChanged: formData.tax.deductible !== (receipt.tax?.deductible || false) ||
                   formData.tax.deductionPercentage !== (receipt.tax?.deductionPercentage || 0) ||
                   formData.tax.taxYear !== (receipt.tax?.taxYear || new Date().getFullYear()) ||
                   formData.tax.amount !== ((receipt.tax as any)?.amount || 0)
      });
    }
    
    return hasChanges;
  }, [formData, receipt]);

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.vendor || !formData.amount) {
        showError('Error', 'Vendor and amount are required');
        return;
      }

      // Validate split-tender amounts
      if (!isSplitTenderValid) {
        showError('Error', 'Split-tender payment amounts must equal the receipt total');
        return;
      }

      // Create updated receipt data
      const updatedReceiptBase = {
        vendor: formData.vendor,
        businessName: formData.vendor, // Ensure businessName matches vendor for consistency
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
          ...(formData.splitTender.isSplitTender && {
            splitTender: {
              ...formData.splitTender,
              totalVerified: Math.abs(formData.splitTender.payments.reduce((sum, p) => sum + p.amount, 0) - parseFloat(formData.amount)) <= 0.01,
              confidence: 1.0, // User-edited data is always high confidence
            }
          }),
        },
        tax: {
          deductible: formData.tax.deductible,
          deductionPercentage: formData.tax.deductionPercentage,
          taxYear: formData.tax.taxYear,
          category: formData.category, // Use the main category for tax as well
          amount: formData.tax.amount || 0, // Save the tax amount
        },
        updatedAt: new Date(),
      };

      // Create the update object - convert null businessId to undefined so Firestore can delete the field
      const updatedReceipt: Partial<Receipt> = {
        ...updatedReceiptBase,
        businessId: formData.businessId || undefined
      };

      console.log('💾 Saving receipt with data:', {
        receiptId: receipt.receiptId,
        originalVendor: receipt.vendor,
        formDataVendor: formData.vendor,
        updatedReceiptVendor: updatedReceipt.vendor,
        hasVendorChanged: formData.vendor !== receipt.vendor,
        fullUpdateObject: updatedReceipt
      });

      // Update the receipt with only the changed fields
      console.log('🔥 About to update receipt in Firestore:', {
        receiptId: receipt.receiptId,
        updateData: updatedReceipt
      });
      await receiptService.updateReceipt(receipt.receiptId, updatedReceipt);
      console.log('✅ Receipt updated in Firestore successfully');
      
      // Update local receipt state with the saved changes
      setReceipt(prevReceipt => {
        const newReceipt = {
          ...prevReceipt,
          ...updatedReceipt,
          updatedAt: new Date()
        };
        
        console.log('🔄 Receipt state updated:', {
          oldVendor: prevReceipt.vendor,
          newVendor: newReceipt.vendor,
          vendorChanged: prevReceipt.vendor !== newReceipt.vendor,
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
            // Simply go back - the useFocusEffect in ReceiptsListScreen will handle the refresh
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

  // Get payment method display info
  const getPaymentMethodInfo = (method: SplitTenderPayment['method']) => {
    return paymentMethodOptions.find(option => option.value === method) || paymentMethodOptions[5]; // fallback to 'other'
  };

  // Get display value for payment amount input
  const getPaymentAmountDisplayValue = (paymentIndex: number, amount: number) => {
    // If user is currently editing this field, use the input value
    if (paymentAmountInputs[paymentIndex] !== undefined) {
      return paymentAmountInputs[paymentIndex];
    }
    // Otherwise, show the formatted amount or empty string for 0
    return amount > 0 ? amount.toString() : '';
  };

  // Calculate remaining amount for automatic population
  const getRemainingAmount = () => {
    const receiptTotal = parseFloat(formData.amount) || 0;
    const totalPayments = formData.splitTender.payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = receiptTotal - totalPayments;
    return Math.max(0, remaining);
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (paymentIndex: number, method: SplitTenderPayment['method']) => {
    const newPayments = [...formData.splitTender.payments];
    newPayments[paymentIndex] = { ...newPayments[paymentIndex], method };
    setFormData(prev => ({
      ...prev,
      splitTender: { ...prev.splitTender, payments: newPayments }
    }));
    setShowPaymentMethodDropdown(false);
    setSelectedPaymentIndex(null);
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
                  receiptId={receipt.receiptId}
                  userId={receipt.userId}
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
            <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Tax Amount</Text>
            <View style={[styles.inputContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.secondary,
            }]}>
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                value={formData.taxAmountDisplay}
                onChangeText={(text) => {
                  const taxAmount = parseFloat(text) || 0;
                  setFormData(prev => ({ 
                    ...prev, 
                    taxAmountDisplay: text,
                    tax: { ...prev.tax, amount: taxAmount }
                  }));
                }}
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
            <View style={styles.fieldLabelContainer}>
              <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Description</Text>
              <Text style={[styles.characterCount, { color: theme.text.secondary }]}>
                {formData.description.length}/200
              </Text>
            </View>
            <View style={[styles.inputContainer, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.secondary,
            }]}>
              <TextInput
                style={[styles.input, { color: theme.text.primary }]}
                value={formData.description}
                onChangeText={(text) => {
                  if (text.length <= 200) {
                    setFormData(prev => ({ ...prev, description: text }))
                  }
                }}
                placeholder="Enter description"
                placeholderTextColor={theme.text.secondary}
                multiline={true}
                numberOfLines={2}
                maxLength={200}
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
                <View style={styles.fieldLabelContainer}>
                  <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Description</Text>
                  <Text style={[styles.characterCount, { color: theme.text.secondary, fontSize: 10 }]}>
                    {item.description.length}/50
                  </Text>
                </View>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.secondary,
                  }]}
                  value={item.description}
                  onChangeText={(text) => {
                    if (text.length <= 50) {
                      handleUpdateItem(index, 'description', text)
                    }
                  }}
                  placeholder="Item description"
                  placeholderTextColor={theme.text.secondary}
                  maxLength={50}
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

        {/* Split Tender Section */}
        <View style={[styles.card, { backgroundColor: theme.background.elevated }]}>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>Payment Methods</Text>
          
          <View style={styles.fieldGroup}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setFormData(prev => {
                const isEnablingSplitTender = !prev.splitTender.isSplitTender;
                if (isEnablingSplitTender && prev.splitTender.payments.length === 0) {
                  const receiptTotal = parseFloat(prev.amount) || 0;
                  const halfAmount = Math.round((receiptTotal / 2) * 100) / 100; // Round to 2 decimal places
                  const remainder = receiptTotal - halfAmount;
                  return {
                    ...prev,
                    splitTender: { 
                      ...prev.splitTender, 
                      isSplitTender: true,
                      payments: [
                        { method: 'cash', amount: halfAmount }, 
                        { method: 'credit', amount: remainder }
                      ]
                    }
                  };
                }
                return {
                  ...prev,
                  splitTender: { 
                    ...prev.splitTender, 
                    isSplitTender: isEnablingSplitTender
                  }
                };
              })}
            >
              <View style={[styles.checkbox, {
                backgroundColor: formData.splitTender.isSplitTender ? theme.gold.primary : theme.background.primary,
                borderColor: formData.splitTender.isSplitTender ? theme.gold.primary : theme.border.primary,
              }]}>
                {formData.splitTender.isSplitTender && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
              <Text style={[styles.checkboxText, { color: theme.text.primary }]}>Split Tender Payment</Text>
            </TouchableOpacity>
            
            {formData.splitTender.isSplitTender && (
              <Text style={[styles.fieldLabel, { color: theme.text.secondary, fontSize: 12, marginTop: 8 }]}>
                This receipt was paid using multiple payment methods
              </Text>
            )}
          </View>

          {formData.splitTender.isSplitTender && (
            <>
              {formData.splitTender.payments.map((payment: SplitTenderPayment, index: number) => (
                <View
                  key={index}
                  style={[styles.itemCard, { 
                    backgroundColor: theme.background.secondary,
                    borderColor: theme.border.secondary,
                  }]}
                >
                  <View style={styles.itemHeader}>
                    <Text style={[styles.itemTitle, { color: theme.text.primary }]}>
                      Payment {index + 1}
                    </Text>
                    {formData.splitTender.payments.length > 1 && (
                      <TouchableOpacity 
                        onPress={() => {
                          const newPayments = formData.splitTender.payments.filter((_, i) => i !== index);
                          setFormData(prev => ({
                            ...prev,
                            splitTender: { ...prev.splitTender, payments: newPayments }
                          }));
                        }}
                        style={[styles.removeButton, { backgroundColor: theme.status.error + '20' }]}
                      >
                        <Text style={[styles.removeButtonText, { color: theme.status.error }]}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View style={styles.itemField}>
                    <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Payment Method</Text>
                    <TouchableOpacity
                      style={[styles.inputContainer, { 
                        backgroundColor: theme.background.primary,
                        borderColor: theme.border.secondary,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }]}
                      onPress={() => {
                        setSelectedPaymentIndex(index);
                        setShowPaymentMethodDropdown(true);
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Text style={{ fontSize: 18, marginRight: 12 }}>
                          {getPaymentMethodInfo(payment.method).icon}
                        </Text>
                        <Text style={[styles.input, { color: theme.text.primary, flex: 1 }]}>
                          {getPaymentMethodInfo(payment.method).label}
                        </Text>
                      </View>
                      <Ionicons name="chevron-down" size={18} color={theme.text.secondary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.itemField}>
                    <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Amount</Text>
                    <View style={[styles.inputContainer, { 
                      backgroundColor: theme.background.primary,
                      borderColor: theme.border.secondary,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }]}>
                      <Text style={[{ color: theme.text.secondary, fontSize: 16, fontWeight: '500', marginRight: 8 }]}>$</Text>
                      <TextInput
                        style={[styles.input, { 
                          color: theme.text.primary,
                          flex: 1,
                        }]}
                        value={getPaymentAmountDisplayValue(index, payment.amount)}
                        onChangeText={(text) => {
                          // Store the raw input text for display
                          setPaymentAmountInputs(prev => ({
                            ...prev,
                            [index]: text
                          }));

                          // Allow empty string or valid decimal numbers
                          if (text === '' || /^\d*\.?\d*$/.test(text)) {
                            const amount = text === '' ? 0 : parseFloat(text) || 0;
                            const newPayments = [...formData.splitTender.payments];
                            newPayments[index] = { ...payment, amount };
                            
                            // Auto-adjust the last payment to match remaining amount if there are multiple payments
                            if (newPayments.length > 1) {
                              const receiptTotal = parseFloat(formData.amount) || 0;
                              const lastIndex = newPayments.length - 1;
                              
                              // If this isn't the last payment, calculate remainder for the last payment
                              if (index !== lastIndex) {
                                const totalExceptLast = newPayments.slice(0, -1).reduce((sum, p) => sum + p.amount, 0);
                                const remainder = Math.max(0, receiptTotal - totalExceptLast);
                                newPayments[lastIndex] = { ...newPayments[lastIndex], amount: remainder };
                              }
                            }
                            
                            setFormData(prev => ({
                              ...prev,
                              splitTender: { ...prev.splitTender, payments: newPayments }
                            }));
                          }
                        }}
                        onBlur={() => {
                          // Clear the input tracking when user finishes editing
                          setPaymentAmountInputs(prev => {
                            const newInputs = { ...prev };
                            delete newInputs[index];
                            return newInputs;
                          });
                        }}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={theme.text.secondary}
                      />
                    </View>
                  </View>

                  {(payment.method === 'credit' || payment.method === 'debit') && (
                    <View style={styles.itemField}>
                      <Text style={[styles.itemLabel, { color: theme.text.secondary }]}>Last 4 Digits</Text>
                      <View style={[styles.inputContainer, { 
                        backgroundColor: theme.background.primary,
                        borderColor: theme.border.secondary,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }]}>
                        <Text style={[{ color: theme.text.secondary, fontSize: 16, fontWeight: '500', marginRight: 8 }]}>****</Text>
                        <TextInput
                          style={[styles.input, { 
                            color: theme.text.primary,
                            flex: 1,
                            letterSpacing: 2,
                          }]}
                          value={payment.last4 || ''}
                          onChangeText={(text) => {
                            if (text.length <= 4 && /^\d*$/.test(text)) {
                              const newPayments = [...formData.splitTender.payments];
                              newPayments[index] = { ...payment, last4: text };
                              setFormData(prev => ({
                                ...prev,
                                splitTender: { ...prev.splitTender, payments: newPayments }
                              }));
                            }
                          }}
                          keyboardType="number-pad"
                          placeholder="1234"
                          placeholderTextColor={theme.text.secondary}
                          maxLength={4}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={[styles.addButton, { 
                  borderColor: theme.gold.primary,
                  backgroundColor: theme.gold.background,
                }]}
                onPress={() => {
                  const remainingAmount = getRemainingAmount();
                  setFormData(prev => ({
                    ...prev,
                    splitTender: {
                      ...prev.splitTender,
                      payments: [...prev.splitTender.payments, { method: 'cash', amount: remainingAmount }]
                    }
                  }));
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.gold.primary} style={{ marginRight: 8 }} />
                <Text style={[styles.addButtonText, { color: theme.gold.primary }]}>Add Payment Method</Text>
              </TouchableOpacity>

              {/* Payment Summary */}
              <View style={[styles.taxContainer, { backgroundColor: theme.background.secondary, marginTop: 16 }]}>
                <View style={styles.fieldGroup}>
                  <Text style={[styles.fieldLabel, { color: theme.text.primary }]}>Payment Summary</Text>
                  {formData.splitTender.payments.map((payment, index) => (
                    <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Text style={[{ color: theme.text.secondary }]}>
                        {payment.method.replace('_', ' ').toUpperCase()}{payment.last4 ? ` ****${payment.last4}` : ''}:
                      </Text>
                      <Text style={[{ color: theme.text.primary, fontWeight: '600' }]}>
                        {formatCurrency(payment.amount)}
                      </Text>
                    </View>
                  ))}
                  <View style={[styles.itemTotal, { borderTopColor: theme.border.secondary, marginTop: 8, paddingTop: 8 }]}>
                    <Text style={[styles.itemTotalLabel, { color: theme.text.secondary }]}>
                      Total Payments:
                    </Text>
                    <Text style={[styles.itemTotalValue, { color: theme.gold.primary }]}>
                      {formatCurrency(formData.splitTender.payments.reduce((sum, p) => sum + p.amount, 0))}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <Text style={[{ color: theme.text.secondary }]}>Receipt Total:</Text>
                    <Text style={[{ color: theme.text.primary, fontWeight: '600' }]}>
                      {formatCurrency(parseFloat(formData.amount) || 0)}
                    </Text>
                  </View>
                  {Math.abs(formData.splitTender.payments.reduce((sum, p) => sum + p.amount, 0) - parseFloat(formData.amount)) > 0.01 && (
                    <Text style={[{ color: theme.status.error, fontSize: 12, marginTop: 8, textAlign: 'center' }]}>
                      ⚠️ Payment amounts don't match receipt total
                    </Text>
                  )}
                </View>
              </View>
            </>
          )}
        </View>
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, { 
            backgroundColor: (!isSplitTenderValid || loading) ? theme.text.secondary : theme.gold.primary,
            opacity: (!isSplitTenderValid || loading) ? 0.5 : 1,
          }]}
          onPress={handleSave}
          disabled={loading || !isSplitTenderValid}
        >
          {loading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Ionicons 
                name={!isSplitTenderValid ? "alert-circle" : "checkmark-circle"} 
                size={18} 
                color="white" 
                style={{ marginRight: 6 }} 
              />
              <Text style={styles.saveButtonText}>
                {!isSplitTenderValid ? "Payment Amounts Don't Match" : "Save Changes"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Payment Method Dropdown Modal */}
      <Modal
        visible={showPaymentMethodDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowPaymentMethodDropdown(false);
          setSelectedPaymentIndex(null);
        }}
      >
        <TouchableOpacity 
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowPaymentMethodDropdown(false);
            setSelectedPaymentIndex(null);
          }}
        >
          <View style={[styles.dropdownContainer, { backgroundColor: theme.background.elevated }]}>
            <FlatList
              data={paymentMethodOptions}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = selectedPaymentIndex !== null && 
                  formData.splitTender.payments[selectedPaymentIndex]?.method === item.value;
                
                return (
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      { backgroundColor: theme.background.secondary },
                      isSelected && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      if (selectedPaymentIndex !== null) {
                        handlePaymentMethodSelect(selectedPaymentIndex, item.value);
                      }
                    }}
                  >
                    <Text style={{ fontSize: 20, marginRight: 16 }}>
                      {item.icon}
                    </Text>
                    <Text style={[styles.dropdownItemText, { color: theme.text.primary }]}>
                      {item.label}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={theme.gold.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};
