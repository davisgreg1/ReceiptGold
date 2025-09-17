import React, { useState } from "react";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import {
  Text,
  View,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useTeam } from "../context/TeamContext";
import { useTeammateLogoutDetection } from "../hooks/useTeammateLogoutDetection";
import { useAuth } from "../context/AuthContext";
import { PremiumGate } from "../components/PremiumGate";
import { HomeScreen } from "../screens/HomeScreen";
import { ReceiptsListScreen } from "../screens/ReceiptsListScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ScanReceiptScreen } from "../screens/ScanReceiptScreen";
import { ReceiptDetailScreen } from "../screens/ReceiptDetailScreen";
import { EditReceiptScreen } from "../screens/EditReceiptScreen";
import { DetailedBreakdownScreen } from "../screens/DetailedBreakdownScreen";
import { NotificationSettingsScreen } from "../screens/NotificationSettingsScreen";
import { BankTransactionsScreen } from "../screens/BankTransactionsScreen";
import { ContactSupportScreen } from "../screens/ContactSupportScreen";
import { HelpCenterScreen } from "../screens/HelpCenterScreen";
import { PrivacyPolicyScreen } from "../screens/PrivacyPolicyScreen";
import { TrialBanner } from "../components/TrialBanner";
import { TermsOfServiceScreen } from "../screens/TermsOfServiceScreen";
import BusinessManagementScreen from "../screens/BusinessManagementScreen";
import CreateBusinessScreen from "../screens/CreateBusinessScreen";
import { TeamManagementScreen } from "../screens/TeamManagementScreen";
import { InviteTeammateScreen } from "../screens/InviteTeammateScreen";
import { CreateCustomCategoryScreen } from "../screens/CreateCustomCategoryScreen";
import { TrialEndedScreen } from "../screens/TrialEndedScreen";
import { Receipt } from "../types/receipt";
import { AccountService } from "../services/AccountService";
import { useCustomAlert } from "../components/CustomAlert";

// Tab Navigator Types
export type BottomTabParamList = {
  HomeTab: undefined;
  ReceiptsTab: undefined;
  ReportsTab: undefined;
  SettingsTab: undefined;
};

// Stack Navigator Types for each tab
export type HomeStackParamList = {
  Home: undefined;
  Subscription: undefined;
  BankTransactions: undefined;
};

export type ReceiptsStackParamList = {
  ReceiptsList: undefined;
  ReceiptDetail: { receiptId: string; imageUrl?: string };
  ScanReceipt: undefined;
  EditReceipt: { receipt: Receipt };
  CreateCustomCategory:
    | { onCategoryCreated?: (categoryName: string) => void }
    | undefined;
};

export type ReportsStackParamList = {
  ReportsDashboard: undefined;
  TaxReport: undefined;
  ExpenseReport: undefined;
  CategoryReport: undefined;
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  Profile: undefined;
  Billing: undefined;
  Notifications: undefined;
  Help: undefined;
  ContactSupport: undefined;
  PrivacyPolicy: undefined;
  TermsOfService: undefined;
  BusinessManagement: undefined;
  CreateBusiness: undefined;
  CreateCustomCategory:
    | { onCategoryCreated?: (categoryName: string) => void }
    | undefined;
  TeamManagement: undefined;
  InviteTeammate: undefined;
  Subscription: undefined;
};

const Tab = createBottomTabNavigator<BottomTabParamList>();
const HomeStack = createStackNavigator<HomeStackParamList>();
const ReceiptsStack = createStackNavigator<ReceiptsStackParamList>();
const ReportsStack = createStackNavigator<ReportsStackParamList>();
const SettingsStack = createStackNavigator<SettingsStackParamList>();

// Placeholder screens (you'll replace these with actual screens)
const PlaceholderScreen = ({ title }: { title: string }) => {
  const { theme } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: theme.background.primary,
      }}
    >
      <Text
        style={{
          fontSize: 24,
          color: theme.text.primary,
          fontWeight: "bold",
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 16,
          color: theme.text.secondary,
          marginTop: 8,
          textAlign: "center",
          paddingHorizontal: 32,
        }}
      >
        This screen will be implemented next
      </Text>
    </View>
  );
};

