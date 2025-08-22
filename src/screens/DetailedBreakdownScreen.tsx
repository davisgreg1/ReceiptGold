/**
 * DetailedBreakdownScreen - Beautiful, modern expense analysis with theme support
 * 
 * Features:
 * - Modern card-based design with proper dark/light mode
 * - Detailed category breakdown with visual trends
 * - Top merchants analysis with rankings
 * - Monthly spending patterns with insights
 * - Business vs personal breakdown
 * - Beautiful animations and micro-interactions
 */

import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, Dimensions, RefreshControl } from "react-native";
import {
  Text,
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
import { useFocusEffect } from "@react-navigation/native";
import { ReceiptCategoryService } from '../services/ReceiptCategoryService';
import { formatCurrency } from '../utils/formatCurrency';
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useTheme } from "../theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";

interface Receipt {
  amount: number;
  category: string;
  date?: Timestamp;
  createdAt: Timestamp;
  businessId?: string;
  businessName?: string;
  description?: string;
  id: string;
  status: string;
}

interface CategoryInsight {
  category: string;
  total: number;
  count: number;
  average: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  trendPercentage: number;
}

interface MerchantInsight {
  name: string;
  total: number;
  count: number;
  category: string;
  averageTransaction: number;
}

interface MonthlyData {
  month: string;
  total: number;
  count: number;
  topCategory: string;
}

