import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeProvider';
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationSettings } from '../context/NotificationSettingsContext';
import { BankReceiptService } from '../services/BankReceiptService';
import { useAuth } from '../hooks/useAuth';
import { NotificationService } from '../services/ExpoNotificationService';

// Helper functions for time handling
const timeStringToDate = (timeString: string): Date => {
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const dateToTimeString = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatDisplayTime = (timeString: string): string => {
  const date = timeStringToDate(timeString);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const NotificationSettingsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { getPermissionStatus, getFCMToken } = useNotifications();
  const { user } = useAuth();
  const { 
    settings, 
    loading, 
    updateSetting, 
    resetToDefaults, 
    canSendNotification, 
    isInQuietHours 
  } = useNotificationSettings();
  
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
  const [fcmToken, setFCMToken] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    loadNotificationData();
  }, []);

  const loadNotificationData = async () => {
    try {
      const status = await getPermissionStatus();
      setPermissionStatus(status);
      
      const token = await getFCMToken();
      setFCMToken(token);
    } catch (error) {
      console.error('Error loading notification data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotificationData();
    setRefreshing(false);
  };

  const requestPermissions = async () => {
    try {
      const { NotificationService } = await import('../services/ExpoNotificationService');
      const service = NotificationService.getInstance();
      await service.initialize();
      await loadNotificationData();
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions.');
    }
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      'Reset Notification Settings',
      'This will reset all notification preferences to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Reset', 
          style: 'destructive',
          onPress: resetToDefaults 
        }
      ]
    );
  };

  const copyTokenToClipboard = () => {
    if (fcmToken) {
      Alert.alert('Push Token', fcmToken, [{ text: 'OK' }]);
    }
  };

  const regenerateToken = async () => {
    try {
      console.log('🔄 Regenerating push token...');
      const notificationService = NotificationService.getInstance();
      await notificationService.clearToken(); // Clear cached token
      const newToken = await notificationService.getDevicePushToken();
      console.log('🆕 New token:', newToken);
      
      if (user && newToken) {
        await notificationService.saveTokenToFirestore(user.uid);
        Alert.alert('Token Regenerated', `New token: ${newToken}`, [{ text: 'OK' }]);
        // Reload notification data to show new token
        await loadNotificationData();
      }
    } catch (error) {
      console.error('❌ Error regenerating token:', error);
      Alert.alert('Error', 'Failed to regenerate token');
    }
  };

  const testLocalNotificationTrigger = async () => {
    try {
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      console.log('🧪 Testing local notification trigger...');
      
      // Import Firestore functions
      const { db } = await import('../config/firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

      // Create a test document in user_notifications (same as Cloud Function would do)
      const testNotification = {
        userId: user.uid,
        title: '🧪 Test Local Notification',
        body: 'This tests the local notification monitoring system!',
        data: {
          type: 'test',
          priority: 'medium',
          createdAt: new Date().toISOString()
        },
        createdAt: serverTimestamp(),
        read: false,
        source: 'manual_test'
      };

      const docRef = await addDoc(collection(db, 'user_notifications'), testNotification);
      
      console.log('✅ Test notification document created with ID:', docRef.id);
      console.log('✅ Document data:', testNotification);
      Alert.alert('Test Triggered', `Local notification trigger created with ID: ${docRef.id}. Check console logs!`);
      
    } catch (error) {
      console.error('❌ Error testing local notification:', error);
      Alert.alert('Error', 'Failed to test local notification');
    }
  };

  const testWebhook = async (webhookCode: string) => {
    try {
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Get real bank connections
      const bankService = BankReceiptService.getInstance();
      const connections = await bankService.getBankConnections(user.uid);
      
      if (connections.length === 0) {
        Alert.alert('No Bank Connections', 'Please connect a bank account first to test webhooks.');
        return;
      }

      // Use the first active connection
      const connection = connections.find(conn => conn.isActive) || connections[0];

      const webhookTypeMap: Record<string, string> = {
        'PENDING_EXPIRATION': 'ITEM',
        'NEW_ACCOUNTS_AVAILABLE': 'ITEM',
        'LOGIN_REPAIRED': 'ITEM',
        'TRANSACTIONS': 'TRANSACTIONS',
      };

      const webhookType = webhookTypeMap[webhookCode] || 'ITEM';

      const payload = {
        webhook_type: webhookType,
        webhook_code: webhookCode === 'TRANSACTIONS' ? 'DEFAULT_UPDATE' : webhookCode,
        item_id: connection.id,
        institution_name: connection.institutionName,
        ...(webhookType === 'TRANSACTIONS' && {
          new_transactions: 3,
          removed_transactions: 0,
        }),
      };

      console.log('🧪 Testing webhook:', payload);

      const response = await fetch('https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook test result:', result);
        Alert.alert(
          'Webhook Test Success',
          `${webhookCode} webhook fired successfully!\n\nCheck Firestore for notifications.`,
          [{ text: 'OK' }]
        );
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('❌ Webhook test failed:', error);
      Alert.alert(
        'Webhook Test Failed',
        `Failed to test ${webhookCode} webhook: ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const getPermissionStatusColor = () => {
    switch (permissionStatus) {
      case 'granted':
        return theme.status.success;
      case 'denied':
        return theme.status.error;
      default:
        return theme.text.secondary;
    }
  };

  const getPermissionStatusText = () => {
    switch (permissionStatus) {
      case 'granted':
        return 'Notifications Enabled';
      case 'denied':
        return 'Notifications Disabled';
      case 'undetermined':
        return 'Permission Not Set';
      default:
        return 'Unknown Status';
    }
  };

  const notificationTypes = [
    {
      key: 'receiptProcessing' as const,
      title: 'Receipt Processing',
      description: 'Get notified when your receipts are processed and ready',
      icon: 'receipt' as const,
    },
    {
      key: 'taxReminders' as const,
      title: 'Tax Reminders',
      description: 'Important tax deadlines and preparation reminders',
      icon: 'calendar' as const,
    },
    {
      key: 'subscriptionUpdates' as const,
      title: 'Subscription Updates',
      description: 'Updates about your ReceiptGold subscription',
      icon: 'card' as const,
    },
    {
      key: 'tipsFeatures' as const,
      title: 'Tips & New Features',
      description: 'Learn about new features and helpful tips',
      icon: 'bulb' as const,
    },
    {
      key: 'securityAlerts' as const,
      title: 'Security Alerts',
      description: 'Important security notifications and updates',
      icon: 'shield-checkmark' as const,
    },
  ];

  const frequencyOptions = [
    { value: 'all', label: 'All Notifications', description: 'Receive all enabled notifications' },
    { value: 'important', label: 'Important Only', description: 'Skip tips and promotional content' },
    { value: 'minimal', label: 'Critical Only', description: 'Only receipts and security alerts' },
  ];

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background.primary,
    },
    scrollContainer: {
      flex: 1,
    },
    header: {
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.border.primary,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: theme.text.primary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: theme.text.secondary,
      lineHeight: 22,
    },
    statusSection: {
      margin: 20,
      padding: 16,
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    statusIcon: {
      marginRight: 12,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
    },
    tokenSection: {
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border.primary,
    },
    tokenText: {
      fontSize: 12,
      color: theme.text.secondary,
      fontFamily: 'monospace',
    },
    requestButton: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: theme.gold.primary,
      borderRadius: 8,
      alignItems: 'center',
    },
    requestButtonText: {
      color: theme.text.inverse,
      fontSize: 14,
      fontWeight: '600',
    },
    section: {
      margin: 20,
      marginTop: 0,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 16,
    },
    masterToggle: {
      padding: 20,
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    masterToggleContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    masterToggleText: {
      flex: 1,
    },
    masterToggleTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    masterToggleDescription: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    quietHoursIndicator: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: theme.status.warning + '20',
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    quietHoursText: {
      fontSize: 12,
      color: theme.status.warning,
      fontWeight: '600',
    },
    settingItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 16,
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
      opacity: settings.notificationsEnabled ? 1 : 0.5,
    },
    settingIcon: {
      marginRight: 16,
    },
    settingContent: {
      flex: 1,
    },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 14,
      color: theme.text.secondary,
      lineHeight: 20,
    },
    switch: {
      marginLeft: 12,
    },
    frequencySection: {
      marginBottom: 20,
    },
    frequencyOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      backgroundColor: theme.background.secondary,
      borderRadius: 8,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    frequencyOptionSelected: {
      borderColor: theme.gold.primary,
      backgroundColor: theme.gold.background,
    },
    radioButton: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: theme.border.primary,
      marginRight: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioButtonSelected: {
      borderColor: theme.gold.primary,
    },
    radioButtonInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: theme.gold.primary,
    },
    frequencyContent: {
      flex: 1,
    },
    frequencyTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 2,
    },
    frequencyDescription: {
      fontSize: 14,
      color: theme.text.secondary,
    },
    quietHoursSection: {
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: theme.border.primary,
    },
    quietHoursHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    quietHoursTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
    },
    timeInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      flexWrap: 'wrap',
    },
    timeContainer: {
      marginTop: 12,
      paddingHorizontal: 4,
    },
    timeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    timeLabel: {
      fontSize: 14,
      color: theme.text.secondary,
      width: 50,
      textAlign: 'right',
      marginRight: 8,
    },
    timeInput: {
      flex: 1,
      backgroundColor: theme.background.primary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 8,
      color: theme.text.primary,
      fontSize: 16,
      textAlign: 'center',
      minWidth: 90, // Accommodate "10:00 PM" format
    },
    timeButton: {
      backgroundColor: theme.background.primary,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border.primary,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: 120,
      flex: 1,
    },
    timeButtonText: {
      color: theme.text.primary,
      fontSize: 16,
      fontWeight: '500',
    },
    timeFormatHint: {
      fontSize: 12,
      color: theme.text.secondary,
      textAlign: 'center',
      marginTop: 8,
      fontStyle: 'italic',
    },
    resetButton: {
      marginTop: 20,
      padding: 16,
      backgroundColor: theme.background.secondary,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.status.error,
      alignItems: 'center',
    },
    resetButtonText: {
      color: theme.status.error,
      fontSize: 16,
      fontWeight: '600',
    },
    webhookTestSection: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: theme.border.primary,
    },
    webhookTestTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    webhookTestDescription: {
      fontSize: 12,
      color: theme.text.secondary,
      marginBottom: 12,
    },
    webhookButtonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
    },
    webhookButton: {
      flex: 1,
      minWidth: '47%',
      maxWidth: '48%',
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.2,
      shadowRadius: 1.41,
      elevation: 2,
    },
    webhookButtonIcon: {
      fontSize: 16,
      marginBottom: 4,
    },
    webhookButtonText: {
      color: '#FFFFFF',
      fontSize: 11,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 14,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ color: theme.text.primary }}>Loading notification settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>
            Manage your notification preferences and stay updated with ReceiptGold
          </Text>
        </View>

        {/* Permission Status */}
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <Ionicons
              name={permissionStatus === 'granted' ? 'checkmark-circle' : 'alert-circle'}
              size={24}
              color={getPermissionStatusColor()}
              style={styles.statusIcon}
            />
            <Text style={[styles.statusText, { color: getPermissionStatusColor() }]}>
              {getPermissionStatusText()}
            </Text>
          </View>

          {(permissionStatus === 'denied' || permissionStatus === 'undetermined') && (
            <TouchableOpacity style={styles.requestButton} onPress={requestPermissions}>
              <Text style={styles.requestButtonText}>
                {permissionStatus === 'undetermined' ? 'Allow Notifications' : 'Enable Notifications'}
              </Text>
            </TouchableOpacity>
          )}

          {fcmToken && __DEV__ && (
            <View style={styles.tokenSection}>
              <TouchableOpacity onPress={copyTokenToClipboard}>
                <Text style={styles.tokenText} numberOfLines={2}>
                  {fcmToken.startsWith('ExpoToken[') 
                    ? `Legacy Expo Token: ${fcmToken.substring(0, 30)}...` 
                    : `Native ${Platform.OS === 'ios' ? 'APNs' : 'FCM'} Token: ${fcmToken.substring(0, 30)}...`}
                </Text>
                <Text style={[styles.tokenText, { marginTop: 8, color: theme.status.success }]}>
                  ✅ Using {fcmToken.startsWith('ExpoToken[') ? 'Expo Legacy' : 'Direct FCM/APNs'} delivery
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {__DEV__ && (
            <View style={styles.webhookTestSection}>
              <Text style={styles.webhookTestTitle}>Debug Tools</Text>
              <Text style={styles.webhookTestDescription}>
                Development and testing tools
              </Text>
              
              <TouchableOpacity 
                style={[styles.requestButton, { backgroundColor: theme.status.warning, marginBottom: 8 }]}
                onPress={regenerateToken}
              >
                <Text style={[styles.requestButtonText, { color: '#FFFFFF' }]}>
                  🔄 Regenerate Push Token
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.requestButton, { backgroundColor: theme.status.success, marginBottom: 16 }]}
                onPress={testLocalNotificationTrigger}
              >
                <Text style={[styles.requestButtonText, { color: '#FFFFFF' }]}>
                  🧪 Test Local Notification
                </Text>
              </TouchableOpacity>
              
              <Text style={[styles.webhookTestTitle, { marginBottom: 4 }]}>Webhook Tests</Text>
              <Text style={[styles.webhookTestDescription, { marginBottom: 12 }]}>
                Test Plaid webhook notifications
              </Text>
              {console.log('🧪 Webhook test section rendering in dev mode')}
              
              <View style={styles.webhookButtonGrid}>
                <TouchableOpacity 
                  style={[styles.webhookButton, { backgroundColor: '#FF6B6B' }]}
                  onPress={() => testWebhook('PENDING_EXPIRATION')}
                >
                  <Text style={styles.webhookButtonIcon}>🔴</Text>
                  <Text style={styles.webhookButtonText}>Connection Issue</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.webhookButton, { backgroundColor: '#4ECDC4' }]}
                  onPress={() => testWebhook('NEW_ACCOUNTS_AVAILABLE')}
                >
                  <Text style={styles.webhookButtonIcon}>🆕</Text>
                  <Text style={styles.webhookButtonText}>New Accounts</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.webhookButton, { backgroundColor: '#45B7D1' }]}
                  onPress={() => testWebhook('LOGIN_REPAIRED')}
                >
                  <Text style={styles.webhookButtonIcon}>✅</Text>
                  <Text style={styles.webhookButtonText}>Login Repaired</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.webhookButton, { backgroundColor: '#96CEB4' }]}
                  onPress={() => testWebhook('TRANSACTIONS')}
                >
                  <Text style={styles.webhookButtonIcon}>💳</Text>
                  <Text style={styles.webhookButtonText}>New Transactions</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          {/* Master Toggle */}
          <View style={styles.masterToggle}>
            <View style={styles.masterToggleContent}>
              <View style={styles.masterToggleText}>
                <Text style={styles.masterToggleTitle}>Enable Notifications</Text>
                <Text style={styles.masterToggleDescription}>
                  Master toggle for all app notifications
                </Text>
                {isInQuietHours() && settings.quietHours.enabled && (
                  <View style={styles.quietHoursIndicator}>
                    <Text style={styles.quietHoursText}>🔇 Quiet Hours Active</Text>
                  </View>
                )}
              </View>
              <Switch
                style={styles.switch}
                value={settings.notificationsEnabled}
                onValueChange={(value) => updateSetting('notificationsEnabled', value)}
                trackColor={{ 
                  false: theme.border.primary, 
                  true: theme.gold.primary + '40' 
                }}
                thumbColor={settings.notificationsEnabled ? theme.gold.primary : theme.text.secondary}
              />
            </View>
          </View>

          {/* Frequency Selection */}
          <Text style={styles.sectionTitle}>Notification Frequency</Text>
          <View style={styles.frequencySection}>
            {frequencyOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.frequencyOption,
                  settings.frequency === option.value && styles.frequencyOptionSelected
                ]}
                onPress={() => updateSetting('frequency', option.value as any)}
                disabled={!settings.notificationsEnabled}
              >
                <View style={[
                  styles.radioButton,
                  settings.frequency === option.value && styles.radioButtonSelected
                ]}>
                  {settings.frequency === option.value && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <View style={styles.frequencyContent}>
                  <Text style={styles.frequencyTitle}>{option.label}</Text>
                  <Text style={styles.frequencyDescription}>{option.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Quiet Hours */}
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <View style={styles.quietHoursSection}>
            <View style={styles.quietHoursHeader}>
              <Text style={styles.quietHoursTitle}>Do Not Disturb</Text>
              <Switch
                value={settings.quietHours.enabled}
                onValueChange={(value) => updateSetting('quietHours', {
                  ...settings.quietHours,
                  enabled: value
                })}
                disabled={!settings.notificationsEnabled}
                trackColor={{ 
                  false: theme.border.primary, 
                  true: theme.gold.primary + '40' 
                }}
                thumbColor={settings.quietHours.enabled ? theme.gold.primary : theme.text.secondary}
              />
            </View>
            
            {settings.quietHours.enabled && (
              <View style={styles.timeContainer}>
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>From:</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowStartTimePicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatDisplayTime(settings.quietHours.startTime)}
                    </Text>
                    <Ionicons name="time-outline" size={16} color={theme.text.secondary} />
                  </TouchableOpacity>
                </View>
                
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>To:</Text>
                  <TouchableOpacity
                    style={styles.timeButton}
                    onPress={() => setShowEndTimePicker(true)}
                  >
                    <Text style={styles.timeButtonText}>
                      {formatDisplayTime(settings.quietHours.endTime)}
                    </Text>
                    <Ionicons name="time-outline" size={16} color={theme.text.secondary} />
                  </TouchableOpacity>
                </View>
                
                {showStartTimePicker && (
                  <DateTimePicker
                    value={timeStringToDate(settings.quietHours.startTime)}
                    mode="time"
                    is24Hour={false}
                    onChange={(event, selectedDate) => {
                      setShowStartTimePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        const timeString = dateToTimeString(selectedDate);
                        updateSetting('quietHours', {
                          ...settings.quietHours,
                          startTime: timeString
                        });
                      }
                    }}
                  />
                )}
                
                {showEndTimePicker && (
                  <DateTimePicker
                    value={timeStringToDate(settings.quietHours.endTime)}
                    mode="time"
                    is24Hour={false}
                    onChange={(event, selectedDate) => {
                      setShowEndTimePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        const timeString = dateToTimeString(selectedDate);
                        updateSetting('quietHours', {
                          ...settings.quietHours,
                          endTime: timeString
                        });
                      }
                    }}
                  />
                )}
                
                <Text style={styles.timeFormatHint}>
                  Tap the time buttons above to set your quiet hours
                </Text>
              </View>
            )}
          </View>

          {/* Individual Notification Types */}
          <Text style={styles.sectionTitle}>Notification Types</Text>
          {notificationTypes.map((notificationType) => (
            <View key={notificationType.key} style={styles.settingItem}>
              <Ionicons
                name={notificationType.icon}
                size={24}
                color={settings[notificationType.key] && settings.notificationsEnabled 
                  ? theme.gold.primary 
                  : theme.text.secondary}
                style={styles.settingIcon}
              />
              
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{notificationType.title}</Text>
                <Text style={styles.settingDescription}>{notificationType.description}</Text>
                {canSendNotification(notificationType.key) && (
                  <Text style={[styles.settingDescription, { color: theme.status.success, marginTop: 4 }]}>
                    ✓ Will be delivered
                  </Text>
                )}
              </View>
              
              <Switch
                style={styles.switch}
                value={settings[notificationType.key]}
                onValueChange={(value) => updateSetting(notificationType.key, value)}
                disabled={!settings.notificationsEnabled}
                trackColor={{ 
                  false: theme.border.primary, 
                  true: theme.gold.primary + '40' 
                }}
                thumbColor={settings[notificationType.key] ? theme.gold.primary : theme.text.secondary}
              />
            </View>
          ))}

          {/* Reset Button */}
          <TouchableOpacity style={styles.resetButton} onPress={handleResetToDefaults}>
            <Text style={styles.resetButtonText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsScreen;
