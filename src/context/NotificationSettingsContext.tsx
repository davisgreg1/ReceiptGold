import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { NotificationService } from '../services/NotificationService';

// Notification setting keys
export const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

// Individual notification types
export interface NotificationSettings {
  // Master toggle
  notificationsEnabled: boolean;
  
  // Specific notification types
  receiptProcessing: boolean;
  taxReminders: boolean;
  subscriptionUpdates: boolean;
  tipsFeatures: boolean;
  securityAlerts: boolean;
  
  // Scheduling preferences
  quietHours: {
    enabled: boolean;
    startTime: string; // "22:00"
    endTime: string;   // "08:00"
  };
  
  // Frequency settings
  frequency: 'all' | 'important' | 'minimal';
}

// Default settings
const DEFAULT_SETTINGS: NotificationSettings = {
  notificationsEnabled: true,
  receiptProcessing: true,
  taxReminders: true,
  subscriptionUpdates: false,
  tipsFeatures: false,
  securityAlerts: true,
  quietHours: {
    enabled: false,
    startTime: '22:00',
    endTime: '08:00',
  },
  frequency: 'important',
};

interface NotificationSettingsContextType {
  settings: NotificationSettings;
  loading: boolean;
  updateSetting: <K extends keyof NotificationSettings>(
    key: K, 
    value: NotificationSettings[K]
  ) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  canSendNotification: (type: keyof Omit<NotificationSettings, 'notificationsEnabled' | 'quietHours' | 'frequency'>) => boolean;
  isInQuietHours: () => boolean;
}

const NotificationSettingsContext = createContext<NotificationSettingsContextType | undefined>(undefined);

export const useNotificationSettings = () => {
  const context = useContext(NotificationSettingsContext);
  if (!context) {
    throw new Error('useNotificationSettings must be used within NotificationSettingsProvider');
  }
  return context;
};

interface NotificationSettingsProviderProps {
  children: React.ReactNode;
}

