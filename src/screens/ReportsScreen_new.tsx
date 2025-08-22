/**
 * ReportsScreen - Enhanced with accurate data handling and real-time updates
 * 
 * Key improvements:
 * - Uses createdAt field (primary) with date fallback for backward compatibility
 * - Properly filters out deleted receipts using status field
 * - Handles Firestore index issues with fallback queries
 * - Real-time updates when receipts are deleted/modified
 * - Better loading states and error handling
 * - Manual refresh capability
 * - Enhanced empty states with contextual messaging
 * - Beautiful modern design with proper dark/light mode support
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView, Dimensions, RefreshControl } from "react-native";
import {
  Text,
  Button,
  SegmentedButtons,
  ActivityIndicator,
} from "react-native-paper";
import { useSubscription } from "../context/SubscriptionContext";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { PremiumGate } from "../components/PremiumGate";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { format } from "date-fns";
import type { StackNavigationProp } from "@react-navigation/stack";
import { ReceiptCategoryService } from '../services/ReceiptCategoryService';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from "../theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";

interface Receipt {
  amount: number;
  category: string;
  date?: Timestamp; // Optional for backward compatibility
  createdAt: Timestamp; // Primary date field
  businessId?: string;
  description?: string;
  id?: string;
  status?: string;
  tax?: {
    deductible: boolean;
  };
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const navigation = useNavigation<StackNavigationProp<any>>();
  const { theme } = useTheme();
  
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<
    "week" | "month" | "year"
  >("month");

  // Generate basic report
  const generateBasicReport = () => {
    const totalAmount = receipts.reduce(
      (sum, receipt) => sum + receipt.amount,
      0
    );
    const categoryTotals = receipts.reduce((acc, receipt) => {
      acc[receipt.category] = (acc[receipt.category] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalAmount,
      categoryTotals,
      receiptCount: receipts.length,
    };
  };

  const generateAdvancedReport = () => {
    // Only available for Growth and Professional tiers
    if (!subscription.features.advancedReporting) return null;

    const byBusiness = receipts.reduce((acc, receipt) => {
      const businessId = receipt.businessId || "default";
      if (!acc[businessId]) {
        acc[businessId] = {
          totalAmount: 0,
          receipts: [],
        };
      }
      acc[businessId].totalAmount += receipt.amount;
      acc[businessId].receipts.push(receipt);
      return acc;
    }, {} as Record<string, { totalAmount: number; receipts: Receipt[] }>);

    // Generate monthly trends
    const trends = receipts.reduce((acc, receipt) => {
      // Use createdAt first, fall back to date for backward compatibility
      const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
      if (!receiptDate) return acc;

      const monthKey = format(receiptDate, 'yyyy-MM');
      if (!acc[monthKey]) {
        acc[monthKey] = { date: receiptDate, amount: 0 };
      }
      acc[monthKey].amount += receipt.amount;
      return acc;
    }, {} as Record<string, { date: Date; amount: number }>);

    return {
      byBusiness,
      trends: Object.values(trends).sort(
        (a, b) => a.date.getTime() - b.date.getTime()
      ),
    };
  };

  // Calculate business percentage
  const businessPercentage = useMemo(() => {
    const businessAmount = receipts
      .filter((receipt) => receipt.tax?.deductible === true)
      .reduce((sum, receipt) => sum + receipt.amount, 0);
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    
    if (totalAmount === 0) return 0;
    
    return Math.round((businessAmount / totalAmount) * 100);
  }, [receipts]);

  // Calculate tax categories
  const taxCategories = useMemo(() => {
    return receipts
      .filter((receipt) => receipt.tax?.deductible === true)
      .reduce((acc, receipt) => {
        const category = receipt.category;
        if (!acc[category]) acc[category] = 0;
        acc[category] += receipt.amount;
        return acc;
      }, {} as Record<string, number>);
  }, [receipts]);

  // Screen dimensions for the chart
  const screenWidth = Dimensions.get("window").width;

  // Date range filters
  const dateRangeFilter = useMemo(() => {
    const now = new Date();
    const startDate = new Date();

    switch (selectedDateRange) {
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setMonth(now.getMonth() - 1);
        break;
      case "year":
        startDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return {
      startDate: Timestamp.fromDate(startDate),
      endDate: Timestamp.fromDate(now),
    };
  }, [selectedDateRange]);

  useEffect(() => {
    const fetchReceipts = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);

      try {
        const receiptsRef = collection(db, "receipts");
        let querySnapshot;

        try {
          // Try optimized query first
          const optimizedQuery = query(
            receiptsRef,
            where("userId", "==", user.uid),
            where("status", "!=", "deleted"),
            where("createdAt", ">=", dateRangeFilter.startDate),
            where("createdAt", "<=", dateRangeFilter.endDate)
          );
          querySnapshot = await getDocs(optimizedQuery);
        } catch (error: any) {
          if (error.code === 'failed-precondition' || error.message.includes('index')) {
            // Fall back to basic query and filter in memory
            const basicQuery = query(
              receiptsRef,
              where("userId", "==", user.uid)
            );
            const basicSnapshot = await getDocs(basicQuery);
            
            const docs = basicSnapshot.docs.filter(doc => {
              const data = doc.data();
              if (data.status === 'deleted') return false;
              
              const createdAt = data.createdAt;
              if (!createdAt) return false;
              
              return createdAt >= dateRangeFilter.startDate && 
                     createdAt <= dateRangeFilter.endDate;
            });
            
            querySnapshot = { docs };
          } else {
            throw error;
          }
        }

        const fetchedReceipts: Receipt[] = [];

        querySnapshot.docs.forEach((doc) => {
          const data = doc.data();
          fetchedReceipts.push({
            id: doc.id,
            amount: data.amount || 0,
            category: data.category || 'Uncategorized',
            date: data.date,
            createdAt: data.createdAt,
            businessId: data.businessId,
            description: data.description,
            status: data.status || 'active',
            tax: data.tax || undefined,
          });
        });

        setReceipts(fetchedReceipts);
      } catch (error) {
        console.error("Error fetching receipts:", error);
        setError("Failed to load receipts. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [user, dateRangeFilter]);

  const refreshData = useCallback(async () => {
    if (!user) return;
    
    setRefreshing(true);
    try {
      const receiptsRef = collection(db, "receipts");
      let querySnapshot;

      try {
        const optimizedQuery = query(
          receiptsRef,
          where("userId", "==", user.uid),
          where("status", "!=", "deleted"),
          where("createdAt", ">=", dateRangeFilter.startDate),
          where("createdAt", "<=", dateRangeFilter.endDate)
        );
        querySnapshot = await getDocs(optimizedQuery);
      } catch (error: any) {
        if (error.code === 'failed-precondition' || error.message.includes('index')) {
          const basicQuery = query(
            receiptsRef,
            where("userId", "==", user.uid)
          );
          const basicSnapshot = await getDocs(basicQuery);
          
          const docs = basicSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (data.status === 'deleted') return false;
            
            const createdAt = data.createdAt;
            if (!createdAt) return false;
            
            return createdAt >= dateRangeFilter.startDate && 
                   createdAt <= dateRangeFilter.endDate;
          });
          
          querySnapshot = { docs };
        } else {
          throw error;
        }
      }

      const fetchedReceipts: Receipt[] = [];

      querySnapshot.docs.forEach((doc) => {
        const data = doc.data();
        fetchedReceipts.push({
          id: doc.id,
          amount: data.amount || 0,
          category: data.category || 'Uncategorized',
          date: data.date,
          createdAt: data.createdAt,
          businessId: data.businessId,
          description: data.description,
          status: data.status || 'active',
          tax: data.tax || undefined,
        });
      });

      setReceipts(fetchedReceipts);
    } catch (error) {
      console.error("Error refreshing receipts:", error);
    } finally {
      setRefreshing(false);
    }
  }, [user, dateRangeFilter]);

  useFocusEffect(
    useCallback(() => {
      console.log('Reports screen focused, refreshing data...');
      refreshData();
    }, [refreshData])
  );

  const exportToCSV = async () => {
    try {
      const csvContent = [
        "Date,Amount,Category,Business,Description",
        ...receipts.map((receipt) => {
          const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
          return [
            receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
            receipt.amount.toString(),
            receipt.category,
            receipt.businessId || "Personal",
            (receipt.description || "").replace(/,/g, ";"),
          ].join(",");
        }),
      ]
        .join("\n");
      const fileName = `receipts_${new Date().toISOString().split("T")[0]}.csv`;
      const filePath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(filePath, csvContent);
      await Sharing.shareAsync(filePath);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[
          styles.loadingContainer,
          { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
        ]}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.loadingText, { color: theme.text.primary }]}>
            Loading your financial reports...
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[
          styles.errorContainer,
          { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
        ]}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.status.error} />
          <Text style={[styles.errorTitle, { color: theme.text.primary }]}>
            Something went wrong
          </Text>
          <Text style={[styles.errorText, { color: theme.text.secondary }]}>
            {error}
          </Text>
          <Button
            mode="contained"
            onPress={() => {
              setLoading(true);
              setError(null);
              setSelectedDateRange(selectedDateRange);
            }}
            style={[styles.retryButton, { backgroundColor: theme.gold.primary }]}
            labelStyle={{ color: theme.background.primary }}
          >
            Try Again
          </Button>
        </View>
      </View>
    );
  }

  if (receipts.length === 0) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.background.primary }]}>
        <View style={[
          styles.emptyContent,
          { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
        ]}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No Receipts for {selectedDateRange === 'week' ? 'This Week' : 
                           selectedDateRange === 'month' ? 'This Month' : 
                           'This Year'}
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.text.secondary }]}>
            {receipts.length === 0 && selectedDateRange === 'month' 
              ? "Add receipts to start tracking expenses and generate reports."
              : `Try selecting a different time range or add more receipts for the selected ${selectedDateRange}.`
            }
          </Text>
          
          {/* Date Range Selector */}
          <View style={[
            styles.emptyDateRangeCard,
            { backgroundColor: theme.background.primary, borderColor: theme.border.primary }
          ]}>
            <Text style={[styles.emptyDateRangeTitle, { color: theme.text.primary }]}>
              Select Time Range
            </Text>
            <SegmentedButtons
              value={selectedDateRange}
              onValueChange={(value) =>
                setSelectedDateRange(value as typeof selectedDateRange)
              }
              buttons={[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "year", label: "Year" },
              ]}
              style={{ backgroundColor: theme.background.secondary }}
            />
          </View>

          <Button
            mode="contained"
            onPress={() => {
              // Navigate to add receipt screen
              // @ts-ignore - we know this exists in the navigation
              navigation.navigate("ReceiptsTab", { screen: "ScanReceipt" });
            }}
            style={[styles.emptyActionButton, { backgroundColor: theme.gold.primary }]}
            labelStyle={{ color: theme.background.primary }}
            icon="plus"
          >
            Add Your First Receipt
          </Button>
        </View>
      </View>
    );
  }

  const basicReport = generateBasicReport();
  const advancedReport = generateAdvancedReport();
  const trends = advancedReport?.trends || [];

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: theme.background.primary }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refreshData}
          colors={[theme.gold.primary]}
          tintColor={theme.gold.primary}
        />
      }
    >
      {/* Header Card with Date Range */}
      <View style={[
        styles.headerCard,
        { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
      ]}>
        <View style={styles.headerContent}>
          <View style={styles.headerTitleSection}>
            <Ionicons name="analytics-outline" size={24} color={theme.gold.primary} />
            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              Financial Reports
            </Text>
          </View>
          <Text style={[styles.headerSubtitle, { color: theme.text.secondary }]}>
            {selectedDateRange === 'week' ? 'Past 7 days' : 
             selectedDateRange === 'month' ? 'Past 30 days' : 'Past 12 months'}
          </Text>
        </View>
        
        <SegmentedButtons
          value={selectedDateRange}
          onValueChange={(value) =>
            setSelectedDateRange(value as typeof selectedDateRange)
          }
          buttons={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
          style={[styles.segmentedButtons, { backgroundColor: theme.background.primary }]}
        />
      </View>

      {/* Summary Stats */}
      <View style={[
        styles.summaryCard,
        { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
      ]}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
          Summary
        </Text>
        
        <View style={styles.summaryStats}>
          <View style={[styles.statItem, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
              <Ionicons name="receipt-outline" size={20} color={theme.gold.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {basicReport.receiptCount}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Receipts
            </Text>
          </View>
          
          <View style={[styles.statItem, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
              <Ionicons name="cash-outline" size={20} color={theme.gold.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {formatCurrency(basicReport.totalAmount)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Total Spent
            </Text>
          </View>
          
          <View style={[styles.statItem, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
            <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
              <Ionicons name="trending-up-outline" size={20} color={theme.gold.primary} />
            </View>
            <Text style={[styles.statValue, { color: theme.text.primary }]}>
              {formatCurrency(basicReport.totalAmount / Math.max(basicReport.receiptCount, 1))}
            </Text>
            <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
              Average
            </Text>
          </View>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={[
        styles.categoryCard,
        { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
      ]}>
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
          Category Breakdown
        </Text>
        
        <View style={styles.categoryList}>
          {Object.entries(basicReport.categoryTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([category, amount]) => {
              const percentage = ((amount / basicReport.totalAmount) * 100).toFixed(1);
              return (
                <View key={category} style={[
                  styles.categoryItem,
                  { backgroundColor: theme.background.primary, borderColor: theme.border.primary }
                ]}>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryName, { color: theme.text.primary }]}>
                      {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                    </Text>
                    <Text style={[styles.categoryAmount, { color: theme.gold.primary }]}>
                      {formatCurrency(amount)}
                    </Text>
                  </View>
                  <View style={styles.categoryProgress}>
                    <View 
                      style={[styles.categoryProgressBar, { backgroundColor: theme.border.primary }]}
                    >
                      <View 
                        style={[
                          styles.categoryProgressFill,
                          { 
                            backgroundColor: theme.gold.primary,
                            width: `${Math.min(100, Math.max(0, parseFloat(percentage)))}%` as any
                          }
                        ]}
                      />
                    </View>
                    <Text style={[styles.categoryPercentage, { color: theme.text.secondary }]}>
                      {percentage}%
                    </Text>
                  </View>
                </View>
              );
            })}
        </View>
        
        <View style={styles.categoryActions}>
          <Button
            mode="contained"
            onPress={exportToCSV}
            style={[styles.actionButton, { backgroundColor: theme.gold.primary }]}
            labelStyle={{ color: theme.background.primary }}
            icon="download-outline"
          >
            Export CSV
          </Button>
          <Button
            mode="outlined"
            onPress={() => {
              navigation.navigate("ReportsTab", { screen: "CategoryReport" });
            }}
            style={[styles.actionButton, { borderColor: theme.gold.primary }]}
            labelStyle={{ color: theme.gold.primary }}
            icon="analytics-outline"
          >
            View Details
          </Button>
        </View>
      </View>

      {/* Premium Features */}
      {!subscription.features.advancedReporting && (
        <View style={[
          styles.premiumCard,
          { backgroundColor: theme.background.secondary, borderColor: theme.gold.primary }
        ]}>
          <Ionicons name="lock-closed" size={24} color={theme.gold.primary} />
          <Text style={[styles.premiumTitle, { color: theme.text.primary }]}>
            Advanced Analytics
          </Text>
          <Text style={[styles.premiumDescription, { color: theme.text.secondary }]}>
            Unlock tax insights, business expense tracking, and detailed trends with Premium.
          </Text>
        </View>
      )}
      
      {/* Advanced features for premium users */}
      {subscription.features.advancedReporting && advancedReport && (
        <>
          {/* Business vs Personal Split */}
          <View style={[
            styles.taxCard,
            { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
          ]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Business vs Personal
            </Text>
            
            <View style={styles.splitVisualization}>
              <View 
                style={[
                  styles.businessSplit, 
                  { 
                    backgroundColor: theme.gold.primary,
                    width: `${businessPercentage}%` as any
                  }
                ]} 
              />
              <View 
                style={[
                  styles.personalSplit,
                  { 
                    backgroundColor: theme.text.tertiary,
                    width: `${100 - businessPercentage}%` as any
                  }
                ]} 
              />
            </View>
            
            <View style={styles.splitStats}>
              <View style={styles.splitStatItem}>
                <Text style={[styles.splitPercentage, { color: theme.gold.primary }]}>
                  {businessPercentage}%
                </Text>
                <Text style={[styles.splitLabel, { color: theme.text.secondary }]}>
                  Business
                </Text>
              </View>
              <View style={styles.splitStatItem}>
                <Text style={[styles.splitPercentage, { color: theme.text.tertiary }]}>
                  {100 - businessPercentage}%
                </Text>
                <Text style={[styles.splitLabel, { color: theme.text.secondary }]}>
                  Personal
                </Text>
              </View>
            </View>
            
            {businessPercentage > 0 && (
              <View style={[
                styles.taxSavingsInsight,
                { backgroundColor: theme.gold.background, borderColor: theme.gold.primary }
              ]}>
                <Ionicons name="trending-up" size={20} color={theme.gold.primary} />
                <View>
                  <Text style={[styles.taxSavingsTitle, { color: theme.text.primary }]}>
                    Potential Tax Savings
                  </Text>
                  <Text style={[styles.taxSavingsAmount, { color: theme.gold.primary }]}>
                    {formatCurrency(
                      receipts
                        .filter((r) => r.tax?.deductible === true)
                        .reduce((sum, r) => sum + r.amount, 0) * 0.25
                    )}
                  </Text>
                  <Text style={[styles.taxSavingsNote, { color: theme.text.secondary }]}>
                    Est. at 25% tax rate
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tax Categories */}
          <View style={[
            styles.taxCategoriesCard,
            { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }
          ]}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Tax-Deductible Categories
            </Text>
            
            {Object.keys(taxCategories).length > 0 ? (
              Object.entries(taxCategories).map(([category, amount]) => (
                <View key={category} style={[
                  styles.taxCategoryItem,
                  { borderColor: theme.border.primary }
                ]}>
                  <Text style={[styles.taxCategoryName, { color: theme.text.primary }]}>
                    {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                  </Text>
                  <Text style={[styles.taxCategoryAmount, { color: theme.gold.primary }]}>
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={[styles.noTaxCategoriesText, { color: theme.text.secondary }]}>
                No tax-deductible receipts found for this period.
              </Text>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  
  // Loading state
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  
  // Error state
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    marginTop: 8,
  },
  
  // Empty state
  emptyContainer: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContent: {
    width: '100%',
    maxWidth: 400,
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  emptyDateRangeCard: {
    width: '100%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  emptyDateRangeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyActionButton: {
    marginTop: 8,
  },
  
  // Header
  headerCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  headerContent: {
    marginBottom: 16,
  },
  headerTitleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginLeft: 12,
  },
  headerSubtitle: {
    fontSize: 16,
    marginLeft: 36,
  },
  segmentedButtons: {
    borderRadius: 12,
  },
  
  // Summary stats
  summaryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  
  // Categories
  categoryCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  categoryList: {
    gap: 12,
    marginBottom: 20,
  },
  categoryItem: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  categoryInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  categoryProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  categoryProgressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryPercentage: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 40,
    textAlign: 'right',
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
  },
  
  // Premium gate
  premiumCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    marginBottom: 16,
  },
  premiumTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  premiumDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Tax insights
  taxCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  splitVisualization: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  businessSplit: {
    height: '100%',
  },
  personalSplit: {
    height: '100%',
  },
  splitStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  splitStatItem: {
    alignItems: 'center',
  },
  splitPercentage: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  splitLabel: {
    fontSize: 14,
  },
  taxSavingsInsight: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    gap: 12,
  },
  taxSavingsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  taxSavingsAmount: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 2,
  },
  taxSavingsNote: {
    fontSize: 12,
  },
  
  // Tax categories
  taxCategoriesCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  taxCategoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  taxCategoryName: {
    fontSize: 16,
    flex: 1,
  },
  taxCategoryAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  noTaxCategoriesText: {
    fontSize: 16,
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 20,
  },
});
