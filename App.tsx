import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { BusinessProvider } from './src/context/BusinessContext';
import { StripeWrapper } from './src/components/StripeWrapper';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { CustomAlertProvider } from './src/components/CustomAlert';
import { InAppNotificationProvider } from './src/components/InAppNotificationProvider';
import { NotificationSettingsProvider } from './src/context/NotificationSettingsContext';
import { useNotificationSettings } from './src/context/NotificationSettingsContext';
import { NotificationService } from './src/services/ExpoNotificationService';
import { useUserNotificationMonitor } from './src/services/UserNotificationMonitor';
import { useReceiptSync } from './src/services/ReceiptSyncService';
import { useNavigationIntent } from './src/hooks/useNavigationIntent';

const AppContent: React.FC = () => {
  const [splashFinished, setSplashFinished] = useState(false);
  const { themeMode } = useTheme();
  const { user, loading: authLoading } = useAuth();
  
  // Monitor user notifications for local display
  console.log('🔗 App.tsx: Setting up notification monitoring for user:', user?.uid);
  useUserNotificationMonitor(user?.uid || null);

  // Handle navigation intents from notifications
  useNavigationIntent();

  // Initialize notification service when user is authenticated
  useEffect(() => {
    const initializeNotifications = async () => {
      if (user) {
        try {
          console.log('🔔 Initializing notifications for user:', user.uid);
          const notificationService = NotificationService.getInstance();
          await notificationService.initialize();
          await notificationService.saveTokenToFirestore(user.uid);
          console.log('✅ Notifications initialized successfully');
        } catch (error) {
          console.error('❌ Failed to initialize notifications:', error);
        }
      }
    };

    initializeNotifications();
  }, [user]);

  // Show splash screen until both splash animation is done AND auth is initialized
  const showSplash = !splashFinished || authLoading;

  console.log('App State:', {
    splashFinished,
    authLoading,
    showSplash,
    hasUser: !!user,
    userEmail: user?.email
  });

  // Sync receipts globally for logged-in users
  const { syncing, syncError } = useReceiptSync();

  if (showSplash) {
    return <AppSplashScreen onFinish={() => setSplashFinished(true)} />;
  }

  // Sync status banner
  const SyncBanner = () => {
    if (syncing) {
      return (
        <StatusBanner message="Syncing receipts..." color="#FFD700" />
      );
    }
    if (syncError) {
      return (
        <StatusBanner message={syncError} color="#FF4D4F" />
      );
    }
    return null;
  };

  // Simple status banner component
  const StatusBanner = ({ message, color }: { message: string; color: string }) => (
    <View style={{
      width: '100%',
      backgroundColor: color,
      padding: 8,
      alignItems: 'center',
      position: 'absolute',
      top: 0,
      zIndex: 9999,
    }}>
      <Text style={{
        color: '#222',
        fontWeight: 'bold',
      }}>
        {message}
      </Text>
    </View>
  );

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <SyncBanner />
      <NotificationInitializer />
      {user ? <AppNavigator /> : <AuthNavigator />}
    </>
  );
};

// Separate component to handle notification initialization with settings
const NotificationInitializer: React.FC = () => {
  const { user } = useAuth();
  const { settings, loading } = useNotificationSettings();
  
  useEffect(() => {
    if (loading) return; // Wait for settings to load
    
    const initializeNotifications = async () => {
      try {
        const notificationService = NotificationService.getInstance();
        await notificationService.initialize();
        
        // Only subscribe to topics if notifications are enabled
        if (settings.notificationsEnabled) {
          console.log('🔔 User has notifications enabled, subscribing to topics');
          
          // Subscribe to general app notifications
          await notificationService.subscribeToTopic('receiptgold_general');
          
          // Subscribe based on individual settings
          if (settings.receiptProcessing) {
            await notificationService.subscribeToTopic('receipt_processing');
          }
          if (settings.taxReminders) {
            await notificationService.subscribeToTopic('tax_reminders');
          }
          if (settings.subscriptionUpdates) {
            await notificationService.subscribeToTopic('subscription_updates');
          }
          if (settings.tipsFeatures) {
            await notificationService.subscribeToTopic('tips_features');
          }
          if (settings.securityAlerts) {
            await notificationService.subscribeToTopic('security_alerts');
          }
          
          // If user is logged in, subscribe to user-specific topics
          if (user?.email) {
            console.log('User logged in, could subscribe to user-specific notifications');
          }
        } else {
          console.log('🔕 User has notifications disabled, skipping topic subscriptions');
          // Unsubscribe from all topics
          await notificationService.unsubscribeFromTopic('receiptgold_general');
          await notificationService.unsubscribeFromTopic('receipt_processing');
          await notificationService.unsubscribeFromTopic('tax_reminders');
          await notificationService.unsubscribeFromTopic('subscription_updates');
          await notificationService.unsubscribeFromTopic('tips_features');
          await notificationService.unsubscribeFromTopic('security_alerts');
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeNotifications();
  }, [user, settings, loading]);

  return null; // This component doesn't render anything
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeWrapper>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <BusinessProvider>
                <CustomAlertProvider>
                  <NotificationSettingsProvider>
                    <InAppNotificationProvider>
                      <AppContent />
                    </InAppNotificationProvider>
                  </NotificationSettingsProvider>
                </CustomAlertProvider>
              </BusinessProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </StripeWrapper>
    </SafeAreaProvider>
  );
}