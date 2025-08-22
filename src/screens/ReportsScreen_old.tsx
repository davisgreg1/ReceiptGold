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
  Card,
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
import { LineChart } from "react-native-chart-kit";
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
  id: string;
  status: string;
  tax?: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
  };
}

type RootStackParamList = {
  ReceiptsTab: { screen: "ScanReceipt" | "ReceiptsList" };
  ReportsTab: { screen: "CategoryReport" | "ExpenseReport" | "TaxReport" };
};

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

  // Calculate business percentage
  const businessPercentage = useMemo(() => {
    if (receipts.length === 0) return 0;
    const totalAmount = receipts.reduce((sum, r) => sum + r.amount, 0);
    if (totalAmount === 0) return 0;
    
    // Debug logging
    console.log('=== BUSINESS PERCENTAGE DEBUG ===');
    console.log('Total receipts:', receipts.length);
    console.log('Sample receipt tax data:', receipts.slice(0, 3).map(r => ({ 
      id: r.id, 
      amount: r.amount, 
      tax: r.tax,
      hasDeductible: r.tax?.deductible 
    })));
    
    const businessAmount = receipts
      .filter((r) => r.tax?.deductible === true)
      .reduce((sum, r) => sum + r.amount, 0);
      
    console.log('Business receipts found:', receipts.filter(r => r.tax?.deductible === true).length);
    console.log('Business amount:', businessAmount);
    console.log('Total amount:', totalAmount);
    console.log('================================');
    
    return Math.round((businessAmount / totalAmount) * 100);
  }, [receipts]);

  // Calculate tax categories (only include tax-deductible receipts)
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
        
        // First try the optimized query with indexes
        let querySnapshot;
        try {
          const q = query(
            receiptsRef,
            where("userId", "==", user.uid),
            where("status", "!=", "deleted"),
            where("createdAt", ">=", dateRangeFilter.startDate),
            where("createdAt", "<=", dateRangeFilter.endDate)
          );
          querySnapshot = await getDocs(q);
        } catch (error: any) {
          // If we get an index error, fall back to basic query and filter in memory
          if (error?.message?.includes('requires an index')) {
            console.log('Index not ready for reports, falling back to basic query...');
            const basicQuery = query(
              receiptsRef,
              where("userId", "==", user.uid)
            );
            const basicSnapshot = await getDocs(basicQuery);
            
            // Filter in memory
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
            date: data.date, // Keep for backward compatibility
            createdAt: data.createdAt,
            businessId: data.businessId,
            description: data.description,
            status: data.status || 'active',
            tax: data.tax || undefined, // Include tax data for deductible analysis
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

  // Refresh data when screen comes into focus
  const refreshData = useCallback(async () => {
    if (!user) return;

    // Set refreshing state if we're not in initial loading
    if (!loading) {
      setRefreshing(true);
    }

    try {
      const receiptsRef = collection(db, "receipts");
      
      // First try the optimized query with indexes
      let querySnapshot;
      try {
        const q = query(
          receiptsRef,
          where("userId", "==", user.uid),
          where("status", "!=", "deleted"),
          where("createdAt", ">=", dateRangeFilter.startDate),
          where("createdAt", "<=", dateRangeFilter.endDate)
        );
        querySnapshot = await getDocs(q);
      } catch (error: any) {
        // If we get an index error, fall back to basic query and filter in memory
        if (error?.message?.includes('requires an index')) {
          console.log('Index not ready for reports refresh, falling back to basic query...');
          const basicQuery = query(
            receiptsRef,
            where("userId", "==", user.uid)
          );
          const basicSnapshot = await getDocs(basicQuery);
          
          // Filter in memory
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
          date: data.date, // Keep for backward compatibility
          createdAt: data.createdAt,
          businessId: data.businessId,
          description: data.description,
          status: data.status || 'active',
          tax: data.tax || undefined, // Include tax data for deductible analysis
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

  // Also refresh when user changes (in case of logout/login)
  useEffect(() => {
    if (user) {
      console.log('User changed, refreshing reports data...');
      refreshData();
    }
  }, [user, refreshData]);

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
          total: 0,
          receipts: [],
        };
      }
      acc[businessId].total += receipt.amount;
      acc[businessId].receipts.push(receipt);
      return acc;
    }, {} as Record<string, { total: number; receipts: Receipt[] }>);

    return {
      byBusiness,
      trends: calculateTrends(),
    };
  };

  const calculateTrends = () => {
    // Group receipts by month using createdAt (fallback to date for backward compatibility)
    const monthly = receipts.reduce((acc, receipt) => {
      const timestamp = receipt.createdAt || receipt.date;
      if (!timestamp) return acc;
      
      const date = timestamp.toDate();
      const month = format(date, "yyyy-MM");
      acc[month] = (acc[month] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(monthly)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6) // Last 6 months
      .map(([month, amount]) => ({
        month: format(new Date(month), "MMM"),
        amount,
      }));
  };

  const exportToCSV = async () => {
    try {
      const rows = [
        ["Date", "Amount", "Category", "Business ID", "Description"],
        ...receipts.map((r) => {
          // Use createdAt, fallback to date for backward compatibility
          const timestamp = r.createdAt || r.date;
          const dateString = timestamp ? format(timestamp.toDate(), "yyyy-MM-dd") : "N/A";
          
          return [
            dateString,
            r.amount.toFixed(2),
            r.category,
            r.businessId || "",
            r.description || "",
          ];
        }),
      ];

      const csvContent = rows
        .map((row) =>
          row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
        )
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
  }  const basicReport = generateBasicReport();
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
            <View style={[styles.statIconContainer, { backgroundColor: theme.gold.secondary }]}>
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
                            width: `${percentage}%`
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
      </View>
                  <Text style={styles.categoryItem}>
                    {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                  </Text>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryAmount}>
                      {formatCurrency(amount)}
                    </Text>
                    <Text style={styles.categoryPercent}>{percentage}%</Text>
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

      {/* Tax Insights Card */}
      <Card style={styles.card}>
        <Card.Title title="Tax Insights" />
        <Card.Content>
          <Text style={styles.sectionTitle}>Business vs Personal Split</Text>
          {receipts.length > 0 && (
            <>
              {/* Modern Split Visualization */}
              <View style={styles.modernSplitContainer}>
                <View style={styles.splitVisualization}>
                  <View 
                    style={[
                      styles.modernBusinessBar, 
                      { width: `${businessPercentage}%` }
                    ]} 
                  />
                  <View 
                    style={[
                      styles.modernPersonalBar, 
                      { width: `${100 - businessPercentage}%` }
                    ]} 
                  />
                </View>
              </View>

              {/* Split Stats Cards */}
              <View style={styles.splitStatsContainer}>
                <View style={[styles.splitStatCard, styles.businessStatCard]}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.businessIcon}>💼</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Business</Text>
                    <Text style={styles.statPercentage}>{businessPercentage}%</Text>
                    <Text style={styles.statAmount}>
                      ${receipts
                        .filter((r) => r.tax?.deductible === true)
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={[styles.splitStatCard, styles.personalStatCard]}>
                  <View style={styles.statIconContainer}>
                    <Text style={styles.personalIcon}>👤</Text>
                  </View>
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel}>Personal</Text>
                    <Text style={styles.statPercentage}>{100 - businessPercentage}%</Text>
                    <Text style={styles.statAmount}>
                      ${receipts
                        .filter((r) => !r.tax?.deductible)
                        .reduce((sum, r) => sum + r.amount, 0)
                        .toFixed(2)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Tax Savings Insight */}
              {businessPercentage > 0 && (
                <View style={styles.taxSavingsCard}>
                  <Text style={styles.taxSavingsIcon}>💰</Text>
                  <View style={styles.taxSavingsContent}>
                    <Text style={styles.taxSavingsTitle}>Potential Tax Savings</Text>
                    <Text style={styles.taxSavingsAmount}>
                      ${(receipts
                        .filter((r) => r.tax?.deductible === true)
                        .reduce((sum, r) => sum + r.amount, 0) * 0.25).toFixed(2)}
                    </Text>
                    <Text style={styles.taxSavingsSubtext}>
                      Estimated at 25% tax rate
                    </Text>
                  </View>
                </View>
              )}
            </>
          )}

          <Text style={styles.sectionTitle}>Tax Categories</Text>
          <View style={styles.taxCategories}>
            {Object.entries(taxCategories).map(([category, amount]) => (
              <View key={category} style={styles.taxCategory}>
                <Text style={styles.taxCategoryName} numberOfLines={2}>
                  {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                </Text>
                <Text style={styles.taxCategoryAmount}>
                  {formatCurrency(amount)}
                </Text>
              </View>
            ))}
          </View>
        </Card.Content>
      </Card>

      <PremiumGate
        feature="advancedReporting"
        featureName="Advanced Reports"
        description="Access detailed analytics, trends, and business-wise reporting"
        requiredTier="growth"
      >
        <Card style={styles.card}>
          <Card.Title title="Advanced Reports" />
          <Card.Content>
            {trends.length > 0 && (
              <View>
                <Text style={styles.sectionTitle}>Monthly Trends</Text>
                <LineChart
                  data={{
                    labels: trends.map((t) => t.month),
                    datasets: [
                      {
                        data: trends.map((t) => t.amount),
                      },
                    ],
                  }}
                  width={screenWidth - 48}
                  height={220}
                  chartConfig={{
                    backgroundColor: "#ffffff",
                    backgroundGradientFrom: "#ffffff",
                    backgroundGradientTo: "#ffffff",
                    decimalPlaces: 0,
                    color: (opacity: number = 1) => `rgba(0, 0, 0, ${opacity})`,
                    labelColor: (opacity: number = 1) =>
                      `rgba(0, 0, 0, ${opacity})`,
                    style: {
                      borderRadius: 16,
                    },
                    propsForDots: {
                      r: "6",
                      strokeWidth: "2",
                      stroke: "#ffa726",
                    },
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>
            )}

            {advancedReport && (
              <View>
                <Text style={styles.sectionTitle}>Business Breakdown:</Text>
                {Object.entries(advancedReport.byBusiness).map(
                  ([businessId, data]) => (
                    <View key={businessId} style={styles.categoryRow}>
                      <Text style={styles.categoryItem}>{businessId}</Text>
                      <View style={styles.categoryDetails}>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(data.total)} ({data.receipts.length}{" "}
                          receipts)
                        </Text>
                      </View>
                    </View>
                  )
                )}
              </View>
            )}
          </Card.Content>
        </Card>
      </PremiumGate>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  emptyContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDescription: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  card: {
    marginBottom: 16,
  },
  errorText: {
    color: "#B00020",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  amount: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 16,
  },
  metric: {
    fontSize: 16,
    color: "#333",
    marginVertical: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  categoryItem: {
    fontSize: 16,
    color: "#333",
    flex: 1,
  },
  categoryDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  categoryAmount: {
    fontSize: 16,
    color: "#333",
    marginRight: 8,
  },
  categoryPercent: {
    fontSize: 14,
    color: "#666",
    width: 50,
    textAlign: "right",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  button: {
    marginHorizontal: 4,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splitContainer: {
    flexDirection: "row",
    height: 40,
    borderRadius: 20,
    overflow: "hidden",
    marginVertical: 8,
  },
  splitBar: {
    justifyContent: "center",
    alignItems: "center",
  },
  businessBar: {
    backgroundColor: "#4CAF50",
  },
  personalBar: {
    backgroundColor: "#9E9E9E",
  },
  splitText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  taxCategories: {
    marginTop: 8,
  },
  taxCategory: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  taxCategoryName: {
    fontSize: 16,
    color: "#333",
    flex: 1,
    marginRight: 12,
    lineHeight: 20,
  },
  taxCategoryAmount: {
    fontSize: 16,
    color: "#333",
    fontWeight: "bold",
    minWidth: 80,
    textAlign: "right",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
    alignSelf: "center",
  },
  // Modern Split UI Styles
  modernSplitContainer: {
    marginVertical: 16,
  },
  splitVisualization: {
    flexDirection: "row",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    marginBottom: 16,
  },
  modernBusinessBar: {
    backgroundColor: "#4CAF50",
    height: "100%",
    borderRadius: 4,
  },
  modernPersonalBar: {
    backgroundColor: "#9E9E9E",
    height: "100%",
    borderRadius: 4,
  },
  splitStatsContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  splitStatCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  businessStatCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50",
  },
  personalStatCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#9E9E9E",
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  businessIcon: {
    fontSize: 20,
  },
  personalIcon: {
    fontSize: 20,
  },
  statContent: {
    flex: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 4,
    fontWeight: "500",
  },
  statPercentage: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 4,
  },
  statAmount: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "600",
  },
  taxSavingsCard: {
    flexDirection: "row",
    backgroundColor: "#E8F5E8",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4CAF50",
    marginBottom: 8,
  },
  taxSavingsIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  taxSavingsContent: {
    flex: 1,
  },
  taxSavingsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32",
    marginBottom: 4,
  },
  taxSavingsAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1B5E20",
    marginBottom: 2,
  },
  taxSavingsSubtext: {
    fontSize: 12,
    color: "#4CAF50",
  },
});
