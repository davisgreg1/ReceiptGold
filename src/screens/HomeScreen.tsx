import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useHomeNavigation, useTabNavigation, navigationHelpers } from "../navigation/navigationHelpers";
import { BrandText, HeadingText, BodyText, ButtonText } from '../components/Typography';
import { useInAppNotifications } from '../components/InAppNotificationProvider';
import { NotificationService } from '../services/ExpoNotificationService';
import { useNotifications } from '../hooks/useNotifications';
import PricingLanding from "./PricingLanding";

export const HomeScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const homeNavigation = useHomeNavigation();
  const tabNavigation = useTabNavigation();
  const { showNotification } = useInAppNotifications();
  const { getFCMToken, getPermissionStatus, scheduleLocalNotification, scheduleNotificationWithSettings, notificationsEnabled, isInQuietHours } = useNotifications();

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

  // const handleLogout = () => {
  //   Alert.alert(
  //     'Sign Out',
  //     'Are you sure you want to sign out?',
  //     [
  //       {
  //         text: 'Cancel',
  //         style: 'cancel',
  //       },
  //       {
  //         text: 'Sign Out',
  //         style: 'destructive',
  //         onPress: logout,
  //       },
  //     ]
  //   );
  // };

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
          <BodyText size="large" color="secondary">
            Manage your receipts and maximize your tax savings
          </BodyText>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <HeadingText size="medium" color="primary">
            Quick Actions
          </HeadingText>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.gold.primary }]}
              onPress={() => navigationHelpers.switchToReceiptsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📄</Text>
              <ButtonText size="medium" color="inverse">
                Scan Receipt
              </ButtonText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.background.secondary, borderColor: theme.border.primary, borderWidth: 1 }]}
              onPress={() => navigationHelpers.switchToReportsTab(tabNavigation)}
            >
              <Text style={styles.actionButtonIcon}>📊</Text>
              <ButtonText size="medium" color="primary">
                View Reports
              </ButtonText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Debug/Test Section - Remove in production */}
        {__DEV__ && (
          <View style={styles.testSection}>
            <HeadingText size="medium" color="primary">
              Notification Tests (Dev Only)
            </HeadingText>
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
          </View>
        )}

        <PricingLanding />
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
  content: {
    flex: 1,
  },
  welcomeSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 80,
  },
  actionButtonIcon: {
    fontSize: 24,
    marginBottom: 8,
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
  testSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  testButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  testButton: {
    flex: 1,
    minWidth: 120,
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
