import messaging, { FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class NotificationService {
  private static instance: NotificationService;
  private fcmToken: string | null = null;

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Initialize Firebase messaging and request permissions
   */
  public async initialize(): Promise<void> {
    try {
      // Request permission for notifications
      await this.requestPermission();
      
      // Get FCM token
      await this.getFCMToken();
      
      // Set up message handlers
      this.setupMessageHandlers();
      
      // Handle background messages
      this.setupBackgroundMessageHandler();
      
      console.log('✅ Notification service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

  /**
   * Request notification permissions
   */
  private async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        // Request Android notification permission
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true; // Automatic for Android < 13
      }

      // iOS permission request
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Notification permission granted');
      } else {
        console.log('❌ Notification permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM registration token
   */
  public async getFCMToken(): Promise<string | null> {
    try {
      if (this.fcmToken) {
        return this.fcmToken;
      }

      // Check if we have a cached token
      const cachedToken = await AsyncStorage.getItem('fcm_token');
      if (cachedToken) {
        this.fcmToken = cachedToken;
        return cachedToken;
      }

      // Get new token
      const token = await messaging().getToken();
      if (token) {
        this.fcmToken = token;
        await AsyncStorage.setItem('fcm_token', token);
        console.log('📱 FCM Token:', token);
        return token;
      }

      return null;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Set up foreground message handlers
   */
  private setupMessageHandlers(): void {
    // Handle messages when app is in foreground
    messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('📬 Foreground message received:', remoteMessage);
      
      // Show custom alert for foreground messages
      if (remoteMessage.notification) {
        Alert.alert(
          remoteMessage.notification.title || 'ReceiptGold',
          remoteMessage.notification.body || 'You have a new notification',
          [
            {
              text: 'Dismiss',
              style: 'cancel',
            },
            {
              text: 'View',
              onPress: () => this.handleNotificationPress(remoteMessage),
            },
          ]
        );
      }
    });

    // Handle notification opened when app is in background
    messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('📬 Notification opened app from background:', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // Handle notification opened when app is closed
    messaging()
      .getInitialNotification()
      .then((remoteMessage: FirebaseMessagingTypes.RemoteMessage | null) => {
        if (remoteMessage) {
          console.log('📬 Notification opened app from quit state:', remoteMessage);
          this.handleNotificationPress(remoteMessage);
        }
      });

    // Handle token refresh
    messaging().onTokenRefresh(async (token: string) => {
      console.log('🔄 FCM Token refreshed:', token);
      this.fcmToken = token;
      await AsyncStorage.setItem('fcm_token', token);
      // TODO: Send updated token to your server
      this.sendTokenToServer(token);
    });
  }

  /**
   * Set up background message handler
   */
  private setupBackgroundMessageHandler(): void {
    messaging().setBackgroundMessageHandler(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('📬 Background message received:', remoteMessage);
      
      // Handle background message processing
      // You can update local storage, trigger local notifications, etc.
      
      return Promise.resolve();
    });
  }

  /**
   * Handle notification press/tap
   */
  private handleNotificationPress(remoteMessage: FirebaseMessagingTypes.RemoteMessage): void {
    console.log('🔔 Notification pressed:', remoteMessage);
    
    // Handle different notification types based on data payload
    const { data } = remoteMessage;
    
    if (data?.type) {
      switch (data.type) {
        case 'receipt_processed':
          // Navigate to receipts list or specific receipt
          console.log('Navigate to receipt:', data.receiptId);
          break;
        case 'subscription_reminder':
          // Navigate to pricing/subscription page
          console.log('Navigate to subscription page');
          break;
        case 'tax_deadline':
          // Navigate to reports or tax section
          console.log('Navigate to tax reports');
          break;
        default:
          console.log('Unknown notification type:', data.type);
      }
    }
  }

  /**
   * Send FCM token to your server
   */
  private async sendTokenToServer(token: string): Promise<void> {
    try {
      // TODO: Implement API call to your server
      console.log('📤 Sending token to server:', token);
      
      // Example API call:
      // await fetch('/api/fcm-tokens', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ token, userId: currentUserId })
      // });
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  /**
   * Subscribe to a topic
   */
  public async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log(`✅ Subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Error subscribing to topic ${topic}:`, error);
    }
  }

  /**
   * Unsubscribe from a topic
   */
  public async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log(`✅ Unsubscribed from topic: ${topic}`);
    } catch (error) {
      console.error(`Error unsubscribing from topic ${topic}:`, error);
    }
  }

  /**
   * Get notification permission status
   */
  public async getPermissionStatus(): Promise<string> {
    const authStatus = await messaging().hasPermission();
    
    switch (authStatus) {
      case messaging.AuthorizationStatus.AUTHORIZED:
        return 'authorized';
      case messaging.AuthorizationStatus.DENIED:
        return 'denied';
      case messaging.AuthorizationStatus.NOT_DETERMINED:
        return 'not_determined';
      case messaging.AuthorizationStatus.PROVISIONAL:
        return 'provisional';
      default:
        return 'unknown';
    }
  }

  /**
   * Clear cached token (useful for logout)
   */
  public async clearToken(): Promise<void> {
    try {
      await messaging().deleteToken();
      await AsyncStorage.removeItem('fcm_token');
      this.fcmToken = null;
      console.log('✅ FCM token cleared');
    } catch (error) {
      console.error('Error clearing FCM token:', error);
    }
  }
}

export default NotificationService;
