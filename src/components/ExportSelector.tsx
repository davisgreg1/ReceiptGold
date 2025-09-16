import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useBusiness } from '../context/BusinessContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, subDays, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ReceiptCategoryService } from '../services/ReceiptCategoryService';
import { CustomCategory } from '../services/CustomCategoryService';


export interface ExportOptions {
  includePersonal: boolean;
  selectedBusinesses: string[];
  dateRange: {
    start: Date;
    end: Date;
  };
  categories: string[];
  format: 'csv' | 'pdf' | 'excel';
  groupBy: 'none' | 'business' | 'category' | 'date';
  includeImages: boolean;
  taxDeductibleOnly: boolean;
}

interface ExportSelectorProps {
  visible: boolean;
  onClose: () => void;
  onExport: (options: ExportOptions) => void;
  availableCategories: string[];
  customCategories: CustomCategory[];
}

type DateRangePresetType = {
  label: string;
  days?: number;
  months?: number;
  year?: boolean;
  lastYear?: boolean;
  allTime?: boolean;
  custom?: boolean;
};

const DateRangePreset: Record<string, DateRangePresetType> = {
  LAST_7_DAYS: { label: 'Last 7 days', days: 7 },
  LAST_30_DAYS: { label: 'Last 30 days', days: 30 },
  LAST_3_MONTHS: { label: 'Last 3 months', months: 3 },
  LAST_6_MONTHS: { label: 'Last 6 months', months: 6 },
  THIS_YEAR: { label: 'This year', year: true },
  LAST_YEAR: { label: 'Last year', lastYear: true },
  ALL_TIME: { label: 'All time', allTime: true },
  CUSTOM: { label: 'Custom range', custom: true },
};

