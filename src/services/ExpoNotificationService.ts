import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configure how notifications are handled when received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private devicePushToken: string | null = null;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize Expo notifications
   */
  public async initialize(): Promise<void> {
    try {
      // Request permission for notifications
      await this.requestPermission();
      
      // Get native device push token
      await this.getDevicePushToken();
      
      // Set up notification handlers
      this.setupNotificationHandlers();
      
      console.log('✅ Expo notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermission(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permission denied');
        return false;
      }

      console.log('✅ Notification permission granted');
      return true;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get native device push token (FCM for Android, APNs for iOS)
   */
  public async getDevicePushToken(): Promise<string | null> {
    try {
      if (this.devicePushToken) {
        return this.devicePushToken;
      }

      // Check if we have a cached token
      const cachedToken = await AsyncStorage.getItem('device_push_token');
      if (cachedToken) {
        this.devicePushToken = cachedToken;
        return cachedToken;
      }

      if (!Device.isDevice) {
        console.log('Must use physical device for push notifications');
        return null;
      }

      try {
        // Get native device push token (FCM for Android, APNs for iOS)
        const tokenData = await Notifications.getDevicePushTokenAsync();
        
        if (tokenData.data) {
          this.devicePushToken = tokenData.data;
          await AsyncStorage.setItem('device_push_token', tokenData.data);
          console.log('📱 Native Device Push Token:', tokenData.data);
          console.log('📱 Platform:', Platform.OS);
          return tokenData.data;
        }
      } catch (tokenError) {
        console.error('Failed to get native device push token:', tokenError);
        
        // Return null - no fallback for device tokens
        return null;
      }

      return null;
    } catch (error) {
      console.error('Error getting native device push token:', error);
      return null;
    }
  }

  /**
   * Set up notification handlers
   */
  private setupNotificationHandlers(): void {
    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('📬 Notification received:', notification);
      // For data-only messages from FCM, manually show the notification
      this.handleDataOnlyNotification(notification);
    });

    // Handle notification response (user tapped notification)
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📬 Notification response:', response);
      this.handleNotificationPress(response.notification);
    });
  }

  /**
   * Handle data-only notifications from FCM (show them manually)
   */
  private async handleDataOnlyNotification(notification: Notifications.Notification): Promise<void> {
    const { data } = notification.request.content;
    
    // Check if this is a data-only notification with title/body in data
    if (data?.title && data?.body && !notification.request.content.title) {
      console.log('📱 Processing data-only FCM notification');
      
      try {
        // Schedule local notification to display it
        await Notifications.scheduleNotificationAsync({
          content: {
            title: data.title as string,
            body: data.body as string,
            data: data,
            sound: true,
          },
          trigger: null, // Show immediately
        });
        
        console.log('✅ Data-only notification displayed locally');
      } catch (error) {
        console.error('❌ Error displaying data-only notification:', error);
      }
    }
  }

  /**
   * Handle notification press/tap
   */
  private handleNotificationPress(notification: Notifications.Notification): void {
    console.log('🔔 Notification pressed:', notification);
    console.log('🔔 Notification data:', notification.request.content.data);
    
    // Handle different notification types based on data payload
    const { data } = notification.request.content;
    
    if (data?.type) {
      console.log("🚀 ~ NotificationService ~ handleNotificationPress ~ data:", data)
      switch (data.type) {
        case 'pending_expiration':
        case 'reauth_required':
        case 'permission_revoked':
          // Navigate to bank connection management
          console.log('Navigate to bank connection management:', {
            itemId: data.itemId,
            userId: data.userId,
            priority: data.priority
          });
          this.handleBankConnectionAction({
            ...data,
            action: 'reconnect_bank',
            connectionType: data.type
          });
          break;
          
        case 'new_accounts_available':
          // Navigate to bank connections to add new accounts
          console.log('Navigate to add new accounts:', {
            itemId: data.itemId,
            userId: data.userId
          });
          this.handleBankConnectionAction({
            ...data,
            action: 'add_accounts',
            connectionType: 'new_accounts'
          });
          break;
          
        case 'new_transactions':
          // Navigate to transactions or receipts screen
          console.log('Navigate to new transactions:', {
            itemId: data.itemId,
            userId: data.userId
          });
          this.handleNewTransactionsAction(data);
          break;
          
        case 'login_repaired':
          // Just show success, maybe navigate to transactions
          console.log('Bank connection restored:', {
            itemId: data.itemId,
            userId: data.userId
          });
          this.handleLoginRepairedAction(data);
          break;
          
        case 'receipt_processed':
          // Navigate to receipts list or specific receipt
          console.log('Navigate to receipt:', data.receiptId);
          break;
          
        case 'subscription_reminder':
          // Navigate to pricing/subscription page
          console.log('Navigate to subscription page');
          break;
          
        default:
          console.log('Unknown notification type:', data.type);
      }
    }
  }

  /**
   * Handle bank connection notification actions
   */
  private handleBankConnectionAction(data: any): void {
    // Store the notification data for the app to handle navigation
    try {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        const navigationData = {
          screen: 'Settings', // Navigate to Settings screen where bank connections are managed
          params: {
            highlightItem: data.itemId,
            actionRequired: data.action === 'reconnect_bank',
            notificationType: data.connectionType,
            fromNotification: true,
            timestamp: Date.now()
          }
        };

        AsyncStorage.setItem('navigationIntent', JSON.stringify(navigationData));
        console.log('🔗 Bank connection navigation intent stored:', navigationData);
      }).catch(error => {
        console.error('Error storing navigation intent:', error);
      });
    } catch (error) {
      console.error('Error handling bank connection action:', error);
    }
  }

  /**
   * Handle new transactions notification
   */
  private handleNewTransactionsAction(data: any): void {
    try {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        const navigationData = {
          screen: 'BankTransactions', // Navigate to bank transactions screen
          params: {
            itemId: data.itemId,
            fromNotification: true,
            timestamp: Date.now()
          }
        };

        AsyncStorage.setItem('navigationIntent', JSON.stringify(navigationData));
        console.log('💳 New transactions navigation intent stored:', navigationData);
      }).catch(error => {
        console.error('Error storing navigation intent:', error);
      });
    } catch (error) {
      console.error('Error handling new transactions action:', error);
    }
  }

  /**
   * Handle login repaired notification
   */
  private handleLoginRepairedAction(data: any): void {
    try {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        const navigationData = {
          screen: 'BankTransactions', // Navigate to transactions to see updated data
          params: {
            itemId: data.itemId,
            connectionRestored: true,
            fromNotification: true,
            timestamp: Date.now()
          }
        };

        AsyncStorage.setItem('navigationIntent', JSON.stringify(navigationData));
        console.log('✅ Login repaired navigation intent stored:', navigationData);
      }).catch(error => {
        console.error('Error storing navigation intent:', error);
      });
    } catch (error) {
      console.error('Error handling login repaired action:', error);
    }
  }

  /**
   * Send push token to Firestore for the current user
   * Preserves existing notification preferences
   */
  public async saveTokenToFirestore(userId: string): Promise<void> {
    try {
      const token = await this.getDevicePushToken();
      if (!token || !userId) {
        console.log('❌ No token or user ID available');
        return;
      }

      // Import Firestore
      const { db } = await import('../config/firebase');
      const { doc, getDoc, updateDoc, setDoc, serverTimestamp } = await import('firebase/firestore');

      const userRef = doc(db, 'users', userId);
      
      // Get existing user data to preserve notification settings
      const userDoc = await getDoc(userRef);
      const existingData = userDoc.exists() ? userDoc.data() : {};
      
      // Default notification settings (only used if user has no existing settings)
      const defaultNotificationSettings = {
        notificationsEnabled: true, // Master toggle
        push: true, // Enable push notifications by default
        bankConnections: true, // Enable bank connection notifications
        receipts: true, // Enable receipt notifications
        security: true, // Enable security alerts (always important)
        frequency: 'all', // all, important, minimal
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00'
        }
      };

      // Preserve existing notification settings or use defaults
      const notificationSettings = existingData.notificationSettings || defaultNotificationSettings;

      const updateData = {
        devicePushToken: token,
        pushTokenType: Platform.OS === 'ios' ? 'apns' : 'fcm',
        pushTokenUpdatedAt: serverTimestamp(),
        // Only set notification settings if they don't exist
        ...(existingData.notificationSettings ? {} : { notificationSettings })
      };

      if (userDoc.exists()) {
        await updateDoc(userRef, updateData);
      } else {
        await setDoc(userRef, {
          ...updateData,
          notificationSettings, // New users get default settings
          createdAt: serverTimestamp()
        });
      }

      console.log('✅ Native device push token saved to Firestore for user:', userId);
      console.log('📋 Notification settings preserved/initialized');
    } catch (error) {
      console.error('❌ Error saving push token to Firestore:', error);
    }
  }



  /**
   * Schedule a local notification (for testing) - respects user settings
   */
  public async scheduleLocalNotification(
    title: string,
    body: string,
    data?: any,
    delay: number = 0
  ): Promise<void> {
    try {
      // Check if notifications are enabled (basic check)
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('📵 Notifications not permitted by system');
        return;
      }

      // Note: This method doesn't check user settings by default for backward compatibility
      // Use scheduleNotificationWithSettings for settings-aware notifications
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            bypassUserSettings: true, // Mark as test notification
          },
          sound: true,
        },
        trigger: delay > 0 ? { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delay 
        } : null,
      });
      console.log('📅 Local notification scheduled (bypassed user settings)');
    } catch (error) {
      console.error('Error scheduling local notification:', error);
    }
  }

  /**
   * Schedule a notification that respects user settings
   */
  public async scheduleNotificationWithSettings(
    type: 'receiptProcessing' | 'taxReminders' | 'subscriptionUpdates' | 'tipsFeatures' | 'securityAlerts',
    title: string,
    body: string,
    data?: any,
    delay: number = 0,
    canSendNotification?: (type: any) => boolean,
    isInQuietHours?: () => boolean
  ): Promise<boolean> {
    try {
      // Check system permissions first
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('📵 Notifications not permitted by system');
        return false;
      }

      // Check user settings if provided
      if (canSendNotification && !canSendNotification(type)) {
        console.log(`📵 User has disabled ${type} notifications`);
        return false;
      }

      // Check quiet hours if provided
      if (isInQuietHours && isInQuietHours() && type !== 'securityAlerts') {
        console.log('🔇 In quiet hours, skipping non-critical notification');
        return false;
      }

      // Add notification type to data
      const notificationData = {
        ...data,
        type,
        scheduledAt: new Date().toISOString(),
        respectsUserSettings: true,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: notificationData,
          sound: true,
          priority: type === 'securityAlerts' ? 'high' : 'normal',
        },
        trigger: delay > 0 ? { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delay 
        } : null,
      });
      
      console.log(`📅 ${type} notification scheduled: ${title}`);
      return true;
    } catch (error) {
      console.error('Error scheduling notification with settings:', error);
      return false;
    }
  }

  /**
   * Schedule a notification that always checks user settings from storage
   * This is the recommended method for production use
   */
  public async scheduleProductionNotification(
    type: 'receiptProcessing' | 'taxReminders' | 'subscriptionUpdates' | 'tipsFeatures' | 'securityAlerts',
    title: string,
    body: string,
    data?: any,
    delay: number = 0
  ): Promise<boolean> {
    try {
      // Check system permissions first
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        console.log('📵 Notifications not permitted by system');
        return false;
      }

      // Load user settings from storage
      const { NOTIFICATION_SETTINGS_KEY } = await import('../context/NotificationSettingsContext');
      const settingsData = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      
      if (!settingsData) {
        console.log('📵 No user settings found, using defaults');
        // If no settings, allow only critical notifications
        if (type !== 'receiptProcessing' && type !== 'securityAlerts') {
          return false;
        }
      } else {
        const settings = JSON.parse(settingsData);
        
        // Check master toggle
        if (!settings.notificationsEnabled) {
          console.log('📵 User has disabled all notifications');
          return false;
        }

        // Check specific notification type
        if (!settings[type]) {
          console.log(`📵 User has disabled ${type} notifications`);
          return false;
        }

        // Check frequency setting
        if (settings.frequency === 'minimal' && type !== 'securityAlerts' && type !== 'receiptProcessing') {
          console.log(`📵 User in minimal mode, skipping ${type}`);
          return false;
        }

        if (settings.frequency === 'important' && type === 'tipsFeatures') {
          console.log(`📵 User in important mode, skipping ${type}`);
          return false;
        }

        // Check quiet hours
        if (settings.quietHours?.enabled && type !== 'securityAlerts') {
          const now = new Date();
          const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          const { startTime, endTime } = settings.quietHours;
          
          let inQuietHours = false;
          if (startTime > endTime) {
            // Overnight quiet hours
            inQuietHours = currentTime >= startTime || currentTime <= endTime;
          } else {
            inQuietHours = currentTime >= startTime && currentTime <= endTime;
          }

          if (inQuietHours) {
            console.log('🔇 In quiet hours, skipping non-critical notification');
            return false;
          }
        }
      }

      // Add notification type to data
      const notificationData = {
        ...data,
        type,
        scheduledAt: new Date().toISOString(),
        respectsUserSettings: true,
      };

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: notificationData,
          sound: true,
          priority: type === 'securityAlerts' ? 'high' : 'normal',
        },
        trigger: delay > 0 ? { 
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: delay 
        } : null,
      });
      
      console.log(`📅 Production ${type} notification scheduled: ${title}`);
      return true;
    } catch (error) {
      console.error('Error scheduling production notification:', error);
      return false;
    }
  }


  /**
   * Get notification permission status
   */
  public async getPermissionStatus(): Promise<string> {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Error getting permission status:', error);
      return 'unknown';
    }
  }

  /**
   * Clear cached token (useful for logout)
   */
  public async clearToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem('device_push_token');
      this.devicePushToken = null;
      console.log('✅ Native device push token cleared');
    } catch (error) {
      console.error('Error clearing native device push token:', error);
    }
  }

  // Compatibility methods for Firebase-like interface
  public async getFCMToken(): Promise<string | null> {
    return this.getDevicePushToken();
  }

  // Legacy compatibility method
  public async getExpoPushToken(): Promise<string | null> {
    console.warn('getExpoPushToken is deprecated, use getDevicePushToken instead');
    return this.getDevicePushToken();
  }

  public async subscribeToTopic(topic: string): Promise<void> {
    console.log(`📝 Topic subscription (${topic}) - implement server-side logic`);
    // With Expo notifications, topic subscriptions are handled server-side
    // You would send the token and topic to your server
  }

  public async unsubscribeFromTopic(topic: string): Promise<void> {
    console.log(`📝 Topic unsubscription (${topic}) - implement server-side logic`);
    // With Expo notifications, topic unsubscriptions are handled server-side
  }
}

export default NotificationService;