// Import screens
import ReportsScreen from "../screens/ReportsScreen";

const TaxReportScreen = () => (
  <PremiumGate
    feature="taxPreparation"
    featureName="Tax Reports"
    description="Generate tax-ready reports and streamline your tax preparation process."
    requiredTier="growth"
  >
    <PlaceholderScreen title="Tax Report" />
  </PremiumGate>
);

// Stack Navigators for each tab
const HomeStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background.secondary,
        },
        headerTintColor: theme.text.primary,
        headerTitleStyle: {
          color: theme.text.primary,
        },
        cardStyle: {
          backgroundColor: theme.background.primary,
        },
      }}
    >
      <HomeStack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="Subscription"
        component={require("../screens/SubscriptionRouter").default}
        options={{ headerShown: false }}
      />
      <HomeStack.Screen
        name="BankTransactions"
        component={BankTransactionsScreen}
        options={{ title: "Bank Transactions" }}
      />
    </HomeStack.Navigator>
  );
};

const ReceiptsStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <ReceiptsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background.secondary,
        },
        headerTintColor: theme.text.primary,
        headerTitleStyle: {
          color: theme.text.primary,
        },
        cardStyle: {
          backgroundColor: theme.background.primary,
        },
      }}
    >
      <ReceiptsStack.Screen
        name="ReceiptsList"
        component={ReceiptsListScreen}
        options={{
          headerShown: false,
          title: "Receipts",
        }}
      />
      <ReceiptsStack.Screen
        name="ScanReceipt"
        component={ScanReceiptScreen}
        options={{
          headerShown: false,
        }}
      />
      <ReceiptsStack.Screen
        name="ReceiptDetail"
        component={ReceiptDetailScreen}
        options={{
          headerShown: true,
          title: "Receipt Details",
        }}
      />
      <ReceiptsStack.Screen
        name="EditReceipt"
        component={EditReceiptScreen}
        options={{
          headerShown: true,
          title: "Edit Receipt",
          presentation: "modal",
        }}
      />
      <ReceiptsStack.Screen
        name="CreateCustomCategory"
        component={CreateCustomCategoryScreen}
        options={{ headerShown: false }}
      />
    </ReceiptsStack.Navigator>
  );
};

const ReportsStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <ReportsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background.secondary,
        },
        headerTintColor: theme.text.primary,
        headerTitleStyle: {
          color: theme.text.primary,
        },
        cardStyle: {
          backgroundColor: theme.background.primary,
        },
      }}
    >
      <ReportsStack.Screen
        name="ReportsDashboard"
        component={ReportsScreen}
        options={{ title: "Reports & Analytics" }}
      />
      <ReportsStack.Screen
        name="TaxReport"
        component={TaxReportScreen}
        options={{ title: "Tax Report" }}
      />
      <ReportsStack.Screen
        name="ExpenseReport"
        component={ReportsScreen}
        options={{ title: "Expense Report" }}
      />
      <ReportsStack.Screen
        name="CategoryReport"
        component={DetailedBreakdownScreen}
        options={{ title: "Detailed Breakdown" }}
      />
    </ReportsStack.Navigator>
  );
};

