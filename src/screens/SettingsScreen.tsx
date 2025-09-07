import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  useColorScheme,
  TextInput,
  Dimensions,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { SettingsStackParamList } from "../navigation/AppNavigator";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useAuth } from "../context/AuthContext";
import { useBusiness } from "../context/BusinessContext";
import { useTeam } from "../context/TeamContext";
import { useStripePayments } from "../hooks/useStripePayments";
import { Ionicons } from "@expo/vector-icons";
import {
  doc,
  updateDoc,
  getDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import {
  getAuth,
  updateProfile,
  EmailAuthProvider,
  updatePassword,
  reauthenticateWithCredential,
  deleteUser,
} from "firebase/auth";
import { useCustomAlert } from "../hooks/useCustomAlert";
import { FirebaseErrorScenarios } from "../utils/firebaseErrorHandler";
import {
  BankReceiptService,
  BankConnection,
} from "../services/BankReceiptService";
import { PlaidService } from "../services/PlaidService";
import { LinkSuccess, LinkExit } from "react-native-plaid-link-sdk";
import { BrandText, HeadingText, BodyText, ButtonText } from '../components/Typography';
import { Signature } from '../components/Signature';
import { useInAppNotifications } from '../components/InAppNotificationProvider';
import { NotificationService } from '../services/NotificationService';
import { useNotifications } from '../hooks/useNotifications';
import { useTabNavigation, navigationHelpers } from "../navigation/navigationHelpers";
import { CustomCategoryService, CustomCategory } from '../services/CustomCategoryService';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  children,
}) => {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      <View
        style={[
          styles.sectionContent,
          {
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

interface SettingsRowProps {
  label: string;
  value?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  description?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  isSwitch,
  switchValue,
  onSwitchChange,
  onPress,
  rightElement,
  description,
}) => {
  const { theme } = useTheme();

  const content = (
    <>
      <View style={styles.settingsRowMain}>
        <Text style={[styles.settingsLabel, { color: theme.text.primary }]}>
          {label}
        </Text>
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{
              false: theme.text.tertiary,
              true: theme.gold.primary,
            }}
            thumbColor={switchValue ? "#FFFFFF" : "#F4F3F4"}
            ios_backgroundColor={theme.text.tertiary}
          />
        ) : rightElement ? (
          rightElement
        ) : value ? (
          <Text style={[styles.settingsValue, { color: theme.text.secondary }]}>
            {value}
          </Text>
        ) : (
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.text.tertiary}
          />
        )}
      </View>
      {description && (
        <Text
          style={[styles.settingsDescription, { color: theme.text.tertiary }]}
        >
          {description}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.settingsRow, { borderColor: theme.border.primary }]}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.settingsRow, { borderColor: theme.border.primary }]}>
      {content}
    </View>
  );
};

// Helper function to safely format dates
const formatConnectionDate = (dateValue: any): string => {
  if (!dateValue) {
    return 'Unknown';
  }
  const date = new Date(dateValue);
  return isNaN(date.getTime()) ? 'Unknown' : date.toLocaleDateString();
};

