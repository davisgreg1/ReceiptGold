import { useEffect } from 'react';
import { onSnapshot, collection, query, where, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';

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
  public startMonitoring(userId: string): void {
    if (this.unsubscribe) {
      console.log('📡 Stopping previous monitoring session');
      this.unsubscribe();
    }

    console.log(`📡 Starting notification monitoring for user: ${userId}`);

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
            const notification = change.doc.data();
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
  public stopMonitoring(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
      console.log('📡 Stopped notification monitoring');
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
      
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: null, // Show immediately
      });
      
      console.log(`✅ Local notification scheduled successfully with ID: ${notificationId}`);
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
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
    monitor.startMonitoring(userId);

    return () => {
      console.log('🔗 Cleanup: stopping notification monitoring');
      monitor.stopMonitoring();
    };
  }, [userId]);
};

export default UserNotificationMonitor;