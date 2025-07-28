import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from '../components/Text';
import { receiptService } from '../services/firebaseService';
import { format } from 'date-fns';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  imageContainer: {
    aspectRatio: 3/4,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    width: 120,
    fontSize: 16,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  dateButton: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  itemContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemInput: {
    flex: 1,
    height: 36,
    borderRadius: 6,
    paddingHorizontal: 8,
    fontSize: 14,
  },
  addButton: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  saveButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  taxSection: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import { Receipt } from '../services/firebaseService';

interface FormItem {
  description: string;
  quantity: number;
  price: number;
  amount: number;
  tax: number;
}
import { NativeStackScreenProps } from '@react-navigation/native-stack';

type RootStackParamList = {
  EditReceipt: { receipt: Receipt };
};

type EditReceiptScreenProps = NativeStackScreenProps<RootStackParamList, 'EditReceipt'>;

export const EditReceiptScreen: React.FC<EditReceiptScreenProps> = ({ route, navigation }) => {
  const { receipt } = route.params;
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [formData, setFormData] = useState({
    vendor: receipt.vendor || '',
    amount: receipt.amount?.toString() || '0',
    date: new Date(receipt.date),
    description: receipt.description || '',
    category: receipt.category || 'business_expense',
    currency: receipt.currency || 'USD',
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

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Validate required fields
      if (!formData.vendor || !formData.amount) {
        Alert.alert('Error', 'Vendor and amount are required');
        return;
      }

      // Create updated receipt data
      const updatedReceipt: Partial<Receipt> = {
        vendor: formData.vendor,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description,
        category: formData.tax.category, // Use tax category as main category
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
          category: formData.tax.category,
        },
        updatedAt: new Date(),
      };

      // Update the receipt with only the changed fields
      await receiptService.updateReceipt(receipt.receiptId, updatedReceipt);
      
      Alert.alert(
        'Success',
        'Receipt updated successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error updating receipt:', error);
      Alert.alert('Error', 'Failed to update receipt. Please try again.');
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
      <ScrollView style={styles.content}>
        {/* Image Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Receipt Image</Text>
          <View style={[styles.imageContainer, { backgroundColor: theme.background.secondary }]}>
            <Image
              source={{ uri: receipt.images[0]?.url }}
              style={styles.image}
            />
          </View>
        </View>

        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Basic Information</Text>
          
          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text.primary }]}>Vendor</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.background.secondary,
                color: theme.text.primary,
                borderColor: theme.border.primary,
                borderWidth: 1,
              }]}
              value={formData.vendor}
              onChangeText={(text) => setFormData(prev => ({ ...prev, vendor: text }))}
              placeholder="Enter vendor name"
              placeholderTextColor={theme.text.secondary}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text.primary }]}>Amount</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.background.secondary,
                color: theme.text.primary,
                borderColor: theme.border.primary,
                borderWidth: 1,
              }]}
              value={formData.amount}
              onChangeText={(text) => setFormData(prev => ({ ...prev, amount: text }))}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={theme.text.secondary}
            />
          </View>

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text.primary }]}>Date</Text>
            <TouchableOpacity
              style={[styles.dateButton, { 
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.primary,
                borderWidth: 1,
              }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: theme.text.primary }}>
                {format(formData.date, 'MMM d, yyyy')}
              </Text>
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

          <View style={styles.row}>
            <Text style={[styles.label, { color: theme.text.primary }]}>Description</Text>
            <TextInput
              style={[styles.input, { 
                backgroundColor: theme.background.secondary,
                color: theme.text.primary,
                borderColor: theme.border.primary,
                borderWidth: 1,
              }]}
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              placeholder="Enter description"
              placeholderTextColor={theme.text.secondary}
            />
          </View>
        </View>

        {/* Tax Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Tax Information</Text>
          <View style={[styles.taxSection, { backgroundColor: theme.background.secondary }]}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => setFormData(prev => ({
                ...prev,
                tax: { ...prev.tax, deductible: !prev.tax.deductible }
              }))}
            >
              <View style={[styles.checkbox, {
                backgroundColor: formData.tax.deductible ? theme.gold.primary : theme.background.primary,
                borderColor: theme.border.primary,
                borderWidth: 1,
              }]}>
                {formData.tax.deductible && (
                  <Text style={{ color: 'white' }}>✓</Text>
                )}
              </View>
              <Text style={[styles.label, { color: theme.text.primary }]}>Tax Deductible</Text>
            </TouchableOpacity>

            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.text.primary }]}>Category</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.background.primary,
                  color: theme.text.primary,
                  borderColor: theme.border.primary,
                  borderWidth: 1,
                }]}
                value={formData.tax.category}
                onChangeText={(text) => setFormData(prev => ({
                  ...prev,
                  tax: { ...prev.tax, category: text }
                }))}
                placeholder="Enter tax category"
                placeholderTextColor={theme.text.secondary}
              />
            </View>

            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.text.primary }]}>Deduction %</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.background.primary,
                  color: theme.text.primary,
                  borderColor: theme.border.primary,
                  borderWidth: 1,
                }]}
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

            <View style={styles.row}>
              <Text style={[styles.label, { color: theme.text.primary }]}>Tax Year</Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: theme.background.primary,
                  color: theme.text.primary,
                  borderColor: theme.border.primary,
                  borderWidth: 1,
                }]}
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

        {/* Items Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Items</Text>
          {formData.items.map((item: FormItem, index: number) => (
            <View
              key={index}
              style={[styles.itemContainer, { backgroundColor: theme.background.secondary }]}
            >
              <View style={styles.itemHeader}>
                <Text style={[{ color: theme.text.primary, fontWeight: '500' }]}>
                  Item {index + 1}
                </Text>
                <TouchableOpacity onPress={() => handleRemoveItem(index)}>
                  <Text style={{ color: theme.status.error }}>Remove</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.itemRow}>
                <Text style={[{ width: 80, color: theme.text.primary }]}>Description</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.primary,
                    borderWidth: 1,
                  }]}
                  value={item.description}
                  onChangeText={(text) => handleUpdateItem(index, 'description', text)}
                  placeholder="Item description"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemRow}>
                <Text style={[{ width: 80, color: theme.text.primary }]}>Quantity</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.primary,
                    borderWidth: 1,
                  }]}
                  value={item.quantity?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'quantity', text)}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemRow}>
                <Text style={[{ width: 80, color: theme.text.primary }]}>Price</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.primary,
                    borderWidth: 1,
                  }]}
                  value={item.price?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'price', text)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={styles.itemRow}>
                <Text style={[{ width: 80, color: theme.text.primary }]}>Tax</Text>
                <TextInput
                  style={[styles.itemInput, { 
                    backgroundColor: theme.background.primary,
                    color: theme.text.primary,
                    borderColor: theme.border.primary,
                    borderWidth: 1,
                  }]}
                  value={item.tax?.toString()}
                  onChangeText={(text) => handleUpdateItem(index, 'tax', text)}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={theme.text.secondary}
                />
              </View>

              <View style={[styles.itemRow, { justifyContent: 'flex-end' }]}>
                <Text style={{ color: theme.text.primary }}>
                  Total: ${(item.quantity * item.price).toFixed(2)}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.addButton, { 
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.primary,
              borderWidth: 1,
            }]}
            onPress={handleAddItem}
          >
            <Text style={{ color: theme.text.primary }}>+ Add Item</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.saveButton, { 
          backgroundColor: theme.gold.primary,
          opacity: loading ? 0.7 : 1,
        }]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};
