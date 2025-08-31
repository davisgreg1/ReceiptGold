import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import PlaidConnectionService, { PlaidItem, ConnectionNotification } from '../services/PlaidConnectionService';
import { BrandText, HeadingText, BodyText, ButtonText } from '../components/Typography';

interface ConnectionManagementScreenProps {
  navigation: any;
}

const ConnectionManagementScreen: React.FC<ConnectionManagementScreenProps> = ({ navigation }) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [notifications, setNotifications] = useState<ConnectionNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconnectingItem, setReconnectingItem] = useState<string | null>(null);

  const connectionService = PlaidConnectionService;

  useEffect(() => {
    if (user) {
      loadData();
      
      // Subscribe to real-time updates
      const unsubscribeItems = connectionService.subscribeToItemUpdates(user.uid, setItems);
      const unsubscribeNotifications = connectionService.subscribeToNotifications(user.uid, setNotifications);
      
      return () => {
        unsubscribeItems();
        unsubscribeNotifications();
      };
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      const [userItems, userNotifications] = await Promise.all([
        connectionService.getUserItems(user.uid),
        connectionService.getUserNotifications(user.uid)
      ]);
      
      setItems(userItems);
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error loading connection data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleReconnect = async (item: PlaidItem) => {
    setReconnectingItem(item.id);
    
    try {
      // Import Plaid Link
      const { PlaidLink } = await import('react-native-plaid-link-sdk');
      
      // Get update mode link token from Firebase function
      const createPlaidUpdateToken = async (itemId: string) => {
        // This would call your Firebase function
        // For now, we'll show how it would work
        const response = await fetch('/your-firebase-function-url/createPlaidUpdateToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId })
        });
        return response.json();
      };

      const tokenResponse = await createPlaidUpdateToken(item.itemId);
      
      if (!tokenResponse.link_token) {
        throw new Error('Failed to create update link token');
      }

      // Launch Plaid Link in update mode
      PlaidLink.open({
        tokenConfig: {
          token: tokenResponse.link_token,
        },
        onSuccess: (success: any) => {
          console.log('Plaid Link update success:', success);
          Alert.alert(
            'Connection Updated',
            `Your ${item.institutionName} connection has been successfully updated.`,
            [{ text: 'OK' }]
          );
          // Refresh data to show updated status
          loadData();
        },
        onExit: (exit: any) => {
          console.log('Plaid Link update exit:', exit);
          if (exit.error) {
            Alert.alert(
              'Update Failed',
              exit.error.displayMessage || 'Failed to update connection. Please try again.',
              [{ text: 'OK' }]
            );
          }
        },
      });
      
    } catch (error) {
      console.error('Error launching Plaid Link update:', error);
      Alert.alert(
        'Error',
        'Failed to launch bank reconnection. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setReconnectingItem(null);
    }
  };

  const dismissNotification = async (notification: ConnectionNotification) => {
    try {
      await connectionService.dismissNotification(notification.id);
    } catch (error) {
      console.error('Error dismissing notification:', error);
    }
  };

  const getStatusColor = (item: PlaidItem) => {
    if (!item.active || item.status === 'error') return theme.status.error;
    if (item.status === 'pending_expiration' || item.needsReauth) return theme.status.warning;
    return theme.status.success;
  };

  const getStatusIcon = (item: PlaidItem) => {
    if (!item.active || item.status === 'error') return 'alert-circle';
    if (item.status === 'pending_expiration' || item.needsReauth) return 'warning';
    return 'checkmark-circle';
  };

  const getStatusText = (item: PlaidItem) => {
    if (!item.active) return 'Disconnected';
    if (item.status === 'error') return 'Error';
    if (item.status === 'pending_expiration') return 'Expiring Soon';
    if (item.status === 'pending_disconnect') return 'Will Disconnect';
    if (item.needsReauth) return 'Needs Attention';
    return 'Connected';
  };

  const connectionHealth = connectionService.getConnectionHealth(items);

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
            Loading bank connections...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <HeadingText style={[styles.title, { color: theme.text.primary }]}>
            Bank Connections
          </HeadingText>
          <BodyText style={[styles.subtitle, { color: theme.text.secondary }]}>
            Manage your connected bank accounts
          </BodyText>
        </View>

        {/* Connection Health Overview */}
        <View style={[styles.healthCard, { backgroundColor: theme.background.secondary }]}>
          <View style={styles.healthHeader}>
            <HeadingText style={[styles.healthTitle, { color: theme.text.primary }]}>
              Connection Health
            </HeadingText>
            <View style={[
              styles.healthStatus,
              { backgroundColor: connectionHealth.status === 'healthy' ? theme.status.success : 
                  connectionHealth.status === 'warning' ? theme.status.warning : theme.status.error }
            ]}>
              <Ionicons 
                name={connectionHealth.status === 'healthy' ? 'checkmark' : 'warning'} 
                size={16} 
                color="white" 
              />
              <Text style={[styles.healthStatusText, { color: 'white' }]}>
                {connectionHealth.status.charAt(0).toUpperCase() + connectionHealth.status.slice(1)}
              </Text>
            </View>
          </View>
          
          <View style={styles.healthStats}>
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatNumber, { color: theme.text.primary }]}>
                {connectionHealth.connected}
              </Text>
              <Text style={[styles.healthStatLabel, { color: theme.text.secondary }]}>
                Connected
              </Text>
            </View>
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatNumber, { color: theme.status.warning }]}>
                {connectionHealth.needsAttention}
              </Text>
              <Text style={[styles.healthStatLabel, { color: theme.text.secondary }]}>
                Need Attention
              </Text>
            </View>
            <View style={styles.healthStat}>
              <Text style={[styles.healthStatNumber, { color: theme.status.error }]}>
                {connectionHealth.critical}
              </Text>
              <Text style={[styles.healthStatLabel, { color: theme.text.secondary }]}>
                Critical
              </Text>
            </View>
          </View>
        </View>

        {/* Active Notifications */}
        {notifications.length > 0 && (
          <View style={styles.section}>
            <HeadingText style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Notifications
            </HeadingText>
            {notifications.map((notification) => (
              <View
                key={notification.id}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: theme.background.secondary,
                    borderLeftColor: notification.priority === 'high' ? theme.status.error :
                      notification.priority === 'medium' ? theme.status.warning : theme.status.info
                  }
                ]}
              >
                <View style={styles.notificationContent}>
                  <View style={styles.notificationHeader}>
                    <Text style={[styles.notificationTitle, { color: theme.text.primary }]}>
                      {notification.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => dismissNotification(notification)}
                      style={styles.dismissButton}
                    >
                      <Ionicons name="close" size={20} color={theme.text.tertiary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.notificationMessage, { color: theme.text.secondary }]}>
                    {notification.message}
                  </Text>
                  <Text style={[styles.notificationBank, { color: theme.text.tertiary }]}>
                    {notification.institutionName}
                  </Text>
                </View>
                
                {notification.actionRequired && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    onPress={() => {
                      const item = items.find(i => i.itemId === notification.itemId);
                      if (item) handleReconnect(item);
                    }}
                  >
                    <ButtonText style={[styles.actionButtonText, { color: 'white' }]}>
                      Reconnect
                    </ButtonText>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Connected Banks */}
        <View style={styles.section}>
          <HeadingText style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Connected Banks ({items.length})
          </HeadingText>
          
          {items.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: theme.background.secondary }]}>
              <Ionicons name="bank-outline" size={48} color={theme.text.tertiary} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                No Banks Connected
              </Text>
              <Text style={[styles.emptyMessage, { color: theme.text.secondary }]}>
                Connect your bank accounts to automatically track receipt expenses from transactions.
              </Text>
              <TouchableOpacity
                style={[styles.connectButton, { backgroundColor: theme.colors.primary }]}
                onPress={() => navigation.navigate('PlaidConnection')}
              >
                <ButtonText style={[styles.connectButtonText, { color: 'white' }]}>
                  Connect Bank Account
                </ButtonText>
              </TouchableOpacity>
            </View>
          ) : (
            items.map((item) => (
              <View
                key={item.id}
                style={[styles.bankCard, { backgroundColor: theme.background.secondary }]}
              >
                <View style={styles.bankHeader}>
                  <View style={styles.bankInfo}>
                    <Text style={[styles.bankName, { color: theme.text.primary }]}>
                      {item.institutionName}
                    </Text>
                    <View style={styles.accountsInfo}>
                      <Ionicons name="card-outline" size={14} color={theme.text.tertiary} />
                      <Text style={[styles.accountsCount, { color: theme.text.tertiary }]}>
                        {item.accounts.length} account{item.accounts.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.bankStatus}>
                    <Ionicons
                      name={getStatusIcon(item)}
                      size={20}
                      color={getStatusColor(item)}
                    />
                    <Text style={[styles.bankStatusText, { color: getStatusColor(item) }]}>
                      {getStatusText(item)}
                    </Text>
                  </View>
                </View>

                {item.error && (
                  <Text style={[styles.errorMessage, { color: theme.status.error }]}>
                    {item.error.displayMessage}
                  </Text>
                )}

                <View style={styles.bankActions}>
                  <Text style={[styles.lastSync, { color: theme.text.tertiary }]}>
                    Last sync: {item.lastSyncAt ? 
                      new Date(item.lastSyncAt).toLocaleDateString() : 'Never'}
                  </Text>
                  
                  {(item.needsReauth || !item.active || item.status === 'error') && (
                    <TouchableOpacity
                      style={[styles.reconnectButton, { 
                        backgroundColor: theme.colors.primary,
                        opacity: reconnectingItem === item.id ? 0.7 : 1
                      }]}
                      onPress={() => handleReconnect(item)}
                      disabled={reconnectingItem === item.id}
                    >
                      {reconnectingItem === item.id ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={16} color="white" />
                          <ButtonText style={[styles.reconnectButtonText, { color: 'white' }]}>
                            Reconnect
                          </ButtonText>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                {/* Account List */}
                <View style={styles.accountsList}>
                  {item.accounts.slice(0, 3).map((account, index) => (
                    <View key={account.accountId} style={styles.accountItem}>
                      <Text style={[styles.accountName, { color: theme.text.secondary }]}>
                        {account.name} {account.mask && `•••${account.mask}`}
                      </Text>
                      <Text style={[styles.accountType, { color: theme.text.tertiary }]}>
                        {account.type} • {account.subtype}
                      </Text>
                    </View>
                  ))}
                  {item.accounts.length > 3 && (
                    <Text style={[styles.moreAccounts, { color: theme.text.tertiary }]}>
                      +{item.accounts.length - 3} more accounts
                    </Text>
                  )}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Add Connection Button */}
        <TouchableOpacity
          style={[styles.addConnectionButton, { backgroundColor: theme.background.secondary }]}
          onPress={() => navigation.navigate('PlaidConnection')}
        >
          <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
          <ButtonText style={[styles.addConnectionText, { color: theme.colors.primary }]}>
            Connect Another Bank
          </ButtonText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
  },
  healthCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  healthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  healthTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  healthStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  healthStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  healthStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  healthStat: {
    alignItems: 'center',
  },
  healthStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  healthStatLabel: {
    fontSize: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  notificationCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  dismissButton: {
    padding: 4,
  },
  notificationMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationBank: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 12,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  connectButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bankCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  bankHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accountsCount: {
    marginLeft: 6,
    fontSize: 12,
  },
  bankStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 16,
  },
  bankStatusText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 12,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  bankActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  lastSync: {
    fontSize: 12,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  reconnectButtonText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  accountsList: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  accountItem: {
    marginBottom: 8,
  },
  accountName: {
    fontSize: 13,
    fontWeight: '500',
  },
  accountType: {
    fontSize: 11,
    marginTop: 2,
  },
  moreAccounts: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },
  addConnectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.1)',
    borderStyle: 'dashed',
  },
  addConnectionText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConnectionManagementScreen;