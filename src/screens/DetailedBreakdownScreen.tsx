/**
 * DetailedBreakdownScreen - Comprehensive expense analysis
 * 
 * Features:
 * - Detailed category breakdown with trends
 * - Monthly/weekly spending patterns
 * - Top merchants analysis
 * - Average transaction sizes
 * - Spending velocity and frequency
 * - Business vs personal detailed breakdown
 */

import React, { useState, useEffect, useMemo } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import {
  Text,
  Card,
  SegmentedButtons,
  ActivityIndicator,
  useTheme,
  Chip,
  ProgressBar,
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
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

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
  const { colors } = useTheme();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading detailed breakdown...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Period Selector */}
      <Card style={styles.card}>
        <Card.Content>
          <SegmentedButtons
            value={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as any)}
            buttons={[
              { value: "3months", label: "3 Months" },
              { value: "6months", label: "6 Months" },
              { value: "year", label: "1 Year" },
            ]}
            style={styles.segmentedButtons}
          />
        </Card.Content>
      </Card>

      {/* Overview Stats */}
      <Card style={styles.card}>
        <Card.Title title="Expense Overview" />
        <Card.Content>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${totalExpenses.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Total Expenses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{receipts.length}</Text>
              <Text style={styles.statLabel}>Transactions</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>${averageTransaction.toFixed(2)}</Text>
              <Text style={styles.statLabel}>Average</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{businessPercentage.toFixed(1)}%</Text>
              <Text style={styles.statLabel}>Business</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Category Insights */}
      <Card style={styles.card}>
        <Card.Title title="Category Analysis" />
        <Card.Content>
          {categoryInsights.map((insight) => (
            <View key={insight.category} style={styles.categoryInsight}>
              <View style={styles.categoryHeader}>
                <Text style={styles.categoryName}>
                  {ReceiptCategoryService.getCategoryDisplayName(insight.category as any)}
                </Text>
                <View style={styles.categoryTrend}>
                  <Chip
                    icon={insight.trend === 'up' ? 'trending-up' : insight.trend === 'down' ? 'trending-down' : 'trending-neutral'}
                    mode="outlined"
                    compact
                    style={[
                      styles.trendChip,
                      { backgroundColor: insight.trend === 'up' ? '#ffebee' : insight.trend === 'down' ? '#e8f5e8' : '#f5f5f5' }
                    ]}
                  >
                    {insight.trend === 'stable' ? 'Stable' : `${insight.trendPercentage.toFixed(0)}%`}
                  </Chip>
                </View>
              </View>
              
              <View style={styles.categoryStats}>
                <Text style={styles.categoryAmount}>${insight.total.toFixed(2)}</Text>
                <Text style={styles.categoryDetails}>
                  {insight.count} transactions • ${insight.average.toFixed(2)} avg
                </Text>
              </View>
              
              <ProgressBar
                progress={insight.percentage / 100}
                color={colors.primary}
                style={styles.progressBar}
              />
              <Text style={styles.percentageText}>{insight.percentage.toFixed(1)}% of total</Text>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Top Merchants */}
      <Card style={styles.card}>
        <Card.Title title="Top Merchants" />
        <Card.Content>
          {topMerchants.map((merchant, index) => (
            <View key={merchant.name} style={styles.merchantItem}>
              <View style={styles.merchantRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.merchantInfo}>
                <Text style={styles.merchantName} numberOfLines={1}>
                  {merchant.name}
                </Text>
                <Text style={styles.merchantCategory}>
                  {ReceiptCategoryService.getCategoryDisplayName(merchant.category as any)}
                </Text>
              </View>
              <View style={styles.merchantStats}>
                <Text style={styles.merchantAmount}>${merchant.total.toFixed(2)}</Text>
                <Text style={styles.merchantDetails}>
                  {merchant.count} visits • ${merchant.averageTransaction.toFixed(2)} avg
                </Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>

      {/* Monthly Breakdown */}
      <Card style={styles.card}>
        <Card.Title title="Monthly Trends" />
        <Card.Content>
          {monthlyBreakdown.map((month) => (
            <View key={month.month} style={styles.monthItem}>
              <Text style={styles.monthName}>{month.month}</Text>
              <View style={styles.monthStats}>
                <Text style={styles.monthAmount}>${month.total.toFixed(2)}</Text>
                <Text style={styles.monthDetails}>
                  {month.count} transactions • Top: {ReceiptCategoryService.getCategoryDisplayName(month.topCategory as any)}
                </Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  card: {
    marginBottom: 16,
  },
  segmentedButtons: {
    marginVertical: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  statItem: {
    width: "49%",
    alignItems: "center",
    marginBottom: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  categoryInsight: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
  },
  categoryTrend: {
    marginLeft: 8,
  },
  trendChip: {
    height: 35,
  },
  categoryStats: {
    marginBottom: 8,
  },
  categoryAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  categoryDetails: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  progressBar: {
    height: 6,
    marginVertical: 8,
    borderRadius: 3,
  },
  percentageText: {
    fontSize: 12,
    color: "#666",
    textAlign: "right",
  },
  merchantItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  merchantRank: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e3f2fd",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1976d2",
  },
  merchantInfo: {
    flex: 1,
    marginRight: 12,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  merchantCategory: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  merchantStats: {
    alignItems: "flex-end",
  },
  merchantAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  merchantDetails: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  monthItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  monthName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    flex: 1,
  },
  monthStats: {
    alignItems: "flex-end",
  },
  monthAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
  },
  monthDetails: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
});