export const DetailedBreakdownScreen = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<"3months" | "6months" | "year">("3months");

  // Fetch receipts with error handling
  const fetchReceipts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Calculate date range
      const now = new Date();
      const monthsBack = selectedPeriod === "3months" ? 3 : selectedPeriod === "6months" ? 6 : 12;
      const startDate = subMonths(now, monthsBack);

      // Primary query using createdAt
      let receiptsQuery = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("status", "!=", "deleted"),
        where("createdAt", ">=", Timestamp.fromDate(startDate))
      );

      const snapshot = await getDocs(receiptsQuery);
      const receiptsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Receipt[];

      setReceipts(receiptsData);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      // Fallback query without date filter if index issues
      try {
        const fallbackQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("status", "!=", "deleted")
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        const fallbackData = fallbackSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Receipt[];
        
        // Filter client-side
        const monthsBack = selectedPeriod === "3months" ? 3 : selectedPeriod === "6months" ? 6 : 12;
        const startDate = subMonths(new Date(), monthsBack);
        const filteredData = fallbackData.filter(receipt => {
          const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
          return receiptDate && receiptDate >= startDate;
        });
        
        setReceipts(filteredData);
      } catch (fallbackError) {
        console.error("Fallback query failed:", fallbackError);
        setReceipts([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchReceipts();
    setRefreshing(false);
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchReceipts();
    }, [user, selectedPeriod])
  );

  // Calculate category insights with trends
  const categoryInsights = useMemo((): CategoryInsight[] => {
    const categoryData: Record<string, { current: Receipt[]; previous: Receipt[] }> = {};
    const now = new Date();
    const currentPeriodStart = subMonths(now, selectedPeriod === "3months" ? 3 : selectedPeriod === "6months" ? 6 : 12);
    const previousPeriodStart = subMonths(currentPeriodStart, selectedPeriod === "3months" ? 3 : selectedPeriod === "6months" ? 6 : 12);

    // Group receipts by category and period
    receipts.forEach(receipt => {
      const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
      if (!receiptDate) return;

      const category = receipt.category || 'other';
      if (!categoryData[category]) {
        categoryData[category] = { current: [], previous: [] };
      }

      if (receiptDate >= currentPeriodStart) {
        categoryData[category].current.push(receipt);
      } else if (receiptDate >= previousPeriodStart) {
        categoryData[category].previous.push(receipt);
      }
    });

    const total = receipts.reduce((sum, r) => sum + r.amount, 0);

    return Object.entries(categoryData)
      .map(([category, data]) => {
        const currentTotal = data.current.reduce((sum, r) => sum + r.amount, 0);
        const previousTotal = data.previous.reduce((sum, r) => sum + r.amount, 0);
        const count = data.current.length;
        const average = count > 0 ? currentTotal / count : 0;
        const percentage = total > 0 ? (currentTotal / total) * 100 : 0;

        let trend: 'up' | 'down' | 'stable' = 'stable';
        let trendPercentage = 0;

        if (previousTotal > 0) {
          const change = ((currentTotal - previousTotal) / previousTotal) * 100;
          trendPercentage = Math.abs(change);
          if (change > 5) trend = 'up';
          else if (change < -5) trend = 'down';
        } else if (currentTotal > 0) {
          trend = 'up';
          trendPercentage = 100;
        }

        return {
          category,
          total: currentTotal,
          count,
          average,
          percentage,
          trend,
          trendPercentage,
        };
      })
      .filter(insight => insight.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [receipts, selectedPeriod]);

  // Calculate top merchants
  const topMerchants = useMemo((): MerchantInsight[] => {
    const merchantData: Record<string, Receipt[]> = {};

    receipts.forEach(receipt => {
      const merchantName = receipt.businessName || receipt.description || 'Unknown Merchant';
      if (!merchantData[merchantName]) {
        merchantData[merchantName] = [];
      }
      merchantData[merchantName].push(receipt);
    });

    return Object.entries(merchantData)
      .map(([name, receipts]) => ({
        name,
        total: receipts.reduce((sum, r) => sum + r.amount, 0),
        count: receipts.length,
        category: receipts[0]?.category || 'other',
        averageTransaction: receipts.reduce((sum, r) => sum + r.amount, 0) / receipts.length,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [receipts]);

  // Calculate monthly breakdown
  const monthlyBreakdown = useMemo((): MonthlyData[] => {
    const monthlyData: Record<string, Receipt[]> = {};

    receipts.forEach(receipt => {
      const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
      if (!receiptDate) return;

      const monthKey = format(receiptDate, 'MMM yyyy');
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(receipt);
    });

    return Object.entries(monthlyData)
      .map(([month, receipts]) => {
        const categoryTotals: Record<string, number> = {};
        receipts.forEach(receipt => {
          const category = receipt.category || 'other';
          categoryTotals[category] = (categoryTotals[category] || 0) + receipt.amount;
        });

        const topCategory = Object.entries(categoryTotals)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'other';

        return {
          month,
          total: receipts.reduce((sum, r) => sum + r.amount, 0),
          count: receipts.length,
          topCategory,
        };
      })
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }, [receipts]);

  // Calculate overall stats
  const totalExpenses = receipts.reduce((sum, r) => sum + r.amount, 0);
  const averageTransaction = receipts.length > 0 ? totalExpenses / receipts.length : 0;
  const businessExpenses = receipts.filter(r => r.businessId).reduce((sum, r) => sum + r.amount, 0);
  const businessPercentage = totalExpenses > 0 ? (businessExpenses / totalExpenses) * 100 : 0;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[styles.loadingContainer, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Analyzing your detailed breakdown...
          </Text>
        </View>
      </View>
    );
  }

  if (receipts.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[styles.emptyContainer, { backgroundColor: theme.background.primary }]}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="analytics-outline" size={48} color={theme.gold.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No Data Available
          </Text>
          <Text style={[styles.emptyMessage, { color: theme.text.secondary }]}>
            No receipts found for the selected period. Add some receipts to see detailed analytics.
          </Text>
        </View>
      </View>
    );
  }

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
      {/* Header Card with Period Selector */}
      <View style={[styles.card, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.headerIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="time-outline" size={20} color={theme.gold.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Analysis Period
          </Text>
        </View>
        <View style={styles.cardContent}>
          <SegmentedButtons
            value={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as any)}
            theme={{
              colors: {
                primary: theme.gold.primary,
                onPrimary: theme.text.inverse,
                surface: theme.background.secondary,
                onSurface: theme.text.primary,
                outline: theme.border.primary,
              },
            }}
            buttons={[
              { value: "3months", label: "3 Months" },
              { value: "6months", label: "6 Months" }, 
              { value: "year", label: "1 Year" },
            ]}
            style={styles.segmentedButtons}
          />
        </View>
      </View>

      {/* Overview Stats Card */}
      <View style={[styles.card, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.headerIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="stats-chart-outline" size={20} color={theme.gold.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Expense Overview
          </Text>
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
                <Ionicons name="cash-outline" size={20} color={theme.gold.primary} />
              </View>
              <Text 
                style={[styles.statValue, { color: theme.text.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatCurrency(totalExpenses)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Total Expenses
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
                <Ionicons name="receipt-outline" size={20} color={theme.gold.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {receipts.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Transactions
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
                <Ionicons name="trending-up-outline" size={20} color={theme.gold.primary} />
              </View>
              <Text 
                style={[styles.statValue, { color: theme.text.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatCurrency(averageTransaction)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Average
              </Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary }]}>
              <View style={[styles.statIconContainer, { backgroundColor: theme.gold.background }]}>
                <Ionicons name="briefcase-outline" size={20} color={theme.gold.primary} />
              </View>
              <Text style={[styles.statValue, { color: theme.text.primary }]}>
                {businessPercentage.toFixed(1)}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                Business
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Category Analysis Card */}
      <View style={[styles.card, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.headerIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="pie-chart-outline" size={20} color={theme.gold.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Category Analysis
          </Text>
        </View>
        <View style={styles.cardContent}>
          {categoryInsights.map((insight, index) => (
            <View key={insight.category} style={[
              styles.categoryInsight, 
              { borderBottomColor: theme.border.primary },
              index === categoryInsights.length - 1 && { borderBottomWidth: 0 }
            ]}>
              <View style={styles.categoryHeader}>
                <Text style={[styles.categoryName, { color: theme.text.primary }]}>
                  {ReceiptCategoryService.getCategoryDisplayName(insight.category as any)}
                </Text>
                <View style={styles.categoryTrend}>
                  <View style={[
                    styles.trendContainer,
                    { 
                      backgroundColor: insight.trend === 'up' 
                        ? 'rgba(255, 59, 48, 0.1)' 
                        : insight.trend === 'down' 
                          ? 'rgba(52, 199, 89, 0.1)' 
                          : theme.background.secondary,
                      borderColor: insight.trend === 'up' 
                        ? '#FF3B30' 
                        : insight.trend === 'down' 
                          ? '#34C759' 
                          : theme.border.primary
                    }
                  ]}>
                    <Ionicons 
                      name={insight.trend === 'up' ? 'trending-up' : insight.trend === 'down' ? 'trending-down' : 'remove-outline'} 
                      size={14} 
                      color={insight.trend === 'up' 
                        ? '#FF3B30' 
                        : insight.trend === 'down' 
                          ? '#34C759' 
                          : theme.text.secondary
                      } 
                    />
                    <Text style={[
                      styles.trendText,
                      { 
                        color: insight.trend === 'up' 
                          ? '#FF3B30' 
                          : insight.trend === 'down' 
                            ? '#34C759' 
                            : theme.text.secondary
                      }
                    ]}>
                      {insight.trend === 'stable' ? 'Stable' : `${insight.trendPercentage.toFixed(0)}%`}
                    </Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.categoryStats}>
                <Text 
                  style={[styles.categoryAmount, { color: theme.text.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {formatCurrency(insight.total)}
                </Text>
                <Text style={[styles.categoryDetails, { color: theme.text.secondary }]}>
                  {insight.count} transactions • {formatCurrency(insight.average)} avg
                </Text>
              </View>
              
              <View style={styles.progressContainer}>
                <View style={[styles.progressBar, { backgroundColor: theme.background.tertiary }]}>
                  <View 
                    style={[
                      styles.progressFill,
                      { 
                        width: `${Math.max(insight.percentage, 2)}%`,
                        backgroundColor: theme.gold.primary
                      }
                    ]} 
                  />
                </View>
                <Text style={[styles.percentageText, { color: theme.text.tertiary }]}>
                  {insight.percentage.toFixed(1)}% of total
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Top Merchants Card */}
      <View style={[styles.card, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.headerIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="storefront-outline" size={20} color={theme.gold.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Top Merchants
          </Text>
        </View>
        <View style={styles.cardContent}>
          {topMerchants.map((merchant, index) => (
            <View key={merchant.name} style={[
              styles.merchantItem, 
              { borderBottomColor: theme.border.primary },
              index === topMerchants.length - 1 && { borderBottomWidth: 0 }
            ]}>
              <View style={[styles.merchantRank, { backgroundColor: theme.gold.background }]}>
                <Text style={[styles.rankNumber, { color: theme.gold.primary }]}>
                  {index + 1}
                </Text>
              </View>
              <View style={styles.merchantInfo}>
                <Text style={[styles.merchantName, { color: theme.text.primary }]} numberOfLines={1}>
                  {merchant.name}
                </Text>
                <Text style={[styles.merchantCategory, { color: theme.text.secondary }]}>
                  {ReceiptCategoryService.getCategoryDisplayName(merchant.category as any)}
                </Text>
              </View>
              <View style={styles.merchantStats}>
                <Text 
                  style={[styles.merchantAmount, { color: theme.text.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {formatCurrency(merchant.total)}
                </Text>
                <Text style={[styles.merchantDetails, { color: theme.text.secondary }]}>
                  {merchant.count} visits • {formatCurrency(merchant.averageTransaction)} avg
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Monthly Breakdown Card */}
      <View style={[styles.card, { backgroundColor: theme.background.primary, borderColor: theme.border.primary }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.headerIconContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="calendar-outline" size={20} color={theme.gold.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: theme.text.primary }]}>
            Monthly Trends
          </Text>
        </View>
        <View style={styles.cardContent}>
          {monthlyBreakdown.map((month, index) => (
            <View key={month.month} style={[
              styles.monthItem, 
              { borderBottomColor: theme.border.primary },
              index === monthlyBreakdown.length - 1 && { borderBottomWidth: 0 }
            ]}>
              <View style={styles.monthInfo}>
                <Text style={[styles.monthName, { color: theme.text.primary }]}>
                  {month.month}
                </Text>
                <Text style={[styles.monthCategory, { color: theme.text.secondary }]}>
                  Top: {ReceiptCategoryService.getCategoryDisplayName(month.topCategory as any)}
                </Text>
              </View>
              <View style={styles.monthStats}>
                <Text 
                  style={[styles.monthAmount, { color: theme.text.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {formatCurrency(month.total)}
                </Text>
                <Text style={[styles.monthDetails, { color: theme.text.secondary }]}>
                  {month.count} transactions
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
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
  
  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // Card styling
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  headerIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  
  // Segmented buttons
  segmentedButtons: {
    marginVertical: 8,
  },
  
  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '47%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  
  // Category insights
  categoryInsight: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  categoryTrend: {
    marginLeft: 12,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  categoryStats: {
    marginBottom: 12,
  },
  categoryAmount: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryDetails: {
    fontSize: 14,
  },
  
  // Progress bar
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    textAlign: 'right',
  },
  
  // Merchant items
  merchantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  merchantRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
  },
  merchantInfo: {
    flex: 1,
    marginRight: 12,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  merchantCategory: {
    fontSize: 12,
  },
  merchantStats: {
    alignItems: 'flex-end',
  },
  merchantAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  merchantDetails: {
    fontSize: 12,
  },
  
  // Monthly items
  monthItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  monthInfo: {
    flex: 1,
    marginRight: 12,
  },
  monthName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  monthCategory: {
    fontSize: 12,
  },
  monthStats: {
    alignItems: 'flex-end',
  },
  monthAmount: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  monthDetails: {
    fontSize: 12,
  },
});
