import { useEffect } from 'react';
import { onSnapshot, collection, query, where, orderBy, doc, updateDoc, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Type definitions for notification data
interface NotificationData {
  id: string;
  userId: string;
  title: string;
  body: string;
  data: any;
  createdAt: Timestamp | { toDate: () => Date } | string | Date;
  read: boolean;
  source: string;
  [key: string]: any;
}

export class UserNotificationMonitor {
  private static instance: UserNotificationMonitor;
  private unsubscribe: (() => void) | null = null;

  public static getInstance(): UserNotificationMonitor {
    if (!UserNotificationMonitor.instance) {
      UserNotificationMonitor.instance = new UserNotificationMonitor();
    }
    return UserNotificationMonitor.instance;
  }

  /**
   * Start monitoring user notifications for the given user
   */
  public async startMonitoring(userId: string): Promise<void> {
    if (this.unsubscribe) {
      console.log('📡 Stopping previous monitoring session');
      this.unsubscribe();
    }

    console.log(`📡 Starting notification monitoring for user: ${userId}`);

    // First, check for missed notifications since last app session
    await this.checkForMissedNotifications(userId);

    // Query for unread notifications for this user
    const notificationsQuery = query(
      collection(db, 'user_notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
      // Temporarily removing orderBy to avoid index issues
      // orderBy('createdAt', 'desc')
    );

    console.log('📡 Setting up Firestore listener for user_notifications...');

    this.unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        console.log(`📡 Firestore snapshot received. Document count: ${snapshot.size}`);
        console.log(`📡 Document changes: ${snapshot.docChanges().length}`);
        
        snapshot.docChanges().forEach(async (change, index) => {
          console.log(`📡 Processing change ${index + 1}: type=${change.type}`);
          
          if (change.type === 'added') {
            const notification = change.doc.data() as NotificationData;
            console.log('📬 New user notification received:', notification);
            
            // Show local notification using the same method as test notifications
            await this.showLocalNotification(
              notification.title,
              notification.body,
              notification.data
            );

            // Mark as read
            await this.markAsRead(change.doc.id);
          }
        });
      },
      (error) => {
        console.error('❌ Error monitoring user notifications:', error);
      }
    );

    console.log('📡 Firestore listener setup complete');
  }

  /**
   * Stop monitoring notifications
   */
  public async stopMonitoring(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('📡 Stopped notification monitoring');
      
      // Save timestamp when monitoring stopped (app going to background/closing)
      await AsyncStorage.setItem('last_notification_check', new Date().toISOString());
    }
  }

  /**
   * Check for missed notifications since last app session
   */
  private async checkForMissedNotifications(userId: string): Promise<void> {
    try {
      console.log('🔄 Checking for missed notifications...');
      
      // Get the last time we checked for notifications
      const lastCheckStr = await AsyncStorage.getItem('last_notification_check');
      const lastCheck = lastCheckStr ? new Date(lastCheckStr) : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to 24h ago
      
      console.log(`📅 Last notification check: ${lastCheck.toISOString()}`);
      
      // Query for unread notifications created since last check
      const missedQuery = query(
        collection(db, 'user_notifications'),
        where('userId', '==', userId),
        where('read', '==', false)
      );

      const snapshot = await getDocs(missedQuery);
      const missedNotifications = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as NotificationData))
        .filter((notification: NotificationData) => {
          if (!notification.createdAt) return false;
          
          // Handle Firestore Timestamp object
          const createdAt = (notification.createdAt as any)?.toDate ? 
            (notification.createdAt as any).toDate() : 
            new Date(notification.createdAt as string | Date);
          
          return createdAt > lastCheck;
        })
        .sort((a: NotificationData, b: NotificationData) => {
          const aTime = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate() : new Date(a.createdAt as string | Date);
          const bTime = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate() : new Date(b.createdAt as string | Date);
          return aTime.getTime() - bTime.getTime(); // Oldest first
        });

      console.log(`📬 Found ${missedNotifications.length} missed notifications`);

      if (missedNotifications.length > 0) {
        // Show notifications with a small delay between them to avoid overwhelming
        for (let i = 0; i < missedNotifications.length; i++) {
          const notification: NotificationData = missedNotifications[i];
          
          setTimeout(async () => {
            console.log(`📱 Showing missed notification ${i + 1}/${missedNotifications.length}`);
            
            await this.showLocalNotification(
              notification.title,
              notification.body,
              { ...notification.data, missed: true }
            );

            // Mark as read
            await this.markAsRead(notification.id);
          }, i * 1000); // 1 second delay between notifications
        }
      }

      // Update the last check timestamp
      await AsyncStorage.setItem('last_notification_check', new Date().toISOString());
      
    } catch (error) {
      console.error('❌ Error checking for missed notifications:', error);
    }
  }

  /**
   * Show local notification using the same approach as test notifications
   */
  private async showLocalNotification(title: string, body: string, data: any): Promise<void> {
    try {
      console.log(`📱 Attempting to show local notification:`);
      console.log(`📱 Title: ${title}`);
      console.log(`📱 Body: ${body}`);
      console.log(`📱 Data:`, data);
      
      // Check notification permissions first
      const { status } = await Notifications.getPermissionsAsync();
      console.log(`📱 Notification permission status: ${status}`);
      
      if (status !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return;
      }
      
      // Determine navigation screen based on notification type
      const navigationScreen = this.getNavigationScreen(data);
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: {
            ...data,
            // Add navigation data for tap handling
            navigationScreen: navigationScreen,
            fromLocalNotification: true
          },
          sound: true,
        },
        trigger: null, // Show immediately
      });
      
      console.log(`✅ Local notification scheduled successfully with ID: ${notificationId}`);
      
      // Set up one-time tap handler for this notification
      this.setupNotificationTapHandler();
      
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  /**
   * Set up notification tap handler (one-time setup)
   */
  private setupNotificationTapHandler(): void {
    if ((this as any).tapHandlerSetup) {
      return; // Already set up
    }
    
    console.log('📱 Setting up notification tap handler');
    
    // Listen for notification responses (taps)
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('📱 Local notification tapped:', response);
      
      const { data } = response.notification.request.content;
      if (data?.fromLocalNotification && data?.navigationScreen) {
        console.log('📱 Handling local notification tap, navigating to:', data.navigationScreen);
        this.handleNotificationTap(data);
      }
    });
    
    (this as any).tapHandlerSetup = true;
    (this as any).tapSubscription = subscription;
  }

  /**
   * Handle notification tap and navigate
   */
  private handleNotificationTap(data: any): void {
    try {
      import('@react-native-async-storage/async-storage').then(({ default: AsyncStorage }) => {
        const navigationData = {
          screen: data.navigationScreen || 'BankTransactions',
          params: {
            fromNotification: true,
            timestamp: Date.now(),
            notificationData: data
          }
        };
        
        AsyncStorage.setItem('navigationIntent', JSON.stringify(navigationData));
        console.log('📱 Navigation intent stored from local notification:', navigationData);
      }).catch(error => {
        console.error('❌ Error storing navigation intent:', error);
      });
    } catch (error) {
      console.error('❌ Error handling notification tap:', error);
    }
  }

  /**
   * Determine navigation screen based on notification type
   */
  private getNavigationScreen(data: any): string {
    if (data?.type) {
      switch (data.type) {
        case 'new_transactions':
        case 'login_repaired':
          return 'BankTransactions'; // Bank Sync screen
        case 'pending_expiration':
        case 'reauth_required':
        case 'permission_revoked':
        case 'new_accounts_available':
          return 'BankTransactions'; // Also Bank Sync screen for connection issues
        case 'receipt_processed':
          return 'ReceiptsList'; // Receipts screen
        default:
          return 'BankTransactions'; // Default to Bank Sync
      }
    }
    return 'BankTransactions'; // Default fallback
  }

  /**
   * Mark notification as read
   */
  private async markAsRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'user_notifications', notificationId), {
        read: true,
        readAt: new Date()
      });
      console.log('✅ Notification marked as read');
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
    }
  }
}

/**
 * React hook to start/stop notification monitoring
 */
export const useUserNotificationMonitor = (userId: string | null) => {
  useEffect(() => {
    console.log('🔗 useUserNotificationMonitor hook called with userId:', userId);
    
    if (!userId) {
      console.log('🔗 No userId provided, skipping monitoring');
      return;
    }

    console.log('🔗 Initializing UserNotificationMonitor...');
    const monitor = UserNotificationMonitor.getInstance();
    
    // Start monitoring (async)
    monitor.startMonitoring(userId).catch((error) => {
      console.error('❌ Failed to start notification monitoring:', error);
    });

    return () => {
      console.log('🔗 Cleanup: stopping notification monitoring');
      monitor.stopMonitoring().catch((error) => {
        console.error('❌ Failed to stop notification monitoring:', error);
      });
    };
  }, [userId]);
};

export default UserNotificationMonitor;