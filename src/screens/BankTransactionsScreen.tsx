import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  TextInput,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinkSuccess, LinkExit } from "react-native-plaid-link-sdk";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import {
  BankReceiptService,
  TransactionCandidate,
} from "../services/BankReceiptService";
import { PlaidService } from "../services/PlaidService";
import { GeneratedReceipt } from "../services/HTMLReceiptService";
import { GeneratedReceiptPDF } from "../services/PDFReceiptService";
import { PDFViewer } from "../components/PDFViewer";
import { useInAppNotifications } from "../components/InAppNotificationProvider";
import { PlaidLinkButton } from "../components/PlaidLinkButton";
import CollapsibleFilterSection from "../components/CollapsibleFilterSection";
import DateTimePicker from "@react-native-community/datetimepicker";

export const BankTransactionsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { showNotification } = useInAppNotifications();

  const [candidates, setCandidates] = useState<
    (TransactionCandidate & { _id?: string })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(
    null
  );
  const [generatedReceipts, setGeneratedReceipts] = useState<
    Map<string, GeneratedReceiptPDF>
  >(new Map());
  const [linkToken, setLinkToken] = useState<string | null>(null);

  // Track cancelled operations
  const cancelledOperations = useRef<Set<string>>(new Set());

  // Quick filter state (multi-select)
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);
  const [showSearchSection, setShowSearchSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Date filter state
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
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
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expandedFilterSection, setExpandedFilterSection] = useState<string | null>(null);

  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();

  // Filtered and sorted candidates
  const filteredAndSortedCandidates = useMemo(() => {
    let filtered = candidates;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (candidate) =>
          candidate.transaction.merchant_name?.toLowerCase().includes(query) ||
          candidate.transaction.name?.toLowerCase().includes(query)
      );
    }

    // Apply quick filters (multiple selection)
    if (selectedQuickFilters.length > 0) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      filtered = filtered.filter((candidate) => {
        return selectedQuickFilters.some((filterType) => {
          switch (filterType) {
            case "recent":
              return new Date(candidate.transaction.date) >= sevenDaysAgo;
            case "high":
              return Math.abs(candidate.transaction.amount) >= 100;
            case "dining":
              return (
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("food") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("dining") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("restaurant")
              );
            case "shopping":
              return (
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("shop") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("retail") ||
                candidate.transaction.category?.[0]?.toLowerCase().includes("store")
              );
            case "transport":
              return (
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("transport") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("travel") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("gas") ||
                candidate.transaction.category?.[0]
                  ?.toLowerCase()
                  .includes("uber") ||
                candidate.transaction.category?.[0]?.toLowerCase().includes("taxi")
              );
            default:
              return true;
          }
        });
      });
    }

    // Date range filter
    if (
      dateRangeFilter.active &&
      (dateRangeFilter.startDate || dateRangeFilter.endDate)
    ) {
      filtered = filtered.filter((candidate) => {
        const transactionDate = new Date(candidate.transaction.date);

        if (dateRangeFilter.startDate) {
          const startOfDay = new Date(dateRangeFilter.startDate);
          startOfDay.setHours(0, 0, 0, 0);
          if (transactionDate < startOfDay) return false;
        }

        if (dateRangeFilter.endDate) {
          const endOfDay = new Date(dateRangeFilter.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (transactionDate > endOfDay) return false;
        }

        return true;
      });
    }

    // Sort by date (most recent first) for all filters
    filtered.sort((a, b) => {
      const dateA = new Date(a.transaction.date).getTime();
      const dateB = new Date(b.transaction.date).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [candidates, selectedQuickFilters, searchQuery, dateRangeFilter]); // Get unique categories for filter
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    candidates.forEach((candidate) => {
      if (candidate.transaction.category?.[0]) {
        categories.add(candidate.transaction.category[0]);
      }
    });
    return Array.from(categories).sort();
  }, [candidates]);

  useEffect(() => {
    if (user && subscription.currentTier === "professional") {
      // Only load candidates and create link token; do not clear bank connections in dev mode
      loadTransactionCandidates();
      createLinkToken(); // Prepare link token for bank connection
    }
  }, [user, subscription.currentTier]);

  const loadTransactionCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First, try to get candidates from cache
      const cachedCandidates =
        await bankReceiptService.getCachedTransactionCandidates(user.uid);

      if (cachedCandidates.length > 0) {
        console.log("� Using cached candidates:", cachedCandidates.length);
        setCandidates(
          cachedCandidates.map((candidate) => ({
            _id: candidate.transaction?.transaction_id || "unknown",
            ...candidate,
          }))
        );

        // Load generated receipts for candidates with 'generated' status
        await loadGeneratedReceipts(
          cachedCandidates
            .filter((c) => c.status === "generated")
            .map((candidate) => ({
              _id: candidate.transaction?.transaction_id || "unknown",
              ...candidate,
            }))
        );
        return;
      }

      // No cache, run the full sync process
      console.log("� No cache found, running full sync...");
      await bankReceiptService.monitorTransactions(user.uid);

      // Now fetch the newly created candidates from Firestore
      const { getDocs, collection, query, where } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../config/firebase");
      const candidatesQuery = query(
        collection(db, "transactionCandidates"),
        where("userId", "==", user.uid),
        where("status", "!=", "rejected")
      );
      const snapshot = await getDocs(candidatesQuery);
      const allCandidates = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...(doc.data() as TransactionCandidate),
      }));
      setCandidates(allCandidates);

      // Cache these candidates with their Firestore IDs
      await bankReceiptService.cacheFirestoreCandidates(
        user.uid,
        allCandidates
      );

      // Load generated receipts for candidates with 'generated' status
      await loadGeneratedReceipts(
        allCandidates.filter((c) => c.status === "generated")
      );
    } catch (error) {
      console.error("Error loading transaction candidates:", error);
      // Check if error is due to no bank connections
      if (
        error instanceof Error &&
        error.message.includes("Network request failed")
      ) {
        console.log("ℹ️ Network error - likely no bank connections exist yet");
        setCandidates([]); // Set empty array so UI shows connect button
      } else {
        showNotification({
          type: "error",
          title: "Error Loading Transactions",
          message: "Failed to load recent transactions. Please try again.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadGeneratedReceipts = async (
    candidatesWithReceipts: (TransactionCandidate & { _id?: string })[]
  ) => {
    if (candidatesWithReceipts.length === 0) return;

    try {
      const { getDocs, collection, query, where } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../config/firebase");

      const newGeneratedReceipts = new Map<string, GeneratedReceiptPDF>();

      for (const candidate of candidatesWithReceipts) {
        const docId = (candidate as any)._id;
        if (!docId) continue;

        // Query the generatedReceipts collection with userId filter for security
        const receiptsQuery = query(
          collection(db, "generatedReceipts"),
          where("candidateId", "==", docId),
          where("userId", "==", user?.uid)
        );
        const receiptSnap = await getDocs(receiptsQuery);

        if (!receiptSnap.empty) {
          const receiptData = receiptSnap.docs[0].data();

          // Convert to GeneratedReceiptPDF format if it's a PDF receipt
          if (receiptData.type === "pdf" && receiptData.receiptPdfUrl) {
            const generatedReceiptPDF: GeneratedReceiptPDF = {
              receiptPdfUrl: receiptData.receiptPdfUrl,
              receiptPdfPath: receiptData.receiptPdfPath,
              receiptData: {
                businessName: receiptData.businessName,
                address: receiptData.address,
                date: receiptData.date,
                time: receiptData.time,
                items: receiptData.items || [],
                subtotal: receiptData.subtotal,
                tax: receiptData.tax,
                total: receiptData.total,
                paymentMethod: receiptData.paymentMethod,
                transactionId: receiptData.transactionId,
              },
            };
            newGeneratedReceipts.set(docId, generatedReceiptPDF);
          }
        }
      }

      setGeneratedReceipts(newGeneratedReceipts);
    } catch (error) {
      console.error("Error loading generated receipts:", error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);

    // Clear cache to force fresh data fetch
    if (user) {
      await bankReceiptService.clearTransactionCache(user.uid);
    }

    await loadTransactionCandidates();
    setRefreshing(false);
  };

  const createLinkToken = async () => {
    if (!user) return;

    try {
      const token = await plaidService.createLinkToken(user.uid);
      setLinkToken(token);
    } catch (error) {
      console.error("Error creating link token:", error);
      showNotification({
        type: "error",
        title: "Connection Error",
        message: "Failed to prepare bank connection. Please try again.",
      });
    }
  };

  const handlePlaidSuccess = async (success: LinkSuccess) => {
    if (!user) return;

    try {
      setLoading(true);
      const accessToken = await plaidService.exchangePublicToken(
        success.publicToken
      );
      const accounts = await plaidService.getAccounts(accessToken);

      // Create bank connection record
      const bankConnection = {
        id: `bank_${user.uid}_${Date.now()}`,
        userId: user.uid,
        accessToken,
        institutionName: "Connected Bank",
        accounts: accounts.map((acc) => ({
          accountId: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask,
        })),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        isActive: true,
      };

      await bankReceiptService.saveBankConnectionLocally(bankConnection);

      showNotification({
        type: "success",
        title: "Bank Connected!",
        message: "Your bank account has been connected successfully.",
      });

      await loadTransactionCandidates();
    } catch (error) {
      console.error("Error handling Plaid success:", error);
      showNotification({
        type: "error",
        title: "Connection Failed",
        message: "Failed to complete bank connection. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlaidExit = (exit: LinkExit) => {
    console.log("Plaid Link exited:", exit);
    if (exit.error) {
      showNotification({
        type: "error",
        title: "Connection Error",
        message: exit.error.errorMessage || "Failed to connect bank account.",
      });
    }
  };

  const generateReceipt = async (
    candidate: TransactionCandidate,
    candidateId: string
  ) => {
    try {
      console.log("� Generate receipt called for candidate:", candidateId);
      console.log("🔍 Current user:", user);
      console.log("🔍 User UID:", user?.uid);

      if (!user?.uid) {
        console.error("❌ No authenticated user found");
        showNotification({
          type: "error",
          title: "Authentication Error",
          message: "You must be logged in to generate receipts.",
        });
        return;
      }

      setGeneratingReceipt(candidateId);

      // Clear any previous cancellation for this candidate
      cancelledOperations.current.delete(candidateId);

      console.log(
        "🔍 Calling generateReceiptForTransaction with userId:",
        user.uid
      );
      const generatedReceipt =
        await bankReceiptService.generateReceiptForTransaction(
          candidateId,
          candidate.transaction,
          user.uid
        );

      // Check if operation was cancelled after generation completed
      if (cancelledOperations.current.has(candidateId)) {
        console.log("🔍 Generation was cancelled, not storing receipt");
        cancelledOperations.current.delete(candidateId);
        return;
      }
      setGeneratedReceipts((prev) => {
        const newMap = new Map(prev);
        newMap.set(candidateId, generatedReceipt);
        return newMap;
      });

      // Clear generating state after storing receipt
      setGeneratingReceipt(null);
    } catch (error) {
      console.error("Error generating and saving receipt:", error);

      // Provide more helpful error messages based on error type
      let errorTitle = "Generation Failed";
      let errorMessage = "Failed to generate receipt. Please try again.";

      if (error instanceof Error) {
        if (
          error.message.includes("took too long") ||
          error.message.includes("longer than expected")
        ) {
          errorTitle = "Timeout Error";
          errorMessage =
            "PDF generation is taking longer than usual. This might be due to device performance. Would you like to try again?";
        } else if (error.message.includes("storage")) {
          errorTitle = "Storage Error";
          errorMessage =
            "Unable to save receipt. Please check your device storage space and try again.";
        } else if (error.message.includes("expo-print")) {
          errorTitle = "PDF Generation Error";
          errorMessage =
            "There was an issue with PDF generation. A simplified receipt was created instead.";
        }
      }

      showNotification({
        type: "error",
        title: errorTitle,
        message: errorMessage,
      });

      // Clear generating state on error
      setGeneratingReceipt(null);
    } finally {
      // Only clear generating state if there was an error
      // Success case is handled above after storing the receipt
    }
  };

  const approveReceipt = async (
    candidate: TransactionCandidate & { _id?: string },
    candidateId: string,
    generatedReceiptPDF: GeneratedReceiptPDF
  ) => {
    if (!user) return;

    try {
      await bankReceiptService.saveGeneratedPDFReceiptAsReceipt(
        user.uid,
        generatedReceiptPDF,
        candidateId
      );

      // Remove from candidates list by Firestore doc id
      setCandidates((prev) =>
        prev.filter((c) => (c as any)._id !== candidateId)
      );
      setGeneratedReceipts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(candidateId);
        return newMap;
      });

      showNotification({
        type: "success",
        title: "Receipt Saved!",
        message: "The generated receipt has been added to your collection.",
      });
    } catch (error) {
      console.error("Error approving receipt:", error);
      showNotification({
        type: "error",
        title: "Save Failed",
        message: "Failed to save receipt. Please try again.",
      });
    }
  };

  const rejectCandidate = async (candidateId: string) => {
    try {
      console.log("🗑️ Reject candidate called for:", candidateId);

      if (!user?.uid) {
        showNotification({
          type: "error",
          title: "Authentication Error",
          message: "You must be logged in to dismiss transactions.",
        });
        return;
      }

      // Call the service to dismiss the candidate in Firestore
      await bankReceiptService.dismissCandidate(candidateId, user.uid);

      // Remove from local state
      setCandidates((prev) =>
        prev.filter((c) => (c as any)._id !== candidateId)
      );
      setGeneratedReceipts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(candidateId);
        return newMap;
      });
    } catch (error) {
      console.error("Error dismissing candidate:", error);
      showNotification({
        type: "error",
        title: "Dismiss Failed",
        message: "Failed to dismiss transaction. Please try again.",
      });
    }
  };

  const discardGeneratedReceipt = async (candidateId: string) => {
    try {
      console.log("🗑️ Discarding generated receipt for:", candidateId);

      if (!user?.uid) {
        showNotification({
          type: "error",
          title: "Authentication Error",
          message: "You must be logged in to discard receipts.",
        });
        return;
      }

      // Delete the generated receipt from Firestore
      const { getDocs, collection, query, where, deleteDoc } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../config/firebase");

      // Find and delete the generated receipt document
      const receiptsQuery = query(
        collection(db, "generatedReceipts"),
        where("candidateId", "==", candidateId),
        where("userId", "==", user.uid)
      );
      const receiptSnap = await getDocs(receiptsQuery);

      // Delete all matching generated receipts (should be only one)
      const deletePromises = receiptSnap.docs.map((doc) => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      // Remove from local state
      setGeneratedReceipts((prev) => {
        const newMap = new Map(prev);
        newMap.delete(candidateId);
        return newMap;
      });

      console.log("✅ Generated receipt discarded successfully");
    } catch (error) {
      console.error("❌ Error discarding generated receipt:", error);
      showNotification({
        type: "error",
        title: "Discard Failed",
        message: "Failed to discard receipt. Please try again.",
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const clearFilters = () => {
    setSelectedQuickFilters([]);
    setSearchQuery("");
    setShowSearchSection(false);
    setDateRangeFilter({
      startDate: null,
      endDate: null,
      active: false,
    });
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
    // Don't close search section - allow multiple filter interactions
    setShowDateRangePicker(false);
  }, []);

  // Handle custom date range
  const handleDatePickerChange = useCallback(
    (event: any, selectedDate?: Date) => {
      if (selectedDate) {
        if (datePickerMode === "start") {
          // When selecting start date, automatically set end date to today if not set
          const newDateFilter = {
            ...dateRangeFilter,
            startDate: selectedDate,
            endDate: dateRangeFilter.endDate || new Date(), // Auto-set to today if no end date
            active: true,
          };
          setDateRangeFilter(newDateFilter);

          // Don't auto-close filter section - allow multiple filter interactions
        } else {
          // End date selection
          const newDateFilter = {
            ...dateRangeFilter,
            endDate: selectedDate,
            active: true,
          };
          setDateRangeFilter(newDateFilter);

          // Don't auto-close filter section - allow multiple filter interactions
        }
      }
      setShowDatePicker(false);
    },
    [datePickerMode, dateRangeFilter]
  );

  // Clear date filter
  const clearDateFilter = () => {
    setDateRangeFilter({
      startDate: null,
      endDate: null,
      active: false,
    });
  };

  const hasActiveFilters =
    selectedQuickFilters.length > 0 ||
    searchQuery.trim() !== "" ||
    dateRangeFilter.active;

  // FlatList item renderer
  const renderTransactionItem = ({
    item: candidate,
  }: {
    item: TransactionCandidate & { _id?: string };
  }) => {
    const docId =
      (candidate as any)._id ??
      `${candidate.transaction.transaction_id}_fallback`;
    const generatedReceipt = generatedReceipts.get(docId);
    const isGenerating = generatingReceipt === docId;
    console.log("🚀 ~ renderTransactionItem ~ candidate:", candidate);

    return (
      <View style={styles.candidateCard}>
        <View style={styles.candidateHeader}>
          <View style={styles.merchantInfo}>
            <Text style={styles.merchantName}>
              {candidate.transaction.merchant_name ||
                candidate.transaction.name}
            </Text>
            <Text style={styles.transactionDate}>
              {formatDate(new Date(candidate.transaction.date))}
            </Text>
          </View>
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>
              {formatCurrency(candidate.transaction.amount)}
            </Text>
            {candidate.transaction.category && (
              <Text style={styles.category}>
                {candidate.transaction.category[0]}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.transactionDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment Channel:</Text>
            <Text style={styles.detailValue}>
              {candidate.transaction.payment_channel}
            </Text>
          </View>
          {candidate.transaction?.location?.city &&
            candidate.transaction?.location?.region && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Location:</Text>
                <Text style={styles.detailValue}>
                  {candidate.transaction.location.city},{" "}
                  {candidate.transaction.location.region}
                </Text>
              </View>
            )}
        </View>

        {generatedReceipt && (
          <View style={styles.generatedReceiptContainer}>
            <Text style={styles.receiptTitle}>Generated PDF Receipt</Text>

            <View style={styles.pdfViewerContainer}>
              <PDFViewer
                pdfFilePath={generatedReceipt.receiptPdfPath}
                style={styles.pdfViewer}
              />
            </View>

            <Text style={styles.receiptDetails}>
              {generatedReceipt.receiptData.businessName} •{" "}
              {generatedReceipt.receiptData.date}
            </Text>
          </View>
        )}

        <View style={styles.buttonContainer}>
          {!generatedReceipt && !isGenerating && (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.generateButton]}
                onPress={() => generateReceipt(candidate, docId)}
              >
                <Text style={[styles.buttonText, styles.generateButtonText]}>
                  Generate PDF
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => rejectCandidate(docId)}
              >
                <Text style={[styles.buttonText, styles.rejectButtonText]}>
                  Skip
                </Text>
              </TouchableOpacity>
            </>
          )}

          {(isGenerating || generatedReceipt) && (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.approveButton,
                  !generatedReceipt && { opacity: 0.6 },
                ]}
                onPress={() => {
                  if (generatedReceipt) {
                    approveReceipt(candidate, docId, generatedReceipt);
                  } else {
                    // Receipt is still generating, but user wants to save it
                    // We'll mark it for auto-save when generation completes
                    showNotification({
                      type: "info",
                      title: "Will Save",
                      message:
                        "Receipt will be saved automatically when generation completes.",
                    });
                  }
                }}
                disabled={!generatedReceipt}
              >
                <Text style={[styles.buttonText, styles.approveButtonText]}>
                  {isGenerating ? "Generating..." : "Save Receipt"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => {
                  if (isGenerating) {
                    // Cancel generation - mark operation as cancelled
                    cancelledOperations.current.add(docId);
                    setGeneratingReceipt(null);
                    showNotification({
                      type: "info",
                      title: "Cancelled",
                      message: "Receipt generation cancelled.",
                    });
                  } else {
                    // Discard generated receipt
                    discardGeneratedReceipt(docId);
                  }
                }}
              >
                <Text style={[styles.buttonText, styles.rejectButtonText]}>
                  {isGenerating ? "Cancel" : "Discard"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    scrollContainer: {
      flex: 1,
    },
    countContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
      marginTop: -30,
      alignItems: "center",
      backgroundColor: theme.background.primary,
    },
    countText: {
      fontSize: 14,
      color: theme.text.secondary,
      textAlign: "center",
    },
    emptyState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: 40,
    },
    emptyTitle: {
      fontSize: 20,
      fontWeight: "600",
      color: theme.text.primary,
      marginTop: 16,
      textAlign: "center",
    },
    emptySubtitle: {
      fontSize: 16,
      color: theme.text.secondary,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 22,
    },
    connectButton: {
      backgroundColor: theme.gold.primary,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 12,
      marginTop: 20,
    },
    connectButtonText: {
      color: theme.background.primary,
      fontSize: 16,
      fontWeight: "600",
    },
    candidateCard: {
      backgroundColor: theme.background.secondary,
      marginHorizontal: 20,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    candidateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    merchantInfo: {
      flex: 1,
    },
    merchantName: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text.primary,
      marginBottom: 4,
    },
    transactionDate: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    amountContainer: {
      alignItems: "flex-end",
    },
    amount: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.gold.primary,
    },
    category: {
      fontSize: 12,
      color: theme.text.secondary,
      backgroundColor: theme.background.primary,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      marginTop: 4,
    },
    transactionDetails: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border.primary,
    },
    detailRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    detailLabel: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    detailValue: {
      fontSize: 14,
      color: theme.text.primary,
    },
    buttonContainer: {
      flexDirection: "row",
      marginTop: 4,
      gap: 2,
    },
    actionButton: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 6,
      borderRadius: 4,
      alignItems: "center",
      justifyContent: "center",
    },
    generateButton: {
      backgroundColor: theme.gold.primary,
    },
    approveButton: {
      backgroundColor: theme.status.success,
    },
    rejectButton: {
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.status.error,
    },
    buttonText: {
      fontSize: 10,
      fontWeight: "600",
      textAlign: "center",
    },
    generateButtonText: {
      color: theme.background.primary,
    },
    approveButtonText: {
      color: theme.background.primary,
    },
    rejectButtonText: {
      color: theme.status.error,
    },
    generatedReceiptContainer: {
      marginTop: 8,
      padding: 8,
      backgroundColor: theme.background.primary,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.gold.primary,
    },
    receiptTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text.primary,
      marginBottom: 8,
    },
    receiptImage: {
      width: "100%",
      height: 200,
      borderRadius: 8,
      marginBottom: 8,
    },
    pdfPreviewContainer: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.background.secondary,
      borderRadius: 8,
      padding: 20,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    pdfIcon: {
      marginBottom: 8,
    },
    pdfText: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text.primary,
      marginBottom: 4,
    },
    pdfPath: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: "center",
    },
    pdfViewerContainer: {
      backgroundColor: theme.background.secondary,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
      overflow: "hidden",
    },
    pdfViewer: {
      height: 250, // Preview height
      width: "100%",
    },
    receiptDetails: {
      fontSize: 12,
      color: theme.text.secondary,
    },
    // Text-based receipt styles
    textReceiptContainer: {
      backgroundColor: theme.background.secondary,
      padding: 16,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    textReceiptTitle: {
      fontSize: 16,
      fontWeight: "bold",
      color: theme.text.primary,
      textAlign: "center",
      marginBottom: 4,
    },
    textReceiptAddress: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: "center",
      marginBottom: 8,
    },
    textReceiptDate: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: "monospace",
      marginBottom: 2,
    },
    textReceiptLine: {
      height: 1,
      backgroundColor: theme.border.primary,
      marginVertical: 8,
    },
    textReceiptItemRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 4,
    },
    textReceiptItemName: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: "monospace",
      flex: 1,
    },
    textReceiptItemPrice: {
      fontSize: 12,
      color: theme.text.primary,
      fontFamily: "monospace",
    },
    textReceiptTotalLabel: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.text.primary,
      fontFamily: "monospace",
    },
    textReceiptTotalAmount: {
      fontSize: 14,
      fontWeight: "bold",
      color: theme.text.primary,
      fontFamily: "monospace",
    },
    loadingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    loadingText: {
      marginLeft: 8,
      color: theme.text.secondary,
    },
    listContainer: {
      paddingTop: 0, // Remove padding since search bar will be positioned naturally
      paddingBottom: 20,
    },
    searchAndFiltersContainer: {
      backgroundColor: theme.background.primary,
      zIndex: 1000,
      elevation: 6,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    searchContainer: {
      flexDirection: "row",
      alignItems: "center",
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    searchInputContainer: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.background.tertiary,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: theme.border.secondary,
      shadowColor: theme.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
      minWidth: 200,
    },
    searchIcon: {
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: "#000000",
      backgroundColor: "#FFFFFF",
      paddingVertical: 8,
      paddingHorizontal: 8,
      minHeight: 36,
      minWidth: 150,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#E0E0E0",
    },
    clearButton: {
      padding: 8,
      marginLeft: 4,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    filterButton: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: theme.background.secondary,
      borderWidth: 1,
      borderColor: theme.gold.primary,
      alignItems: "center",
      justifyContent: "center",
    },

    // FAB styles
    fabContainer: {
      position: "absolute",
      bottom: 30,
      right: 20,
      alignItems: "center",
    },
    filterLabel: {
      backgroundColor: theme.gold.primary,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginBottom: 8,
    },
    filterLabelText: {
      color: "white",
      fontSize: 12,
      fontWeight: "600",
      textTransform: "capitalize",
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.gold.primary,
      justifyContent: "center",
      alignItems: "center",
      elevation: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
    fabActive: {
      backgroundColor: theme.gold.rich,
    },

    // Beautiful Search & Filters Section Styles
    searchSection: {
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 16,
    },
    filtersSection: {
      paddingHorizontal: 20,
      paddingBottom: 24,
    },
    filtersSectionTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.text.primary,
      marginBottom: 16,
      letterSpacing: 0.5,
    },
    filtersContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 12,
    },
    filterChip: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: theme.background.secondary,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border.secondary,
      shadowColor: theme.text.primary,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    filterChipActive: {
      backgroundColor: theme.gold.primary,
      borderColor: theme.gold.primary,
      shadowColor: theme.gold.primary,
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    filterChipIcon: {
      marginRight: 8,
    },
    filterChipText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.text.secondary,
    },
    filterChipTextActive: {
      color: "white",
      fontWeight: "600",
    },
    generatingContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 4,
      paddingHorizontal: 6,
      backgroundColor: theme.background.secondary,
      borderRadius: 4,
    },
    generatingSpinner: {
      marginRight: 4,
    },
    generatingText: {
      fontSize: 10,
      color: theme.text.primary,
      marginRight: 4,
    },
    cancelButton: {
      paddingVertical: 3,
      paddingHorizontal: 6,
      backgroundColor: theme.status.error,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.text.tertiary,
    },
    quickSaveButton: {
      backgroundColor: theme.text.tertiary,
      marginTop: 8,
    },
    quickSaveButtonText: {
      color: theme.background.primary,
      fontSize: 12,
    },
    quickDateFiltersScroll: {
      paddingVertical: 8,
    },
    quickDateFilter: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      borderWidth: 1,
      marginRight: 8,
    },
    quickDateFilterText: {
      fontSize: 12,
      fontWeight: "500",
    },
    customDateRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    dateButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
    },
    dateButtonText: {
      marginLeft: 8,
      fontSize: 14,
    },
    dateSeparator: {
      marginHorizontal: 8,
      fontSize: 14,
      fontWeight: "500",
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

  // Check if user has Professional subscription
  if (subscription.currentTier !== "professional") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <Ionicons
            name="card-outline"
            size={64}
            color={theme.text.secondary}
          />
          <Text style={styles.emptyTitle}>Professional Feature</Text>
          <Text style={styles.emptySubtitle}>
            Bank transaction monitoring and automatic receipt generation is
            available for Professional subscribers only.
          </Text>
          <TouchableOpacity style={styles.connectButton}>
            <Text style={styles.connectButtonText}>
              Upgrade to Professional
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (loading && candidates.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {candidates.length > 0 && (
        <View style={styles.countContainer}>
          <Text style={styles.countText}>
            {filteredAndSortedCandidates.length === 0 && hasActiveFilters
              ? `No transactions match the current filter`
              : filteredAndSortedCandidates.length === 0
              ? "No recent purchases found"
              : `${filteredAndSortedCandidates.length} of ${candidates.length} transactions`}
          </Text>

          {/* Active Filter Badges */}
          {!showSearchSection && hasActiveFilters && (
            <View style={styles.activeFilterBadges}>
              {selectedQuickFilters.map((filter, index) => (
                <TouchableOpacity
                  key={`${filter}-${index}`}
                  style={[
                    styles.filterBadge,
                    { backgroundColor: theme.gold.primary },
                  ]}
                  onPress={() => setSelectedQuickFilters(prev => prev.filter(f => f !== filter))}
                >
                  <Text style={styles.filterBadgeText}>{filter}</Text>
                  <View style={styles.filterBadgeClose}>
                    <Ionicons name="close" size={18} color="white" />
                  </View>
                </TouchableOpacity>
              ))}
              {searchQuery.trim() !== "" && (
                <TouchableOpacity
                  style={[
                    styles.filterBadge,
                    { backgroundColor: theme.gold.rich },
                  ]}
                  onPress={() => setSearchQuery("")}
                >
                  <Text style={styles.filterBadgeText}>"{searchQuery}"</Text>
                  <View style={styles.filterBadgeClose}>
                    <Ionicons name="close" size={18} color="white" />
                  </View>
                </TouchableOpacity>
              )}
              {dateRangeFilter.active &&
                (dateRangeFilter.startDate || dateRangeFilter.endDate) && (
                  <TouchableOpacity
                    style={[
                      styles.filterBadge,
                      { backgroundColor: theme.status.success },
                    ]}
                    onPress={clearDateFilter}
                  >
                    <Text style={styles.filterBadgeText}>
                      {dateRangeFilter.startDate && dateRangeFilter.endDate
                        ? `${formatDate(
                            dateRangeFilter.startDate
                          )} - ${formatDate(dateRangeFilter.endDate)}`
                        : dateRangeFilter.startDate
                        ? `From ${formatDate(dateRangeFilter.startDate)}`
                        : `Until ${formatDate(dateRangeFilter.endDate!)}`}
                    </Text>
                    <View style={styles.filterBadgeClose}>
                      <Ionicons name="close" size={18} color="white" />
                    </View>
                  </TouchableOpacity>
                )}
            </View>
          )}
        </View>
      )}

      {showSearchSection && (
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            setShowSearchSection(false);
          }}
        >
          <View style={styles.searchAndFiltersContainer}>
          {/* Search Section */}
          <View style={styles.searchSection} onStartShouldSetResponder={() => true}>
            <View style={styles.searchInputContainer}>
              <Ionicons
                name="search-outline"
                size={22}
                color={theme.text.secondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Type here..."
                placeholderTextColor="#999999"
                value={searchQuery}
                onChangeText={setSearchQuery}
                multiline={false}
                numberOfLines={1}
                returnKeyType="done"
                onSubmitEditing={() => setShowSearchSection(false)}
                blurOnSubmit={true}
              />
              <TouchableOpacity
                onPress={() => setSearchQuery("")}
                style={[
                  styles.clearButton,
                  { opacity: searchQuery.length > 0 ? 1 : 0 },
                ]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color="#999999" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filters Section */}
          <ScrollView
            style={styles.filtersSection}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onStartShouldSetResponder={() => true}
          >
            {/* Date Range Collapsible Section */}
            <CollapsibleFilterSection
              title="Date Range"
              expanded={expandedFilterSection === 'dateRange'}
              onToggle={(isExpanded) => {
                setExpandedFilterSection(isExpanded ? 'dateRange' : null);
              }}
              iconColor={theme.text.primary}
              headerBackgroundColor={theme.background.secondary}
              contentBackgroundColor={theme.background.primary}
              titleColor={theme.text.primary}
              shadowColor={theme.text.primary}
            >
              {/* Quick Date Filters */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.quickDateFiltersScroll}
              >
                {[
                  { label: "Last 7 Days", days: 7 },
                  { label: "Last 30 Days", days: 30 },
                  { label: "Last 90 Days", days: 90 },
                  { label: "Last Year", days: 365 },
                ].map((filter) => (
                  <TouchableOpacity
                    key={filter.label}
                    style={[
                      styles.quickDateFilter,
                      {
                        backgroundColor: theme.background.secondary,
                        borderColor: theme.border.primary,
                      },
                    ]}
                    onPress={() => handleQuickDateFilter(filter.days)}
                  >
                    <Text
                      style={[
                        styles.quickDateFilterText,
                        { color: theme.text.primary },
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
                      : "Start Date"}
                  </Text>
                </TouchableOpacity>

                <Text
                  style={[
                    styles.dateSeparator,
                    { color: theme.text.secondary },
                  ]}
                >
                  to
                </Text>

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
                      : "End Date"}
                  </Text>
                </TouchableOpacity>
              </View>
            </CollapsibleFilterSection>

            {/* Quick Filters Collapsible Section */}
            <CollapsibleFilterSection
              title="Quick Filters"
              expanded={expandedFilterSection === 'quickFilters'}
              onToggle={(isExpanded) => {
                setExpandedFilterSection(isExpanded ? 'quickFilters' : null);
              }}
              iconColor={theme.text.primary}
              headerBackgroundColor={theme.background.secondary}
              contentBackgroundColor={theme.background.primary}
              titleColor={theme.text.primary}
              shadowColor={theme.text.primary}
            >
              <View style={styles.filtersContainer}>
                {[
                  { key: "all", label: "All", icon: "list" },
                  { key: "recent", label: "Recent", icon: "time" },
                  { key: "high", label: "High Amount", icon: "trending-up" },
                  { key: "dining", label: "Dining", icon: "restaurant" },
                  { key: "shopping", label: "Shopping", icon: "bag" },
                  { key: "transport", label: "Transport", icon: "car" },
                ].map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterChip,
                      selectedQuickFilters.includes(option.key) && styles.filterChipActive,
                    ]}
                    onPress={() => {
                      if (selectedQuickFilters.includes(option.key)) {
                        // Remove filter if already selected
                        setSelectedQuickFilters(prev => prev.filter(f => f !== option.key));
                      } else {
                        // Add filter to selection
                        setSelectedQuickFilters(prev => [...prev, option.key]);
                      }
                      // Don't close search section - allow multiple filter interactions
                    }}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={16}
                      color={
                        selectedQuickFilters.includes(option.key)
                          ? "white"
                          : theme.text.secondary
                      }
                      style={styles.filterChipIcon}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        selectedQuickFilters.includes(option.key) &&
                          styles.filterChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </CollapsibleFilterSection>
          </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      )}

      {candidates.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="card-outline"
            size={64}
            color={theme.text.secondary}
          />
          <Text style={styles.emptyTitle}>No Recent Purchases</Text>
          <Text style={styles.emptySubtitle}>
            We'll monitor your connected accounts for new purchases and notify
            you when we find potential receipts.
          </Text>
          {linkToken ? (
            <PlaidLinkButton
              linkToken={linkToken}
              onSuccess={handlePlaidSuccess}
              onExit={handlePlaidExit}
              style={styles.connectButton}
            >
              <Text style={styles.connectButtonText}>Connect Bank Account</Text>
            </PlaidLinkButton>
          ) : (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={createLinkToken}
            >
              <Text style={styles.connectButtonText}>Connect Bank Account</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : filteredAndSortedCandidates.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons
            name="search-outline"
            size={64}
            color={theme.text.secondary}
          />
          <Text style={styles.emptyTitle}>No Transactions Found</Text>
          <Text style={styles.emptySubtitle}>
            {selectedQuickFilters.length > 0
              ? `No transactions match the selected filters: ${selectedQuickFilters.join(', ')}.`
              : "Connect your bank account to see transactions here."}
          </Text>
          {selectedQuickFilters.length > 0 && (
            <TouchableOpacity
              style={styles.connectButton}
              onPress={clearFilters}
            >
              <Text style={styles.connectButtonText}>
                Show All Transactions
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedCandidates}
          renderItem={renderTransactionItem}
          keyExtractor={(item) =>
            (item as any)._id ?? `${item.transaction.transaction_id}_fallback`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[theme.gold.primary]}
              tintColor={theme.gold.primary}
            />
          }
          onScroll={undefined}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={(data, index) => ({
            length: 200,
            offset: 200 * index,
            index,
          })}
        />
      )}

      {/* Smart Filter FAB */}
      {candidates.length > 0 && (
        <View style={styles.fabContainer}>
          {hasActiveFilters && !showSearchSection && (
            <View style={styles.filterLabel}>
              <Text style={styles.filterLabelText}>
                {(() => {
                  if (searchQuery.trim()) {
                    return "Search Active";
                  }
                  
                  const totalFilters = selectedQuickFilters.length + (dateRangeFilter.active ? 1 : 0);
                  
                  if (totalFilters > 0) {
                    return `${totalFilters} Filter${totalFilters > 1 ? 's' : ''} Active`;
                  }
                  
                  return "All Transactions";
                })()}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.fab,
              (hasActiveFilters || showSearchSection) && styles.fabActive,
            ]}
            onPress={() => setShowSearchSection(!showSearchSection)}
          >
            <Ionicons
              name={showSearchSection ? "close" : "search"}
              size={24}
              color="white"
            />
          </TouchableOpacity>
        </View>
      )}
      {/* Date Picker */}
      {showDatePicker && (
        <DateTimePicker
          value={
            datePickerMode === "start"
              ? dateRangeFilter.startDate || new Date()
              : dateRangeFilter.endDate || new Date()
          }
          mode="date"
          display="default"
          onChange={handleDatePickerChange}
        />
      )}
    </SafeAreaView>
  );
};

export default BankTransactionsScreen;
