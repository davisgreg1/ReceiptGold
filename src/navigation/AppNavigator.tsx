import React from "react";
import { NavigationContainer, LinkingOptions } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useTeam } from "../context/TeamContext";
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
import { Receipt } from "../types/receipt";

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
  CreateCustomCategory: { onCategoryCreated?: (categoryName: string) => void } | undefined;
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
  CreateCustomCategory: { onCategoryCreated?: (categoryName: string) => void } | undefined;
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
        component={require("../screens/ChoosePlanScreen").default}
        options={{ title: "Choose Your Plan" }}
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
          title: 'Receipts'
        }} 
      />
      <ReceiptsStack.Screen 
        name="ScanReceipt" 
        component={ScanReceiptScreen} 
        options={{ 
          headerShown: false 
        }} 
      />
      <ReceiptsStack.Screen 
        name="ReceiptDetail" 
        component={ReceiptDetailScreen} 
        options={{ 
          headerShown: true,
          title: 'Receipt Details'
        }} 
      />
      <ReceiptsStack.Screen 
        name="EditReceipt" 
        component={EditReceiptScreen} 
        options={{ 
          headerShown: true,
          title: 'Edit Receipt',
          presentation: 'modal'
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
      <SettingsStack.Screen
        name="Profile"
        options={{ title: "Profile" }}
      >
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
        options={{ title: "Notifications" }}
      />
      <SettingsStack.Screen
        name="Help"
        component={HelpCenterScreen}
        options={{ title: "Help Center" }}
      />
      <SettingsStack.Screen
        name="ContactSupport"
        component={ContactSupportScreen}
        options={{ title: "Contact Support" }}
      />
      <SettingsStack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ title: "Privacy Policy" }}
      />
      <SettingsStack.Screen
        name="TermsOfService"
        component={TermsOfServiceScreen}
        options={{ title: "Terms of Service" }}
      />
      <SettingsStack.Screen
        name="BusinessManagement"
        component={BusinessManagementScreen}
        options={{ title: "Business Management" }}
      />
      <SettingsStack.Screen
        name="CreateBusiness"
        component={CreateBusinessScreen}
        options={{ title: "Create Business" }}
      />
      <SettingsStack.Screen
        name="TeamManagement"
        component={TeamManagementScreen}
        options={{ title: "Team Management" }}
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
        component={require("../screens/ChoosePlanScreen").default}
        options={{ title: "Choose Your Plan" }}
      />
    </SettingsStack.Navigator>
  );
};

// Deep linking configuration for OAuth redirects
const linking: LinkingOptions<BottomTabParamList> = {
  prefixes: [
    // Production URLs
    'receiptgold://',
    'https://receiptgold.app',
    // Development URLs (Expo)
    ...__DEV__ ? ['exp+receiptgold://'] : [],
  ],
  config: {
    screens: {
      HomeTab: {
        screens: {
          Home: '',
          BankTransactions: 'oauth', // Handle OAuth redirects
        },
      },
      ReceiptsTab: 'receipts',
      ReportsTab: 'reports',
      SettingsTab: 'settings',
    },
  },
};

const BaseAppNavigator: React.FC = () => {
  const { theme } = useTheme();
  const { isTeamMember } = useTeam();

  return (
    <NavigationContainer 
      linking={linking}
      onStateChange={(state) => {
        // Optional: Log navigation state changes for debugging
        if (__DEV__) {
          console.log('Navigation state changed:', state);
        }
      }}
      onUnhandledAction={(action) => {
        // Handle unhandled navigation actions
        if (__DEV__) {
          console.warn('Unhandled navigation action:', action);
        }
      }}
      fallback={<View style={{ flex: 1, backgroundColor: theme.background.primary }} />}
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
    </NavigationContainer>
  );
};

// Export the main navigator
export { BaseAppNavigator as AppNavigator };
