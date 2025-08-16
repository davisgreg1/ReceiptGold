import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { StripeWrapper } from './src/components/StripeWrapper';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { CustomAlertProvider } from './src/components/CustomAlert';
import { InAppNotificationProvider } from './src/components/InAppNotificationProvider';
import { NotificationSettingsProvider } from './src/context/NotificationSettingsContext';
import { useNotificationSettings } from './src/context/NotificationSettingsContext';
import { NotificationService } from './src/services/ExpoNotificationService';

const AppContent: React.FC = () => {
  const [splashFinished, setSplashFinished] = useState(false);
  const { themeMode } = useTheme();
  const { user, loading: authLoading } = useAuth();

  // Show splash screen until both splash animation is done AND auth is initialized
  const showSplash = !splashFinished || authLoading;

  console.log('App State:', {
    splashFinished,
    authLoading,
    showSplash,
    hasUser: !!user,
    userEmail: user?.email
  });

  if (showSplash) {
    return <AppSplashScreen onFinish={() => setSplashFinished(true)} />;
  }

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
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
              <CustomAlertProvider>
                <NotificationSettingsProvider>
                  <InAppNotificationProvider>
                    <AppContent />
                  </InAppNotificationProvider>
                </NotificationSettingsProvider>
              </CustomAlertProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </StripeWrapper>
    </SafeAreaProvider>
  );
}