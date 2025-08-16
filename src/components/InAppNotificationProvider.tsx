import React, { createContext, useContext, useState, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface InAppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface InAppNotificationContextType {
  showNotification: (notification: Omit<InAppNotification, 'id'>) => void;
  hideNotification: (id: string) => void;
  hideAllNotifications: () => void;
}

const InAppNotificationContext = createContext<InAppNotificationContextType | undefined>(undefined);

export const useInAppNotifications = () => {
  const context = useContext(InAppNotificationContext);
  if (!context) {
    throw new Error('useInAppNotifications must be used within InAppNotificationProvider');
  }
  return context;
};

interface NotificationItemProps {
  notification: InAppNotification;
  onHide: (id: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification, onHide }) => {
  const { theme } = useTheme();
  const [slideAnim] = useState(new Animated.Value(-300));
  const [opacityAnim] = useState(new Animated.Value(0));

  React.useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-hide after duration
    const duration = notification.duration || 5000;
    const timer = setTimeout(() => {
      hideNotification();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const hideNotification = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -300,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(notification.id);
    });
  };

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'information-circle';
    }
  };

  const getColor = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return theme.status.success;
      case 'error':
        return theme.status.error;
      case 'warning':
        return theme.status.warning;
      case 'info':
        return theme.status.info;
      default:
        return theme.status.info;
    }
  };

  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.background.elevated,
      marginHorizontal: 16,
      marginVertical: 4,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      borderLeftWidth: 4,
      borderLeftColor: getColor(notification.type),
      shadowColor: theme.text.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    iconContainer: {
      marginRight: 12,
      marginTop: 2,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text.primary,
      marginBottom: 4,
    },
    message: {
      fontSize: 14,
      color: theme.text.secondary,
      lineHeight: 20,
    },
    actionButton: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: getColor(notification.type),
      borderRadius: 6,
      alignSelf: 'flex-start',
    },
    actionText: {
      color: theme.text.inverse,
      fontSize: 14,
      fontWeight: '600',
    },
    closeButton: {
      marginLeft: 8,
      padding: 4,
    },
  });

  return (
    <Animated.View
      style={{
        transform: [{ translateX: slideAnim }],
        opacity: opacityAnim,
      }}
    >
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={getIcon(notification.type)}
            size={24}
            color={getColor(notification.type)}
          />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.title}>{notification.title}</Text>
          {notification.message && (
            <Text style={styles.message}>{notification.message}</Text>
          )}
          
          {notification.action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                notification.action!.onPress();
                hideNotification();
              }}
            >
              <Text style={styles.actionText}>{notification.action.label}</Text>
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity style={styles.closeButton} onPress={hideNotification}>
          <Ionicons name="close" size={20} color={theme.text.secondary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

interface InAppNotificationProviderProps {
  children: React.ReactNode;
}

export const InAppNotificationProvider: React.FC<InAppNotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);

  const showNotification = useCallback((notificationData: Omit<InAppNotification, 'id'>) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification: InAppNotification = {
      ...notificationData,
      id,
    };
    
    setNotifications(prev => [...prev, newNotification]);
  }, []);

  const hideNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);

  const hideAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const styles = StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      pointerEvents: 'box-none',
    },
    container: {
      flex: 1,
      justifyContent: 'flex-start',
      paddingTop: 60, // Account for status bar and safe area
    },
  });

  return (
    <InAppNotificationContext.Provider
      value={{
        showNotification,
        hideNotification,
        hideAllNotifications,
      }}
    >
      {children}
      
      {notifications.length > 0 && (
        <View style={styles.overlay}>
          <SafeAreaView style={styles.container} pointerEvents="box-none">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onHide={hideNotification}
              />
            ))}
          </SafeAreaView>
        </View>
      )}
    </InAppNotificationContext.Provider>
  );
};

export default InAppNotificationProvider;
