import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import PlaidConnectionService, { ConnectionNotification } from '../services/PlaidConnectionService';
import { BodyText, ButtonText } from './Typography';

interface ConnectionStatusBannerProps {
  onPress?: (notification: ConnectionNotification) => void;
  style?: any;
}

const ConnectionStatusBanner: React.FC<ConnectionStatusBannerProps> = ({ 
  onPress, 
  style 
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const [currentNotification, setCurrentNotification] = useState<ConnectionNotification | null>(null);
  const [slideAnim] = useState(new Animated.Value(-100));
  const [isVisible, setIsVisible] = useState(false);

  const connectionService = PlaidConnectionService;

  useEffect(() => {
    if (!user) return;

    const unsubscribe = connectionService.subscribeToNotifications(
      user.uid,
      (notifications) => {
        // Show the highest priority notification that requires action
        const actionRequired = notifications
          .filter(n => n.actionRequired)
          .sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
          });

        if (actionRequired.length > 0) {
          setCurrentNotification(actionRequired[0]);
          showBanner();
        } else {
          hideBanner();
        }
      }
    );

    return unsubscribe;
  }, [user]);

  const showBanner = () => {
    if (isVisible) return;
    
    setIsVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      setCurrentNotification(null);
    });
  };

  const handlePress = () => {
    if (currentNotification && onPress) {
      onPress(currentNotification);
    }
  };

  const handleDismiss = async () => {
    if (currentNotification) {
      try {
        await connectionService.dismissNotification(currentNotification.id);
        hideBanner();
      } catch (error) {
        console.error('Error dismissing notification:', error);
      }
    }
  };

  if (!currentNotification || !isVisible) {
    return null;
  }

  const getBannerColor = () => {
    switch (currentNotification.priority) {
      case 'high':
        return theme.status.error;
      case 'medium':
        return theme.status.warning;
      default:
        return theme.status.info;
    }
  };

  const getIconName = () => {
    switch (currentNotification.type) {
      case 'reauth_required':
        return 'alert-circle';
      case 'pending_expiration':
        return 'time';
      case 'permission_revoked':
        return 'lock-closed';
      case 'new_accounts_available':
        return 'add-circle';
      default:
        return 'information-circle';
    }
  };

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: getBannerColor(),
          transform: [{ translateY: slideAnim }],
        },
        style,
      ]}
    >
      <TouchableOpacity
        style={styles.bannerContent}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <View style={styles.iconContainer}>
          <Ionicons name={getIconName()} size={20} color="white" />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.title}>
            {currentNotification.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {currentNotification.message}
          </Text>
          <Text style={styles.bankName}>
            {currentNotification.institutionName}
          </Text>
        </View>

        <View style={styles.actions}>
          {currentNotification.actionRequired && (
            <View style={styles.actionButton}>
              <ButtonText style={styles.actionButtonText}>
                Fix
              </ButtonText>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  message: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 2,
  },
  bankName: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 8,
    marginLeft: 4,
  },
});

export default ConnectionStatusBanner;