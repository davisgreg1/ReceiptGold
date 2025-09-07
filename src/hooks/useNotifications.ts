import { useCallback } from 'react';
import { NotificationService } from '../services/NotificationService';
import { useNotificationSettings } from '../context/NotificationSettingsContext';

export const useNotifications = () => {
  const notificationService = NotificationService.getInstance();
  const { canSendNotification, isInQuietHours, settings } = useNotificationSettings();

  const getFCMToken = useCallback(async () => {
    return await notificationService.getFCMToken();
  }, [notificationService]);

  const subscribeToTopic = useCallback(async (topic: string) => {
    // Only subscribe if notifications are enabled
    if (!settings.notificationsEnabled) {
      console.log(`📵 Skipping topic subscription (${topic}) - notifications disabled`);
      return;
    }
    await notificationService.subscribeToTopic(topic);
  }, [notificationService, settings.notificationsEnabled]);

  const unsubscribeFromTopic = useCallback(async (topic: string) => {
    await notificationService.unsubscribeFromTopic(topic);
  }, [notificationService]);

  const getPermissionStatus = useCallback(async () => {
    return await notificationService.getPermissionStatus();
  }, [notificationService]);

  const clearToken = useCallback(async () => {
    await notificationService.clearToken();
  }, [notificationService]);

  const scheduleLocalNotification = useCallback(async (
    title: string,
    body: string,
    data?: any,
    delay?: number
  ) => {
    if ('scheduleLocalNotification' in notificationService) {
      await (notificationService as any).scheduleLocalNotification(title, body, data, delay);
    }
  }, [notificationService]);

  // New method that respects user settings
  const scheduleNotificationWithSettings = useCallback(async (
    type: 'receiptProcessing' | 'taxReminders' | 'subscriptionUpdates' | 'tipsFeatures' | 'securityAlerts',
    title: string,
    body: string,
    data?: any,
    delay?: number
  ) => {
    if ('scheduleNotificationWithSettings' in notificationService) {
      return await (notificationService as any).scheduleNotificationWithSettings(
        type,
        title,
        body,
        data,
        delay,
        canSendNotification,
        isInQuietHours
      );
    }
    return false;
  }, [notificationService, canSendNotification, isInQuietHours]);

  return {
    getFCMToken,
    subscribeToTopic,
    unsubscribeFromTopic,
    getPermissionStatus,
    clearToken,
    scheduleLocalNotification,
    scheduleNotificationWithSettings,
    // Expose settings info
    notificationsEnabled: settings.notificationsEnabled,
    isInQuietHours: isInQuietHours(),
    canSendNotification,
  };
};

export default useNotifications;
