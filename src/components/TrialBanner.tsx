import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTeam } from '../context/TeamContext';

const { width } = Dimensions.get('window');

export const TrialBanner: React.FC = () => {
  const { theme } = useTheme();
  const { subscription } = useSubscription();
  const { isTeamMember } = useTeam();
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const insets = useSafeAreaInsets();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show banner if not on trial, if dismissed, or if user is a team member
  if (!subscription.trial.isActive || isDismissed || isTeamMember) {
    return null;
  }

  const handleUpgradePress = () => {
    // Navigate to the Home tab first, then to Subscription screen
    // This works from any tab/stack
    try {
      navigation.navigate('HomeTab', {
        screen: 'Subscription'
      });
    } catch (error) {
      console.warn('Failed to navigate to Subscription screen:', error);
      // Fallback: just try direct navigation
      try {
        navigation.navigate('Subscription');
      } catch (fallbackError) {
        console.error('Both navigation attempts failed:', fallbackError);
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  const getDaysText = () => {
    const days = subscription.trial.daysRemaining;
    if (days === 0) {
      return 'Trial expires today!';
    } else if (days === 1) {
      return '1 day left';
    } else {
      return `${days} days left`;
    }
  };

  const getColors = () => {
    const days = subscription.trial.daysRemaining;
    if (days <= 1) {
      return {
        background: 'linear-gradient(135deg, #FF6B6B 0%, #FF5252 100%)',
        backgroundColor: '#FF5252',
        textColor: '#FFFFFF',
        buttonBg: 'rgba(255, 255, 255, 0.25)',
        buttonBorder: 'rgba(255, 255, 255, 0.4)',
      };
    } else if (days <= 2) {
      return {
        background: 'linear-gradient(135deg, #FFB74D 0%, #FF9800 100%)',
        backgroundColor: '#FF9800',
        textColor: '#FFFFFF',
        buttonBg: 'rgba(255, 255, 255, 0.25)',
        buttonBorder: 'rgba(255, 255, 255, 0.4)',
      };
    } else {
      return {
        background: `linear-gradient(135deg, ${theme.gold.primary} 0%, ${theme.gold.rich || '#B8860B'} 100%)`,
        backgroundColor: theme.gold.primary,
        textColor: '#FFFFFF',
        buttonBg: 'rgba(255, 255, 255, 0.25)',
        buttonBorder: 'rgba(255, 255, 255, 0.4)',
      };
    }
  };

  const colors = getColors();

  return (
    <View style={[
      styles.bannerContainer, 
      { 
        top: insets.top + 10,
      }
    ]}>
      {/* Main banner */}
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: colors.backgroundColor }]}
        onPress={handleUpgradePress}
        activeOpacity={0.9}
      >
        <View style={styles.content}>
          <View style={styles.leftSection}>
            <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <Ionicons name="diamond-outline" size={16} color={colors.textColor} />
            </View>
            <View style={styles.textContainer}>
              <View style={styles.mainTextRow}>
                <Text style={[styles.trialText, { color: colors.textColor }]}>
                  Trial: {getDaysText()}
                </Text>
                <View style={[styles.badge, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
                  <Text style={[styles.badgeText, { color: colors.textColor }]}>PRO</Text>
                </View>
              </View>
              <Text style={[styles.subtitle, { color: colors.textColor, opacity: 0.9 }]}>
                Full access to all features
              </Text>
            </View>
          </View>
          
          <TouchableOpacity
            style={[
              styles.upgradeButton,
              { 
                backgroundColor: colors.buttonBg,
                borderColor: colors.buttonBorder,
              }
            ]}
            onPress={handleUpgradePress}
            activeOpacity={0.8}
          >
            <Text style={[styles.upgradeButtonText, { color: colors.textColor }]}>
              Upgrade
            </Text>
            <Ionicons name="arrow-forward" size={12} color={colors.textColor} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Close button - positioned half in, half out */}
      <TouchableOpacity
        style={[styles.closeButton, { backgroundColor: colors.backgroundColor }]}
        onPress={handleDismiss}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={14} color={colors.textColor} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  banner: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  mainTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  trialText: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 80,
    justifyContent: 'center',
  },
  upgradeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 4,
  },
  closeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
});