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

import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Modal, 
  ScrollView,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { ReceiptCategoryService, ReceiptCategory } from '../services/ReceiptCategoryService';

interface CategoryPickerProps {
  selectedCategory: ReceiptCategory;
  onCategorySelect: (category: ReceiptCategory) => void;
  aiSuggestedCategory?: ReceiptCategory;
  aiConfidence?: number;
  disabled?: boolean;
  label?: string;
  showLabel?: boolean;
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
}) => {
  const { theme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const getCategoryIcon = (category: ReceiptCategory): string => {
    const icons: Record<ReceiptCategory, string> = {
      groceries: '🛒',
      restaurant: '🍽️',
      entertainment: '🎬',
      shopping: '🛍️',
      travel: '✈️',
      transportation: '🚗',
      utilities: '⚡',
      healthcare: '🏥',
      professional_services: '💼',
      office_supplies: '📎',
      equipment_software: '💻',
      other: '📄'
    };
    return icons[category];
  };

  const handleCategorySelect = (category: ReceiptCategory) => {
    onCategorySelect(category);
    setModalVisible(false);
  };

  const sortedCategories = React.useMemo(() => {
    // Put AI suggested category at the top if it exists and is different from selected
    const categories = [...ALL_CATEGORIES];
    if (aiSuggestedCategory && aiSuggestedCategory !== selectedCategory) {
      const filtered = categories.filter(cat => cat !== aiSuggestedCategory);
      return [aiSuggestedCategory, ...filtered];
    }
    return categories;
  }, [aiSuggestedCategory, selectedCategory]);

  const selectedDisplayName = ReceiptCategoryService.getCategoryDisplayName(selectedCategory);

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
                const displayName = ReceiptCategoryService.getCategoryDisplayName(category);
                
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
            </ScrollView>
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
});
