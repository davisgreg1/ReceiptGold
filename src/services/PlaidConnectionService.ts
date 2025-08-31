import { db } from '../config/firebase';
import { collection, doc, query, where, getDocs, updateDoc, addDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export interface PlaidItem {
  id: string;
  userId: string;
  itemId: string;
  institutionId: string;
  institutionName: string;
  accessToken: string;
  status: 'connected' | 'error' | 'pending_expiration' | 'pending_disconnect' | 'permission_revoked';
  lastWebhookCode?: string;
  needsReauth: boolean;
  active: boolean;
  accounts: PlaidAccount[];
  error?: PlaidError;
  consentExpirationTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  lastSyncAt?: Date;
}

export interface PlaidAccount {
  accountId: string;
  name: string;
  type: string;
  subtype: string;
  mask?: string;
  balance?: number;
  currency: string;
  selected: boolean;
}

export interface PlaidError {
  errorType: string;
  errorCode: string;
  displayMessage: string;
  suggestedAction?: 'REAUTH' | 'RECONNECT' | 'CONTACT_SUPPORT';
}

export interface ConnectionNotification {
  id: string;
  userId: string;
  itemId: string;
  institutionName: string;
  type: 'reauth_required' | 'pending_expiration' | 'permission_revoked' | 'login_repaired' | 'new_accounts_available';
  title: string;
  message: string;
  actionRequired: boolean;
  dismissed: boolean;
  priority: 'high' | 'medium' | 'low';
  createdAt: Date;
  expiresAt?: Date;
}

export class PlaidConnectionService {
  private static instance: PlaidConnectionService;
  
  private constructor() {}

  public static getInstance(): PlaidConnectionService {
    if (!PlaidConnectionService.instance) {
      PlaidConnectionService.instance = new PlaidConnectionService();
    }
    return PlaidConnectionService.instance;
  }

  /**
   * Get all Plaid items for the current user
   */
  async getUserItems(userId: string): Promise<PlaidItem[]> {
    const itemsQuery = query(
      collection(db, 'plaid_items'),
      where('userId', '==', userId)
    );
    
    const snapshot = await getDocs(itemsQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
      lastSyncAt: doc.data().lastSyncAt?.toDate(),
      consentExpirationTime: doc.data().consentExpirationTime?.toDate(),
    })) as PlaidItem[];
  }

  /**
   * Get items that need reauthorization
   */
  async getItemsNeedingReauth(userId: string): Promise<PlaidItem[]> {
    const items = await this.getUserItems(userId);
    return items.filter(item => 
      item.needsReauth || 
      item.status === 'error' ||
      item.status === 'pending_expiration' ||
      item.status === 'pending_disconnect'
    );
  }

  /**
   * Update item status based on webhook data
   */
  async updateItemStatus(itemId: string, updates: Partial<PlaidItem>): Promise<void> {
    const itemRef = doc(db, 'plaid_items', itemId);
    await updateDoc(itemRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Create a notification for connection issues
   */
  async createConnectionNotification(
    userId: string,
    itemId: string,
    institutionName: string,
    type: ConnectionNotification['type'],
    webhookCode?: string
  ): Promise<void> {
    const notification: Omit<ConnectionNotification, 'id'> = {
      userId,
      itemId,
      institutionName,
      type,
      ...this.getNotificationContent(type, institutionName, webhookCode),
      dismissed: false,
      createdAt: new Date(),
      expiresAt: type === 'login_repaired' ? 
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : // 7 days
        undefined
    };

    await addDoc(collection(db, 'connection_notifications'), {
      ...notification,
      createdAt: Timestamp.fromDate(notification.createdAt),
      expiresAt: notification.expiresAt ? Timestamp.fromDate(notification.expiresAt) : null,
    });
  }

  /**
   * Get notification content based on type
   */
  private getNotificationContent(
    type: ConnectionNotification['type'], 
    institutionName: string,
    webhookCode?: string
  ): Pick<ConnectionNotification, 'title' | 'message' | 'actionRequired' | 'priority'> {
    switch (type) {
      case 'reauth_required':
        return {
          title: 'Bank Connection Needs Attention',
          message: `Your ${institutionName} connection has stopped working. Please reconnect to continue automatic receipt generation.`,
          actionRequired: true,
          priority: 'high'
        };
        
      case 'pending_expiration':
        return {
          title: 'Connection Expiring Soon',
          message: `Your ${institutionName} connection will expire in 7 days. Reconnect now to avoid interruption.`,
          actionRequired: true,
          priority: 'medium'
        };
        
      case 'permission_revoked':
        return {
          title: 'Permissions Revoked',
          message: `Access to your ${institutionName} account has been revoked. Reconnect to restore access.`,
          actionRequired: true,
          priority: 'high'
        };
        
      case 'login_repaired':
        return {
          title: 'Connection Restored',
          message: `Your ${institutionName} connection has been automatically restored. No action needed.`,
          actionRequired: false,
          priority: 'low'
        };
        
      case 'new_accounts_available':
        return {
          title: 'New Accounts Available',
          message: `${institutionName} has new accounts available. Connect them to track more expenses.`,
          actionRequired: false,
          priority: 'medium'
        };
        
      default:
        return {
          title: 'Bank Connection Update',
          message: `There's an update with your ${institutionName} connection.`,
          actionRequired: true,
          priority: 'medium'
        };
    }
  }

  /**
   * Get active notifications for user
   */
  async getUserNotifications(userId: string): Promise<ConnectionNotification[]> {
    const notificationsQuery = query(
      collection(db, 'connection_notifications'),
      where('userId', '==', userId),
      where('dismissed', '==', false)
    );
    
    const snapshot = await getDocs(notificationsQuery);
    const notifications = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      expiresAt: doc.data().expiresAt?.toDate(),
    })) as ConnectionNotification[];

    // Filter out expired notifications
    const now = new Date();
    return notifications.filter(notification => 
      !notification.expiresAt || notification.expiresAt > now
    );
  }

  /**
   * Dismiss a notification
   */
  async dismissNotification(notificationId: string): Promise<void> {
    const notificationRef = doc(db, 'connection_notifications', notificationId);
    await updateDoc(notificationRef, {
      dismissed: true,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Check if item needs immediate attention
   */
  isItemCritical(item: PlaidItem): boolean {
    if (!item.active) return true;
    if (item.status === 'error') return true;
    if (item.status === 'permission_revoked') return true;
    
    // Check if expiring within 24 hours
    if (item.consentExpirationTime) {
      const hoursUntilExpiry = (item.consentExpirationTime.getTime() - Date.now()) / (1000 * 60 * 60);
      if (hoursUntilExpiry < 24) return true;
    }
    
    return false;
  }

  /**
   * Get connection health status
   */
  getConnectionHealth(items: PlaidItem[]): {
    total: number;
    connected: number;
    needsAttention: number;
    critical: number;
    status: 'healthy' | 'warning' | 'critical';
  } {
    const total = items.length;
    const connected = items.filter(item => item.status === 'connected' && item.active).length;
    const needsAttention = items.filter(item => item.needsReauth).length;
    const critical = items.filter(item => this.isItemCritical(item)).length;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (critical > 0) {
      status = 'critical';
    } else if (needsAttention > 0) {
      status = 'warning';
    }

    return { total, connected, needsAttention, critical, status };
  }

  /**
   * Subscribe to connection status changes
   */
  subscribeToItemUpdates(
    userId: string, 
    callback: (items: PlaidItem[]) => void
  ): () => void {
    const itemsQuery = query(
      collection(db, 'plaid_items'),
      where('userId', '==', userId)
    );
    
    return onSnapshot(itemsQuery, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
        lastSyncAt: doc.data().lastSyncAt?.toDate(),
        consentExpirationTime: doc.data().consentExpirationTime?.toDate(),
      })) as PlaidItem[];
      
      callback(items);
    });
  }

  /**
   * Subscribe to notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notifications: ConnectionNotification[]) => void
  ): () => void {
    const notificationsQuery = query(
      collection(db, 'connection_notifications'),
      where('userId', '==', userId),
      where('dismissed', '==', false)
    );
    
    return onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
      })) as ConnectionNotification[];
      
      // Filter out expired notifications
      const now = new Date();
      const activeNotifications = notifications.filter(notification => 
        !notification.expiresAt || notification.expiresAt > now
      );
      
      callback(activeNotifications);
    });
  }
}

export default PlaidConnectionService.getInstance();