export const ExportSelector: React.FC<ExportSelectorProps> = ({
  visible,
  onClose,
  onExport,
  availableCategories,
  customCategories,
}) => {
  const { theme } = useTheme();
  const { businesses } = useBusiness();

  // State
  const [includePersonal, setIncludePersonal] = useState(false);
  const [selectedBusinesses, setSelectedBusinesses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDatePreset, setSelectedDatePreset] = useState('LAST_30_DAYS');
  const [customStartDate, setCustomStartDate] = useState(subMonths(new Date(), 1));
  const [customEndDate, setCustomEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf' | 'excel'>('csv');
  const [groupBy, setGroupBy] = useState<'none' | 'business' | 'category' | 'date'>('none');
  const [includeImages, setIncludeImages] = useState(false);
  const [taxDeductibleOnly, setTaxDeductibleOnly] = useState(false);

  // Initialize with all businesses selected
  useEffect(() => {
    if (businesses.length > 0) {
      setSelectedBusinesses(businesses.map(b => b.id).filter(id => id !== undefined) as string[]);
    }
  }, [businesses]);

  // Initialize with all categories selected
  useEffect(() => {
    if (availableCategories.length > 0) {
      setSelectedCategories(availableCategories);
    }
  }, [availableCategories]);

  const getDateRange = () => {
    const preset = DateRangePreset[selectedDatePreset];
    const now = new Date();

    if (preset?.custom) {
      return { start: startOfDay(customStartDate), end: endOfDay(customEndDate) };
    }
    if (preset?.days) {
      return { start: startOfDay(subDays(now, preset.days)), end: endOfDay(now) };
    }
    if (preset?.months) {
      return { start: startOfDay(subMonths(now, preset.months)), end: endOfDay(now) };
    }
    if (preset?.year) {
      return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
    }
    if (preset?.lastYear) {
      return {
        start: new Date(now.getFullYear() - 1, 0, 1),
        end: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
      };
    }
    if (preset?.allTime) {
      return { start: new Date(2000, 0, 1), end: endOfDay(now) };
    }

    return { start: startOfDay(subMonths(now, 1)), end: endOfDay(now) };
  };

  const toggleBusiness = (businessId: string) => {
    setSelectedBusinesses(prev =>
      prev.includes(businessId)
        ? prev.filter(id => id !== businessId)
        : [...prev, businessId]
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories(prev =>
      prev.includes(category)
        ? prev.filter(cat => cat !== category)
        : [...prev, category]
    );
  };

  const selectAllBusinesses = () => {
    setSelectedBusinesses(businesses.map(b => b.id).filter(id => id !== undefined) as string[]);
  };

  const deselectAllBusinesses = () => {
    setSelectedBusinesses([]);
  };

  const selectAllCategories = () => {
    setSelectedCategories(availableCategories);
  };

  const deselectAllCategories = () => {
    setSelectedCategories([]);
  };

  const handleExport = () => {
    const options: ExportOptions = {
      includePersonal,
      selectedBusinesses,
      dateRange: getDateRange(),
      categories: selectedCategories,
      format: exportFormat,
      groupBy,
      includeImages,
      taxDeductibleOnly,
    };
    onExport(options);
    onClose();
  };

  const getSelectionSummary = () => {
    const dateRange = getDateRange();
    const businessCount = selectedBusinesses.length;
    const categoryCount = selectedCategories.length;

    return {
      dateText: `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`,
      sourceText: [
        includePersonal ? 'Personal' : null,
        businessCount > 0 ? `${businessCount} business${businessCount === 1 ? '' : 'es'}` : null
      ].filter(Boolean).join(' + '),
      categoryText: categoryCount === availableCategories.length ? 'All categories' : `${categoryCount} categories`
    };
  };

  const summary = getSelectionSummary();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.border.primary }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.text.primary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
            Export Reports
          </Text>
          <TouchableOpacity
            onPress={handleExport}
            style={[styles.exportButton, { backgroundColor: theme.gold.primary }]}
          >
            <Text style={styles.exportButtonText}>Export</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Summary Card */}
          <View style={[styles.summaryCard, {
            backgroundColor: theme.gold.background,
            borderColor: theme.gold.primary
          }]}>
            <View style={styles.summaryHeader}>
              <Ionicons name="document-text-outline" size={24} color={theme.gold.primary} />
              <Text style={[styles.summaryTitle, { color: theme.text.primary }]}>
                Export Summary
              </Text>
            </View>
            <View style={styles.summaryDetails}>
              <View style={styles.summaryRow}>
                <Ionicons name="calendar-outline" size={16} color={theme.text.secondary} />
                <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
                  {summary.dateText}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="business-outline" size={16} color={theme.text.secondary} />
                <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
                  {summary.sourceText}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Ionicons name="pricetag-outline" size={16} color={theme.text.secondary} />
                <Text style={[styles.summaryText, { color: theme.text.secondary }]}>
                  {summary.categoryText}
                </Text>
              </View>
            </View>
          </View>

          {/* Date Range Section */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              📅 Date Range
            </Text>

            <View style={styles.presetGrid}>
              {Object.entries(DateRangePreset).map(([key, preset]) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.presetChip,
                    {
                      backgroundColor: selectedDatePreset === key
                        ? theme.gold.primary
                        : theme.background.tertiary,
                      borderColor: selectedDatePreset === key
                        ? theme.gold.primary
                        : theme.border.primary,
                    }
                  ]}
                  onPress={() => setSelectedDatePreset(key)}
                >
                  <Text style={[
                    styles.presetText,
                    { color: selectedDatePreset === key ? 'white' : theme.text.secondary }
                  ]}>
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedDatePreset === 'CUSTOM' && (
              <View style={styles.customDateContainer}>
                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, { color: theme.text.primary }]}>Start Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, {
                      backgroundColor: theme.background.tertiary,
                      borderColor: theme.border.primary
                    }]}
                    onPress={() => setShowStartPicker(true)}
                  >
                    <Text style={[styles.dateButtonText, { color: theme.text.primary }]}>
                      {format(customStartDate, 'MMM d, yyyy')}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color={theme.text.secondary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.dateRow}>
                  <Text style={[styles.dateLabel, { color: theme.text.primary }]}>End Date</Text>
                  <TouchableOpacity
                    style={[styles.dateButton, {
                      backgroundColor: theme.background.tertiary,
                      borderColor: theme.border.primary
                    }]}
                    onPress={() => setShowEndPicker(true)}
                  >
                    <Text style={[styles.dateButtonText, { color: theme.text.primary }]}>
                      {format(customEndDate, 'MMM d, yyyy')}
                    </Text>
                    <Ionicons name="calendar-outline" size={16} color={theme.text.secondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Data Sources Section */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              🏢 Data Sources
            </Text>

            {/* Personal Expenses Toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: theme.border.primary }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: theme.text.primary }]}>
                  Personal Expenses
                </Text>
                <Text style={[styles.toggleSubtitle, { color: theme.text.secondary }]}>
                  Include receipts not assigned to any business
                </Text>
              </View>
              <Switch
                value={includePersonal}
                onValueChange={setIncludePersonal}
                trackColor={{ false: theme.border.primary, true: theme.gold.background }}
                thumbColor={includePersonal ? theme.gold.primary : theme.text.tertiary}
              />
            </View>

            {/* Businesses */}
            {businesses.length > 0 && (
              <View style={styles.businessSection}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.subsectionTitle, { color: theme.text.primary }]}>
                    Businesses ({selectedBusinesses.length}/{businesses.length})
                  </Text>
                  <View style={styles.selectAllRow}>
                    <TouchableOpacity
                      onPress={selectAllBusinesses}
                      style={[styles.selectButton, { borderColor: theme.gold.primary }]}
                    >
                      <Text style={[styles.selectButtonText, { color: theme.gold.primary }]}>
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={deselectAllBusinesses}
                      style={[styles.selectButton, { borderColor: theme.text.tertiary }]}
                    >
                      <Text style={[styles.selectButtonText, { color: theme.text.tertiary }]}>
                        None
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.businessGrid}>
                  {businesses.map((business) => (
                    <TouchableOpacity
                      key={business.id}
                      style={[
                        styles.businessChip,
                        {
                          backgroundColor: business.id && selectedBusinesses.includes(business.id)
                            ? theme.gold.primary
                            : theme.background.tertiary,
                          borderColor: business.id && selectedBusinesses.includes(business.id)
                            ? theme.gold.primary
                            : theme.border.primary,
                        }
                      ]}
                      onPress={() => business.id && toggleBusiness(business.id)}
                    >
                      <Text style={[
                        styles.businessChipText,
                        {
                          color: business.id && selectedBusinesses.includes(business.id)
                            ? 'white'
                            : theme.text.primary
                        }
                      ]}>
                        {business.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Categories Section */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
                🏷️ Categories ({selectedCategories.length}/{availableCategories.length})
              </Text>
              <View style={styles.selectAllRow}>
                <TouchableOpacity
                  onPress={selectAllCategories}
                  style={[styles.selectButton, { borderColor: theme.gold.primary }]}
                >
                  <Text style={[styles.selectButtonText, { color: theme.gold.primary }]}>
                    All
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={deselectAllCategories}
                  style={[styles.selectButton, { borderColor: theme.text.tertiary }]}
                >
                  <Text style={[styles.selectButtonText, { color: theme.text.tertiary }]}>
                    None
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.categoryGrid}>
              {availableCategories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selectedCategories.includes(category)
                        ? theme.gold.primary
                        : theme.background.tertiary,
                      borderColor: selectedCategories.includes(category)
                        ? theme.gold.primary
                        : theme.border.primary,
                    }
                  ]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text style={[
                    styles.categoryChipText,
                    {
                      color: selectedCategories.includes(category)
                        ? 'white'
                        : theme.text.primary
                    }
                  ]}>
                    {ReceiptCategoryService.getCategoryDisplayName(category as any, customCategories)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Export Format Section */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              📄 Export Format
            </Text>

            <View style={styles.formatRow}>
              {[
                { key: 'csv', label: 'CSV', icon: 'document-text-outline', description: 'Excel compatible' },
                { key: 'pdf', label: 'PDF', icon: 'document-outline', description: 'Formatted report' },
                { key: 'excel', label: 'Excel', icon: 'grid-outline', description: 'Native .xlsx' },
              ].map((format) => (
                <TouchableOpacity
                  key={format.key}
                  style={[
                    styles.formatCard,
                    {
                      backgroundColor: exportFormat === format.key
                        ? theme.gold.background
                        : theme.background.tertiary,
                      borderColor: exportFormat === format.key
                        ? theme.gold.primary
                        : theme.border.primary,
                    }
                  ]}
                  onPress={() => setExportFormat(format.key as any)}
                >
                  <Ionicons
                    name={format.icon as any}
                    size={24}
                    color={exportFormat === format.key ? theme.gold.primary : theme.text.secondary}
                  />
                  <Text style={[
                    styles.formatTitle,
                    { color: exportFormat === format.key ? theme.text.primary : theme.text.secondary }
                  ]}>
                    {format.label}
                  </Text>
                  <Text style={[
                    styles.formatDescription,
                    { color: theme.text.tertiary }
                  ]}>
                    {format.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Advanced Options Section */}
          <View style={[styles.section, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              ⚙️ Advanced Options
            </Text>

            {/* Group By */}
            <View style={styles.advancedOption}>
              <Text style={[styles.optionLabel, { color: theme.text.primary }]}>Group By</Text>
              <View style={styles.groupByRow}>
                {[
                  { key: 'none', label: 'None' },
                  { key: 'business', label: 'Business' },
                  { key: 'category', label: 'Category' },
                  { key: 'date', label: 'Date' },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.groupByChip,
                      {
                        backgroundColor: groupBy === option.key
                          ? theme.gold.primary
                          : theme.background.tertiary,
                        borderColor: groupBy === option.key
                          ? theme.gold.primary
                          : theme.border.primary,
                      }
                    ]}
                    onPress={() => setGroupBy(option.key as any)}
                  >
                    <Text style={[
                      styles.groupByText,
                      { color: groupBy === option.key ? 'white' : theme.text.secondary }
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Include Images Toggle */}
            <View style={[styles.toggleRow, { borderBottomColor: theme.border.primary }]}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: theme.text.primary }]}>
                  Include Receipt Images
                </Text>
                <Text style={[styles.toggleSubtitle, { color: theme.text.secondary }]}>
                  Attach original receipt images (PDF only)
                </Text>
              </View>
              <Switch
                value={includeImages}
                onValueChange={setIncludeImages}
                trackColor={{ false: theme.border.primary, true: theme.gold.background }}
                thumbColor={includeImages ? theme.gold.primary : theme.text.tertiary}
                disabled={exportFormat !== 'pdf'}
              />
            </View>

            {/* Tax Deductible Only Toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: theme.text.primary }]}>
                  Tax Deductible Only
                </Text>
                <Text style={[styles.toggleSubtitle, { color: theme.text.secondary }]}>
                  Export only business expenses marked as tax deductible
                </Text>
              </View>
              <Switch
                value={taxDeductibleOnly}
                onValueChange={setTaxDeductibleOnly}
                trackColor={{ false: theme.border.primary, true: theme.gold.background }}
                thumbColor={taxDeductibleOnly ? theme.gold.primary : theme.text.tertiary}
              />
            </View>
          </View>

          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Date Pickers */}
        {showStartPicker && (
          <DateTimePicker
            value={customStartDate}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowStartPicker(false);
              if (selectedDate) {
                setCustomStartDate(selectedDate);
              }
            }}
          />
        )}

        {showEndPicker && (
          <DateTimePicker
            value={customEndDate}
            mode="date"
            display="default"
            onChange={(_, selectedDate) => {
              setShowEndPicker(false);
              if (selectedDate) {
                setCustomEndDate(selectedDate);
              }
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  exportButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exportButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  summaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginVertical: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  summaryDetails: {
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryText: {
    fontSize: 14,
    flex: 1,
  },
  section: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  selectAllRow: {
    flexDirection: 'row',
    gap: 8,
  },
  selectButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  selectButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '500',
  },
  customDateContainer: {
    marginTop: 16,
    gap: 12,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  dateButtonText: {
    fontSize: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  toggleSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  businessSection: {
    marginTop: 16,
  },
  businessGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  businessChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  businessChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  formatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  formatTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  formatDescription: {
    fontSize: 12,
    textAlign: 'center',
  },
  advancedOption: {
    marginBottom: 16,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  groupByRow: {
    flexDirection: 'row',
    gap: 8,
  },
  groupByChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  groupByText: {
    fontSize: 14,
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 40,
  },
});