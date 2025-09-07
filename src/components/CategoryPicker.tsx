/**
 * CategoryPicker - Cross-platform category selection component
 * 
 * Features:
 * - Works on both Android and iOS
 * - Shows friendly category names
 * - Supports AI suggestions for optimal ordering
 * - Accessible and themeable
 * - Smooth animations and native feel
 */

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView,
  Platform,
  Dimensions,
  TextInput,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { ReceiptCategoryService, ReceiptCategory } from '../services/ReceiptCategoryService';
import { CustomCategoryService, CustomCategory } from '../services/CustomCategoryService';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';

interface CategoryPickerProps {
  selectedCategory: ReceiptCategory;
  onCategorySelect: (category: ReceiptCategory) => void;
  aiSuggestedCategory?: ReceiptCategory;
  aiConfidence?: number;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
  allowCustomCategories?: boolean;
}

const ALL_CATEGORIES: ReceiptCategory[] = [
  'groceries',
  'restaurant', 
  'entertainment',
  'shopping',
  'travel',
  'transportation',
  'utilities',
  'healthcare',
  'professional_services',
  'office_supplies',
  'equipment_software',
  'other'
];

export const CategoryPicker: React.FC<CategoryPickerProps> = ({
  selectedCategory,
  onCategorySelect,
  aiSuggestedCategory,
  aiConfidence,
  disabled = false,
  label = "Category",
  showLabel = true,
  allowCustomCategories = true,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { accountHolderId } = useTeam();
  const [modalVisible, setModalVisible] = useState(false);
  const [showNewCategoryModal, setShowNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('📁');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [allCategories, setAllCategories] = useState<ReceiptCategory[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load custom categories on mount
  useEffect(() => {
    loadCategories();
  }, [user, accountHolderId]);

  const loadCategories = async () => {
    if (!user || !accountHolderId) return;
    
    try {
      const [allAvailableCategories, accountCustomCategories] = await Promise.all([
        ReceiptCategoryService.getAvailableCategories(accountHolderId, user.uid),
        CustomCategoryService.getCustomCategories(accountHolderId, user.uid)
      ]);
      
      setCustomCategories(accountCustomCategories);
      setAllCategories(allAvailableCategories);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const getCategoryIcon = (category: ReceiptCategory): string => {
    return ReceiptCategoryService.getCategoryIcon(category, customCategories);
  };

  const getCategoryDisplayName = (category: ReceiptCategory): string => {
    return ReceiptCategoryService.getCategoryDisplayName(category, customCategories);
  };

  const handleCategorySelect = async (category: ReceiptCategory) => {
    // Update last used date for custom categories
    const customCategory = customCategories.find(cat => cat.name === category);
    if (customCategory) {
      await CustomCategoryService.updateLastUsed(customCategory.id);
    }
    
    onCategorySelect(category);
    setModalVisible(false);
  };

  const handleCreateCustomCategory = async () => {
    if (!user || !accountHolderId) return;

    const validation = CustomCategoryService.validateCategoryName(newCategoryName);
    if (!validation.isValid) {
      Alert.alert('Invalid Category Name', validation.error);
      return;
    }

    setIsLoading(true);
    try {
      const newCategory = await CustomCategoryService.createCustomCategory(
        accountHolderId,
        user.uid,
        newCategoryName,
        newCategoryIcon
      );

      if (newCategory) {
        await loadCategories(); // Refresh categories
        setNewCategoryName('');
        setNewCategoryIcon('📁');
        setShowNewCategoryModal(false);
        
        // Automatically select the new category
        onCategorySelect(newCategory.name as ReceiptCategory);
        setModalVisible(false);
        
        Alert.alert('Success', 'Custom category created successfully!');
      } else {
        Alert.alert('Error', 'Failed to create custom category. It may already exist.');
      }
    } catch (error) {
      console.error('Error creating custom category:', error);
      Alert.alert('Error', 'Failed to create custom category. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedCategories = React.useMemo(() => {
    // Put AI suggested category at the top if it exists and is different from selected
    const categories = [...allCategories];
    if (aiSuggestedCategory && aiSuggestedCategory !== selectedCategory) {
      const filtered = categories.filter(cat => cat !== aiSuggestedCategory);
      return [aiSuggestedCategory, ...filtered];
    }
    return categories;
  }, [allCategories, aiSuggestedCategory, selectedCategory]);

  const selectedDisplayName = getCategoryDisplayName(selectedCategory);

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={[styles.label, { color: theme.text.primary }]}>
          {label}
        </Text>
      )}
      
      <TouchableOpacity
        style={[
          styles.picker,
          {
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
          },
          disabled && styles.disabled
        ]}
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
      >
        <View style={styles.pickerContent}>
          <Text style={styles.categoryIcon}>
            {getCategoryIcon(selectedCategory)}
          </Text>
          <Text style={[
            styles.selectedText,
            { color: theme.text.primary },
            disabled && { color: theme.text.secondary }
          ]}>
            {selectedDisplayName}
          </Text>

        </View>
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={disabled ? theme.text.secondary : theme.text.primary} 
        />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View 
            style={[
              styles.modalContent,
              { backgroundColor: theme.background.primary }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border.primary }]}>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                Select Category
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.categoryList}>
              {sortedCategories.map((category) => {
                const isSelected = category === selectedCategory;
                const isAISuggested = category === aiSuggestedCategory;
                const displayName = getCategoryDisplayName(category);
                
                return (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryItem,
                      { borderBottomColor: theme.border.primary },
                      isSelected && { backgroundColor: theme.gold.primary + '20' }
                    ]}
                    onPress={() => handleCategorySelect(category)}
                  >
                    <View style={styles.categoryItemContent}>
                      <Text style={styles.categoryItemIcon}>
                        {getCategoryIcon(category)}
                      </Text>
                      <View style={styles.categoryItemText}>
                        <Text style={[
                          styles.categoryItemName,
                          { color: theme.text.primary },
                          isSelected && { fontWeight: '600' }
                        ]}>
                          {displayName}
                        </Text>
                      </View>
                    </View>
                    {isSelected && (
                      <Ionicons 
                        name="checkmark" 
                        size={20} 
                        color={theme.gold.primary} 
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
              
              {/* Add Custom Category Option */}
              {allowCustomCategories && user && accountHolderId && (
                <TouchableOpacity
                  style={[
                    styles.categoryItem,
                    styles.addCategoryItem,
                    { borderBottomColor: theme.border.primary, borderTopColor: theme.border.primary }
                  ]}
                  onPress={() => setShowNewCategoryModal(true)}
                >
                  <View style={styles.categoryItemContent}>
                    <Ionicons 
                      name="add-circle-outline" 
                      size={24} 
                      color={theme.gold.primary} 
                      style={styles.addCategoryIcon}
                    />
                    <View style={styles.categoryItemText}>
                      <Text style={[
                        styles.categoryItemName,
                        { color: theme.gold.primary, fontWeight: '500' }
                      ]}>
                        Add Custom Category
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* New Category Creation Modal */}
      <Modal
        visible={showNewCategoryModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowNewCategoryModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowNewCategoryModal(false)}
        >
          <View 
            style={[
              styles.newCategoryModal,
              { backgroundColor: theme.background.primary }
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.modalHeader, { borderBottomColor: theme.border.primary }]}>
              <Text style={[styles.modalTitle, { color: theme.text.primary }]}>
                Create Custom Category
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowNewCategoryModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.newCategoryContent}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
                  Category Name
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: theme.background.secondary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary
                    }
                  ]}
                  placeholder="Enter category name..."
                  placeholderTextColor={theme.text.tertiary}
                  value={newCategoryName}
                  onChangeText={setNewCategoryName}
                  maxLength={30}
                  autoCapitalize="words"
                />
                <Text style={[styles.characterCount, { color: theme.text.tertiary }]}>
                  {newCategoryName.length}/30
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
                  Icon
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconPicker}>
                  {CustomCategoryService.getDefaultIcons().map((icon, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.iconOption,
                        { borderColor: theme.border.primary },
                        newCategoryIcon === icon && { 
                          borderColor: theme.gold.primary, 
                          backgroundColor: theme.gold.primary + '20' 
                        }
                      ]}
                      onPress={() => setNewCategoryIcon(icon)}
                    >
                      <Text style={styles.iconText}>{icon}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.newCategoryButtons}>
                <TouchableOpacity
                  style={[
                    styles.newCategoryButton,
                    styles.cancelButton,
                    { borderColor: theme.border.primary }
                  ]}
                  onPress={() => {
                    setShowNewCategoryModal(false);
                    setNewCategoryName('');
                    setNewCategoryIcon('📁');
                  }}
                  disabled={isLoading}
                >
                  <Text style={[styles.buttonText, { color: theme.text.primary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.newCategoryButton,
                    styles.createButton,
                    { backgroundColor: theme.gold.primary }
                  ]}
                  onPress={handleCreateCustomCategory}
                  disabled={isLoading || !newCategoryName.trim()}
                >
                  <Text style={[styles.buttonText, { color: 'white' }]}>
                    {isLoading ? 'Creating...' : 'Create'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 48,
  },
  disabled: {
    opacity: 0.6,
  },
  pickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  selectedText: {
    fontSize: 16,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    ...Platform.select({
      ios: {
        justifyContent: 'center',
      },
      android: {
        justifyContent: 'flex-end',
      },
    }),
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
    ...Platform.select({
      ios: {
        borderRadius: 20,
        marginHorizontal: 20,
        marginVertical: 40,
      },
      android: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
      },
    }),
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
  categoryList: {
    maxHeight: screenHeight * 0.6,
  },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryItemIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  categoryItemText: {
    flex: 1,
  },
  categoryItemName: {
    fontSize: 16,
  },
  addCategoryItem: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 20,
  },
  addCategoryIcon: {
    marginRight: 16,
  },
  newCategoryModal: {
    borderRadius: 16,
    marginHorizontal: 20,
    marginVertical: 80,
    maxHeight: screenHeight * 0.7,
  },
  newCategoryContent: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 4,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  iconPicker: {
    paddingVertical: 8,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    fontSize: 20,
  },
  newCategoryButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  newCategoryButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
  },
  createButton: {
    // backgroundColor set dynamically
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
