import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  SectionList,
  ScrollView,
  Modal,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { deleteReceiptAndImage } from "../utils/deleteReceipt";
import { getMonthlyReceiptCount } from "../utils/getMonthlyReceipts";
import { checkReceiptLimit } from "../utils/navigationGuards";
import { debugSubscriptionState } from "../utils/debugSubscription";
import { formatCurrency } from "../utils/formatCurrency";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useStripePayments } from "../hooks/useStripePayments";
import { useAuth } from "../context/AuthContext";
import { useReceiptSync } from "../services/ReceiptSyncService";
import { db } from "../config/firebase";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useReceiptsNavigation } from "../navigation/navigationHelpers";
import { useFocusEffect } from "@react-navigation/native";
import { ReceiptCategoryService } from "../services/ReceiptCategoryService";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { FirebaseErrorScenarios } from "../utils/firebaseErrorHandler";
import { ReceiptsLoadingAnimation } from "../components/ReceiptsLoadingAnimation";
import CollapsibleFilterSection from "../components/CollapsibleFilterSection";
import { Receipt as FirebaseReceipt } from "../services/firebaseService";

export const ReceiptsListScreen: React.FC = () => {
  const { theme } = useTheme();
  const navigation = useReceiptsNavigation();
  const { subscription, getRemainingReceipts, currentReceiptCount } =
    useSubscription();
  const { handleSubscriptionWithCloudFunction } = useStripePayments();
  const { user } = useAuth();
  const { showError, showSuccess, showWarning, showFirebaseError, hideAlert } =
    useCustomAlert();
  const [isUpgrading, setIsUpgrading] = useState(false);

  // Sync status from global sync hook
  const { syncing, syncError } = useReceiptSync();
  // Receipt type is imported from firebaseService

  // State for receipts and loading
  const [receipts, setReceipts] = useState<Array<FirebaseReceipt>>([]);
  const [filteredReceipts, setFilteredReceipts] = useState<
    Array<FirebaseReceipt>
  >([]);
  const [activeReceiptCount, setActiveReceiptCount] = useState(0);
  const [historicalUsage, setHistoricalUsage] = useState<
    { month: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(
    new Set()
  );
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [isUpgradePromptDismissed, setIsUpgradePromptDismissed] =
    useState(false);
  const [isLimitReachedPromptDismissed, setIsLimitReachedPromptDismissed] =
    useState(false);
  const [groupByDate, setGroupByDate] = useState(true); // New state for grouping
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null); // Category filter
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<{
    startDate: Date | null;
    endDate: Date | null;
    active: boolean;
  }>({
    startDate: null,
    endDate: null,
    active: false,
  });
  const [datePickerMode, setDatePickerMode] = useState<"start" | "end">(
    "start"
  );

  // Quick filter categories
  const quickFilters = [
    "Food",
    "Transportation",
    "Office",
    "Entertainment",
    "Healthcare",
  ];

  // Quick date range filters
  const quickDateFilters = [
    { label: "Today", days: 0 },
    { label: "Last 7 Days", days: 7 },
    { label: "Last 30 Days", days: 30 },
    { label: "Last 90 Days", days: 90 },
  ];

  // Ref for the main SectionList
  const sectionListRef = useRef<SectionList>(null);
  // Ref for the search input
  const searchInputRef = useRef<TextInput>(null);

  // Handle quick filter selection
  const handleQuickFilter = useCallback(
    (category: string) => {
      if (selectedFilter === category) {
        // Deselect filter
        setSelectedFilter(null);
        setFilteredReceipts(receipts);
        setSearchQuery("");
      } else {
        // Apply filter
        setSelectedFilter(category);
        setSearchQuery("");

        // Map filter names to actual categories
        const categoryMap: Record<string, string[]> = {
          Food: ["restaurant", "groceries"],
          Transportation: ["transportation", "travel"],
          Office: ["other"], // Office supplies might be categorized as "other"
          Entertainment: ["entertainment"],
          Healthcare: ["healthcare"],
        };

        const targetCategories = categoryMap[category] || [];

        const filtered = receipts.filter((receipt) => {
          const receiptCategory = receipt.category as string;
          return targetCategories.includes(receiptCategory);
        });

        setFilteredReceipts(filtered);
        // Close search UI when a filter is applied
        setShowSearch(false);
      }
    },
    [receipts, selectedFilter]
  );

  // Handle quick date filter selection
  const handleQuickDateFilter = useCallback((days: number) => {
    const endDate = new Date();
    const startDate =
      days === 0
        ? new Date()
        : new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    setDateRangeFilter({
      startDate,
      endDate,
      active: true,
    });
    setSelectedFilter(null); // Clear category filter
    setSearchQuery(""); // Clear search
    // Close search UI when date filter is applied
    setShowSearch(false);
  }, []);

  // Handle custom date range
  const handleDatePickerChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (selectedDate) {
        const newDateFilter = {
          ...dateRangeFilter,
          [datePickerMode === "start" ? "startDate" : "endDate"]: selectedDate,
          active: true,
        };
        setDateRangeFilter(newDateFilter);

        // Only close search UI when both dates are now selected
        if (newDateFilter.startDate && newDateFilter.endDate) {
          setShowSearch(false);
        }
      }
      setShowDatePicker(false);
    },
    [datePickerMode, dateRangeFilter]
  );

  // Clear date range filter
  const clearDateFilter = useCallback(() => {
    setDateRangeFilter({
      startDate: null,
      endDate: null,
      active: false,
    });
  }, []);

  // Format date for display
  const formatDate = useCallback((date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  }, []);

  // Group receipts by date using useMemo for performance
  const groupedReceipts = useMemo(() => {
    if (!groupByDate) {
      return [
        {
          title: "All Receipts",
          data: filteredReceipts,
        },
      ];
    }

    const groups = filteredReceipts.reduce<Record<string, FirebaseReceipt[]>>(
      (acc, receipt) => {
        const date = receipt.createdAt;
        const now = new Date();
        const today = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );
        const receiptDate = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate()
        );

        let groupKey: string;
        const diffTime = today.getTime() - receiptDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          groupKey = "Today";
        } else if (diffDays === 1) {
          groupKey = "Yesterday";
        } else if (diffDays < 7) {
          groupKey = "This Week";
        } else if (diffDays < 30) {
          groupKey = "This Month";
        } else if (date.getFullYear() === now.getFullYear()) {
          const monthNames = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
          ];
          groupKey = monthNames[date.getMonth()];
        } else {
          const monthNames = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];
          groupKey = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
        }

        if (!acc[groupKey]) {
          acc[groupKey] = [];
        }
        acc[groupKey].push(receipt);
        return acc;
      },
      {}
    );

    // Convert to section list format and sort
    const sections = Object.entries(groups)
      .map(([title, data]) => ({ title, data }))
      .sort((a, b) => {
        // Custom sorting logic for time-based groups
        const timeOrder = ["Today", "Yesterday", "This Week", "This Month"];
        const aIndex = timeOrder.indexOf(a.title);
        const bIndex = timeOrder.indexOf(b.title);

        if (aIndex !== -1 && bIndex !== -1) {
          return aIndex - bIndex;
        } else if (aIndex !== -1) {
          return -1;
        } else if (bIndex !== -1) {
          return 1;
        } else {
          // For month/year groups, sort by date
          return b.title.localeCompare(a.title);
        }
      });

    return sections;
  }, [filteredReceipts, groupByDate]);

  // Separate recent sections (Today, Yesterday, This Week) from the rest
  const recentSections = useMemo(() => {
    const recentKeys = ["Today", "Yesterday", "This Week"];
    return groupedReceipts.filter((section) =>
      recentKeys.includes(section.title)
    );
  }, [groupedReceipts]);

  const otherSections = useMemo(() => {
    const recentKeys = ["Today", "Yesterday", "This Week"];
    return groupedReceipts.filter(
      (section) => !recentKeys.includes(section.title)
    );
  }, [groupedReceipts]);

  // Handle scroll to section
  const scrollToSection = useCallback(
    (sectionTitle: string) => {
      if (!sectionListRef.current) return;

      const sectionIndex = groupedReceipts.findIndex(
        (section) => section.title === sectionTitle
      );
      if (
        sectionIndex !== -1 &&
        groupedReceipts[sectionIndex]?.data.length > 0
      ) {
        try {
          sectionListRef.current.scrollToLocation({
            sectionIndex,
            itemIndex: 0,
            animated: true,
            viewPosition: 0, // Position section header at the very top
            viewOffset: 77, // Small offset to account for any fixed headers
          });
        } catch (error) {
          console.log("Scroll to section failed:", error);
        }
      }
    },
    [groupedReceipts]
  );

  // Handle scroll to index failed
  const onScrollToIndexFailed = useCallback(
    (info: any) => {
      console.log("Scroll to index failed:", info);
      // Wait a bit and retry
      setTimeout(() => {
        if (sectionListRef.current && info.index < groupedReceipts.length) {
          try {
            sectionListRef.current.scrollToLocation({
              sectionIndex: info.index,
              itemIndex: 0,
              animated: true,
              viewPosition: 0,
              viewOffset: 80,
            });
          } catch (retryError) {
            console.log("Retry scroll failed:", retryError);
          }
        }
      }, 100);
    },
    [groupedReceipts]
  );

  const fetchReceipts = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      let receiptDocs;

      // First try the optimized query with indexes
      try {
        // Get displayed receipts (not deleted) with ordering
        const receiptsQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("status", "!=", "deleted"),
          orderBy("createdAt", "desc")
        );
        const receiptsSnapshot = await getDocs(receiptsQuery);
        receiptDocs = receiptsSnapshot.docs;
      } catch (error: any) {
        // If we get an index error, fall back to the basic query
        if (error?.message?.includes("requires an index")) {
          console.log("Index not ready, falling back to basic query...");
          showWarning(
            "Loading Receipts",
            "First-time setup in progress. Your receipts will be available shortly."
          );

          // Get all receipts and sort them in memory
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
        } else {
          throw error; // Re-throw if it's not an index error
        }
      }

      // Convert the docs to receipt data
      const receiptData = receiptDocs.map((doc) => {
        const data = doc.data();
        // Normalize Firestore Timestamp to JS Date
        const createdAt =
          data.createdAt instanceof Date
            ? data.createdAt
            : data.createdAt?.toDate?.() || new Date();
        const updatedAt =
          data.updatedAt instanceof Date
            ? data.updatedAt
            : data.updatedAt?.toDate?.() || new Date();
        const date =
          data.date instanceof Date
            ? data.date
            : data.date?.toDate?.() || new Date();
        return {
          ...data,
          receiptId: data.receiptId || doc.id,
          createdAt,
          updatedAt,
          date,
        };
      }) as FirebaseReceipt[];

      // Get monthly usage count using our utility function
      const monthlyCount = await getMonthlyReceiptCount(user.uid);
      console.log("🚀 ~ ReceiptsListScreen ~ monthlyCount:", monthlyCount);
      console.log("Monthly usage count (including deleted):", monthlyCount);

      // Get historical usage (last 6 months)
      let historicalDocs;
      try {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // Try optimized historical query first
        const historicalQuery = query(
          collection(db, "receipts"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", sixMonthsAgo),
          orderBy("createdAt", "desc")
        );
        const historicalSnapshot = await getDocs(historicalQuery);
        historicalDocs = historicalSnapshot.docs;
      } catch (error: any) {
        if (error?.message?.includes("requires an index")) {
          console.log("Historical index not ready, using basic query...");
          // Fall back to basic query and filter/sort in memory
          const basicHistoricalQuery = query(
            collection(db, "receipts"),
            where("userId", "==", user.uid)
          );
          const basicSnapshot = await getDocs(basicHistoricalQuery);
          const sixMonthsAgo = new Date();
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

          historicalDocs = basicSnapshot.docs
            .filter((doc) => {
              const createdAt = doc.data().createdAt?.toDate?.();
              return createdAt && createdAt >= sixMonthsAgo;
            })
            .sort((a, b) => {
              const aDate = a.data().createdAt?.toDate?.() || new Date(0);
              const bDate = b.data().createdAt?.toDate?.() || new Date(0);
              return bDate.getTime() - aDate.getTime();
            });
        } else {
          throw error;
        }
      }
      const historicalData = historicalDocs.reduce<Record<string, number>>(
        (acc, doc) => {
          const data = doc.data();
          const createdAt = data.createdAt?.toDate();
          if (!createdAt) {
            console.warn("Receipt missing createdAt:", doc.id);
            return acc;
          }

          const monthKey = `${createdAt.getFullYear()}-${String(
            createdAt.getMonth() + 1
          ).padStart(2, "0")}`;
          acc[monthKey] = (acc[monthKey] || 0) + 1;
          return acc;
        },
        {}
      );

      const historicalUsageData = Object.entries(historicalData)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => b.month.localeCompare(a.month));

      console.log("📝 Receipt Data:", {
        activeCount: receiptData.length,
        monthlyUsageCount: monthlyCount,
        historical: historicalUsageData,
        receipts: receiptData.map((r) => ({
          receiptId: r.receiptId,
          date: r.date,
          status: r.status,
          vendor: r.vendor,
          businessName: (r as any).businessName,
          type: (r as any).type,
        })),
      });

      // Update all states
      setReceipts(receiptData);
      setFilteredReceipts(receiptData);
      setActiveReceiptCount(receiptData.length);
      setHistoricalUsage(historicalUsageData);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      setReceipts([]);
      setFilteredReceipts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.uid]);

  // Focus effect to fetch receipts when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log("Screen focused, fetching receipts...");
      fetchReceipts();

      // Validate filters when returning to screen
      // If we have filter badges but no filtered results, clear the filters
      setTimeout(() => {
        const hasActiveFilters =
          searchQuery || selectedFilter || dateRangeFilter.active;
        if (
          hasActiveFilters &&
          filteredReceipts.length === 0 &&
          receipts.length > 0
        ) {
          console.log("Clearing stale filters - no results found");
          setSearchQuery("");
          setSelectedFilter(null);
          setDateRangeFilter({
            startDate: null,
            endDate: null,
            active: false,
          });
        }
      }, 500); // Small delay to ensure receipts are loaded
    }, [fetchReceipts]) // Only depend on fetchReceipts to avoid re-running on filter changes
  );

  // Comprehensive filter function that applies all filters
  const applyAllFilters = useCallback(() => {
    let filtered = receipts;

    // Apply search filter
    if (searchQuery.trim()) {
      const searchTerms = searchQuery.toLowerCase().trim().split(" ");
      filtered = filtered.filter((receipt) => {
        const searchFields = [
          receipt.vendor || "",
          (receipt as any).businessName || "",
          receipt.description || "",
          receipt.amount?.toString() || "",
          receipt.category || "",
          ReceiptCategoryService.getCategoryDisplayName(
            receipt.category as any
          ) || "",
          receipt.date?.toLocaleDateString() || "",
          receipt.createdAt?.toLocaleDateString() || "",
        ].map((field) => field.toLowerCase());

        return searchTerms.every((term) =>
          searchFields.some((field) => field.includes(term))
        );
      });
    }

    // Apply category filter
    if (selectedFilter) {
      // Map filter names to actual categories
      const categoryMap: Record<string, string[]> = {
        Food: ["restaurant", "groceries"],
        Transportation: ["transportation", "travel"],
        Office: ["other"], // Office supplies might be categorized as "other"
        Entertainment: ["entertainment"],
        Healthcare: ["healthcare"],
      };

      const targetCategories = categoryMap[selectedFilter] || [];

      filtered = filtered.filter((receipt) => {
        const receiptCategory = receipt.category as string;
        return targetCategories.includes(receiptCategory);
      });
    }

    // Apply date range filter
    if (
      dateRangeFilter.active &&
      (dateRangeFilter.startDate || dateRangeFilter.endDate)
    ) {
      filtered = filtered.filter((receipt) => {
        const receiptDate = receipt.createdAt;
        let inRange = true;

        if (dateRangeFilter.startDate) {
          const startOfDay = new Date(dateRangeFilter.startDate);
          startOfDay.setHours(0, 0, 0, 0);
          inRange = inRange && receiptDate >= startOfDay;
        }

        if (dateRangeFilter.endDate) {
          const endOfDay = new Date(dateRangeFilter.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          inRange = inRange && receiptDate <= endOfDay;
        }

        return inRange;
      });
    }

    setFilteredReceipts(filtered);
  }, [receipts, searchQuery, selectedFilter, dateRangeFilter]);

  // Filter receipts based on search query
  const filterReceipts = useCallback(
    (query: string) => {
      if (!query.trim()) {
        setFilteredReceipts(receipts);
        return;
      }

      const searchTerms = query.toLowerCase().trim().split(" ");
      const filtered = receipts.filter((receipt) => {
        const searchFields = [
          receipt.vendor || "",
          (receipt as any).businessName || "",
          receipt.description || "",
          receipt.amount?.toString() || "",
          receipt.category || "",
          ReceiptCategoryService.getCategoryDisplayName(
            receipt.category as any
          ) || "",
          receipt.date?.toLocaleDateString() || "",
          receipt.createdAt?.toLocaleDateString() || "",
        ].map((field) => field.toLowerCase());

        // Check if all search terms are found in any of the fields
        return searchTerms.every((term) =>
          searchFields.some((field) => field.includes(term))
        );
      });

      setFilteredReceipts(filtered);
    },
    [receipts]
  );

  // Handle search query changes
  const handleSearchChange = useCallback(
    (query: string) => {
      setSearchQuery(query);
      setSelectedFilter(null); // Clear category filter when searching
      clearDateFilter(); // Clear date filter when searching
    },
    [clearDateFilter]
  );

  // Apply all filters when any filter changes
  useEffect(() => {
    applyAllFilters();
  }, [applyAllFilters]);

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReceipts();
  }, [fetchReceipts]);

  // Reset search when receipts update
  React.useEffect(() => {
    if (searchQuery) {
      filterReceipts(searchQuery);
    } else {
      setFilteredReceipts(receipts);
    }
  }, [receipts, searchQuery, filterReceipts]);

  // Render receipt item for FlatList
  const renderReceiptItem = ({ item: receipt }: { item: FirebaseReceipt }) => (
    <TouchableOpacity
      onPress={() => {
        if (isSelectionMode) {
          const newSelected = new Set(selectedReceipts);
          if (newSelected.has(receipt.receiptId)) {
            newSelected.delete(receipt.receiptId);
          } else {
            newSelected.add(receipt.receiptId);
          }
          setSelectedReceipts(newSelected);
        } else {
          // Get the image URL or PDF path from the receipt
          const imageUrl = receipt.images?.[0]?.url || "";
          const pdfPath = (receipt as any).pdfPath || "";
          const pdfUrl = (receipt as any).pdfUrl || "";

          // For PDF receipts, use businessName as vendor, otherwise use vendor field
          const vendor =
            (receipt as any).businessName || receipt.vendor || "Unknown Vendor";

          // Convert the local receipt format to the format expected by EditReceipt
          const firebaseReceipt: FirebaseReceipt = {
            receiptId: receipt.receiptId,
            userId: receipt.userId,
            vendor: vendor,
            amount: receipt.amount || 0,
            currency: "USD", // Default currency
            date: receipt.date,
            description: "", // Default description
            category: receipt.category || "business_expense",
            subcategory: "",
            tags: [],
            images: imageUrl
              ? [
                  {
                    url: imageUrl,
                    size: 0,
                    uploadedAt: receipt.createdAt,
                  },
                ]
              : [],
            tax: {
              deductible: (receipt as any).tax?.deductible ?? true,
              deductionPercentage:
                (receipt as any).tax?.deductionPercentage ?? 100,
              taxYear:
                (receipt as any).tax?.taxYear ?? new Date().getFullYear(),
              category: (receipt as any).tax?.category ?? "business",
            },
            status: "processed" as const,
            processingErrors: [],
            createdAt: receipt.createdAt,
            updatedAt: receipt.updatedAt,
            // Add PDF fields for EditReceipt to handle
            ...(pdfPath && { pdfPath, pdfUrl, type: "pdf" }),
            // Pass through metadata for regeneration logic
            metadata: (receipt as any).metadata,
          };

          navigation.navigate("EditReceipt", {
            receipt: firebaseReceipt as any,
          });
        }
      }}
      onLongPress={() => {
        if (!isSelectionMode) {
          setIsSelectionMode(true);
          setSelectedReceipts(new Set([receipt.receiptId]));
        }
      }}
      style={[
        styles.receiptCard,
        {
          backgroundColor: theme.background.secondary,
          borderColor: selectedReceipts.has(receipt.receiptId)
            ? theme.gold.primary
            : theme.border.primary,
          borderWidth: selectedReceipts.has(receipt.receiptId) ? 2 : 1,
        },
      ]}
    >
      {isSelectionMode && (
        <View style={[styles.checkbox, { borderColor: theme.border.primary }]}>
          {selectedReceipts.has(receipt.receiptId) && (
            <View
              style={[
                styles.checkboxInner,
                { backgroundColor: theme.gold.primary },
              ]}
            />
          )}
        </View>
      )}
      <View style={styles.receiptContent}>
        <View style={styles.receiptHeader}>
          <Text style={[styles.receiptName, { color: theme.text.primary }]}>
            {receipt.createdAt.toLocaleDateString()}
          </Text>
          <Text style={[styles.receiptAmount, { color: theme.gold.primary }]}>
            {formatCurrency(receipt.amount)}
          </Text>
        </View>
        <View style={styles.receiptDetails}>
          <Text
            style={[styles.receiptCategory, { color: theme.text.secondary }]}
          >
            {receipt.category
              ? ReceiptCategoryService.getCategoryDisplayName(
                  receipt.category as any
                )
              : "Uncategorized"}
          </Text>
          <Text style={[styles.receiptDate, { color: theme.text.tertiary }]}>
            {(receipt as any).businessName ||
              receipt.vendor ||
              "Unknown Vendor"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render header component for FlatList
  const ListHeaderComponent = () => {
    const maxReceipts = subscription?.limits?.maxReceipts || 10;
    const remainingReceipts = getRemainingReceipts(currentReceiptCount);

    return (
      <View
        style={[
          styles.usageCard,
          {
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
            marginBottom: 16,
          },
        ]}
      >
        {refreshing ? (
          <ActivityIndicator size="small" color={theme.gold.primary} />
        ) : (
          <>
            <View style={styles.usageRow}>
              <View style={styles.usageColumn}>
                <Text
                  style={[styles.usageLabel, { color: theme.text.tertiary }]}
                >
                  Active Receipts
                </Text>
                <Text
                  style={[styles.usageValue, { color: theme.text.primary }]}
                >
                  {activeReceiptCount}
                </Text>
              </View>
              <View style={styles.usageColumn}>
                <Text
                  style={[styles.usageLabel, { color: theme.text.tertiary }]}
                >
                  {subscription?.currentTier === "free"
                    ? "Total Usage (includes deleted)"
                    : "Monthly Usage (includes deleted)"}
                </Text>
                <Text
                  style={[styles.usageValue, { color: theme.text.primary }]}
                >
                  {maxReceipts === -1
                    ? currentReceiptCount
                    : `${currentReceiptCount} / ${maxReceipts}`}
                </Text>
              </View>
            </View>

            <View style={styles.usageDivider} />

            <View style={styles.usageInfo}>
              {subscription?.currentTier !== "free" && maxReceipts !== -1 && (
                <Text
                  style={[styles.usageLabel, { color: theme.text.tertiary }]}
                >
                  Limit resets on{" "}
                  {subscription?.billing?.currentPeriodEnd?.toLocaleDateString() ||
                    "N/A"}
                </Text>
              )}

              {maxReceipts !== -1 && remainingReceipts <= 2 && (
                <Text
                  style={[styles.warningText, { color: theme.status.warning }]}
                >
                  {remainingReceipts}{" "}
                  {remainingReceipts === 1 ? "receipt" : "receipts"} remaining
                  this month
                </Text>
              )}
            </View>

            {historicalUsage.filter(
              ({ month }) => month !== new Date().toISOString().slice(0, 7)
            ).length > 0 && (
              <View style={styles.historicalUsage}>
                <Text
                  style={[
                    styles.usageLabel,
                    { color: theme.text.tertiary, marginBottom: 8 },
                  ]}
                >
                  Previous Months
                </Text>
                {historicalUsage
                  .filter(({ month }) => {
                    // Filter out the current month
                    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                    return month !== currentMonth;
                  })
                  .slice(0, 3)
                  .map(({ month, count }) => {
                    const [year, monthNum] = month.split("-");
                    const displayDate = new Date(
                      parseInt(year),
                      parseInt(monthNum) - 1,
                      1
                    );
                    return (
                      <View key={month} style={styles.historicalRow}>
                        <Text
                          style={[
                            styles.historicalMonth,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {displayDate.toLocaleDateString(undefined, {
                            month: "long",
                            year: "numeric",
                          })}
                        </Text>
                        <Text
                          style={[
                            styles.historicalCount,
                            { color: theme.text.primary },
                          ]}
                        >
                          {count} receipts
                        </Text>
                      </View>
                    );
                  })}
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  // Render empty state
  const ListEmptyComponent = () => {
    const hasAnyFilter =
      searchQuery || selectedFilter || dateRangeFilter.active;
    const hasReceipts = receipts.length > 0;

    // If user has receipts but no results due to filters
    if (hasReceipts && hasAnyFilter) {
      return (
        <View style={styles.emptyState}>
          <Ionicons
            name="search-outline"
            size={64}
            color={theme.text.tertiary}
          />
          <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
            No matching receipts
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
            {searchQuery && `No receipts match "${searchQuery}"`}
            {selectedFilter &&
              !searchQuery &&
              `No ${selectedFilter.toLowerCase()} receipts found`}
            {dateRangeFilter.active &&
              !searchQuery &&
              !selectedFilter &&
              `No receipts found for selected date range`}
            {searchQuery &&
              selectedFilter &&
              ` in ${selectedFilter.toLowerCase()} category`}
            {searchQuery && dateRangeFilter.active && ` in selected date range`}
          </Text>
          <Text
            style={[
              styles.emptySubtitle,
              { color: theme.text.tertiary, marginTop: 8 },
            ]}
          >
            Try adjusting your filters to see more results
          </Text>
        </View>
      );
    }

    // If user has no receipts at all
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name="receipt-outline"
          size={64}
          color={theme.text.tertiary}
        />
        <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
          No receipts yet
        </Text>
        <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
          Start by scanning your first receipt!
        </Text>
      </View>
    );
  };

  const handleUpgrade = async () => {
    if (!user) return;

    setIsUpgrading(true);
    try {
      const success = await handleSubscriptionWithCloudFunction(
        "starter",
        user.email || "",
        user.displayName || "User"
      );

      if (!success) {
        showError("Error", "Failed to process payment. Please try again.");
      }
    } catch (error) {
      console.error("Failed to upgrade subscription:", error);
      showError(
        "Error",
        "Failed to process payment. Please check your payment details and try again."
      );
    } finally {
      setIsUpgrading(false);
    }
  };

  const maxReceipts = subscription?.limits?.maxReceipts || 10;
  const remainingReceipts = getRemainingReceipts(currentReceiptCount);

  // Show loading animation when initially loading receipts (but not when refreshing)
  if (loading && !refreshing) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.background.primary },
        ]}
      >
        <ReceiptsLoadingAnimation />

        {/* Floating Action Button - Always Visible */}
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: theme.gold.primary,
              shadowColor: theme.text.primary,
              opacity: 0.7, // Slightly dimmed during loading
            },
          ]}
          onPress={() => {
            // Check again right before navigation
            const maxReceipts = subscription?.limits?.maxReceipts || 10;
            if (
              checkReceiptLimit(currentReceiptCount, maxReceipts, handleUpgrade)
            ) {
              navigation.navigate("ScanReceipt");
            }
          }}
        >
          <Ionicons name="camera" size={28} color="white" />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Sync status banner
  const SyncBanner = () => {
    if (syncing) {
      return (
        <View
          style={{
            width: "100%",
            backgroundColor: theme.gold.primary,
            padding: 8,
          }}
        >
          <Text
            style={{
              color: theme.text.primary,
              textAlign: "center",
              fontWeight: "bold",
            }}
          >
            Syncing receipts...
          </Text>
        </View>
      );
    }
    if (syncError) {
      return (
        <View style={{ width: "100%", backgroundColor: "#FF4D4F", padding: 8 }}>
          <Text
            style={{ color: "#fff", textAlign: "center", fontWeight: "bold" }}
          >
            {syncError}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <View style={styles.content}>
        {/* Header with title and controls */}
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <View style={styles.titleSection}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                My Receipts
              </Text>
              {/* Active Filter Badges */}
              {!showSearch &&
                (selectedFilter || searchQuery || dateRangeFilter.active) && (
                  <View style={styles.activeFilterBadges}>
                    {selectedFilter && (
                      <View
                        style={[
                          styles.filterBadge,
                          { backgroundColor: theme.gold.primary },
                        ]}
                      >
                        <Text style={styles.filterBadgeText}>
                          {selectedFilter}
                        </Text>
                        <TouchableOpacity
                          onPress={() => setSelectedFilter(null)}
                          style={styles.filterBadgeClose}
                        >
                          <Ionicons name="close" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    )}
                    {searchQuery && (
                      <View
                        style={[
                          styles.filterBadge,
                          { backgroundColor: theme.gold.rich },
                        ]}
                      >
                        <Text style={styles.filterBadgeText}>
                          "{searchQuery}"
                        </Text>
                        <TouchableOpacity
                          onPress={() => setSearchQuery("")}
                          style={styles.filterBadgeClose}
                        >
                          <Ionicons name="close" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    )}
                    {dateRangeFilter.active && (
                      <View
                        style={[
                          styles.filterBadge,
                          { backgroundColor: theme.status.success },
                        ]}
                      >
                        <Text style={styles.filterBadgeText}>
                          {dateRangeFilter.startDate && dateRangeFilter.endDate
                            ? `${formatDate(
                                dateRangeFilter.startDate
                              )} - ${formatDate(dateRangeFilter.endDate)}`
                            : "Date Range"}
                        </Text>
                        <TouchableOpacity
                          onPress={clearDateFilter}
                          style={styles.filterBadgeClose}
                        >
                          <Ionicons name="close" size={18} color="white" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
            </View>
            <View style={styles.headerControls}>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setShowSearch(!showSearch)}
              >
                <Ionicons
                  name={showSearch ? "close" : "search"}
                  size={24}
                  color={theme.text.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchButton}
                onPress={() => setGroupByDate(!groupByDate)}
              >
                <Ionicons
                  name={groupByDate ? "list-outline" : "calendar-outline"}
                  size={24}
                  color={groupByDate ? theme.gold.primary : theme.text.primary}
                />
              </TouchableOpacity>
              {filteredReceipts.length > 0 && (
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => {
                    setIsSelectionMode(!isSelectionMode);
                    setSelectedReceipts(new Set());
                  }}
                >
                  <Text
                    style={[
                      styles.selectButtonText,
                      { color: theme.gold.primary },
                    ]}
                  >
                    {isSelectionMode ? "Cancel" : "Select"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Compact Search and Filters */}
          {showSearch && (
            <TouchableWithoutFeedback
              onPress={() => {
                Keyboard.dismiss();
                searchInputRef.current?.blur();
              }}
            >
              <View
                style={[
                  styles.compactSearchContainer,
                  { backgroundColor: theme.background.secondary },
                ]}
              >
                {/* Search Input */}
                <TouchableWithoutFeedback
                  onPress={() => searchInputRef.current?.focus()}
                >
                  <View
                    style={[
                      styles.searchInputContainer,
                      {
                        backgroundColor: theme.background.primary,
                        borderColor: theme.border.primary,
                      },
                    ]}
                  >
                    <Ionicons
                      name="search"
                      size={18}
                      color={theme.text.tertiary}
                    />
                    <TextInput
                      ref={searchInputRef}
                      style={[
                        styles.searchInput,
                        { color: theme.text.primary },
                      ]}
                      placeholder="Search receipts..."
                      placeholderTextColor={theme.text.tertiary}
                      value={searchQuery}
                      onChangeText={handleSearchChange}
                      onSubmitEditing={() => setShowSearch(false)}
                      onBlur={() => Keyboard.dismiss()}
                      returnKeyType="done"
                      autoFocus={false}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => handleSearchChange("")}>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color={theme.text.tertiary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableWithoutFeedback>

                <CollapsibleFilterSection
                  title="Date Range"
                  defaultExpanded={false}
                  iconColor={theme.text.primary}
                  headerBackgroundColor={theme.background.secondary}
                  contentBackgroundColor={theme.background.primary}
                  titleColor={theme.text.primary}
                  shadowColor={theme.text.primary}
                >
                  {/* Quick Date Buttons - Horizontal Scroll */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.quickDateScroll}
                    contentContainerStyle={styles.quickDateScrollContent}
                  >
                    {quickDateFilters.map((filter) => (
                      <TouchableOpacity
                        key={filter.label}
                        style={[
                          styles.quickDateChip,
                          {
                            backgroundColor: theme.background.secondary,
                            borderColor: theme.border.primary,
                          },
                        ]}
                        onPress={() => handleQuickDateFilter(filter.days)}
                      >
                        <Text
                          style={[
                            styles.quickDateChipText,
                            { color: theme.text.secondary },
                          ]}
                        >
                          {filter.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Custom Date Range Row */}
                  <View style={styles.customDateRow}>
                    <TouchableOpacity
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: theme.background.secondary,
                          borderColor: theme.border.primary,
                        },
                      ]}
                      onPress={() => {
                        setDatePickerMode("start");
                        setShowDatePicker(true);
                      }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={theme.text.secondary}
                      />
                      <Text
                        style={[
                          styles.dateButtonText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {dateRangeFilter.startDate
                          ? formatDate(dateRangeFilter.startDate)
                          : "From"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.dateButton,
                        {
                          backgroundColor: theme.background.secondary,
                          borderColor: theme.border.primary,
                        },
                      ]}
                      onPress={() => {
                        setDatePickerMode("end");
                        setShowDatePicker(true);
                      }}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={theme.text.secondary}
                      />
                      <Text
                        style={[
                          styles.dateButtonText,
                          { color: theme.text.primary },
                        ]}
                      >
                        {dateRangeFilter.endDate
                          ? formatDate(dateRangeFilter.endDate)
                          : "To"}
                      </Text>
                    </TouchableOpacity>

                    {dateRangeFilter.active && (
                      <TouchableOpacity
                        style={[
                          styles.clearDateButton,
                          { backgroundColor: theme.status.error },
                        ]}
                        onPress={clearDateFilter}
                      >
                        <Ionicons name="close" size={12} color="white" />
                      </TouchableOpacity>
                    )}
                  </View>
                </CollapsibleFilterSection>

                {/* Filter Sections */}
                <CollapsibleFilterSection
                  title="Category Filters"
                  defaultExpanded={false}
                  iconColor={theme.text.primary}
                  headerBackgroundColor={theme.background.secondary}
                  contentBackgroundColor={theme.background.primary}
                  titleColor={theme.text.primary}
                  shadowColor={theme.text.primary}
                >
                  <View style={styles.categoryChips}>
                    {quickFilters.map((filter) => (
                      <TouchableOpacity
                        key={filter}
                        style={[
                          styles.categoryChip,
                          {
                            backgroundColor:
                              selectedFilter === filter
                                ? theme.gold.primary
                                : theme.background.primary,
                            borderColor:
                              selectedFilter === filter
                                ? theme.gold.primary
                                : theme.border.primary,
                          },
                        ]}
                        onPress={() => handleQuickFilter(filter)}
                      >
                        <Text
                          style={[
                            styles.categoryChipText,
                            {
                              color:
                                selectedFilter === filter
                                  ? "white"
                                  : theme.text.secondary,
                            },
                          ]}
                        >
                          {filter}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </CollapsibleFilterSection>

                {/* Results Summary */}
                {(searchQuery || selectedFilter || dateRangeFilter.active) && (
                  <View
                    style={[
                      styles.resultsSummary,
                      { backgroundColor: theme.background.tertiary },
                    ]}
                  >
                    <Text
                      style={[
                        styles.resultsSummaryText,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {filteredReceipts.length}{" "}
                      {filteredReceipts.length === 1 ? "receipt" : "receipts"}
                      {dateRangeFilter.active &&
                        dateRangeFilter.startDate &&
                        dateRangeFilter.endDate &&
                        ` • ${formatDate(
                          dateRangeFilter.startDate
                        )} - ${formatDate(dateRangeFilter.endDate)}`}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableWithoutFeedback>
          )}

          {/* Date Picker Modal */}
          {showDatePicker && (
            <DateTimePicker
              value={
                (datePickerMode === "start"
                  ? dateRangeFilter.startDate
                  : dateRangeFilter.endDate) || new Date()
              }
              mode="date"
              display="default"
              onChange={handleDatePickerChange}
            />
          )}

          {/* Recent Receipts Quick Access - Only show when no filters are active */}
          {groupByDate &&
            recentSections.length > 0 &&
            !searchQuery &&
            !selectedFilter &&
            !dateRangeFilter.active && (
              <View style={styles.recentReceiptsContainer}>
                <Text
                  style={[
                    styles.recentReceiptsTitle,
                    { color: theme.text.primary },
                  ]}
                >
                  Recent
                </Text>
                <View style={styles.recentSections}>
                  {recentSections.map((section) => (
                    <TouchableOpacity
                      key={section.title}
                      style={[
                        styles.recentSectionCard,
                        {
                          backgroundColor: theme.background.secondary,
                          borderColor: theme.border.primary,
                        },
                      ]}
                      onPress={() => scrollToSection(section.title)}
                    >
                      <Text
                        style={[
                          styles.recentSectionTitle,
                          { color: theme.text.primary },
                        ]}
                      >
                        {section.title}
                      </Text>
                      <Text
                        style={[
                          styles.recentSectionCount,
                          { color: theme.text.secondary },
                        ]}
                      >
                        {section.data.length}{" "}
                        {section.data.length === 1 ? "receipt" : "receipts"}
                      </Text>
                      {section.data.length > 0 && (
                        <Text
                          style={[
                            styles.recentSectionAmount,
                            { color: theme.gold.primary },
                          ]}
                          numberOfLines={1}
                          adjustsFontSizeToFit={true}
                          minimumFontScale={0.8}
                        >
                          {formatCurrency(
                            section.data.reduce(
                              (sum, receipt) => sum + (receipt.amount || 0),
                              0
                            )
                          )}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <Text
                  style={[
                    styles.recentSectionNote,
                    { color: theme.text.tertiary },
                  ]}
                >
                  Tap cards to jump to sections below
                </Text>
              </View>
            )}

          {/* Selection Bar */}
          {isSelectionMode && selectedReceipts.size > 0 && (
            <View style={styles.selectionBar}>
              <Text
                style={[styles.selectionText, { color: theme.text.primary }]}
              >
                {selectedReceipts.size} selected
              </Text>
              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  { backgroundColor: theme.status.error },
                ]}
                onPress={() => {
                  const handleDelete = async () => {
                    try {
                      setLoading(true);
                      const deletePromises = Array.from(selectedReceipts).map(
                        (id) => deleteReceiptAndImage(id)
                      );
                      await Promise.all(deletePromises);
                      setSelectedReceipts(new Set());
                      setIsSelectionMode(false);
                      fetchReceipts();
                      hideAlert(); // Dismiss the alert after successful deletion
                    } catch (error) {
                      console.error("Error deleting receipts:", error);
                      hideAlert(); // Dismiss the confirmation alert first
                      showError(
                        "Error",
                        "Failed to delete some receipts. Please try again."
                      );
                    } finally {
                      setLoading(false);
                    }
                  };

                  showWarning(
                    "Delete Receipts",
                    `Are you sure you want to delete ${
                      selectedReceipts.size
                    } receipt${
                      selectedReceipts.size === 1 ? "" : "s"
                    }? This action cannot be undone.`,
                    {
                      primaryButtonText: "Delete",
                      secondaryButtonText: "Cancel",
                      onPrimaryPress: handleDelete,
                    }
                  );
                }}
              >
                <Ionicons name="trash-outline" size={20} color="white" />
                <Text style={styles.deleteButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Receipts List - Conditional rendering based on grouping */}
        {groupByDate ? (
          <SectionList
            ref={sectionListRef}
            sections={groupedReceipts.map((section) => ({
              ...section,
              data: [
                ...section.data,
                // Add prompts to the last section only
                ...(section === groupedReceipts[groupedReceipts.length - 1]
                  ? [
                      // Add limit reached prompt for users who have reached their limit
                      ...(remainingReceipts === 0 &&
                      !isLimitReachedPromptDismissed
                        ? [{ isLimitReachedPrompt: true }]
                        : []),
                      // Add upgrade prompt as last item for free users with remaining receipts
                      ...(subscription?.currentTier === "free" &&
                      remainingReceipts > 0 &&
                      !isUpgradePromptDismissed
                        ? [{ isUpgradePrompt: true }]
                        : []),
                    ]
                  : []),
              ],
            }))}
            renderItem={({ item }) => {
              // Check if this is the limit reached prompt item
              if ("isLimitReachedPrompt" in item) {
                return (
                  <View
                    style={[
                      styles.limitReachedPromptCard,
                      {
                        backgroundColor: theme.background.secondary,
                        borderColor: theme.border.primary,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.limitReachedPromptClose}
                      onPress={() => setIsLimitReachedPromptDismissed(true)}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>
                    <View style={styles.limitReachedPromptIcon}>
                      <Ionicons name="warning" size={48} color="#ff6b35" />
                    </View>
                    <Text
                      style={[
                        styles.limitReachedPromptTitle,
                        { color: "#ff6b35" },
                      ]}
                    >
                      🚫 Monthly Limit Reached
                    </Text>
                    <Text
                      style={[
                        styles.limitReachedPromptDescription,
                        { color: theme.text.secondary },
                      ]}
                    >
                      You've used all your receipts for this month. Upgrade your
                      plan for unlimited storage or wait until next month.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.limitReachedPromptButton,
                        {
                          backgroundColor: "#ff6b35",
                        },
                      ]}
                      onPress={async () => {
                        setIsUpgrading(true);
                        try {
                          const success =
                            await handleSubscriptionWithCloudFunction(
                              "growth",
                              user?.email || "",
                              user?.displayName || "User"
                            );
                          if (!success) {
                            showError(
                              "Error",
                              "Failed to process payment. Please try again."
                            );
                          }
                        } finally {
                          setIsUpgrading(false);
                        }
                      }}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.limitReachedPromptButtonText}>
                          Upgrade Now
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }
              // Check if this is the upgrade prompt item
              if ("isUpgradePrompt" in item) {
                return (
                  <View
                    style={[
                      styles.upgradePromptCard,
                      {
                        backgroundColor: theme.gold.background,
                        borderColor: theme.gold.primary,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.upgradePromptClose}
                      onPress={() => setIsUpgradePromptDismissed(true)}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>

                    <View style={styles.upgradePromptIcon}>
                      <Ionicons
                        name="sparkles"
                        size={24}
                        color={theme.gold.primary}
                      />
                    </View>

                    <Text
                      style={[
                        styles.upgradePromptTitle,
                        { color: theme.gold.primary },
                      ]}
                    >
                      ✨ Unlock More Receipts
                    </Text>

                    <Text
                      style={[
                        styles.upgradePromptDescription,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Get 50 receipts per month with our Starter Plan. Never
                      worry about running out of space for your receipts again!
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.upgradePromptButton,
                        {
                          backgroundColor: theme.gold.primary,
                          opacity: isUpgrading ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleUpgrade}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="arrow-up"
                            size={16}
                            color="white"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.upgradePromptButtonText}>
                            Upgrade Now
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }

              // Regular receipt item
              const receipt = item as FirebaseReceipt;
              return renderReceiptItem({ item: receipt });
            }}
            renderSectionHeader={({ section: { title } }) => (
              <View
                style={[
                  styles.sectionHeader,
                  { backgroundColor: theme.background.primary },
                ]}
              >
                <Text
                  style={[
                    styles.sectionHeaderText,
                    { color: theme.text.primary },
                  ]}
                >
                  {title}
                </Text>
              </View>
            )}
            keyExtractor={(item, index) => {
              if ("isLimitReachedPrompt" in item) return "limit-reached-prompt";
              if ("isUpgradePrompt" in item) return "upgrade-prompt";
              return (item as FirebaseReceipt).receiptId || index.toString();
            }}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.gold.primary}
                colors={[theme.gold.primary]}
              />
            }
            contentContainerStyle={{
              paddingBottom: 100,
            }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            onScrollToIndexFailed={onScrollToIndexFailed}
            getItemLayout={(data, index) => {
              // Provide approximate layout for better scroll performance
              const ITEM_HEIGHT = 100; // Approximate height of each receipt card
              const HEADER_HEIGHT = 50; // Approximate height of section headers
              return {
                length: ITEM_HEIGHT,
                offset:
                  ITEM_HEIGHT * index + HEADER_HEIGHT * Math.floor(index / 10), // Rough estimate
                index,
              };
            }}
          />
        ) : (
          <FlatList
            data={[
              ...filteredReceipts,
              // Add limit reached prompt for users who have reached their limit
              ...(remainingReceipts === 0 && !isLimitReachedPromptDismissed
                ? [{ isLimitReachedPrompt: true }]
                : []),
              // Add upgrade prompt as last item for free users with remaining receipts
              ...(subscription?.currentTier === "free" &&
              remainingReceipts > 0 &&
              !isUpgradePromptDismissed
                ? [{ isUpgradePrompt: true }]
                : []),
            ]}
            renderItem={({ item }) => {
              // Check if this is the limit reached prompt item
              if ("isLimitReachedPrompt" in item) {
                return (
                  <View
                    style={[
                      styles.limitReachedPromptCard,
                      {
                        backgroundColor: theme.background.secondary,
                        borderColor: theme.border.primary,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.limitReachedPromptClose}
                      onPress={() => setIsLimitReachedPromptDismissed(true)}
                    >
                      <Ionicons
                        name="close"
                        size={24}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>
                    <View style={styles.limitReachedPromptIcon}>
                      <Ionicons name="warning" size={48} color="#ff6b35" />
                    </View>
                    <Text
                      style={[
                        styles.limitReachedPromptTitle,
                        { color: "#ff6b35" },
                      ]}
                    >
                      🚫 Monthly Limit Reached
                    </Text>
                    <Text
                      style={[
                        styles.limitReachedPromptDescription,
                        { color: theme.text.secondary },
                      ]}
                    >
                      You've used all your receipts for this month. Upgrade your
                      plan for unlimited storage or wait until next month.
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.limitReachedPromptButton,
                        {
                          backgroundColor: "#ff6b35",
                        },
                      ]}
                      onPress={async () => {
                        setIsUpgrading(true);
                        try {
                          const success =
                            await handleSubscriptionWithCloudFunction(
                              "growth",
                              user?.email || "",
                              user?.displayName || "User"
                            );
                          if (!success) {
                            showError(
                              "Error",
                              "Failed to process payment. Please try again."
                            );
                          }
                        } finally {
                          setIsUpgrading(false);
                        }
                      }}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Text style={styles.limitReachedPromptButtonText}>
                          Upgrade Now
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }
              // Check if this is the upgrade prompt item
              if ("isUpgradePrompt" in item) {
                return (
                  <View
                    style={[
                      styles.upgradePromptCard,
                      {
                        backgroundColor: theme.gold.background,
                        borderColor: theme.gold.primary,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.upgradePromptClose}
                      onPress={() => setIsUpgradePromptDismissed(true)}
                    >
                      <Ionicons
                        name="close"
                        size={20}
                        color={theme.text.secondary}
                      />
                    </TouchableOpacity>

                    <View style={styles.upgradePromptIcon}>
                      <Ionicons
                        name="sparkles"
                        size={24}
                        color={theme.gold.primary}
                      />
                    </View>

                    <Text
                      style={[
                        styles.upgradePromptTitle,
                        { color: theme.gold.primary },
                      ]}
                    >
                      ✨ Unlock More Receipts
                    </Text>

                    <Text
                      style={[
                        styles.upgradePromptDescription,
                        { color: theme.text.secondary },
                      ]}
                    >
                      Get 50 receipts per month with our Starter Plan. Never
                      worry about running out of space for your receipts again!
                    </Text>

                    <TouchableOpacity
                      style={[
                        styles.upgradePromptButton,
                        {
                          backgroundColor: theme.gold.primary,
                          opacity: isUpgrading ? 0.7 : 1,
                        },
                      ]}
                      onPress={handleUpgrade}
                      disabled={isUpgrading}
                    >
                      {isUpgrading ? (
                        <ActivityIndicator color="white" size="small" />
                      ) : (
                        <>
                          <Ionicons
                            name="arrow-up"
                            size={16}
                            color="white"
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.upgradePromptButtonText}>
                            Upgrade Now
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }

              // Regular receipt item
              const receipt = item as FirebaseReceipt;
              return renderReceiptItem({ item: receipt });
            }}
            keyExtractor={(item) => {
              if ("isLimitReachedPrompt" in item) return "limit-reached-prompt";
              if ("isUpgradePrompt" in item) return "upgrade-prompt";
              return (item as FirebaseReceipt).receiptId;
            }}
            ListHeaderComponent={ListHeaderComponent}
            ListEmptyComponent={ListEmptyComponent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.gold.primary}
                colors={[theme.gold.primary]}
              />
            }
            contentContainerStyle={{
              paddingBottom: 100,
            }}
            showsVerticalScrollIndicator={false}
            getItemLayout={(data, index) => ({
              length: 100, // Approximate height of receipt card
              offset: 100 * index,
              index,
            })}
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            windowSize={10}
          />
        )}
      </View>

      {/* Floating Action Button - Always Visible */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: theme.gold.primary,
            shadowColor: theme.text.primary,
          },
        ]}
        onPress={() => {
          // Check again right before navigation
          const maxReceipts = subscription?.limits?.maxReceipts || 10;
          if (
            checkReceiptLimit(currentReceiptCount, maxReceipts, handleUpgrade)
          ) {
            navigation.navigate("ScanReceipt");
          }
        }}
      >
        <Ionicons name="camera" size={28} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  titleContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  headerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  searchButton: {
    padding: 8,
  },
  selectButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  selectButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchResultsText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
    fontStyle: "italic",
  },
  quickFiltersContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  quickFilterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  quickFilterText: {
    fontSize: 14,
    fontWeight: "500",
  },
  selectionBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    marginBottom: 16,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: "500",
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  usageCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  usageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  usageColumn: {
    flex: 1,
  },
  usageLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 18,
    fontWeight: "600",
  },
  usageDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginBottom: 16,
  },
  usageInfo: {
    marginBottom: 16,
  },
  historicalUsage: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    paddingTop: 16,
  },
  historicalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historicalMonth: {
    fontSize: 14,
  },
  historicalCount: {
    fontSize: 14,
    fontWeight: "500",
  },
  warningText: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },
  receiptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  receiptContent: {
    flex: 1,
    marginLeft: 8,
  },
  receiptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  receiptName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  receiptAmount: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  receiptDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  receiptCategory: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  receiptDate: {
    fontSize: 12,
    marginLeft: 12,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  upgradePrompt: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
  },
  upgradeTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  upgradeText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 22,
  },
  upgradeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  upgradePromptCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    position: "relative",
  },
  upgradePromptClose: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  upgradePromptIcon: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  upgradePromptTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  upgradePromptDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradePromptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  upgradePromptButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  limitReachedPromptCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 12,
    position: "relative",
  },
  limitReachedPromptClose: {
    position: "absolute",
    top: 12,
    right: 12,
    padding: 8,
    zIndex: 1,
  },
  limitReachedPromptIcon: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  limitReachedPromptTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  limitReachedPromptDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  limitReachedPromptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  limitReachedPromptButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 30,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    zIndex: 10,
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 8,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recentReceiptsContainer: {
    marginBottom: 16,
  },
  recentReceiptsTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  recentSections: {
    flexDirection: "row",
    gap: 12,
  },
  recentSectionCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  recentSectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
    textAlign: "center",
  },
  recentSectionCount: {
    fontSize: 12,
    marginBottom: 4,
    textAlign: "center",
  },
  recentSectionAmount: {
    fontSize: 13,
    fontWeight: "bold",
    textAlign: "center",
  },
  recentSectionNote: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontStyle: "italic",
  },
  dateRangeContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  dateRangeTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  quickDateFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  quickDateButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  quickDateText: {
    fontSize: 12,
    fontWeight: "500",
  },
  customDateRange: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  datePickerText: {
    fontSize: 14,
    flex: 1,
  },
  dateRangeSeparator: {
    fontSize: 14,
    fontWeight: "500",
  },
  activeDateFilter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  activeDateFilterText: {
    fontSize: 12,
    flex: 1,
    marginRight: 12,
  },
  clearDateFilterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  clearDateFilterText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },

  // Compact Search & Filter Styles
  compactSearchContainer: {
    backgroundColor: "#f5f5f5",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  compactFiltersRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  categoryChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 4,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  dateFilterToggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  dateFilterToggleText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dateRangeExpanded: {
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  quickDateScroll: {
    maxHeight: 50,
  },
  quickDateScrollContent: {
    gap: 12,
    paddingHorizontal: 4,
  },
  quickDateChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 70,
    alignItems: "center",
  },
  quickDateChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  customDateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    flex: 1,
    minHeight: 40,
  },
  dateButtonText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  clearDateButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  resultsSummary: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  resultsSummaryText: {
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },

  // Active Filter Badge Styles
  titleSection: {
    flex: 1,
  },
  activeFilterBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  filterBadgeText: {
    fontSize: 12,
    color: "white",
    fontWeight: "500",
  },
  filterBadgeClose: {
    padding: 2,
    marginLeft: 2,
  },
});