export const SettingsScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { subscription, canAccessFeature } = useSubscription();
  console.log("🚀 ~ SettingsScreen ~ subscription:", subscription);
  const { user, logout, refreshUser } = useAuth();
  const { businesses, selectedBusiness } = useBusiness();
  const { teamMembers, teamInvitations, canInviteMembers } = useTeam();
  const { handleSubscriptionWithCloudFunction, SUBSCRIPTION_TIERS } =
    useStripePayments();
  const navigation =
    useNavigation<StackNavigationProp<SettingsStackParamList>>();
  const {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showFirebaseError,
    hideAlert,
  } = useCustomAlert();
  const tabNavigation = useTabNavigation();
  const { showNotification } = useInAppNotifications();
  const { getFCMToken, getPermissionStatus, scheduleLocalNotification, scheduleNotificationWithSettings, notificationsEnabled, isInQuietHours } = useNotifications();

  const [userData, setUserData] = React.useState<{
    firstName?: string;
    lastName?: string;
  }>({});
  const [emailUpdates, setEmailUpdates] = React.useState(true);
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [showNameDialog, setShowNameDialog] = React.useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] =
    React.useState(false);
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [deleteConfirmPassword, setDeleteConfirmPassword] = React.useState("");
  const [showDeletePassword, setShowDeletePassword] = React.useState(false);

  const canUseBankConnection = canAccessFeature("bankConnection");

  // Fetch user data from Firestore
  React.useEffect(() => {
    if (!user) return;

    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setFirstName(data.firstName || "");
          setLastName(data.lastName || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user]);

  // Fetch bank connections and custom categories on focus
  const lastRefreshTime = React.useRef<number>(0);
  
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        // Debounce refreshes to prevent theme changes from triggering unnecessary loads
        const now = Date.now();
        const timeSinceLastRefresh = now - lastRefreshTime.current;
        
        // Only refresh if it's been more than 2 seconds since last refresh
        if (timeSinceLastRefresh > 2000) {
          lastRefreshTime.current = now;
          
          // Only refresh bank connections for professional tier or trial users
          if (subscription.currentTier === 'professional' || subscription.trial.isActive) {
            refreshBankConnections();
          }
          loadCustomCategories();
        }
      }
    }, [user, subscription.currentTier])
  );
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  // Bank accounts state
  const [bankConnections, setBankConnections] = React.useState<
    BankConnection[]
  >([]);
  const [loadingBankConnections, setLoadingBankConnections] =
    React.useState(true);
  const [disconnectingAccount, setDisconnectingAccount] = React.useState<
    string | null
  >(null);

  // Services
  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();

  // Custom categories state
  const [customCategories, setCustomCategories] = React.useState<CustomCategory[]>([]);
  const [loadingCustomCategories, setLoadingCustomCategories] = React.useState(false);
  const [showCreateCategoryDialog, setShowCreateCategoryDialog] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newCategoryIcon, setNewCategoryIcon] = React.useState("📁");
  const [isCreatingCategory, setIsCreatingCategory] = React.useState(false);

  const handleNameChange = async () => {
    if (!user || !firstName.trim()) return;

    setIsLoading(true);
    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const fullName = `${trimmedFirstName}${
        trimmedLastName ? " " + trimmedLastName : ""
      }`;

      const auth = getAuth();
      await updateProfile(auth.currentUser!, {
        displayName: fullName,
      });

      // Update Firestore user document with both displayName and split name fields
      const updatedData = {
        displayName: fullName,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      };

      await updateDoc(doc(db, "users", user.uid), updatedData);

      // Update local state
      setUserData((prev) => ({ ...prev, ...updatedData }));

      // Refresh the Firebase user to get updated displayName
      await refreshUser();

      setShowNameDialog(false);
    } catch (error: any) {
      showFirebaseError(error, "Failed to Update Name");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    console.log("handlePasswordChange called", {
      hasUser: !!user,
      currentPasswordLength: currentPassword?.length || 0,
      newPasswordLength: newPassword?.length || 0,
      confirmPasswordLength: confirmPassword?.length || 0,
    });

    if (!user || !currentPassword || !newPassword || !confirmPassword) {
      console.log("Missing required fields for password change");
      showError("Error", "Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      console.log("Passwords do not match");
      showError("Error", "New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      console.log("Password too short");
      showError("Error", "New password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Starting password change process");
      const auth = getAuth();
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );

      // First reauthenticate
      console.log("Reauthenticating user");
      await reauthenticateWithCredential(auth.currentUser!, credential);

      // Then update password
      console.log("Updating password");
      await updatePassword(auth.currentUser!, newPassword);

      console.log("Password updated successfully");
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      showSuccess("Success", "Password updated successfully");
    } catch (error: any) {
      console.error("Password change error:", error);
      showFirebaseError(error, FirebaseErrorScenarios.AUTH.PROFILE_UPDATE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tierId: string) => {
    if (!user?.email) {
      showError("Error", "You must be logged in to upgrade");
      return;
    }

    setIsUpgrading(true);
    try {
      const showAlert = (
        type: "error" | "success" | "warning",
        title: string,
        message: string
      ) => {
        switch (type) {
          case "error":
            showError(title, message);
            break;
          case "success":
            showSuccess(title, message);
            break;
          case "warning":
            showWarning(title, message);
            break;
        }
      };

      await handleSubscriptionWithCloudFunction(
        tierId as any,
        user.email,
        user.displayName || "User",
        undefined,
        showAlert
      );
    } catch (error) {
      console.error("Failed to upgrade:", error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleThemeChange = async (isDark: boolean) => {
    if (!user) return;
    
    // Immediately update the theme for smooth UX
    toggleTheme();
    
    // Update Firestore in the background without blocking the UI
    const newTheme = isDark ? "dark" : "light";
    try {
      // Don't await this - let it happen in the background
      updateDoc(doc(db, "users", user.uid), {
        settings: {
          theme: newTheme,
          defaultCurrency: "USD", // Preserve existing currency setting
        },
      }).catch(error => {
        console.error("Failed to update theme setting:", error);
        // If Firestore update fails, we could potentially revert the theme here
        // but for better UX, we'll keep the local change and just log the error
      });
    } catch (error) {
      console.error("Failed to update theme setting:", error);
    }
  };

  const handleEmailUpdatesChange = async (value: boolean) => {
    if (!user) return;
    setEmailUpdates(value);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        notificationSettings: {
          emailUpdates: value,
        },
      });
    } catch (error) {
      console.error("Failed to update email settings:", error);
    }
  };

  // Helper function to determine if connection needs repair
  const needsRepair = (connection: BankConnection) => {
    return connection.isActive && !connection.accessToken;
  };

  // Bank account handlers
  const handleRepairBankAccount = async (connection: BankConnection) => {
    if (!user) return;

    console.log('🔧 Starting repair flow for:', connection.institutionName);
    
    try {
      setIsLoading(true);
      
      // Create a link token - if no access token, use regular flow, otherwise use update mode
      let token;
      if (connection.accessToken) {
        console.log('🔧 Using update mode with existing access token');
        token = await plaidService.createLinkTokenForUpdate(user.uid, connection.accessToken);
      } else {
        console.log('🔧 No access token available, using regular link token for re-connection');
        token = await plaidService.createLinkToken(user.uid);
      }
      
      // Import Plaid SDK and open in update mode
      const { create, open } = await import("react-native-plaid-link-sdk");
      
      console.log("🔧 Opening Plaid Link in update mode...");
      
      // Create Link with update token
      create({ token });
      
      // Open Plaid Link
      open({
        onSuccess: (success: LinkSuccess) => handlePlaidRepairSuccess(success, connection),
        onExit: (exit: LinkExit) => {
          console.log("Plaid Link repair exited:", exit);
          setIsLoading(false);
          if (exit.error) {
            showError(
              "Repair Failed",
              `Failed to repair ${connection.institutionName} connection. ${exit.error.error_message || 'Please try again.'}`
            );
          }
        },
      });
      
    } catch (error) {
      console.error("Error starting repair flow:", error);
      setIsLoading(false);
      showError(
        "Repair Error",
        `Failed to start repair process for ${connection.institutionName}. Please try again.`
      );
    }
  };

  const handlePlaidRepairSuccess = async (success: LinkSuccess, connection: BankConnection) => {
    if (!user) return;

    try {
      console.log('✅ Repair successful, updating connection...');
      
      // Get the new access token
      const newAccessToken = await plaidService.exchangePublicToken(success.publicToken);
      
      // Update the existing connection with the new access token
      const updatedConnection = {
        ...connection,
        accessToken: newAccessToken,
        lastSyncAt: new Date(),
        // Reset any error states
        isActive: true,
      };

      // Save the updated connection locally
      await bankReceiptService.saveBankConnectionLocally(updatedConnection);

      // Update the UI state
      setBankConnections(prev => 
        prev.map(conn => 
          conn.id === connection.id ? updatedConnection : conn
        )
      );

      showSuccess(
        `${connection.institutionName} Repaired`,
        "Your bank connection has been successfully repaired and is now working normally."
      );

      console.log('✅ Bank connection repair completed successfully');
      
    } catch (error) {
      console.error("Error completing repair:", error);
      showError(
        "Repair Failed",
        `Failed to complete repair for ${connection.institutionName}. Please try again.`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectBankAccount = async (connection: BankConnection) => {
    const performDisconnect = async () => {
      if (!user) return;

      try {
        hideAlert(); // Close the alert first
        setDisconnectingAccount(connection.id);
        const bankReceiptService = BankReceiptService.getInstance();
        await bankReceiptService.disconnectBankAccount(user.uid, connection.id);

        // Update local state
        setBankConnections((prev) =>
          prev.filter((conn) => conn.id !== connection.id)
        );

        showNotification({
          type: "success",
          title: `${connection.institutionName} Disconnected`,
          message: "Account disconnected successfully",
        });
      } catch (error: any) {
        console.error("Error disconnecting bank account:", error);
        showError(
          "Error",
          "Failed to disconnect bank account. Please try again."
        );
      } finally {
        setDisconnectingAccount(null);
      }
    };

    // Use custom alert with warning type and two buttons
    showWarning(
      "Disconnect Bank Account",
      `Are you sure you want to disconnect ${connection.institutionName}? This will stop automatic receipt generation for this account.`,
      {
        primaryButtonText: "Disconnect",
        secondaryButtonText: "Cancel",
        onPrimaryPress: performDisconnect,
        onSecondaryPress: hideAlert, // Properly close the alert
      }
    );
  };

  // Refresh bank connections
  const refreshBankConnections = async () => {
    if (!user) return;
    
    // Only allow professional tier or trial users to access bank connections
    if (subscription.currentTier !== 'professional' && !subscription.trial.isActive) {
      console.log('🚫 Bank connections only available for professional tier or trial users');
      setBankConnections([]);
      return;
    }

    try {
      setLoadingBankConnections(true);
      console.log("🔄 Refreshing bank connections for user:", user.uid);
      const connections = await bankReceiptService.getBankConnections(user.uid);
      console.log("🔍 Raw connections:", connections.length, connections);
      const activeConnections = connections.filter((conn) => conn.isActive);
      console.log(
        "🔍 Active connections:",
        activeConnections.length,
        activeConnections
      );
      setBankConnections(activeConnections);
    } catch (error) {
      console.error("Error fetching bank connections:", error);
      setBankConnections([]);
    } finally {
      setLoadingBankConnections(false);
    }
  };

  // Load custom categories
  const loadCustomCategories = async () => {
    if (!user) return;

    try {
      setLoadingCustomCategories(true);
      const categories = await CustomCategoryService.getCustomCategories(user.uid);
      setCustomCategories(categories);
    } catch (error) {
      console.error("Error loading custom categories:", error);
      setCustomCategories([]);
    } finally {
      setLoadingCustomCategories(false);
    }
  };

  // Create custom category
  const handleCreateCustomCategory = async () => {
    if (!user) return;

    const validation = CustomCategoryService.validateCategoryName(newCategoryName);
    if (!validation.isValid) {
      showError("Invalid Category Name", validation.error!);
      return;
    }

    setIsCreatingCategory(true);
    try {
      const newCategory = await CustomCategoryService.createCustomCategory(
        user.uid,
        newCategoryName.trim(),
        newCategoryIcon
      );

      if (newCategory) {
        // Update local state
        setCustomCategories(prev => [...prev, newCategory]);
        setShowCreateCategoryDialog(false);
        setNewCategoryName("");
        setNewCategoryIcon("📁");
        showSuccess("Success", `"${newCategory.name}" category created successfully`);
      } else {
        showError("Error", "Failed to create custom category. Please try again.");
      }
    } catch (error) {
      console.error("Error creating custom category:", error);
      showError("Error", "Failed to create custom category. Please try again.");
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Delete custom category
  const handleDeleteCustomCategory = async (category: CustomCategory) => {
    const performDelete = async () => {
      if (!user) return;

      try {
        hideAlert();
        const success = await CustomCategoryService.deleteCustomCategory(user.uid, category.id);
        
        if (success) {
          // Update local state
          setCustomCategories(prev => prev.filter(cat => cat.id !== category.id));
          showSuccess("Success", `"${category.name}" category deleted successfully`);
        } else {
          showError("Error", "Failed to delete custom category. Please try again.");
        }
      } catch (error) {
        console.error("Error deleting custom category:", error);
        showError("Error", "Failed to delete custom category. Please try again.");
      }
    };

    showWarning(
      "Delete Custom Category",
      `Are you sure you want to delete the "${category.name}" category? This action cannot be undone.`,
      {
        primaryButtonText: "Delete",
        secondaryButtonText: "Cancel",
        onPrimaryPress: performDelete,
        onSecondaryPress: hideAlert,
      }
    );
  };

  // Plaid connection functions
  const connectBankAccount = async () => {
    if (!user) return;

    try {
      // Create link token and immediately open Plaid
      const token = await plaidService.createLinkToken(user.uid);

      // Import Plaid SDK and open directly
      const { create, open } = await import("react-native-plaid-link-sdk");

      console.log("🔗 Creating and opening Plaid Link directly...");

      // Create Link with token
      create({ token });

      // Wait a moment for create() to complete before opening
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Open Link with callbacks
      open({
        onSuccess: handlePlaidSuccess,
        onExit: (exit: LinkExit) => {
          console.log("Plaid Link exited:", exit);
          if (exit.error) {
            showError(
              "Connection Error",
              exit.error.errorMessage || "Failed to connect bank account."
            );
          }
        },
      });

      console.log("🔗 Plaid Link opened successfully");
    } catch (error) {
      console.error("Error opening Plaid Link:", error);
      showError(
        "Connection Error",
        "Failed to prepare bank connection. Please try again."
      );
    }
  };

  const handlePlaidSuccess = async (success: LinkSuccess) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const accessToken = await plaidService.exchangePublicToken(
        success.publicToken
      );
      const accounts = await plaidService.getAccounts(accessToken);

      // Get institution information
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
        setIsLoading(false);
        return;
      }

      // Create bank connection record
      const bankConnection = {
        id: `bank_${user.uid}_${Date.now()}`,
        userId: user.uid,
        accessToken,
        institutionName: institutionName,
        institutionId: institution?.institution_id,
        institutionLogo: institution?.logo,
        institutionColor: institution?.primary_color,
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

      // Small delay to ensure local storage is updated
      await new Promise(resolve => setTimeout(resolve, 100));

      // Refresh bank connections list immediately after saving
      await refreshBankConnections();

      showNotification({
        type: "success",
        title: `${bankConnection.institutionName} Connected`,
        message: "Account connected successfully",
      });

      // Automatically sync new transactions after connecting the bank
      try {
        console.log('🔄 Auto-syncing transactions for newly connected bank...');
        await bankReceiptService.clearTransactionCache(user.uid); // Clear any existing cache
        const candidates = await bankReceiptService.monitorTransactions(user.uid);
        console.log(`✅ Found ${candidates.length} transaction candidates from new bank connection`);
      } catch (syncError) {
        console.error('❌ Error auto-syncing transactions after bank connection:', syncError);
        // Don't show error to user - they can manually sync later
      }
    } catch (error) {
      console.error("Error handling Plaid success:", error);
      showError(
        "Connection Failed",
        "Failed to complete bank connection. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaidExit = (exit: LinkExit) => {
    console.log("Plaid Link exited:", exit);
    if (exit.error) {
      showError(
        "Connection Error",
        exit.error.errorMessage || "Failed to connect bank account."
      );
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    // Validate password
    if (!deleteConfirmPassword.trim()) {
      showError(
        "Error",
        "Please enter your password to confirm account deletion"
      );
      return;
    }

    setIsLoading(true);
    try {
      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(
        user.email!,
        deleteConfirmPassword
      );
      await reauthenticateWithCredential(user, credential);

      // Delete all user data from Firestore
      const batch = writeBatch(db);

      // Delete user document
      batch.delete(doc(db, "users", user.uid));

      // Delete all receipts
      const receiptsQuery = query(
        collection(db, "receipts"),
        where("userId", "==", user.uid)
      );
      const receiptsSnapshot = await getDocs(receiptsQuery);
      receiptsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete all budgets
      const budgetsQuery = query(
        collection(db, "budgets"),
        where("userId", "==", user.uid)
      );
      const budgetsSnapshot = await getDocs(budgetsQuery);
      budgetsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Commit the batch delete
      await batch.commit();

      // Delete the user account from Firebase Auth
      await deleteUser(user);

      showSuccess(
        "Account Deleted",
        "Your account and all associated data have been permanently deleted."
      );
    } catch (error: any) {
      showFirebaseError(error, "Failed to Delete Account");
    } finally {
      setIsLoading(false);
      setShowDeleteAccountDialog(false);
      setDeleteConfirmPassword("");
      setShowDeletePassword(false);
    }
  };

  const testNotifications = () => {
    // Test different notification types
    setTimeout(() => {
      showNotification({
        type: 'success',
        title: 'Receipt Processed',
        message: 'Your receipt has been successfully processed and saved!',
        action: {
          label: 'View',
          onPress: () => {
            console.log('Navigate to receipts');
            navigationHelpers.switchToReceiptsTab(tabNavigation);
          },
        },
      });
    }, 500);

    setTimeout(() => {
      showNotification({
        type: 'warning',
        title: 'Tax Deadline Approaching',
        message: 'Q3 tax deadline is in 15 days. Start preparing your documents.',
        duration: 8000,
        action: {
          label: 'View Reports',
          onPress: () => {
            console.log('Navigate to reports');
            navigationHelpers.switchToReportsTab(tabNavigation);
          },
        },
      });
    }, 2000);

    setTimeout(() => {
      showNotification({
        type: 'info',
        title: 'New Feature Available',
        message: 'Try our new expense categorization feature.',
        duration: 6000,
      });
    }, 4000);
  };

  const logNotificationStatus = async () => {
    try {
      const status = await getPermissionStatus();
      const token = await getFCMToken();
      
      let message = `Permission: ${status}`;
      
      if (token) {
        if (token.startsWith('ExpoToken[MOCK')) {
          message += '\nToken: Mock (Development Only)';
        } else if (token.startsWith('ExpoToken[')) {
          message += '\nToken: Available';
        } else {
          message += '\nToken: Available';
        }
      } else {
        message += '\nToken: None';
      }

      message += `\nNotifications: ${notificationsEnabled ? 'Enabled' : 'Disabled'}`;
      
      if (isInQuietHours) {
        message += '\n🔇 Quiet Hours Active';
      }
      
      showNotification({
        type: 'info',
        title: 'Notification Status',
        message: message,
        duration: 8000,
      });
      
      console.log('📱 Notification Status:', { status, token: token?.substring(0, 30) + '...' });
    } catch (error) {
      console.error('Error checking notification status:', error);
      showNotification({
        type: 'error',
        title: 'Status Check Failed',
        message: 'Could not check notification status',
      });
    }
  };

  const testPushNotifications = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      
      // Test settings-aware notifications using production method
      const success1 = await notificationService.scheduleProductionNotification(
        'receiptProcessing',
        'Receipt Processed! 📄',
        'Your receipt has been successfully processed and categorized.',
        { receiptId: '12345' }
      );

      const success2 = await notificationService.scheduleProductionNotification(
        'taxReminders',
        'Tax Reminder 📅',
        'Don\'t forget to organize your receipts for tax season!',
        {},
        5 // 5 seconds delay
      );

      const success3 = await notificationService.scheduleProductionNotification(
        'tipsFeatures',
        'New Feature! ✨',
        'Check out our new expense categorization feature.',
        {},
        10 // 10 seconds delay
      );

      let message = 'Push notifications scheduled!';
      const scheduledCount = [success1, success2, success3].filter(Boolean).length;
      
      if (scheduledCount === 0) {
        message = 'No notifications scheduled. This could be due to:\n• Notifications disabled in settings\n• Quiet hours active\n• System permissions not granted';
      } else if (scheduledCount < 3) {
        message = `${scheduledCount} of 3 notifications scheduled (some filtered by your settings)`;
      }

      showNotification({
        type: scheduledCount > 0 ? 'info' : 'warning',
        title: 'Notification Test',
        message: message,
        duration: 6000,
      });
    } catch (error) {
      console.error('Error scheduling push notifications:', error);
      showNotification({
        type: 'error',
        title: 'Push Notification Error',
        message: 'Failed to schedule push notifications',
      });
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <ScrollView style={styles.content}>
        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsRow label="Email" value={user?.email || "Not signed in"} />
          <SettingsRow
            label="Member Since"
            value={
              user?.metadata?.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString(
                    "en-US",
                    {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }
                  )
                : "Unknown"
            }
          />
          <SettingsRow
            label="Name"
            value={user?.displayName || "Not set"}
            onPress={() => {
              setFirstName(userData.firstName || "");
              setLastName(userData.lastName || "");
              setShowNameDialog(true);
            }}
          />
          <SettingsRow
            label="Change Password"
            onPress={() => setShowPasswordDialog(true)}
          />
        </SettingsSection>

        {/* Business Management Section */}
        <SettingsSection title="Business Management">
          <SettingsRow
            label="Manage Businesses"
            value={
              businesses.length === 0
                ? "Get started"
                : `${businesses.length} business${
                    businesses.length !== 1 ? "es" : ""
                  }`
            }
            onPress={() => navigation.navigate("BusinessManagement")}
            rightElement={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.text.secondary}
              />
            }
            description={
              businesses.length === 0
                ? "Set up your business profile to start tracking receipts"
                : canAccessFeature("multiBusinessManagement")
                ? "Create and manage multiple business entities"
                : "Manage your business information and settings"
            }
          />
        </SettingsSection>

        {/* Team Management Section */}
        {canAccessFeature("teamManagement") && (
          <SettingsSection title="Team Management">
            <SettingsRow
              label="Manage Team"
              value={
                teamMembers.length === 0
                  ? "Invite teammates"
                  : `${teamMembers.length} team member${
                      teamMembers.length !== 1 ? "s" : ""
                    }`
              }
              onPress={() => navigation.navigate("TeamManagement" as any)}
              rightElement={
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.text.secondary}
                />
              }
              description={
                canInviteMembers()
                  ? "Invite colleagues to help manage receipts and collaborate on your account"
                  : "View and manage your team members"
              }
            />
            {teamInvitations.length > 0 && (
              <SettingsRow
                label="Pending Invitations"
                value={`${teamInvitations.length} pending`}
                onPress={() => navigation.navigate("TeamManagement" as any)}
                rightElement={
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.text.secondary}
                  />
                }
                description="Review and manage pending team invitations"
              />
            )}
          </SettingsSection>
        )}

        {/* Bank Accounts Section */}
        {canUseBankConnection && (
          <SettingsSection title="Connected Bank Accounts">
            {bankConnections.length > 0 ? (
              <>
                {bankConnections.map((connection) => (
                  <View
                    key={connection.id}
                    style={[
                      styles.bankConnectionRow,
                      {
                        backgroundColor: theme.background.tertiary,
                        borderColor: theme.border.primary,
                      },
                    ]}
                  >
                    <View style={styles.bankConnectionInfo}>
                      <View style={styles.bankConnectionHeader}>
                        {connection.institutionLogo ? (
                          <Image
                            source={{ uri: connection.institutionLogo }}
                            style={styles.bankLogo}
                            onError={() =>
                              console.log(
                                "Failed to load bank logo:",
                                connection.institutionLogo
                              )
                            }
                          />
                        ) : (
                          <Ionicons
                            name="card"
                            size={24}
                            color={
                              connection.institutionColor || theme.gold.primary
                            }
                            style={styles.bankIcon}
                          />
                        )}
                        <View style={styles.bankConnectionDetails}>
                          <View style={styles.bankNameContainer}>
                            <Text
                              style={[
                                styles.bankName,
                                { color: theme.text.primary },
                              ]}
                            >
                              {connection.institutionName}
                            </Text>
                            {needsRepair(connection) && (
                              <View style={styles.repairIndicator}>
                                <Ionicons 
                                  name="warning" 
                                  size={16} 
                                  color={theme.gold.primary}
                                />
                                <Text style={[styles.repairText, { color: theme.gold.primary }]}>
                                  Needs Repair
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.bankAccountsCount,
                              { color: theme.text.secondary },
                            ]}
                          >
                            {connection.accounts.length} account
                            {connection.accounts.length !== 1 ? "s" : ""}{" "}
                            connected
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={[
                          styles.bankConnectionDate,
                          { color: theme.text.tertiary },
                        ]}
                      >
                        Connected {formatConnectionDate(connection.connectedAt)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.disconnectButton,
                        {
                          borderColor: needsRepair(connection) ? theme.gold.primary : theme.status.error,
                          opacity:
                            disconnectingAccount === connection.id ? 0.6 : 1,
                        },
                      ]}
                      onPress={() => needsRepair(connection) 
                        ? handleRepairBankAccount(connection)
                        : handleDisconnectBankAccount(connection)
                      }
                      disabled={disconnectingAccount === connection.id}
                    >
                      {disconnectingAccount === connection.id ? (
                        <ActivityIndicator
                          size="small"
                          color={needsRepair(connection) ? theme.gold.primary : theme.status.error}
                        />
                      ) : (
                        <Text
                          style={[
                            styles.disconnectButtonText,
                            { color: needsRepair(connection) ? theme.gold.primary : theme.status.error },
                          ]}
                        >
                          {needsRepair(connection) ? "Repair" : "Disconnect"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Another Bank Account Button */}
                <View
                  style={[
                    styles.addBankAccountContainer,
                    { borderTopColor: theme.border.primary },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.addBankButton,
                      {
                        backgroundColor: theme.background.secondary,
                        borderColor: theme.gold.primary,
                      },
                    ]}
                    onPress={connectBankAccount}
                  >
                    <Ionicons name="add" size={20} color={theme.gold.primary} />
                    <Text
                      style={[
                        styles.addBankButtonText,
                        { color: theme.gold.primary },
                      ]}
                    >
                      Add Another Bank Account
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.bankAccountsFooter,
                    { borderTopColor: theme.border.primary },
                  ]}
                >
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color={theme.text.tertiary}
                  />
                  <Text
                    style={[
                      styles.bankAccountsFooterText,
                      { color: theme.text.tertiary },
                    ]}
                  >
                    Connect multiple banks to capture all your business
                    transactions
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.noBankAccountsContainer}>
                <Ionicons
                  name="card-outline"
                  size={48}
                  color={theme.text.tertiary}
                />
                <Text
                  style={[
                    styles.noBankAccountsTitle,
                    { color: theme.text.primary },
                  ]}
                >
                  No Bank Accounts Connected
                </Text>
                <Text
                  style={[
                    styles.noBankAccountsDescription,
                    { color: theme.text.secondary },
                  ]}
                >
                  Connect your bank accounts to automatically generate receipts
                  from your transactions
                </Text>

                <TouchableOpacity
                  style={[
                    styles.connectBankButton,
                    { backgroundColor: theme.gold.primary },
                  ]}
                  onPress={connectBankAccount}
                >
                  <Ionicons name="add" size={20} color="white" />
                  <Text style={styles.connectBankButtonText}>
                    Connect Bank Account
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </SettingsSection>
        )}

        {/* Appearance Section */}
        <SettingsSection title="Appearance">
          <SettingsRow
            label="Dark Mode"
            isSwitch
            switchValue={themeMode === "dark"}
            onSwitchChange={handleThemeChange}
            description="Toggle between light and dark theme"
          />
        </SettingsSection>

        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SettingsRow
            label="Notification Settings"
            onPress={() => navigation.navigate("Notifications")}
            rightElement={
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.text.secondary}
              />
            }
            description="Manage push notifications, quiet hours, and notification types"
          />
          <SettingsRow
            label="Email Updates"
            isSwitch
            switchValue={emailUpdates}
            onSwitchChange={handleEmailUpdatesChange}
            description="Receive monthly reports and important announcements"
          />
        </SettingsSection>

        {/* Custom Categories Section */}
        <SettingsSection title="Custom Categories">
          {loadingCustomCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.gold.primary} />
              <Text
                style={[styles.loadingText, { color: theme.text.secondary }]}
              >
                Loading custom categories...
              </Text>
            </View>
          ) : customCategories.length > 0 ? (
            <>
              {customCategories.map((category) => (
                <View
                  key={category.id}
                  style={[
                    styles.customCategoryRow,
                    {
                      backgroundColor: theme.background.tertiary,
                      borderColor: theme.border.primary,
                    },
                  ]}
                >
                  <View style={styles.customCategoryInfo}>
                    <Text style={styles.customCategoryIcon}>{category.icon}</Text>
                    <View style={styles.customCategoryDetails}>
                      <Text
                        style={[
                          styles.customCategoryName,
                          { color: theme.text.primary },
                        ]}
                      >
                        {category.name}
                      </Text>
                      <Text
                        style={[
                          styles.customCategoryDate,
                          { color: theme.text.tertiary },
                        ]}
                      >
                        Created {new Date(category.createdAt).toLocaleDateString()}
                        {category.lastUsed && 
                          ` • Last used ${new Date(category.lastUsed).toLocaleDateString()}`
                        }
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.deleteCategoryButton,
                      { borderColor: theme.status.error },
                    ]}
                    onPress={() => handleDeleteCustomCategory(category)}
                  >
                    <Ionicons 
                      name="trash-outline" 
                      size={18} 
                      color={theme.status.error} 
                    />
                  </TouchableOpacity>
                </View>
              ))}
              
              {/* Create New Category Button */}
              <View
                style={[
                  styles.addCategoryContainer,
                  { borderTopColor: theme.border.primary },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.addCategoryButton,
                    {
                      backgroundColor: theme.background.secondary,
                      borderColor: theme.gold.primary,
                    },
                  ]}
                  onPress={() => setShowCreateCategoryDialog(true)}
                >
                  <Ionicons name="add" size={20} color={theme.gold.primary} />
                  <Text
                    style={[
                      styles.addCategoryButtonText,
                      { color: theme.gold.primary },
                    ]}
                  >
                    Create New Category
                  </Text>
                </TouchableOpacity>
              </View>
              
              <Text
                style={[
                  styles.customCategoryFooter,
                  { color: theme.text.tertiary, marginTop: 12 }
                ]}
              >
                Create custom categories to organize your receipts exactly how you want.
              </Text>
            </>
          ) : (
            <View style={styles.noCustomCategoriesContainer}>
              <Ionicons
                name="folder-outline"
                size={48}
                color={theme.text.tertiary}
              />
              <Text
                style={[
                  styles.noCustomCategoriesTitle,
                  { color: theme.text.primary },
                ]}
              >
                No Custom Categories Yet
              </Text>
              <Text
                style={[
                  styles.noCustomCategoriesDescription,
                  { color: theme.text.secondary },
                ]}
              >
                Create custom categories to better organize your receipts exactly how you want.
              </Text>

              <TouchableOpacity
                style={[
                  styles.createFirstCategoryButton,
                  { backgroundColor: theme.gold.primary },
                ]}
                onPress={() => setShowCreateCategoryDialog(true)}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.createFirstCategoryButtonText}>
                  Create Your First Category
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </SettingsSection>

        {/* Subscription Section */}
        <SettingsSection title="Subscription">
          <SettingsRow
            label="Current Plan"
            value={
              subscription.currentTier.charAt(0).toUpperCase() +
              subscription.currentTier.slice(1)
            }
            description={
              subscription.isActive
                ? subscription.currentTier === "trial" || subscription.trial.isActive
                  ? `Your trial ends on ${
                      subscription.expiresAt?.toLocaleDateString() || "N/A"
                    }`
                  : `Your plan renews on ${
                      subscription.expiresAt?.toLocaleDateString() || "N/A"
                    }`
                : subscription.currentTier === "free"
                ? "Free plan"
                : `Your plan has expired`
            }
          />
          <View
            style={[
              styles.planSelector,
              { backgroundColor: theme.background.tertiary },
            ]}
          >
            {Object.values(SUBSCRIPTION_TIERS)
              .filter((tier) => tier.id !== "free")
              .map((tierInfo) => {
                const isSelected = subscription.currentTier === tierInfo.id;
                const tierDescription = tierInfo.features[0];

                return (
                  <TouchableOpacity
                    key={tierInfo.id}
                    style={[
                      styles.planOption,
                      {
                        borderColor: isSelected
                          ? theme.gold.primary
                          : theme.border.primary,
                        backgroundColor: isSelected
                          ? theme.gold.primary + "10"
                          : "transparent",
                      },
                    ]}
                    onPress={() => handleUpgrade(tierInfo.id)}
                    disabled={isUpgrading || isSelected}
                  >
                    <View style={styles.planHeader}>
                      <Text
                        style={[
                          styles.planName,
                          {
                            color: isSelected
                              ? theme.gold.primary
                              : theme.text.primary,
                            fontWeight: isSelected ? "700" : "600",
                          },
                        ]}
                      >
                        {tierInfo.name}
                      </Text>
                      {isSelected && (
                        <View
                          style={[
                            styles.currentPlanBadge,
                            { backgroundColor: theme.gold.primary },
                          ]}
                        >
                          <Text style={styles.currentPlanText}>
                            Current Plan
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.planPrice,
                        {
                          color: isSelected
                            ? theme.gold.primary
                            : theme.text.primary,
                        },
                      ]}
                    >
                      ${tierInfo.price}/mo
                    </Text>
                    <Text
                      style={[
                        styles.planDescription,
                        { color: theme.text.secondary },
                      ]}
                    >
                      {tierDescription}
                    </Text>
                  </TouchableOpacity>
                );
              })}
          </View>
          {isUpgrading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={theme.gold.primary} size="large" />
            </View>
          )}
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsRow
            label="Help Center"
            onPress={() => navigation.navigate("Help")}
          />
          <SettingsRow
            label="Contact Support"
            onPress={() => navigation.navigate("ContactSupport")}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => navigation.navigate("PrivacyPolicy")}
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => navigation.navigate("TermsOfService")}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Account Actions">
          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: theme.status.error }]}
            onPress={logout}
          >
            <Text
              style={[styles.signOutButtonText, { color: theme.status.error }]}
            >
              Sign Out
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.deleteAccountButton,
              {
                borderColor: theme.status.error,
                backgroundColor: theme.status.error + "10",
              },
            ]}
            onPress={() => setShowDeleteAccountDialog(true)}
          >
            <Text
              style={[
                styles.deleteAccountButtonText,
                { color: theme.status.error },
              ]}
            >
              Delete Account
            </Text>
          </TouchableOpacity>
        </SettingsSection>

        {/* Debug/Test Section - Remove in production */}
        {__DEV__ && (
          <SettingsSection title="Notification Tests (Dev Only)">
            <View style={styles.testButtons}>
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: theme.status.info }]}
                onPress={testNotifications}
              >
                <ButtonText size="small" color="inverse">
                  Test In-App Notifications
                </ButtonText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: theme.status.warning }]}
                onPress={logNotificationStatus}
              >
                <ButtonText size="small" color="inverse">
                  Check FCM Status
                </ButtonText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.testButton, { backgroundColor: theme.status.success }]}
                onPress={testPushNotifications}
              >
                <ButtonText size="small" color="inverse">
                  Test Push Notifications
                </ButtonText>
              </TouchableOpacity>
            </View>
          </SettingsSection>
        )}

        {/* Signature */}
        <Signature variant="default" />
      </ScrollView>

      {/* Name Change Dialog */}
      {showNameDialog && (
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.background.overlay },
          ]}
        >
          <View
            style={[
              styles.dialog,
              { backgroundColor: theme.background.secondary },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>
              Change Name
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary,
                },
              ]}
              placeholder="First name"
              placeholderTextColor={theme.text.tertiary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary,
                },
              ]}
              placeholder="Last name (optional)"
              placeholderTextColor={theme.text.tertiary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { borderColor: theme.border.primary },
                ]}
                onPress={() => {
                  setShowNameDialog(false);
                  setFirstName("");
                  setLastName("");
                }}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.text.primary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { backgroundColor: theme.gold.primary },
                ]}
                onPress={handleNameChange}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: "white" }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Password Change Dialog */}
      {showPasswordDialog && (
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.background.overlay },
          ]}
        >
          <View
            style={[
              styles.dialog,
              { backgroundColor: theme.background.secondary },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>
              Change Password
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    color: theme.text.primary,
                    backgroundColor: theme.background.tertiary,
                    borderColor: theme.border.primary,
                  },
                ]}
                placeholder="Current password"
                placeholderTextColor={theme.text.tertiary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons
                  name={showCurrentPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    color: theme.text.primary,
                    backgroundColor: theme.background.tertiary,
                    borderColor: theme.border.primary,
                  },
                ]}
                placeholder="New password"
                placeholderTextColor={theme.text.tertiary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    color: theme.text.primary,
                    backgroundColor: theme.background.tertiary,
                    borderColor: theme.border.primary,
                  },
                ]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.text.tertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { borderColor: theme.border.primary },
                ]}
                onPress={() => {
                  setShowPasswordDialog(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.text.primary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { backgroundColor: theme.gold.primary },
                ]}
                onPress={handlePasswordChange}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: "white" }]}>
                    Update
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Delete Account Dialog */}
      {showDeleteAccountDialog && (
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.background.overlay },
          ]}
        >
          <View
            style={[
              styles.dialog,
              { backgroundColor: theme.background.secondary },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>
              Delete Account
            </Text>
            <Text
              style={[
                styles.dialogText,
                { color: theme.text.secondary, marginBottom: 16 },
              ]}
            >
              This action cannot be undone. All your receipts, data, and account
              information will be permanently deleted.
            </Text>
            <Text
              style={[
                styles.dialogText,
                { color: theme.text.secondary, marginBottom: 16 },
              ]}
            >
              Please enter your password to confirm:
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[
                  styles.passwordInput,
                  {
                    color: theme.text.primary,
                    backgroundColor: theme.background.tertiary,
                    borderColor: theme.border.primary,
                  },
                ]}
                placeholder="Current password"
                placeholderTextColor={theme.text.tertiary}
                value={deleteConfirmPassword}
                onChangeText={setDeleteConfirmPassword}
                secureTextEntry={!showDeletePassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowDeletePassword(!showDeletePassword)}
              >
                <Ionicons
                  name={showDeletePassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { borderColor: theme.border.primary },
                ]}
                onPress={() => {
                  setShowDeleteAccountDialog(false);
                  setDeleteConfirmPassword("");
                  setShowDeletePassword(false);
                }}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.text.primary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { backgroundColor: theme.status.error },
                ]}
                onPress={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: "white" }]}>
                    Delete Account
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Create Custom Category Dialog */}
      {showCreateCategoryDialog && (
        <View
          style={[
            styles.modalOverlay,
            { backgroundColor: theme.background.overlay },
          ]}
        >
          <View
            style={[
              styles.dialog,
              { backgroundColor: theme.background.secondary },
            ]}
          >
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>
              Create Custom Category
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
                Category Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text.primary,
                    backgroundColor: theme.background.tertiary,
                    borderColor: theme.border.primary,
                  },
                ]}
                placeholder="Enter category name"
                placeholderTextColor={theme.text.tertiary}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                autoCapitalize="words"
                maxLength={30}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text.primary }]}>
                Icon
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={styles.iconPicker}
              >
                {CustomCategoryService.getDefaultIcons().map((icon, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.iconOption,
                      { 
                        borderColor: newCategoryIcon === icon ? theme.gold.primary : theme.border.primary,
                        backgroundColor: newCategoryIcon === icon ? theme.gold.background : "transparent"
                      },
                    ]}
                    onPress={() => setNewCategoryIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { borderColor: theme.border.primary },
                ]}
                onPress={() => {
                  setShowCreateCategoryDialog(false);
                  setNewCategoryName("");
                  setNewCategoryIcon("📁");
                }}
              >
                <Text
                  style={[
                    styles.dialogButtonText,
                    { color: theme.text.primary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogButton,
                  { backgroundColor: theme.gold.primary },
                ]}
                onPress={handleCreateCustomCategory}
                disabled={isCreatingCategory || !newCategoryName.trim()}
              >
                {isCreatingCategory ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: "white" }]}>
                    Create
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const { width } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  planSelector: {
    padding: 16,
    borderRadius: 12,
  },
  planOption: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
  },
  currentPlanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentPlanText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  planPrice: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  pickerContainer: {
    height: Platform.OS === "android" ? 56 : 48,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: "center",
    overflow: "hidden",
  },
  picker: {
    height: Platform.OS === "android" ? 56 : 48,
    width: "100%",
    ...Platform.select({
      android: {
        marginTop: -8,
        marginBottom: -8,
      },
      ios: {
        // Ensure iOS picker is properly positioned
        height: 48,
      },
    }),
  },
  iosPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 48,
    paddingHorizontal: 12,
  },
  iosPickerText: {
    fontSize: 16,
    flex: 1,
  },
  hiddenPicker: {
    position: "absolute",
    opacity: 0,
    width: "100%",
    height: "100%",
  },
  iosPickerModal: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  iosPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
  },
  iosPickerAction: {
    fontSize: 16,
    fontWeight: "600",
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  iosPickerWheel: {
    height: 200,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  settingsRow: {
    padding: 16,
    borderBottomWidth: 1,
  },
  settingsRowMain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  settingsLabel: {
    fontSize: 16,
    flex: 1,
  },
  settingsValue: {
    fontSize: 16,
    marginLeft: 8,
  },
  settingsDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  upgradeIcon: {
    marginRight: 8,
  },
  upgradeButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  signOutButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  deleteAccountButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: "center",
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
  },
  dialog: {
    width: width - 48,
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  dialogText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  dialogButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 6,
    borderWidth: 1,
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  passwordInputContainer: {
    position: "relative",
    marginBottom: 12,
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48, // Make room for the eye icon
    fontSize: 16,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 12,
    padding: 4,
  },
  // Bank Accounts Styles
  loadingContainer: {
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  bankConnectionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  bankConnectionInfo: {
    flex: 1,
    marginRight: 12,
  },
  bankConnectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  bankIcon: {
    marginRight: 12,
  },
  bankLogo: {
    width: 24,
    height: 24,
    marginRight: 12,
    borderRadius: 4,
  },
  bankConnectionDetails: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
    flex: 1,
    marginRight: 12,
  },
  bankNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  repairIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  repairText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bankAccountsCount: {
    fontSize: 14,
  },
  bankConnectionDate: {
    fontSize: 12,
    marginTop: 4,
  },
  disconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 90,
    alignItems: "center",
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  bankAccountsFooter: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  bankAccountsFooterText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  noBankAccountsContainer: {
    alignItems: "center",
    padding: 32,
  },
  noBankAccountsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  noBankAccountsDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  connectBankButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  connectBankButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  addBankAccountContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 8,
  },
  addBankButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  addBankButtonText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  testButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  testButton: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  // Custom Categories Styles
  customCategoryRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  customCategoryInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  customCategoryIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  customCategoryDetails: {
    flex: 1,
  },
  customCategoryName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  customCategoryDate: {
    fontSize: 12,
  },
  deleteCategoryButton: {
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  customCategoryFooter: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 16,
    fontStyle: "italic",
  },
  noCustomCategoriesContainer: {
    alignItems: "center",
    padding: 32,
  },
  noCustomCategoriesTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  noCustomCategoriesDescription: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  createFirstCategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  createFirstCategoryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
  addCategoryContainer: {
    paddingTop: 16,
    borderTopWidth: 1,
    marginTop: 8,
  },
  addCategoryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
  },
  addCategoryButtonText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 6,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  iconPicker: {
    maxHeight: 60,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  iconText: {
    fontSize: 20,
  },
});
