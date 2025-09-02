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
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinkSuccess, LinkExit } from "react-native-plaid-link-sdk";
import Pdf from 'react-native-pdf';
import * as Sharing from 'expo-sharing';
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useBusiness } from "../context/BusinessContext";
import {
  BankReceiptService,
  TransactionCandidate,
} from "../services/BankReceiptService";
import { PlaidService } from "../services/PlaidService";
import { GeneratedReceiptPDF } from "../services/PDFReceiptService";
import { useInAppNotifications } from "../components/InAppNotificationProvider";
import { PlaidLinkButton } from "../components/PlaidLinkButton";
import CollapsibleFilterSection from "../components/CollapsibleFilterSection";
import DateTimePicker from "@react-native-community/datetimepicker";

export const BankTransactionsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const { selectedBusiness } = useBusiness();
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
  const [bankConnections, setBankConnections] = useState<any[]>([]);

  // Track cancelled operations
  const cancelledOperations = useRef<Set<string>>(new Set());

  // Quick filter state (multi-select)
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<string[]>([]);
  const [showSearchSection, setShowSearchSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Bulk selection state
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSkipInProgress, setBulkSkipInProgress] = useState(false);
  const [bulkGenerateInProgress, setBulkGenerateInProgress] = useState(false);
  const [bulkGenerateProgress, setBulkGenerateProgress] = useState({ current: 0, total: 0, currentItem: '' });
  
  // PDF Viewing state
  const [pdfModalVisible, setPdfModalVisible] = useState(false);
  const [selectedPdfUri, setSelectedPdfUri] = useState<string | null>(null);
  
  // Alert deduplication state
  const recentAlerts = useRef<Map<string, number>>(new Map());
  const ALERT_DEDUP_WINDOW = 3000; // 3 seconds
  
  // Loading quotes state
  const [currentLoadingMessage, setCurrentLoadingMessage] = useState(0);
  const [currentBankStatus, setCurrentBankStatus] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const loadingMessages = [
    "🔒 Connected to your bank securely",
    "🛡️ Your data is protected with bank-grade encryption",
    "Loading your transactions...",
    "🔐 We never store your banking passwords",
    "💎 Every receipt tells a story of success",
    "🏦 Read-only access - we can't move your money",
    "Organizing your financial data...",
    "🔒 256-bit SSL encryption keeps you safe",
    "📊 Track every dollar, maximize every deduction",
    "🛡️ Powered by Plaid - trusted by millions",
    "✨ Great receipts lead to great tax savings",
    "🔐 Your login stays private and secure",
    "Gathering your purchase history...",
    "🏦 Bank-level security for your peace of mind",
    "🎯 Stay organized, stay profitable",
    "🔒 Disconnect anytime with one tap",
    "Processing recent transactions...",
    "🛡️ End-to-end encryption protects your data",
    "💼 Smart businesses track everything",
    "🔐 We only read transactions, never account details",
    "Analyzing your spending patterns...",
    "🏦 Your financial institution approves this connection",
    "🌟 Turn chaos into organized success",
    "🔒 Zero access to move or transfer funds",
    "Syncing account information...",
    "🛡️ Military-grade security standards",
    "📝 Every expense matters, every receipt counts",
    "🔐 Your privacy is our top priority",
    "Preparing your transaction list...",
    "🏦 Regulated and compliant financial technology",
    "💡 Organization is the key to growth",
    "🔒 Secure connection established and verified",
    "Almost there...",
    "🛡️ Your trust is our most valuable asset",
    "🚀 Ready to streamline your finances?",
  ];
  
  // Deduplicated notification function
  const showDedupedNotification = (notification: {
    type: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }) => {
    const alertKey = `${notification.title}|${notification.message}`;
    const now = Date.now();
    
    // Check if this alert was shown recently
    const lastShown = recentAlerts.current.get(alertKey);
    if (lastShown && (now - lastShown) < ALERT_DEDUP_WINDOW) {
      console.log(`🔇 Suppressing duplicate alert: ${notification.title}`);
      return;
    }
    
    // Show the alert and record the timestamp
    recentAlerts.current.set(alertKey, now);
    showNotification(notification);
    
    // Clean up old entries to prevent memory leaks
    if (recentAlerts.current.size > 50) {
      const cutoffTime = now - ALERT_DEDUP_WINDOW;
      for (const [key, timestamp] of recentAlerts.current.entries()) {
        if (timestamp < cutoffTime) {
          recentAlerts.current.delete(key);
        }
      }
    }
  };

  // Loading message cycling effect with fade transitions and random timing
  useEffect(() => {
    if (!loading) {
      // Reset to first message when not loading
      setCurrentLoadingMessage(0);
      fadeAnim.setValue(1);
      return;
    }

    let timeout: NodeJS.Timeout;
    let isActive = true;
    
    const cycleMessage = () => {
      if (!isActive) return;
      
      // Fade out current message
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start((finished) => {
        if (!finished || !isActive) return;
        
        // Change message while invisible
        setCurrentLoadingMessage((prev) => (prev + 1) % loadingMessages.length);
        
        // Fade in new message
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }).start((finished) => {
          if (!finished || !isActive) return;
          
          // Schedule next message with random delay
          const randomDelay = Math.random() * 3000 + 7000; // 7-10 seconds
          timeout = setTimeout(() => {
            cycleMessage();
          }, randomDelay);
        });
      });
    };
    
    // Start first cycle after a short initial delay
    timeout = setTimeout(() => {
      cycleMessage();
    }, Math.random() * 3000 + 7000);
    
    return () => {
      isActive = false;
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [loading]); // Removed problematic dependencies

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

  // Function to handle viewing PDF
  const viewPDF = useCallback((generatedReceipt: any) => {
    console.log("🔍 DEBUG: Attempting to view PDF. GeneratedReceipt object:", JSON.stringify(generatedReceipt, null, 2));
    console.log("🔍 DEBUG: pdfUri:", generatedReceipt?.pdfUri);
    console.log("🔍 DEBUG: All keys in generatedReceipt:", Object.keys(generatedReceipt || {}));
    
    // Try different possible URI field names based on actual structure
    const pdfUri = generatedReceipt?.receiptPdfPath || 
                   generatedReceipt?.receiptPdfUrl ||
                   generatedReceipt?.pdfUri || 
                   generatedReceipt?.pdfPath || 
                   generatedReceipt?.filePath ||
                   generatedReceipt?.uri ||
                   generatedReceipt?.path;
    
    console.log("🔍 DEBUG: Final pdfUri to use:", pdfUri);
    
    if (pdfUri) {
      setSelectedPdfUri(pdfUri);
      setPdfModalVisible(true);
    } else {
      showNotification({
        type: "error",
        title: "PDF Not Available",
        message: "PDF file could not be found or is corrupted.",
      });
    }
  }, [showNotification]);

  // Function to handle PDF sharing
  const sharePDF = useCallback(async () => {
    if (!selectedPdfUri) return;
    
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(selectedPdfUri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Share Receipt PDF',
        });
      } else {
        showNotification({
          type: "error",
          title: "Sharing Not Available",
          message: "Sharing is not available on this device.",
        });
      }
    } catch (error) {
      console.error('Error sharing PDF:', error);
      showNotification({
        type: "error",
        title: "Share Failed",
        message: "Failed to share PDF file.",
      });
    }
  }, [selectedPdfUri, showNotification]);

  // Quick filter options including bank connections
  const quickFilterOptions = useMemo(() => {
    const baseFilters = [
      { key: "all", label: "All", icon: "list" },
      { key: "recent", label: "Recent", icon: "time" },
      { key: "high", label: "High Amount", icon: "trending-up" },
      { key: "dining", label: "Dining", icon: "restaurant" },
      { key: "shopping", label: "Shopping", icon: "bag" },
      { key: "transport", label: "Transport", icon: "car" },
    ];

    // Add bank connections as filter options
    const bankFilters = bankConnections.map(connection => ({
      key: `bank_${connection.institutionName?.toLowerCase().replace(/\s+/g, '_')}`,
      label: connection.institutionName || "Unknown Bank",
      icon: "card-outline" as const,
      isBankFilter: true,
      connection: connection
    }));

    return [...baseFilters, ...bankFilters];
  }, [bankConnections]);

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
              // Check if it's a bank filter
              if (filterType.startsWith('bank_')) {
                // Find the bank connection that matches this filter
                const bankFilter = quickFilterOptions.find(option => option.key === filterType);
                if (bankFilter && 'connection' in bankFilter && bankFilter.connection) {
                  // Check if transaction belongs to this bank connection
                  return bankFilter.connection.accounts?.some((account: any) => {
                    const accountId = account.accountId || account.account_id;
                    return accountId === candidate.transaction.account_id;
                  });
                }
              }
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
  }, [candidates, selectedQuickFilters, searchQuery, dateRangeFilter, quickFilterOptions]); // Get unique categories for filter
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    candidates.forEach((candidate) => {
      if (candidate.transaction.category?.[0]) {
        categories.add(candidate.transaction.category[0]);
      }
    });
    return Array.from(categories).sort();
  }, [candidates]);

  // Group transactions by bank connection for SectionList
  const groupedTransactions = useMemo(() => {
    console.log("🔍 DEBUG: Grouping transactions...");
    console.log("🏦 DEBUG: Bank connections:", bankConnections.length, bankConnections);
    console.log("💳 DEBUG: Filtered transactions:", filteredAndSortedCandidates.length);
    
    // Debug: Show first few transaction account IDs
    if (filteredAndSortedCandidates.length > 0) {
      console.log("💳 DEBUG: Sample transaction account IDs:", 
        filteredAndSortedCandidates.slice(0, 5).map(c => ({
          id: c.transaction.transaction_id,
          account_id: c.transaction.account_id,
          merchant: c.transaction.merchant_name || c.transaction.name
        }))
      );
    }
    
    if (bankConnections.length === 0) {
      console.log("❌ DEBUG: No bank connections found");
      return [];
    }

    const sections = bankConnections.map(connection => {
      console.log("🏦 DEBUG: Processing connection:", connection.institutionName);
      console.log("🏦 DEBUG: Connection account IDs:", connection.accounts?.map(acc => acc.accountId || acc.account_id));
      
      const bankTransactions = filteredAndSortedCandidates.filter(candidate => {
        const hasMatch = connection.accounts?.some((account: any) => {
          // Try both accountId and account_id fields
          const accountId = account.accountId || account.account_id;
          const match = accountId === candidate.transaction.account_id;
          if (match) {
            console.log("✅ DEBUG: Transaction matched:", candidate.transaction.account_id, "to", connection.institutionName);
          }
          return match;
        });
        
        if (!hasMatch && filteredAndSortedCandidates.length < 10) {
          console.log("❌ DEBUG: No match for transaction:", candidate.transaction.account_id, "in", connection.institutionName);
        }
        
        return hasMatch;
      });

      const section = {
        title: connection.institutionName || "Unknown Bank",
        data: bankTransactions,
        connection: connection
      };
      
      console.log("📊 DEBUG: Section for", section.title, "has", section.data.length, "transactions");
      return section;
    }).filter(section => section.data.length > 0); // Only show sections with transactions

    console.log("📋 DEBUG: Final grouped sections:", sections.length, sections.map(s => `${s.title}: ${s.data.length}`));
    return sections;
  }, [filteredAndSortedCandidates, bankConnections]);


  useEffect(() => {
    if (user && (subscription.currentTier === "professional" || subscription.trial.isActive)) {
      // Only load candidates and create link token; do not clear bank connections in dev mode
      loadTransactionCandidates();
      loadBankConnections();
      createLinkToken(); // Prepare link token for bank connection
    }
  }, [user, subscription.currentTier]);

  const loadBankConnections = async () => {
    if (!user) return;
    
    try {
      const connections = await bankReceiptService.getBankConnections(user.uid);
      const activeConnections = connections.filter(conn => conn.isActive);
      setBankConnections(activeConnections);
    } catch (error) {
      console.error("Error loading bank connections:", error);
    }
  };

  const loadTransactionCandidates = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // First, try to get candidates from cache
      const cachedCandidates =
        await bankReceiptService.getCachedTransactionCandidates(user.uid);

      if (cachedCandidates.length > 0) {
        console.log("📱 Using cached candidates:", cachedCandidates.length);
        setCurrentBankStatus("Showing recent transactions");
        // Clear the message after 4 seconds
        setTimeout(() => setCurrentBankStatus(null), 4000);
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
      console.log("🔄 No cache found, running full sync...");
      setCurrentBankStatus("🔄 Connecting to your banks...");
      await bankReceiptService.monitorTransactions(user.uid, (status: string | null) => {
        setCurrentBankStatus(status);
      });

      // Now fetch the newly created candidates from Firestore
      const { getDocs, collection, query, where } = await import(
        "firebase/firestore"
      );
      const { db } = await import("../config/firebase");
      // Use 'in' query instead of '!=' to avoid BloomFilter errors
      const candidatesQuery = query(
        collection(db, "transactionCandidates"),
        where("userId", "==", user.uid),
        where("status", "in", ["pending", "approved", "generated"])
      );
      const snapshot = await getDocs(candidatesQuery);
      const allCandidates = snapshot.docs.map((doc) => ({
        _id: doc.id,
        ...(doc.data() as TransactionCandidate),
      }));
      setCandidates(allCandidates);

      // Clear bank status when sync completes
      setCurrentBankStatus(null);

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
    await loadBankConnections();
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

    // Only professional tier or trial users can connect banks
    if (subscription.currentTier !== "professional" && !subscription.trial.isActive) {
      showNotification({
        type: "warning",
        title: "Professional Tier Required",
        message: "Bank connections are available for Professional tier or trial users. Please upgrade your subscription.",
      });
      return;
    }

    try {
      setLoading(true);
      const accessToken = await plaidService.exchangePublicToken(
        success.publicToken
      );
      const accounts = await plaidService.getAccounts(accessToken);
      
      // Get institution info to get the real bank name
      const institution = await plaidService.getInstitution(accessToken);
      const institutionName = institution?.name || "Connected Bank";

      // Check for duplicate connections
      const existingConnections = await bankReceiptService.getBankConnections(user.uid);
      const isDuplicate = existingConnections.some(conn => 
        conn.institutionName === institutionName && conn.isActive
      );

      if (isDuplicate) {
        showNotification({
          type: "warning",
          title: "Bank Already Connected",
          message: `${institutionName} is already connected to your account`,
        });
        setLoading(false);
        return;
      }

      // Create bank connection record
      const bankConnection = {
        id: `bank_${user.uid}_${Date.now()}`,
        userId: user.uid,
        accessToken,
        institutionName: institutionName,
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
        title: `${institutionName} Connected`,
        message: "Account connected successfully",
      });

      await loadTransactionCandidates();
      await loadBankConnections();
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

    // Prevent duplicate approval attempts
    if (generatingReceipt === candidateId) {
      console.log("🔄 Approval already in progress for:", candidateId);
      return;
    }

    try {
      // Set as generating to prevent duplicates
      setGeneratingReceipt(candidateId);

      await bankReceiptService.saveGeneratedPDFReceiptAsReceipt(
        user.uid,
        generatedReceiptPDF,
        candidateId,
        selectedBusiness
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

      showDedupedNotification({
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
    } finally {
      // Clear the generating state after a short delay
      setTimeout(() => {
        setGeneratingReceipt(null);
      }, 500);
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
      
      // Remove from selected items if in bulk mode
      if (bulkMode) {
        setSelectedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(candidateId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("Error dismissing candidate:", error);
      showNotification({
        type: "error",
        title: "Dismiss Failed",
        message: "Failed to dismiss transaction. Please try again.",
      });
    }
  };
  
  // Bulk operations
  const toggleItemSelection = (candidateId: string) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };
  
  const selectAll = () => {
    const allIds = new Set(filteredAndSortedCandidates.map(c => (c as any)._id));
    setSelectedItems(allIds);
  };
  
  const deselectAll = () => {
    setSelectedItems(new Set());
  };
  
  const bulkSkip = async () => {
    if (selectedItems.size === 0 || bulkSkipInProgress) return;
    
    try {
      const itemsToSkip = Array.from(selectedItems);
      const skipCount = itemsToSkip.length;
      
      // Start the beautiful bulk skip process
      setBulkSkipInProgress(true);
      
      // Process all items efficiently in the background
      const skipPromises = itemsToSkip.map(candidateId => rejectCandidate(candidateId));
      await Promise.all(skipPromises);
      
      // Clear transaction cache to ensure dismissed transactions don't reappear
      if (user?.uid) {
        await bankReceiptService.clearTransactionCache(user.uid);
        console.log('🗑️ Cleared transaction cache after bulk skip');
      }
      
      // Wait a moment for the animation to complete
      setTimeout(() => {
        // Clear selection and exit bulk mode smoothly
        setSelectedItems(new Set());
        setBulkMode(false);
        setBulkSkipInProgress(false);
      }, 1000); // Give time for the animation to be appreciated
      
    } catch (error) {
      console.error("Error in bulk skip:", error);
      setBulkSkipInProgress(false);
      showNotification({
        type: "error",
        title: "Bulk Skip Failed",
        message: "Failed to skip some transactions. Please try again.",
      });
    }
  };
  
  const bulkGeneratePDF = async () => {
    if (selectedItems.size === 0 || bulkGenerateInProgress) return;
    
    try {
      const itemsToGenerate = Array.from(selectedItems);
      const candidatesToGenerate = filteredAndSortedCandidates.filter(candidate => {
        const candidateId = (candidate as any)._id;
        return itemsToGenerate.includes(candidateId) && !generatedReceipts.has(candidateId);
      });
      
      if (candidatesToGenerate.length === 0) {
        showNotification({
          type: "info",
          title: "No PDFs to Generate",
          message: "All selected transactions already have PDFs generated.",
        });
        return;
      }
      
      // Start the bulk generation process
      setBulkGenerateInProgress(true);
      setBulkGenerateProgress({ current: 0, total: candidatesToGenerate.length, currentItem: 'Preparing...' });
      
      showNotification({
        type: "info",
        title: "Bulk PDF Generation Started",
        message: `Generating PDFs for ${candidatesToGenerate.length} transactions...`,
      });
      
      // Track progress
      let successCount = 0;
      let failCount = 0;
      
      // Process each selected item
      for (let i = 0; i < candidatesToGenerate.length; i++) {
        const candidate = candidatesToGenerate[i];
        const candidateId = (candidate as any)._id;
        
        try {
          console.log(`🔄 Bulk generating PDF ${i + 1}/${candidatesToGenerate.length} for:`, candidateId);
          
          // Update progress with current item
          const merchantName = candidate.transaction.merchant_name || candidate.transaction.name || 'Unknown Merchant';
          setBulkGenerateProgress({ 
            current: i, 
            total: candidatesToGenerate.length, 
            currentItem: `Processing ${merchantName}...` 
          });
          
          // Clear any previous cancellation for this candidate
          cancelledOperations.current.delete(candidateId);
          
          const generatedReceipt = await bankReceiptService.generateReceiptForTransaction(
            candidateId,
            candidate.transaction,
            user!.uid
          );
          
          // Check if operation was cancelled
          if (cancelledOperations.current.has(candidateId)) {
            console.log('🔍 Generation was cancelled during bulk operation');
            cancelledOperations.current.delete(candidateId);
            continue;
          }
          
          // Store the generated receipt
          setGeneratedReceipts((prev) => {
            const newMap = new Map(prev);
            newMap.set(candidateId, generatedReceipt);
            return newMap;
          });
          
          successCount++;
          
          // Update progress after successful generation
          setBulkGenerateProgress({ 
            current: i + 1, 
            total: candidatesToGenerate.length, 
            currentItem: `Generated PDF for ${merchantName}` 
          });
          
          // Small delay between generations to prevent overwhelming the system
          if (i < candidatesToGenerate.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (error) {
          console.error(`❌ Error generating PDF for ${candidateId}:`, error);
          failCount++;
          
          // Update progress after failed generation
          const merchantName = candidate.transaction.merchant_name || candidate.transaction.name || 'Unknown Merchant';
          setBulkGenerateProgress({ 
            current: i + 1, 
            total: candidatesToGenerate.length, 
            currentItem: `Failed to generate PDF for ${merchantName}` 
          });
        }
      }
      
      // Final progress update
      setBulkGenerateProgress({ 
        current: candidatesToGenerate.length, 
        total: candidatesToGenerate.length, 
        currentItem: 'Completing...' 
      });
      
      // Clear selection and exit bulk mode
      // Cleanup state and memory after bulk operations
      setTimeout(() => {
        setSelectedItems(new Set());
        setBulkMode(false);
        setBulkGenerateInProgress(false);
        setBulkGenerateProgress({ current: 0, total: 0, currentItem: '' });
        setGeneratingReceipt(null);
        
        // Force garbage collection if available (helps with memory after bulk PDF generation)
        if (global.gc && typeof global.gc === 'function') {
          try {
            global.gc();
            console.log('🧹 Triggered garbage collection after bulk PDF generation');
          } catch (e) {
            // Garbage collection not available in release mode, which is fine
          }
        }
      }, 1000);
      
      setBulkGenerateInProgress(false);
      
      // Show notification only for errors or partial failures
      if (failCount > 0 && successCount > 0) {
        showNotification({
          type: "warning",
          title: "Bulk PDF Generation Partial",
          message: `Generated ${successCount} PDFs successfully. ${failCount} failed.`,
        });
      } else if (failCount > 0 && successCount === 0) {
        showNotification({
          type: "error",
          title: "Bulk PDF Generation Failed",
          message: "Failed to generate any PDFs. Please try again.",
        });
      }
      // No notification for complete success (failCount === 0)
      
    } catch (error) {
      console.error("Error in bulk PDF generation:", error);
      setBulkGenerateInProgress(false);
      setBulkGenerateProgress({ current: 0, total: 0, currentItem: '' });
      showNotification({
        type: "error",
        title: "Bulk PDF Generation Failed",
        message: "Failed to generate PDFs. Please try again.",
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

  // FlatList item renderer - memoized to prevent unnecessary re-renders
  const renderTransactionItem = useCallback(({
    item: candidate,
  }: {
    item: TransactionCandidate & { _id?: string };
  }) => {
    const docId =
      (candidate as any)._id ??
      `${candidate.transaction.transaction_id}_fallback`;
    const generatedReceipt = generatedReceipts.get(docId);
    const isGenerating = generatingReceipt === docId;
    const isSelected = selectedItems.has(docId);
    // Removed console.log to improve performance

    return (
      <TouchableOpacity
        style={[styles.candidateCard, isSelected && styles.candidateCardSelected]}
        onPress={() => {
          if (bulkMode) {
            toggleItemSelection(docId);
          }
        }}
        onLongPress={() => {
          if (!bulkMode) {
            // Enter bulk mode and select this item (following My Receipts pattern)
            setBulkMode(true);
            setSelectedItems(new Set([docId]));
            setShowSearchSection(false); // Hide search when entering bulk mode
          }
        }}
        activeOpacity={bulkMode ? 0.7 : 0.8}
        delayLongPress={500}
      >
        <View style={styles.candidateHeader}>
          {bulkMode && (
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => toggleItemSelection(docId)}
            >
              <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                {isSelected && (
                  <Ionicons name="checkmark" size={16} color="white" />
                )}
              </View>
            </TouchableOpacity>
          )}
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

            <View style={styles.pdfPlaceholderContainer}>
              <TouchableOpacity 
                style={styles.pdfPlaceholder} 
                onPress={() => viewPDF(generatedReceipt)}
                activeOpacity={0.7}
              >
                <Ionicons name="document-text" size={24} color={theme.text.secondary} />
                <Text style={styles.pdfPlaceholderText}>PDF Generated</Text>
                <Text style={styles.pdfPlaceholderSubtext}>
                  {generatedReceipt.receiptData.businessName} • {generatedReceipt.receiptData.date}
                </Text>
                <Ionicons name="eye" size={16} color={theme.gold.primary} style={{ marginTop: 4 }} />
              </TouchableOpacity>
            </View>

            <Text style={styles.receiptDetails}>
              {generatedReceipt.receiptData.businessName} •{" "}
              {generatedReceipt.receiptData.date}
            </Text>
          </View>
        )}

        {!bulkMode && (
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
                    {isGenerating ? (generatedReceipt ? "Saving..." : "Generating...") : "Save Receipt"}
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
        )}
      </TouchableOpacity>
    );
  }, [bulkMode, selectedItems, generatedReceipts, generatingReceipt, toggleItemSelection, generateReceipt, formatDate, formatCurrency, discardGeneratedReceipt, approveReceipt, theme]);

  // Section header for bank groups
  const renderSectionHeader = useCallback(({ section }: { section: { title: string, data: any[], connection: any } }) => {
    console.log("📱 Rendering section header for:", section.title, "with", section.data.length, "transactions");
    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderContent}>
          <Ionicons name="card-outline" size={24} color={theme.gold.primary} />
          <Text style={[styles.sectionHeaderText, { color: theme.text.primary }]}>
            {section.title}
          </Text>
          <Text style={[styles.sectionHeaderCount, { color: theme.text.secondary }]}>
            {section.data.length} transactions
          </Text>
        </View>
      </View>
    );
  }, [theme]);

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
    hintText: {
      fontSize: 12,
      color: theme.text.tertiary,
      textAlign: "center",
      marginTop: 2,
      fontStyle: "italic",
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
    candidateCardSelected: {
      borderColor: theme.gold.primary,
      borderWidth: 2,
      backgroundColor: theme.background.tertiary,
    },
    candidateHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 12,
    },
    checkboxContainer: {
      marginRight: 12,
      justifyContent: "center",
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: theme.border.secondary,
      backgroundColor: theme.background.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    checkboxSelected: {
      backgroundColor: theme.gold.primary,
      borderColor: theme.gold.primary,
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
    pdfPlaceholderContainer: {
      backgroundColor: theme.background.secondary,
      borderRadius: 8,
      marginVertical: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
      height: 120, // Much smaller than PDF viewer
    },
    pdfPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      flex: 1,
      padding: 16,
      borderRadius: 8,
      backgroundColor: theme.background.secondary,
    },
    pdfPlaceholderText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.text.primary,
      marginTop: 8,
    },
    pdfPlaceholderSubtext: {
      fontSize: 12,
      color: theme.text.secondary,
      marginTop: 4,
      textAlign: "center",
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
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 40,
      gap: 24,
    },
    loadingAnimation: {
      marginBottom: 8,
    },
    loadingMessageContainer: {
      minHeight: 60,
      justifyContent: "center",
      alignItems: "center",
    },
    loadingText: {
      fontSize: 18,
      color: theme.text.primary,
      textAlign: "center",
      fontWeight: "500",
      lineHeight: 24,
      maxWidth: 300,
    },
    bankStatusContainer: {
      marginTop: 24,
      paddingHorizontal: 20,
    },
    bankStatusCard: {
      backgroundColor: theme.background.secondary,
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-start",
      borderWidth: 1,
      borderColor: theme.gold.primary + "20", // 20% opacity
      shadowColor: theme.gold.primary,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
      minHeight: 50,
      width: "100%",
    },
    bankStatusIcon: {
      marginRight: 8,
      padding: 4,
      backgroundColor: theme.gold.primary + "15", // 15% opacity
      borderRadius: 8,
    },
    bankStatusText: {
      flex: 1,
      fontSize: 15,
      fontWeight: "500",
      color: theme.text.primary,
      textAlign: "left",
      marginLeft: 10,
      lineHeight: 20,
      flexWrap: "wrap",
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
    // Beautiful Bulk Selection Styles
    bulkHeader: {
      paddingVertical: 20,
      paddingHorizontal: 24,
      backgroundColor: theme.background.secondary,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
      gap: 20,
    },
    
    // Top Row: Cancel & Count
    bulkTopRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 4,
      paddingHorizontal: 4,
    },
    bulkSpacer: {
      flex: 1,
      minWidth: 20,
    },
    bulkCancelButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.border.secondary,
    },
    bulkCancelIcon: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.background.tertiary,
      justifyContent: "center",
      alignItems: "center",
    },
    bulkCancelText: {
      fontSize: 14,
      color: theme.text.primary,
      fontWeight: "500",
    },
    bulkSelectionCount: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    bulkCountBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.gold.primary,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: theme.gold.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 4,
    },
    bulkCountNumber: {
      fontSize: 14,
      color: "white",
      fontWeight: "700",
    },
    bulkCountLabel: {
      fontSize: 12,
      color: theme.text.secondary,
      fontWeight: "500",
    },
    
    // Middle Row: Select All
    bulkMiddleRow: {
      paddingHorizontal: 4,
      marginVertical: 2,
    },
    bulkSelectAllButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: 14,
      backgroundColor: theme.background.primary,
      borderWidth: 1,
      borderColor: theme.border.secondary,
    },
    bulkSelectAllButtonActive: {
      backgroundColor: theme.background.tertiary,
      borderColor: theme.gold.primary,
    },
    bulkSelectAllIcon: {
      width: 24,
      height: 24,
      justifyContent: "center",
      alignItems: "center",
    },
    bulkSelectAllText: {
      fontSize: 14,
      color: theme.text.primary,
      fontWeight: "500",
    },
    bulkSelectAllTextActive: {
      color: theme.gold.primary,
      fontWeight: "600",
    },
    
    // Bottom Row: Action Buttons
    bulkActionRow: {
      flexDirection: "row",
      gap: 8,
    },
    bulkActionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 14,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 6,
      elevation: 3,
      minHeight: 52,
      flex: 1,
    },
    bulkActionButtonDisabled: {
      opacity: 0.5,
      shadowOpacity: 0,
      elevation: 0,
    },
    bulkGenerateButton: {
      backgroundColor: theme.gold.primary,
      shadowColor: theme.gold.primary,
    },
    bulkSkipButton: {
      backgroundColor: theme.status.error,
      shadowColor: theme.status.error,
    },
    bulkActionIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      justifyContent: "center",
      alignItems: "center",
    },
    bulkActionContent: {
      flex: 1,
    },
    bulkActionTitle: {
      fontSize: 14,
      color: "white",
      fontWeight: "600",
      marginBottom: 1,
      flexShrink: 0,
    },
    bulkActionCount: {
      fontSize: 11,
      color: "rgba(255, 255, 255, 0.85)",
      fontWeight: "500",
    },
    normalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 4,
    },
    bulkModeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    bulkModeButtonText: {
      fontSize: 14,
      color: theme.text.secondary,
      fontWeight: "500",
    },
    
    // Beautiful Bulk Operation Overlay
    bulkOperationOverlay: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
    },
    bulkOperationCard: {
      backgroundColor: theme.background.primary,
      borderRadius: 24,
      padding: 32,
      alignItems: "center",
      marginHorizontal: 40,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
      width: 320,
      minHeight: 280,
      justifyContent: "center",
    },
    bulkOperationAnimation: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: theme.background.secondary,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 24,
    },
    bulkOperationTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.text.primary,
      marginBottom: 8,
      textAlign: "center",
      width: "100%",
      maxWidth: 260,
    },
    bulkOperationSubtitle: {
      fontSize: 14,
      color: theme.text.secondary,
      textAlign: "center",
      marginBottom: 16,
      lineHeight: 20,
      width: "100%",
      maxWidth: 260,
      height: 20,
    },
    bulkOperationProgress: {
      width: "100%",
      height: 4,
      backgroundColor: theme.background.tertiary,
      borderRadius: 2,
      overflow: "hidden",
    },
    bulkOperationProgressBar: {
      height: "100%",
      backgroundColor: theme.gold.primary,
      borderRadius: 2,
    },
    bulkOperationCurrentItem: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 8,
      fontStyle: "italic",
      lineHeight: 16,
      width: "100%",
      maxWidth: 260,
      height: 32,
    },
    bulkOperationPercentage: {
      fontSize: 16,
      fontWeight: "600",
      color: theme.gold.primary,
      textAlign: "center",
      marginTop: 8,
      width: "100%",
      height: 20,
    },
    
    // Security Trust UI
    securityBanner: {
      backgroundColor: theme.background.secondary,
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: theme.border.primary,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    securityBannerHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
      gap: 12,
    },
    securityIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.background.tertiary,
      justifyContent: "center",
      alignItems: "center",
    },
    securityBannerTitle: {
      fontSize: 18,
      fontWeight: "700",
      color: theme.text.primary,
      flex: 1,
    },
    securityFeatures: {
      gap: 12,
      marginBottom: 16,
    },
    securityFeature: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    securityFeatureText: {
      fontSize: 14,
      color: theme.text.secondary,
      flex: 1,
      fontWeight: "500",
    },
    securityBadge: {
      backgroundColor: theme.gold.primary,
      borderRadius: 12,
      paddingVertical: 8,
      paddingHorizontal: 16,
      alignItems: "center",
    },
    securityBadgeText: {
      fontSize: 14,
      fontWeight: "700",
      color: "white",
    },
    securityBadgeSubtext: {
      fontSize: 12,
      color: "rgba(255, 255, 255, 0.8)",
      marginTop: 2,
    },
    securityIndicator: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 4,
    },
    securityIndicatorText: {
      fontSize: 12,
      color: theme.gold.primary,
      fontWeight: "500",
    },
    sectionHeader: {
      backgroundColor: theme.background.secondary,
      paddingHorizontal: 20,
      paddingVertical: 16,
      marginTop: 0,
      marginBottom: 8,
      marginHorizontal: 16,
      borderRadius: 12,
      minHeight: 56,
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      borderWidth: 1,
      borderColor: theme.gold.primary + '20',
    },
    sectionHeaderContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    sectionHeaderText: {
      fontSize: 18,
      fontWeight: "700",
      flex: 1,
      letterSpacing: 0.5,
    },
    sectionHeaderCount: {
      fontSize: 14,
      fontWeight: "600",
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: theme.gold.primary + '20',
      borderRadius: 12,
      overflow: 'hidden',
    },
    
    // PDF Overlay styles
    pdfOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      pointerEvents: 'box-none', // Allow touches to pass through to PDF
    },
    pdfTopButtons: {
      position: 'absolute',
      top: 60,
      right: 20,
      flexDirection: 'row',
      gap: 16,
    },
    pdfOverlayButton: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
      borderWidth: 0.5,
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
  });

  // Check if user has Professional subscription or active trial
  if (subscription.currentTier !== "professional" && !subscription.trial.isActive) {
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
          <View style={styles.loadingAnimation}>
            <ActivityIndicator size="large" color={theme.gold.primary} />
          </View>
          <View style={styles.loadingMessageContainer}>
            <Animated.Text 
              style={[
                styles.loadingText,
                { opacity: fadeAnim }
              ]}
            >
              {loadingMessages[currentLoadingMessage]}
            </Animated.Text>
          </View>

          {/* Beautiful Bank Status Section */}
          {currentBankStatus && (
            <View style={styles.bankStatusContainer}>
              <View style={styles.bankStatusCard}>
                <View style={styles.bankStatusIcon}>
                  <Ionicons name="card" size={16} color={theme.gold.primary} />
                </View>
                <Text style={styles.bankStatusText}>
                  {currentBankStatus}
                </Text>
              </View>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {candidates.length > 0 && (
        <View style={styles.countContainer}>
          {bulkMode ? (
            <View style={styles.bulkHeader}>
              {/* Top Row: Cancel & Selection Count */}
              <View style={styles.bulkTopRow}>
                <TouchableOpacity
                  style={styles.bulkCancelButton}
                  onPress={() => {
                    setBulkMode(false);
                    setSelectedItems(new Set());
                  }}
                >
                  <View style={styles.bulkCancelIcon}>
                    <Ionicons name="arrow-back" size={18} color={theme.text.primary} />
                  </View>
                  <Text style={styles.bulkCancelText}>Cancel</Text>
                </TouchableOpacity>
                
                <View style={styles.bulkSpacer} />
                
                <View style={styles.bulkSelectionCount}>
                  <View style={styles.bulkCountBadge}>
                    <Text style={styles.bulkCountNumber}>{selectedItems.size}</Text>
                  </View>
                  <Text style={styles.bulkCountLabel}>
                    of {filteredAndSortedCandidates.length} selected
                  </Text>
                </View>
              </View>
              
              {/* Middle Row: Select All Toggle */}
              <View style={styles.bulkMiddleRow}>
                <TouchableOpacity
                  style={[
                    styles.bulkSelectAllButton,
                    selectedItems.size === filteredAndSortedCandidates.length && styles.bulkSelectAllButtonActive
                  ]}
                  onPress={selectedItems.size === filteredAndSortedCandidates.length ? deselectAll : selectAll}
                >
                  <View style={styles.bulkSelectAllIcon}>
                    <Ionicons 
                      name={selectedItems.size === filteredAndSortedCandidates.length ? "checkbox" : "square-outline"} 
                      size={20} 
                      color={selectedItems.size === filteredAndSortedCandidates.length ? theme.gold.primary : theme.text.secondary} 
                    />
                  </View>
                  <Text style={[
                    styles.bulkSelectAllText,
                    selectedItems.size === filteredAndSortedCandidates.length && styles.bulkSelectAllTextActive
                  ]}>
                    {selectedItems.size === filteredAndSortedCandidates.length ? "Deselect All" : "Select All"}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {/* Bottom Row: Action Buttons */}
              <View style={styles.bulkActionRow}>
                <TouchableOpacity
                  style={[
                    styles.bulkActionButton,
                    styles.bulkGenerateButton,
                    (selectedItems.size === 0 || Array.from(selectedItems).filter(id => !generatedReceipts.has(id)).length === 0 || bulkGenerateInProgress) && styles.bulkActionButtonDisabled
                  ]}
                  onPress={bulkGeneratePDF}
                  disabled={selectedItems.size === 0 || Array.from(selectedItems).filter(id => !generatedReceipts.has(id)).length === 0 || bulkGenerateInProgress}
                >
                  <View style={styles.bulkActionIcon}>
                    <Ionicons name="document-text" size={16} color="white" />
                  </View>
                  <View style={styles.bulkActionContent}>
                    <Text style={styles.bulkActionTitle} numberOfLines={1}>
                      {bulkGenerateInProgress ? "Generating..." : "Generate PDF"}
                    </Text>
                    <Text style={styles.bulkActionCount} numberOfLines={1}>
                      {Array.from(selectedItems).filter(id => !generatedReceipts.has(id)).length} items
                    </Text>
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.bulkActionButton,
                    styles.bulkSkipButton,
                    (selectedItems.size === 0 || bulkSkipInProgress) && styles.bulkActionButtonDisabled
                  ]}
                  onPress={bulkSkip}
                  disabled={selectedItems.size === 0 || bulkSkipInProgress}
                >
                  <View style={styles.bulkActionIcon}>
                    <Ionicons name="close-circle" size={16} color="white" />
                  </View>
                  <View style={styles.bulkActionContent}>
                    <Text style={styles.bulkActionTitle} numberOfLines={1}>
                      {bulkSkipInProgress ? "Skipping..." : "Skip"}
                    </Text>
                    <Text style={styles.bulkActionCount} numberOfLines={1}>
                      {selectedItems.size} items
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.normalHeader}>
              <View>
                <Text style={styles.countText}>
                  {filteredAndSortedCandidates.length === 0 && hasActiveFilters
                    ? `No transactions match the current filter`
                    : filteredAndSortedCandidates.length === 0
                    ? "No recent purchases found"
                    : `${filteredAndSortedCandidates.length} of ${candidates.length} transactions`}
                </Text>
                {bankConnections.length > 0 && (
                  <View style={styles.securityIndicator}>
                    <Ionicons name="shield-checkmark" size={12} color={theme.gold.primary} />
                    <Text style={styles.securityIndicatorText}>Securely connected</Text>
                  </View>
                )}
                {filteredAndSortedCandidates.length > 0 && (
                  <Text style={styles.hintText}>
                    Long press any transaction to select multiple
                  </Text>
                )}
              </View>
              
              {filteredAndSortedCandidates.length > 0 && (
                <TouchableOpacity
                  style={styles.bulkModeButton}
                  onPress={() => {
                    setBulkMode(true);
                    setShowSearchSection(false); // Hide search when entering bulk mode
                  }}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={theme.text.secondary} />
                  <Text style={styles.bulkModeButtonText}>Select</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Active Filter Badges - only show when not in bulk mode */}
          {!showSearchSection && hasActiveFilters && !bulkMode && (
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
                {quickFilterOptions.map((option) => (
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
          {bankConnections.length === 0 && (
            <View style={styles.securityBanner}>
              <View style={styles.securityBannerHeader}>
                <View style={styles.securityIconContainer}>
                  <Ionicons name="shield-checkmark" size={32} color={theme.gold.primary} />
                </View>
                <Text style={styles.securityBannerTitle}>Your Security is Our Priority</Text>
              </View>
              <View style={styles.securityFeatures}>
                <View style={styles.securityFeature}>
                  <Ionicons name="lock-closed" size={16} color={theme.text.secondary} />
                  <Text style={styles.securityFeatureText}>Bank-grade 256-bit encryption</Text>
                </View>
                <View style={styles.securityFeature}>
                  <Ionicons name="eye-off" size={16} color={theme.text.secondary} />
                  <Text style={styles.securityFeatureText}>Read-only access - we can't move money</Text>
                </View>
                <View style={styles.securityFeature}>
                  <Ionicons name="key" size={16} color={theme.text.secondary} />
                  <Text style={styles.securityFeatureText}>Never store your login credentials</Text>
                </View>
                <View style={styles.securityFeature}>
                  <Ionicons name="business" size={16} color={theme.text.secondary} />
                  <Text style={styles.securityFeatureText}>Powered by Plaid - trusted by millions</Text>
                </View>
              </View>
              <View style={styles.securityBadge}>
                <Text style={styles.securityBadgeText}>🔒 Secure & Safe</Text>
                <Text style={styles.securityBadgeSubtext}>Disconnect anytime with one tap</Text>
              </View>
            </View>
          )}
          
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
      ) : groupedTransactions.length > 0 ? (
        <SectionList
          sections={groupedTransactions}
          renderItem={renderTransactionItem}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) =>
            (item as any)._id ?? `${item.transaction.transaction_id}_fallback`
          }
          stickySectionHeadersEnabled={true}
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
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={200}
          legacyImplementation={false}
          ItemSeparatorComponent={null}
        />
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
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={3}
          removeClippedSubviews={true}
          updateCellsBatchingPeriod={200}
          legacyImplementation={false}
          getItemLayout={(data, index) => ({
            length: 180, // Reduced height since PDF placeholder is smaller
            offset: 180 * index,
            index,
          })}
        />
      )}

      {/* Beautiful Bulk Operation Overlay */}
      {(bulkSkipInProgress || bulkGenerateInProgress) && (
        <View style={styles.bulkOperationOverlay}>
          <View style={styles.bulkOperationCard}>
            <View style={styles.bulkOperationAnimation}>
              <Ionicons 
                name={bulkSkipInProgress ? "trash-outline" : "document-text-outline"} 
                size={48} 
                color={theme.gold.primary} 
              />
            </View>
            <Text style={styles.bulkOperationTitle}>
              {bulkSkipInProgress ? "Skipping Transactions" : "Generating PDFs"}
            </Text>
            <Text style={styles.bulkOperationSubtitle}>
              {bulkSkipInProgress 
                ? `Processing ${selectedItems.size} transactions...`
                : bulkGenerateProgress.total > 0
                  ? `${bulkGenerateProgress.current} of ${bulkGenerateProgress.total} PDFs ${bulkGenerateProgress.current === bulkGenerateProgress.total ? 'completed' : 'generated'}`
                  : `Creating PDFs for selected transactions...`
              }
            </Text>
            {!bulkSkipInProgress && (
              <Text style={styles.bulkOperationCurrentItem} numberOfLines={2}>
                {bulkGenerateProgress.currentItem || " "}
              </Text>
            )}
            <View style={styles.bulkOperationProgress}>
              <View style={[
                styles.bulkOperationProgressBar, 
                { 
                  width: bulkSkipInProgress || bulkGenerateProgress.total === 0 
                    ? '100%' 
                    : `${Math.round((bulkGenerateProgress.current / bulkGenerateProgress.total) * 100)}%` 
                }
              ]} />
            </View>
            {!bulkSkipInProgress && (
              <Text style={styles.bulkOperationPercentage}>
                {bulkGenerateProgress.total > 0 
                  ? `${Math.round((bulkGenerateProgress.current / bulkGenerateProgress.total) * 100)}%`
                  : " "
                }
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Smart Filter FAB - hide when in bulk mode */}
      {candidates.length > 0 && !bulkMode && (
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

      {/* PDF Viewer Modal */}
      <Modal
        visible={pdfModalVisible}
        animationType="slide"
        onRequestClose={() => setPdfModalVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {selectedPdfUri && (
            <Pdf
              source={{ uri: selectedPdfUri }}
              style={{ flex: 1 }}
              onLoadComplete={(numberOfPages) => {
                console.log(`PDF loaded with ${numberOfPages} pages`);
              }}
              onError={(error) => {
                console.log('PDF load error:', error);
                showNotification({
                  type: "error",
                  title: "PDF Load Error",
                  message: "Failed to load PDF file.",
                });
              }}
            />
          )}
          
          {/* Overlay Controls */}
          <View style={styles.pdfOverlay}>
            {/* Top buttons */}
            <View style={styles.pdfTopButtons}>
              <TouchableOpacity 
                onPress={sharePDF}
                style={styles.pdfOverlayButton}
              >
                <Ionicons name="share" size={24} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => setPdfModalVisible(false)}
                style={styles.pdfOverlayButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default BankTransactionsScreen;
