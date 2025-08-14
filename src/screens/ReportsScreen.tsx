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
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import {
  Text,
  Button,
  Card,
  SegmentedButtons,
  ActivityIndicator,
  useTheme,
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

interface Receipt {
  amount: number;
  category: string;
  date?: Timestamp; // Optional for backward compatibility
  createdAt: Timestamp; // Primary date field
  businessId?: string;
  description?: string;
  id: string;
  status: string;
}

type RootStackParamList = {
  ReceiptsTab: { screen: "ScanReceipt" | "ReceiptsList" };
  ReportsTab: { screen: "CategoryReport" | "ExpenseReport" | "TaxReport" };
};

export const ReportsScreen = () => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { colors } = useTheme();
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
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
    const businessAmount = receipts
      .filter((r) => r.businessId)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.round((businessAmount / totalAmount) * 100);
  }, [receipts]);

  // Calculate tax categories
  const taxCategories = useMemo(() => {
    return receipts.reduce((acc, receipt) => {
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
      <View style={styles.container}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={{ alignItems: 'center', padding: 20 }}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 16, textAlign: 'center' }}>
                Loading your financial reports...
              </Text>
            </View>
          </Card.Content>
        </Card>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <Button
          mode="contained"
          onPress={() => {
            setLoading(true);
            setError(null);
            setSelectedDateRange(selectedDateRange);
          }}
        >
          Retry
        </Button>
      </View>
    );
  }

  if (receipts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>📊</Text>
        <Text style={styles.emptyTitle}>
          No Receipts for {selectedDateRange === 'week' ? 'This Week' : 
                          selectedDateRange === 'month' ? 'This Month' : 
                          'This Year'}
        </Text>
        <Text style={styles.emptyDescription}>
          {receipts.length === 0 && selectedDateRange === 'month' 
            ? "Add your first receipt to start tracking your expenses and generate detailed reports."
            : `Try selecting a different time range or add more receipts for the selected ${selectedDateRange}.`
          }
        </Text>
        
        {/* Date Range Selector */}
        <Card style={[styles.card, { width: '100%', marginBottom: 16 }]}>
          <Card.Content>
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
            />
          </Card.Content>
        </Card>

        <Button
          mode="contained"
          onPress={() => {
            // Navigate to add receipt screen
            // @ts-ignore - we know this exists in the navigation
            navigation.navigate("ReceiptsTab", { screen: "ScanReceipt" });
          }}
          style={styles.button}
          icon="plus"
        >
          Add Your First Receipt
        </Button>
      </View>
    );
  }

  const basicReport = generateBasicReport();
  const advancedReport = generateAdvancedReport();
  const trends = advancedReport?.trends || [];

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Title 
          title="Date Range" 
          right={(props) => (
            <Button
              {...props}
              mode="text"
              onPress={refreshData}
              icon={refreshing ? "loading" : "refresh"}
              disabled={loading || refreshing}
              loading={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          )}
        />
        <Card.Content>
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
          />
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Title title="Financial Summary" />
        <Card.Content>
          <Text style={styles.amount}>
            Total Expenses: ${basicReport.totalAmount.toFixed(2)}
          </Text>
          <Text style={styles.subtitle}>
            Total Receipts: {basicReport.receiptCount}
          </Text>

          {/* Average Transaction */}
          <Text style={styles.metric}>
            Average Transaction: $
            {(
              basicReport.totalAmount / (basicReport.receiptCount || 1)
            ).toFixed(2)}
          </Text>

          {/* Daily Average - more accurate based on date range */}
          <Text style={styles.metric}>
            {selectedDateRange === 'week' ? 'Daily Average: $' : 
             selectedDateRange === 'month' ? 'Daily Average: $' : 
             'Monthly Average: $'}
            {selectedDateRange === 'year' 
              ? (basicReport.totalAmount / 12).toFixed(2)
              : (basicReport.totalAmount / (selectedDateRange === 'week' ? 7 : 30)).toFixed(2)}
          </Text>

          <Text style={styles.sectionTitle}>Category Breakdown:</Text>
          {Object.entries(basicReport.categoryTotals)
            .sort(([, a], [, b]) => b - a) // Sort by amount descending
            .map(([category, amount]) => {
              const percentage = (
                (amount / basicReport.totalAmount) *
                100
              ).toFixed(1);
              return (
                <View key={category} style={styles.categoryRow}>
                  <Text style={styles.categoryItem}>
                    {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                  </Text>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryAmount}>
                      ${amount.toFixed(2)}
                    </Text>
                    <Text style={styles.categoryPercent}>{percentage}%</Text>
                  </View>
                </View>
              );
            })}

          <View style={styles.buttonContainer}>
            <Button
              mode="contained"
              onPress={exportToCSV}
              style={styles.button}
              icon="file-download"
            >
              Export CSV
            </Button>
            <Button
              mode="outlined"
              onPress={() => {
                // Navigate to detailed breakdown
                navigation.navigate("ReportsTab", { screen: "CategoryReport" });
              }}
              style={styles.button}
              icon="chart-bar"
            >
              Detailed Breakdown
            </Button>
          </View>
        </Card.Content>
      </Card>

      {/* Tax Insights Card */}
      <Card style={styles.card}>
        <Card.Title title="Tax Insights" />
        <Card.Content>
          <Text style={styles.sectionTitle}>Business vs Personal Split</Text>
          {receipts.length > 0 && (
            <View style={styles.splitContainer}>
              {businessPercentage > 0 && (
                <View style={[styles.splitBar, styles.businessBar, { flex: businessPercentage }]}>
                  <Text style={styles.splitText}>
                    Business {businessPercentage}%
                  </Text>
                </View>
              )}
              {businessPercentage < 100 && (
                <View
                  style={[
                    styles.splitBar,
                    styles.personalBar,
                    { flex: 100 - businessPercentage },
                  ]}
                >
                  <Text style={styles.splitText}>
                    Personal {100 - businessPercentage}%
                  </Text>
                </View>
              )}
            </View>
          )}

          <Text style={styles.sectionTitle}>Tax Categories</Text>
          <View style={styles.taxCategories}>
            {Object.entries(taxCategories).map(([category, amount]) => (
              <View key={category} style={styles.taxCategory}>
                <Text style={styles.taxCategoryName} numberOfLines={2}>
                  {ReceiptCategoryService.getCategoryDisplayName(category as any)}
                </Text>
                <Text style={styles.taxCategoryAmount}>
                  ${amount.toFixed(2)}
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
                          ${data.total.toFixed(2)} ({data.receipts.length}{" "}
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
    flex: 1,
    marginHorizontal: 4,
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
});
