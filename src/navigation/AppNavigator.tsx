import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { PremiumGate } from '../components/PremiumGate';
import { HomeScreen } from '../screens/HomeScreen';
import { ReceiptsListScreen } from '../screens/ReceiptsListScreen';

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
};

export type ReceiptsStackParamList = {
  ReceiptsList: undefined;
  ReceiptDetail: { receiptId: string };
  ScanReceipt: undefined;
  EditReceipt: { receiptId: string };
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
    <View style={{ 
      flex: 1, 
      justifyContent: 'center', 
      alignItems: 'center',
      backgroundColor: theme.background.primary 
    }}>
      <Text style={{ 
        fontSize: 24, 
        color: theme.text.primary,
        fontWeight: 'bold' 
      }}>
        {title}
      </Text>
      <Text style={{ 
        fontSize: 16, 
        color: theme.text.secondary,
        marginTop: 8,
        textAlign: 'center',
        paddingHorizontal: 32
      }}>
        This screen will be implemented next
      </Text>
    </View>
  );
};

// Premium-aware screens
const AdvancedReportsScreen = () => (
  <PremiumGate
    feature="advancedReporting"
    featureName="Advanced Reports"
    description="Get detailed analytics and insights about your expenses with advanced reporting features."
    requiredTier="growth"
    fallbackComponent={<PlaceholderScreen title="Basic Reports" />}
  >
    <PlaceholderScreen title="Advanced Reports" />
  </PremiumGate>
);

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
const HomeStackNavigator = () => (
  <HomeStack.Navigator>
    <HomeStack.Screen 
      name="Home" 
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen 
      name="Subscription" 
      component={() => <PlaceholderScreen title="Subscription" />}
      options={{ title: 'Choose Your Plan' }}
    />
  </HomeStack.Navigator>
);

const ReceiptsStackNavigator = () => (
  <ReceiptsStack.Navigator>
    <ReceiptsStack.Screen 
      name="ReceiptsList" 
      component={ReceiptsListScreen}
      options={{ title: 'My Receipts' }}
    />
    <ReceiptsStack.Screen 
      name="ReceiptDetail" 
      component={() => <PlaceholderScreen title="Receipt Details" />}
      options={{ title: 'Receipt Details' }}
    />
    <ReceiptsStack.Screen 
      name="ScanReceipt" 
      component={() => <PlaceholderScreen title="Scan Receipt" />}
      options={{ title: 'Scan Receipt', presentation: 'modal' }}
    />
    <ReceiptsStack.Screen 
      name="EditReceipt" 
      component={() => <PlaceholderScreen title="Edit Receipt" />}
      options={{ title: 'Edit Receipt' }}
    />
  </ReceiptsStack.Navigator>
);

const ReportsStackNavigator = () => (
  <ReportsStack.Navigator>
    <ReportsStack.Screen 
      name="ReportsDashboard" 
      component={() => <PlaceholderScreen title="Reports Dashboard" />}
      options={{ title: 'Reports' }}
    />
    <ReportsStack.Screen 
      name="TaxReport" 
      component={TaxReportScreen}
      options={{ title: 'Tax Report' }}
    />
    <ReportsStack.Screen 
      name="ExpenseReport" 
      component={AdvancedReportsScreen}
      options={{ title: 'Expense Report' }}
    />
    <ReportsStack.Screen 
      name="CategoryReport" 
      component={AdvancedReportsScreen}
      options={{ title: 'Category Report' }}
    />
  </ReportsStack.Navigator>
);

const SettingsStackNavigator = () => (
  <SettingsStack.Navigator>
    <SettingsStack.Screen 
      name="SettingsHome" 
      component={() => <PlaceholderScreen title="Settings" />}
      options={{ title: 'Settings' }}
    />
    <SettingsStack.Screen 
      name="Profile" 
      component={() => <PlaceholderScreen title="Profile" />}
      options={{ title: 'Profile' }}
    />
    <SettingsStack.Screen 
      name="Billing" 
      component={() => <PlaceholderScreen title="Billing" />}
      options={{ title: 'Billing & Subscription' }}
    />
    <SettingsStack.Screen 
      name="Notifications" 
      component={() => <PlaceholderScreen title="Notifications" />}
      options={{ title: 'Notifications' }}
    />
    <SettingsStack.Screen 
      name="Help" 
      component={() => <PlaceholderScreen title="Help" />}
      options={{ title: 'Help & Support' }}
    />
  </SettingsStack.Navigator>
);

export const AppNavigator: React.FC = () => {
  const { theme } = useTheme();

  return (
    <NavigationContainer>
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
            fontWeight: '600',
            marginTop: 4,
          },
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStackNavigator}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>🏠</Text>
            ),
          }}
        />
        <Tab.Screen
          name="ReceiptsTab"
          component={ReceiptsStackNavigator}
          options={{
            tabBarLabel: 'Receipts',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>📄</Text>
            ),
          }}
        />
        <Tab.Screen
          name="ReportsTab"
          component={ReportsStackNavigator}
          options={{
            tabBarLabel: 'Reports',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>📊</Text>
            ),
          }}
        />
        <Tab.Screen
          name="SettingsTab"
          component={SettingsStackNavigator}
          options={{
            tabBarLabel: 'Settings',
            tabBarIcon: ({ color }) => (
              <Text style={{ fontSize: 24, color }}>⚙️</Text>
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};