const SettingsStackNavigator = () => {
  const { theme } = useTheme();

  return (
    <SettingsStack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.background.secondary,
        },
        headerTintColor: theme.text.primary,
        headerTitleStyle: {
          color: theme.text.primary,
        },
        cardStyle: {
          backgroundColor: theme.background.primary,
        },
      }}
    >
      <SettingsStack.Screen
        name="SettingsHome"
        component={SettingsScreen}
        options={{
          title: "Settings",
          headerShown: false,
        }}
      />
      <SettingsStack.Screen name="Profile" options={{ title: "Profile" }}>
        {() => <PlaceholderScreen title="Profile" />}
      </SettingsStack.Screen>
      <SettingsStack.Screen
        name="Billing"
        options={{ title: "Billing & Subscription" }}
      >
        {() => <PlaceholderScreen title="Billing" />}
      </SettingsStack.Screen>
      <SettingsStack.Screen
        name="Notifications"
        component={NotificationSettingsScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="Help"
        component={HelpCenterScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="BusinessManagement"
        component={BusinessManagementScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="CreateBusiness"
        component={CreateBusinessScreen}
        options={{ title: "Create Business" }}
      />
      <SettingsStack.Screen
        name="TeamManagement"
        component={TeamManagementScreen}
        options={{ title: "" }}
      />
      <SettingsStack.Screen
        name="InviteTeammate"
        component={InviteTeammateScreen}
        options={{ title: "Invite Teammate" }}
      />
      <SettingsStack.Screen
        name="CreateCustomCategory"
        component={CreateCustomCategoryScreen}
        options={{ headerShown: false }}
      />
      <SettingsStack.Screen
        name="Subscription"
        component={require("../screens/SubscriptionRouter").default}
        options={{ headerShown: false }}
      />
    </SettingsStack.Navigator>
  );
};

// Deep linking configuration for OAuth redirects
const linking: LinkingOptions<BottomTabParamList> = {
  prefixes: [
    // Production URLs
    "receiptgold://",
    "https://receiptgold.app",
    // Development URLs (Expo)
    ...(__DEV__ ? ["exp+receiptgold://"] : []),
  ],
  config: {
    screens: {
      HomeTab: {
        screens: {
          Home: "",
          BankTransactions: "oauth", // Handle OAuth redirects
        },
      },
      ReceiptsTab: "receipts",
      ReportsTab: "reports",
      SettingsTab: "settings",
    },
  },
};

const BaseAppNavigator: React.FC = () => {
  const { theme } = useTheme();
  const { isTeamMember } = useTeam();
  const { logout, user } = useAuth();
  const { isTrialExpiredAndNoPaidPlan, subscription } = useSubscription();
  const { showError, showSuccess } = useCustomAlert();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Monitor for automatic teammate logouts
  useTeammateLogoutDetection();

  // Create reactive trial expiration check
  const isTrialExpired =
    !subscription.trial.isActive &&
    (subscription.currentTier === "free" ||
      subscription.currentTier === "trial") &&
    !isTeamMember;

  // Debug logging for trial state
  console.log("🚀 AppNavigator trial state:", {
    trialIsActive: subscription.trial.isActive,
    currentTier: subscription.currentTier,
    isTeamMember,
    isTrialExpired,
    trialExpiresAt: subscription.trial.expiresAt?.toISOString(),
  });

  // Handle account deletion with password confirmation
  const handleDeleteAccount = () => {
    if (!user) {
      showError("Error", "No user found. Please try logging in again.");
      return;
    }
    setShowDeleteDialog(true);
  };

  // Process the actual account deletion
  const processAccountDeletion = async () => {
    if (!deletePassword.trim()) {
      showError("Error", "Password is required to delete your account.");
      return;
    }

    setIsDeleting(true);
    try {
      await AccountService.deleteAccount(user!, deletePassword);

      // Close dialog and clear form
      setShowDeleteDialog(false);
      setDeletePassword("");
      setShowPassword(false);

      // Immediately sign out the user since their account no longer exists
      await logout();

      showSuccess(
        "Account Deleted",
        "Your account and all associated data have been permanently deleted."
      );
    } catch (error: any) {
      showError(
        "Error",
        error.message || "Failed to delete account. Please try again."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel account deletion
  const cancelAccountDeletion = () => {
    setShowDeleteDialog(false);
    setDeletePassword("");
    setShowPassword(false);
  };

  // Show TrialEndedScreen if trial has expired and user has no paid plan
  if (isTrialExpired) {
    return (
      <TrialEndedScreen
        onSignOut={logout}
        onDeleteAccount={handleDeleteAccount}
      />
    );
  }

  return (
    <NavigationContainer
      linking={linking}
      onUnhandledAction={(action) => {
        // Handle unhandled navigation actions
        if (__DEV__) {
          console.warn("Unhandled navigation action:", action);
        }
      }}
      fallback={
        <View style={{ flex: 1, backgroundColor: theme.background.primary }} />
      }
    >
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.background.secondary,
            borderTopColor: theme.border.primary,
            borderTopWidth: 1,
            paddingBottom: 8,
            paddingTop: 8,
            height: 88,
          },
          tabBarActiveTintColor: theme.gold.primary,
          tabBarInactiveTintColor: theme.text.tertiary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: "600",
            marginTop: 4,
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            tabBarLabel: "Home",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>🏠</Text>
            ),
          }}
        />
        <Tab.Screen
          name="ReceiptsTab"
          component={ReceiptsStackNavigator}
          options={{
            tabBarLabel: "Receipts",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>📄</Text>
            ),
          }}
        />
        {/* Only show Reports tab for account holders (not team members) */}
        {!isTeamMember && (
          <Tab.Screen
            name="ReportsTab"
            component={ReportsStackNavigator}
            options={{
              tabBarLabel: "Reports",
              tabBarIcon: ({ color }) => (
                <Text style={{ fontSize: 24, color }}>📊</Text>
              ),
            }}
          />
        )}
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStackNavigator}
          options={{
            tabBarLabel: "Settings",
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>⚙️</Text>
            ),
          }}
        />
      </Tab.Navigator>
      <TrialBanner />

      {/* Custom Delete Account Dialog */}
      {showDeleteDialog && (
        <Modal
          transparent
          visible={showDeleteDialog}
          animationType="fade"
          onRequestClose={cancelAccountDeletion}
        >
          <View style={deleteDialogStyles.overlay}>
            <View
              style={[
                deleteDialogStyles.dialog,
                { backgroundColor: theme.background.secondary },
              ]}
            >
              <Text
                style={[
                  deleteDialogStyles.title,
                  { color: theme.text.primary },
                ]}
              >
                Delete Account
              </Text>
              <Text
                style={[
                  deleteDialogStyles.message,
                  { color: theme.text.secondary },
                ]}
              >
                This action cannot be undone. All your receipts, data, and
                account information will be permanently deleted.
              </Text>
              <Text
                style={[
                  deleteDialogStyles.passwordLabel,
                  { color: theme.text.secondary },
                ]}
              >
                Please enter your password to confirm:
              </Text>

              <View style={deleteDialogStyles.passwordContainer}>
                <TextInput
                  style={[
                    deleteDialogStyles.passwordInput,
                    {
                      color: theme.text.primary,
                      backgroundColor: theme.background.tertiary,
                      borderColor: theme.border.primary,
                    },
                  ]}
                  placeholder="Current password"
                  placeholderTextColor={theme.text.tertiary}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={deleteDialogStyles.passwordToggle}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color={theme.text.tertiary}
                  />
                </TouchableOpacity>
              </View>

              <View style={deleteDialogStyles.buttons}>
                <TouchableOpacity
                  style={[
                    deleteDialogStyles.button,
                    { borderColor: theme.border.primary },
                  ]}
                  onPress={cancelAccountDeletion}
                  disabled={isDeleting}
                >
                  <Text
                    style={[
                      deleteDialogStyles.cancelButtonText,
                      { color: theme.text.primary },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    deleteDialogStyles.button,
                    deleteDialogStyles.deleteButton,
                  ]}
                  onPress={processAccountDeletion}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="white" size="small" />
                  ) : (
                    <Text style={deleteDialogStyles.deleteButtonText}>
                      Delete Account
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </NavigationContainer>
  );
};

// Styles for the delete account dialog
const deleteDialogStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  dialog: {
    width: "85%",
    maxWidth: 350,
    borderRadius: 16,
    padding: 24,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 16,
  },
  passwordLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    position: "relative",
  },
  passwordInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48,
    fontSize: 16,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    width: 24,
  },
  buttons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "transparent",
  },
  deleteButton: {
    backgroundColor: "#FF6B6B",
    borderColor: "#FF6B6B",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});

// Export the main navigator
export { BaseAppNavigator as AppNavigator };
