import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useHomeNavigation, useTabNavigation, navigationHelpers } from "../navigation/navigationHelpers";
import { BrandText, HeadingText, BodyText, ButtonText } from '../components/Typography';
import { db } from '../config/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { ReceiptCategoryService, ReceiptCategory } from '../services/ReceiptCategoryService';

const { width } = Dimensions.get('window');

interface Receipt {
  receiptId: string;
  vendor: string;
  amount: number;
  date: Date;
  category: string;
}

interface TopCategory {
  category: string;
  amount: number;
}

interface DashboardData {
  recentReceipts: Receipt[];
  monthlyTotal: number;
  receiptCount: number;
  topCategories: TopCategory[];
  monthlyChange: number;
  weeklyTotal: number;
}

export const HomeScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const homeNavigation = useHomeNavigation();
  const tabNavigation = useTabNavigation();

  // State for dashboard data
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    recentReceipts: [],
    monthlyTotal: 0,
    receiptCount: 0,
    topCategories: [],
    monthlyChange: 0,
    weeklyTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  // Load dashboard data on mount and when screen is focused
  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  // Refresh data when screen comes into focus (e.g., returning from ScanReceiptScreen)
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadDashboardData();
      }
    }, [user])
  );

  const loadDashboardData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get all receipts from Firebase
      let receiptDocs;
      try {
        const receiptsQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("status", "!=", "deleted"),
          orderBy("createdAt", "desc")
        );
        const receiptsSnapshot = await getDocs(receiptsQuery);
        receiptDocs = receiptsSnapshot.docs;
      } catch (error: any) {
        // Fallback to basic query if index is not ready
        const basicQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid)
        );
        const basicSnapshot = await getDocs(basicQuery);
        receiptDocs = basicSnapshot.docs
          .filter((doc) => doc.data().status !== "deleted")
          .sort((a, b) => {
            const aDate = a.data().createdAt?.toDate?.() || new Date(0);
            const bDate = b.data().createdAt?.toDate?.() || new Date(0);
            return bDate.getTime() - aDate.getTime();
          });
      }

      // Convert Firestore docs to receipt objects
      const allReceipts = receiptDocs.map((doc, index) => {
        const data = doc.data();
        
        // Debug logging for first few receipts
        if (index < 2) {
          console.log(`🧾 Receipt ${index + 1} raw data:`, {
            id: doc.id,
            allFields: Object.keys(data),
            amountFields: {
              amount: data.amount,
              total: data.total,
              extractedDataAmount: data.extractedData?.amount
            },
            vendor: data.vendor || data.merchantName,
            dateFields: {
              date: data.date,
              createdAt: data.createdAt
            }
          });
        }
        
        let receiptDate: Date | null = null;
        let dateSource = 'none';
        
        // Handle various date formats from Firebase
        if (data.date?.toDate) {
          receiptDate = data.date.toDate();
          dateSource = 'date.toDate()';
        } else if (data.createdAt?.toDate) {
          receiptDate = data.createdAt.toDate();
          dateSource = 'createdAt.toDate()';
        } else if (data.date) {
          const parsedDate = new Date(data.date);
          if (!isNaN(parsedDate.getTime())) {
            receiptDate = parsedDate;
            dateSource = `date (${typeof data.date})`;
          }
        } else if (data.createdAt) {
          const parsedDate = new Date(data.createdAt);
          if (!isNaN(parsedDate.getTime())) {
            receiptDate = parsedDate;
            dateSource = `createdAt (${typeof data.createdAt})`;
          }
        }
        
        // Fallback to current date if no valid date found
        if (!receiptDate) {
          receiptDate = new Date();
          dateSource = 'fallback (current date)';
        }
        
        if (index < 2) {
          console.log(`📅 Receipt ${index + 1} date extraction:`, {
            finalDate: receiptDate.toISOString(),
            dateSource,
            rawDateFields: {
              date: data.date,
              createdAt: data.createdAt
            }
          });
        }
        
        // Extract amount with comprehensive fallback logic
        let amount = 0;
        let amountSource = 'none';
        
        // Check main amount field first
        if (typeof data.amount === 'number' && data.amount > 0) {
          amount = data.amount;
          amountSource = 'amount (number)';
        } else if (data.amount && typeof data.amount === 'string') {
          amount = parseFloat(data.amount) || 0;
          amountSource = `amount (string: "${data.amount}")`;
        }
        // Check extracted data
        else if (data.extractedData?.amount && typeof data.extractedData.amount === 'number' && data.extractedData.amount > 0) {
          amount = data.extractedData.amount;
          amountSource = 'extractedData.amount (number)';
        }
        // Check total field
        else if (typeof data.total === 'number' && data.total > 0) {
          amount = data.total;
          amountSource = 'total (number)';
        } else if (data.total && typeof data.total === 'string') {
          amount = parseFloat(data.total) || 0;
          amountSource = `total (string: "${data.total}")`;
        }
        // Check other possible fields
        else if (typeof data.totalAmount === 'number' && data.totalAmount > 0) {
          amount = data.totalAmount;
          amountSource = 'totalAmount (number)';
        } else if (typeof data.grandTotal === 'number' && data.grandTotal > 0) {
          amount = data.grandTotal;
          amountSource = 'grandTotal (number)';
        } else if (typeof data.finalAmount === 'number' && data.finalAmount > 0) {
          amount = data.finalAmount;
          amountSource = 'finalAmount (number)';
        }
        // Remove the > 0 constraint for debugging - maybe amounts are actually 0?
        else if (typeof data.amount === 'number') {
          amount = data.amount;
          amountSource = `amount (number, zero: ${data.amount})`;
        } else if (data.extractedData?.amount && typeof data.extractedData.amount === 'number') {
          amount = data.extractedData.amount;
          amountSource = `extractedData.amount (number, zero: ${data.extractedData.amount})`;
        }
        
        if (index < 2) {
          console.log(`💰 Receipt ${index + 1} amount extraction:`, {
            finalAmount: amount,
            amountSource
          });
        }

        return {
          ...data, // Spread first
          receiptId: doc.id,
          vendor: data.vendor || data.merchantName || 'Unknown Vendor',
          amount,
          date: receiptDate!, // Then override with our cleaned values
          category: data.category || 'other'
        };
      });
      
      // Calculate this month's data
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const thisMonthReceipts = allReceipts.filter(receipt => 
        receipt.date && receipt.date >= firstOfMonth && receipt.date <= now
      );
      
      const lastMonthReceipts = allReceipts.filter(receipt => 
        receipt.date && receipt.date >= firstOfLastMonth && receipt.date <= lastOfLastMonth
      );
      
      const weekReceipts = allReceipts.filter(receipt => 
        receipt.date && receipt.date >= weekAgo && receipt.date <= now
      );
      
      const monthlyTotal = thisMonthReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const lastMonthTotal = lastMonthReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const weeklyTotal = weekReceipts.reduce((sum, receipt) => sum + receipt.amount, 0);
      const monthlyChange = lastMonthTotal > 0 ? ((monthlyTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
      
      // Debug logging to help diagnose the issue
      console.log('📊 Dashboard Data Debug:', {
        totalReceipts: allReceipts.length,
        thisMonthReceipts: thisMonthReceipts.length,
        weekReceipts: weekReceipts.length,
        monthlyTotal,
        weeklyTotal,
        dateRanges: {
          now: now.toISOString(),
          firstOfMonth: firstOfMonth.toISOString(),
          weekAgo: weekAgo.toISOString()
        },
        sampleReceiptAmounts: allReceipts.slice(0, 5).map(r => ({ 
          vendor: r.vendor, 
          amount: r.amount, 
          date: r.date ? r.date.toISOString() : 'No date',
          isThisMonth: r.date ? (r.date >= firstOfMonth && r.date <= now) : false,
          isThisWeek: r.date ? (r.date >= weekAgo && r.date <= now) : false
        })),
        thisMonthReceiptAmounts: thisMonthReceipts.slice(0, 5).map(r => ({ 
          vendor: r.vendor, 
          amount: r.amount, 
          date: r.date ? r.date.toISOString() : 'No date'
        })),
        weekReceiptAmounts: weekReceipts.slice(0, 5).map(r => ({ 
          vendor: r.vendor, 
          amount: r.amount, 
          date: r.date ? r.date.toISOString() : 'No date'
        }))
      });
      
      // Get top categories
      const categoryTotals: Record<string, number> = {};
      thisMonthReceipts.forEach(receipt => {
        const category = receipt.category || 'other';
        const displayName = ReceiptCategoryService.getCategoryDisplayName(category as ReceiptCategory);
        categoryTotals[displayName] = (categoryTotals[displayName] || 0) + receipt.amount;
      });
      
      const topCategories = Object.entries(categoryTotals)
        .map(([category, amount]) => ({ category, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
      
      setDashboardData({
        recentReceipts: allReceipts.slice(0, 3),
        monthlyTotal,
        receiptCount: allReceipts.length,
        topCategories,
        monthlyChange,
        weeklyTotal,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (date: any) => {
    if (!date) return 'Unknown Date';
    
    // Ensure we have a valid Date object
    let validDate: Date;
    if (date instanceof Date && !isNaN(date.getTime())) {
      validDate = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      validDate = new Date(date);
    } else if (date?.toDate && typeof date.toDate === 'function') {
      validDate = date.toDate();
    } else {
      return 'Invalid Date';
    }
    
    // Check if the date is valid after conversion
    if (isNaN(validDate.getTime())) {
      return 'Invalid Date';
    }
    
    return validDate.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };


  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <View style={styles.header}>
        <BrandText size="large" color="gold">
          ReceiptGold
        </BrandText>
        {/* <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={handleLogout}
            style={[styles.logoutButton, { backgroundColor: theme.status.error }]}
          >
            <Text style={[styles.logoutButtonText, { color: theme.text.inverse }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
        </View> */}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.headerSection}>
          <View style={styles.welcomeSection}>
            <HeadingText size="large" color="primary">
              Welcome back
              {user?.displayName
                ? `, ${(user as any).displayName?.split(' ')[0] || user?.email?.split('@')[0] || ''}`
                : user?.email
                  ? `, ${user.email?.split('@')[0] || ''}`
                  : ''}
              !
            </HeadingText>
            <BodyText size="medium" color="secondary">
              Here's your financial snapshot for today
            </BodyText>
          </View>

          {/* Stats Overview Cards */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.gold.primary} />
              <BodyText size="small" color="secondary" style={{ marginTop: 12 }}>
                Loading your insights...
              </BodyText>
            </View>
          ) : (
            <View style={styles.statsContainer}>
              {/* This Month Card */}
              <View style={[styles.statCard, { backgroundColor: theme.background.secondary }]}>
                <View style={styles.statHeader}>
                  <Ionicons name="calendar" size={20} color={theme.gold.primary} />
                  <BodyText size="small" color="secondary">This Month</BodyText>
                </View>
                <HeadingText size="large" color="primary" style={styles.statValue}>
                  {formatCurrency(dashboardData.monthlyTotal)}
                </HeadingText>
                <View style={styles.statFooter}>
                  <Ionicons 
                    name={dashboardData.monthlyChange >= 0 ? "trending-up" : "trending-down"} 
                    size={14} 
                    color={dashboardData.monthlyChange >= 0 ? theme.status.success : theme.status.error} 
                  />
                  <BodyText 
                    size="small" 
                    color={dashboardData.monthlyChange >= 0 ? "success" : "error"}
                    style={{ marginLeft: 4 }}
                  >
                    {Math.abs(dashboardData.monthlyChange).toFixed(1)}% vs last month
                  </BodyText>
                </View>
              </View>

              {/* This Week Card */}
              <View style={[styles.statCard, { backgroundColor: theme.background.secondary }]}>
                <View style={styles.statHeader}>
                  <Ionicons name="time" size={20} color={theme.status.info} />
                  <BodyText size="small" color="secondary">This Week</BodyText>
                </View>
                <HeadingText size="large" color="primary" style={styles.statValue}>
                  {formatCurrency(dashboardData.weeklyTotal)}
                </HeadingText>
                <View style={styles.statFooter}>
                  <Ionicons name="receipt" size={14} color={theme.text.tertiary} />
                  <BodyText size="small" color="tertiary" style={{ marginLeft: 4 }}>
                    {dashboardData.receiptCount} total receipts
                  </BodyText>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <HeadingText size="medium" color="primary" style={{ marginBottom: 16 }}>
            Quick Actions
          </HeadingText>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.primaryAction, { backgroundColor: theme.gold.primary }]}
              onPress={() => navigationHelpers.switchToReceiptsTab(tabNavigation)}
            >
              <Ionicons name="camera" size={28} color="white" />
              <ButtonText size="medium" color="inverse" style={styles.actionButtonText}>
                Scan Receipt
              </ButtonText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary, borderWidth: 1 }]}
              onPress={() => navigationHelpers.switchToReportsTab(tabNavigation)}
            >
              <Ionicons name="bar-chart" size={24} color={theme.text.primary} />
              <ButtonText size="medium" color="primary" style={styles.actionButtonText}>
                View Reports
              </ButtonText>
            </TouchableOpacity>
            
            {subscription.currentTier === 'professional' && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: theme.status.success }]}
                onPress={() => homeNavigation.navigate('BankTransactions')}
              >
                <Ionicons name="card" size={24} color="white" />
                <ButtonText size="medium" color="inverse" style={styles.actionButtonText}>
                  Bank Sync
                </ButtonText>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Recent Activity & Top Categories */}
        {!loading && (
          <View style={styles.insightsSection}>
            {/* Recent Receipts */}
            <View style={[styles.insightCard, { backgroundColor: theme.background.secondary }]}>
              <View style={styles.insightHeader}>
                <HeadingText size="medium" color="primary">Recent Activity</HeadingText>
                <TouchableOpacity 
                  onPress={() => navigationHelpers.switchToReceiptsTab(tabNavigation)}
                  style={styles.viewAllButton}
                >
                  <BodyText size="small" color="gold">View All</BodyText>
                  <Ionicons name="chevron-forward" size={16} color={theme.gold.primary} />
                </TouchableOpacity>
              </View>
              
              {dashboardData.recentReceipts.length > 0 ? (
                <View style={styles.recentList}>
                  {dashboardData.recentReceipts.map((receipt, index) => (
                    <View key={receipt.receiptId || index} style={styles.recentItem}>
                      <View style={[styles.receiptIcon, { backgroundColor: theme.gold.background }]}>
                        <Ionicons name="receipt" size={16} color={theme.gold.primary} />
                      </View>
                      <View style={styles.receiptDetails}>
                        <BodyText size="medium" color="primary" numberOfLines={1}>
                          {receipt.vendor || 'Unknown Vendor'}
                        </BodyText>
                        <BodyText size="small" color="secondary">
                          {formatDate(receipt.date)} • {ReceiptCategoryService.getCategoryDisplayName(receipt.category as ReceiptCategory)}
                        </BodyText>
                      </View>
                      <BodyText size="medium" color="primary" style={{ fontWeight: '600' }}>
                        {formatCurrency(receipt.amount)}
                      </BodyText>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color={theme.text.tertiary} />
                  <BodyText size="medium" color="secondary" style={{ textAlign: 'center', marginTop: 12 }}>
                    No recent receipts
                  </BodyText>
                  <BodyText size="small" color="tertiary" style={{ textAlign: 'center', marginTop: 4 }}>
                    Scan your first receipt to get started
                  </BodyText>
                </View>
              )}
            </View>

            {/* Top Categories */}
            {dashboardData.topCategories.length > 0 && (
              <View style={[styles.insightCard, { backgroundColor: theme.background.secondary }]}>
                <View style={styles.insightHeader}>
                  <HeadingText size="medium" color="primary">Top Categories</HeadingText>
                  <BodyText size="small" color="secondary">This month</BodyText>
                </View>
                
                <View style={styles.categoriesList}>
                  {dashboardData.topCategories.map((category) => {
                    const percentage = dashboardData.monthlyTotal > 0 
                      ? (category.amount / dashboardData.monthlyTotal) * 100 
                      : 0;
                    
                    return (
                      <View key={category.category} style={styles.categoryItem}>
                        <View style={styles.categoryInfo}>
                          <View style={[styles.categoryDot, { backgroundColor: theme.gold.primary }]} />
                          <BodyText size="medium" color="primary" numberOfLines={1} style={styles.categoryName}>
                            {category.category}
                          </BodyText>
                        </View>
                        <View style={styles.categoryAmount}>
                          <BodyText size="medium" color="primary" style={{ fontWeight: '600' }}>
                            {formatCurrency(category.amount)}
                          </BodyText>
                          <BodyText size="small" color="secondary">
                            {percentage.toFixed(1)}%
                          </BodyText>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Subscription Card */}
        <View style={styles.subscriptionSection}>
          <View style={[styles.subscriptionCard, { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.gold.primary,
          }]}>
            <View style={styles.subscriptionIcon}>
              <Text style={styles.subscriptionEmoji}>
                {subscription.currentTier === 'starter' ? '📄' : 
                 subscription.currentTier === 'growth' ? '📈' : 
                 subscription.currentTier === 'professional' ? '💼' : '🆓'}
              </Text>
            </View>
            <View style={styles.subscriptionDetails}>
              <HeadingText size="medium" color="gold">
                {subscription.currentTier === 'starter' ? 'Starter Plan' : 
                 subscription.currentTier === 'growth' ? 'Growth Plan' : 
                 subscription.currentTier === 'professional' ? 'Professional Plan' : 'Free Plan'}
              </HeadingText>
              <BodyText size="small" color="secondary">
                {subscription.currentTier === 'starter' && '50 receipts/mo • Basic categorization'}
                {subscription.currentTier === 'growth' && '150 receipts/mo • Advanced reporting'}
                {subscription.currentTier === 'professional' && 'Unlimited receipts • Multi-business • Bank sync'}
                {subscription.currentTier === 'free' && 'Limited features • Upgrade for more'}
              </BodyText>
              <BodyText size="small" color="tertiary" style={{ marginTop: 4 }}>
                {subscription.currentTier === 'starter' && '$9.99/month'}
                {subscription.currentTier === 'growth' && '$19.99/month'}
                {subscription.currentTier === 'professional' && '$39.99/month'}
                {subscription.currentTier === 'free' && 'Try premium features'}
              </BodyText>
            </View>
            <TouchableOpacity
              style={[styles.subscriptionButton, { backgroundColor: theme.gold.primary }]}
              onPress={() => homeNavigation.navigate('Subscription')}
            >
              <ButtonText size="small" color="inverse">
                {subscription.currentTier === 'free' ? 'Upgrade' : 'Manage'}
              </ButtonText>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  content: {
    flex: 1,
  },
  
  // Header Section
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  welcomeSection: {
    marginBottom: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  
  // Stats Cards
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  statValue: {
    marginBottom: 8,
  },
  statFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Quick Actions
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: width > 400 ? 110 : 100,
    padding: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryAction: {
    shadowColor: '#D4AF37',
    shadowOpacity: 0.25,
  },
  actionButtonText: {
    textAlign: "center",
    marginTop: 12,
    fontWeight: '600',
  },
  
  // Insights Section
  insightsSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  insightCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  
  // Recent Activity
  recentList: {
    gap: 16,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  receiptIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  receiptDetails: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  
  // Categories
  categoriesList: {
    gap: 16,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 16,
  },
  categoryName: {
    flex: 1,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  categoryAmount: {
    alignItems: 'flex-end',
    minWidth: 80,
    flexShrink: 0,
  },
  
  // Subscription Section
  subscriptionSection: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  subscriptionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  subscriptionIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionEmoji: {
    fontSize: 32,
  },
  subscriptionDetails: {
    flex: 1,
  },
  subscriptionButton: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  
  // Legacy styles (keeping for compatibility)
  themeToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  themeToggleText: {
    fontSize: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: "center",
    marginBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
  },
});