export const NotificationSettingsProvider: React.FC<NotificationSettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Load settings from Firebase (for authenticated users) or AsyncStorage (for unauthenticated)
  const loadSettings = useCallback(async () => {
    try {
      if (user) {
        // Load from Firebase for authenticated users
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().notificationSettings) {
          const firebaseSettings = userDoc.data().notificationSettings;
          const mergedSettings = { ...DEFAULT_SETTINGS, ...firebaseSettings };
          setSettings(mergedSettings);
          
          // Also save to AsyncStorage for offline access
          await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(mergedSettings));
        } else {
          // No settings in Firebase, check AsyncStorage for migration
          const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
          if (stored) {
            const parsed = JSON.parse(stored);
            const migratedSettings = { ...DEFAULT_SETTINGS, ...parsed };
            setSettings(migratedSettings);
            
            // Migrate to Firebase
            await setDoc(doc(db, 'users', user.uid), {
              notificationSettings: migratedSettings
            }, { merge: true });
          } else {
            // No settings anywhere, use defaults and save to Firebase
            await setDoc(doc(db, 'users', user.uid), {
              notificationSettings: DEFAULT_SETTINGS
            }, { merge: true });
          }
        }
      } else {
        // Load from AsyncStorage for unauthenticated users
        const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      // Fallback to AsyncStorage if Firebase fails
      try {
        const stored = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setSettings({ ...DEFAULT_SETTINGS, ...parsed });
        }
      } catch (fallbackError) {
        console.error('Error loading from AsyncStorage fallback:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Save settings to both Firebase and AsyncStorage
  const saveSettings = useCallback(async (newSettings: NotificationSettings) => {
    try {
      // Always save to AsyncStorage for immediate access
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      
      // Save to Firebase for authenticated users
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          notificationSettings: newSettings
        });
        console.log('📱 Notification settings saved to Firebase:', newSettings);
      } else {
        console.log('📱 Notification settings saved to AsyncStorage:', newSettings);
      }
    } catch (error) {
      console.error('Error saving notification settings:', error);
      // If Firebase fails, at least AsyncStorage should work
      try {
        await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
        console.log('📱 Notification settings saved to AsyncStorage (fallback)');
      } catch (fallbackError) {
        console.error('Error saving to AsyncStorage fallback:', fallbackError);
      }
    }
  }, [user]);

  // Update a specific setting
  const updateSetting = useCallback(async <K extends keyof NotificationSettings>(
    key: K,
    value: NotificationSettings[K]
  ) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await saveSettings(newSettings);

    // Handle master toggle
    if (key === 'notificationsEnabled') {
      const notificationService = NotificationService.getInstance();
      
      if (!value) {
        // User disabled notifications - unsubscribe from all topics
        console.log('🔕 User disabled notifications, unsubscribing from topics');
        await notificationService.unsubscribeFromTopic('receiptgold_general');
        await notificationService.unsubscribeFromTopic('receipt_processing');
        await notificationService.unsubscribeFromTopic('tax_reminders');
        await notificationService.unsubscribeFromTopic('subscription_updates');
        await notificationService.unsubscribeFromTopic('tips_features');
        await notificationService.unsubscribeFromTopic('security_alerts');
      } else {
        // User enabled notifications - resubscribe based on individual settings
        console.log('🔔 User enabled notifications, subscribing to topics based on preferences');
        await notificationService.subscribeToTopic('receiptgold_general');
        
        if (newSettings.receiptProcessing) {
          await notificationService.subscribeToTopic('receipt_processing');
        }
        if (newSettings.taxReminders) {
          await notificationService.subscribeToTopic('tax_reminders');
        }
        if (newSettings.subscriptionUpdates) {
          await notificationService.subscribeToTopic('subscription_updates');
        }
        if (newSettings.tipsFeatures) {
          await notificationService.subscribeToTopic('tips_features');
        }
        if (newSettings.securityAlerts) {
          await notificationService.subscribeToTopic('security_alerts');
        }
      }
    }

    // Handle individual topic toggles
    if (settings.notificationsEnabled && key !== 'notificationsEnabled' && key !== 'quietHours' && key !== 'frequency') {
      const notificationService = NotificationService.getInstance();
      const topicMap = {
        receiptProcessing: 'receipt_processing',
        taxReminders: 'tax_reminders',
        subscriptionUpdates: 'subscription_updates',
        tipsFeatures: 'tips_features',
        securityAlerts: 'security_alerts',
      };

      const topic = topicMap[key as keyof typeof topicMap];
      if (topic) {
        if (value) {
          await notificationService.subscribeToTopic(topic);
        } else {
          await notificationService.unsubscribeFromTopic(topic);
        }
      }
    }
  }, [settings, saveSettings]);

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    setSettings(DEFAULT_SETTINGS);
    await saveSettings(DEFAULT_SETTINGS);
    
    // Resubscribe to default topics
    const notificationService = NotificationService.getInstance();
    await notificationService.subscribeToTopic('receiptgold_general');
    await notificationService.subscribeToTopic('receipt_processing');
    await notificationService.subscribeToTopic('tax_reminders');
    await notificationService.subscribeToTopic('security_alerts');
    await notificationService.unsubscribeFromTopic('subscription_updates');
    await notificationService.unsubscribeFromTopic('tips_features');
  }, [saveSettings]);

  // Check if we can send a specific type of notification
  const canSendNotification = useCallback((type: keyof Omit<NotificationSettings, 'notificationsEnabled' | 'quietHours' | 'frequency'>) => {
    if (!settings.notificationsEnabled) {
      return false;
    }

    if (isInQuietHours()) {
      // Only allow critical notifications during quiet hours
      return type === 'securityAlerts';
    }

    if (settings.frequency === 'minimal') {
      // Only critical notifications in minimal mode
      return type === 'securityAlerts' || type === 'receiptProcessing';
    }

    if (settings.frequency === 'important') {
      // Skip tips and features in important mode
      return type !== 'tipsFeatures';
    }

    // All mode - respect individual settings
    return settings[type];
  }, [settings]);

  // Check if we're in quiet hours
  const isInQuietHours = useCallback(() => {
    if (!settings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    const { startTime, endTime } = settings.quietHours;
    
    // Handle overnight quiet hours (e.g., 22:00 to 08:00)
    if (startTime > endTime) {
      return currentTime >= startTime || currentTime <= endTime;
    } else {
      return currentTime >= startTime && currentTime <= endTime;
    }
  }, [settings]);

  // Load settings on mount and when user changes
  useEffect(() => {
    loadSettings();
  }, [loadSettings, user]);

  const value: NotificationSettingsContextType = {
    settings,
    loading,
    updateSetting,
    resetToDefaults,
    canSendNotification,
    isInQuietHours,
  };

  return (
    <NotificationSettingsContext.Provider value={value}>
      {children}
    </NotificationSettingsContext.Provider>
  );
};

export default NotificationSettingsProvider;
