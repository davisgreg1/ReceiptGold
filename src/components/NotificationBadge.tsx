import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface NotificationBadgeProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
  color?: string;
  textColor?: string;
  style?: any;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  count,
  size = 'medium',
  color,
  textColor,
  style,
}) => {
  const { theme } = useTheme();

  if (count <= 0) {
    return null;
  }

  const badgeColor = color || theme.status.error;
  const badgeTextColor = textColor || theme.text.inverse;

  const sizeStyles = {
    small: {
      width: 16,
      height: 16,
      borderRadius: 8,
      fontSize: 10,
    },
    medium: {
      width: 20,
      height: 20,
      borderRadius: 10,
      fontSize: 12,
    },
    large: {
      width: 24,
      height: 24,
      borderRadius: 12,
      fontSize: 14,
    },
  };

  const currentSize = sizeStyles[size];

  const styles = StyleSheet.create({
    badge: {
      backgroundColor: badgeColor,
      minWidth: currentSize.width,
      height: currentSize.height,
      borderRadius: currentSize.borderRadius,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: count > 9 ? 4 : 0,
    },
    text: {
      color: badgeTextColor,
      fontSize: currentSize.fontSize,
      fontWeight: 'bold',
      textAlign: 'center',
    },
  });

  const displayCount = count > 99 ? '99+' : count.toString();

  return (
    <View style={[styles.badge, style]}>
      <Text style={styles.text}>{displayCount}</Text>
    </View>
  );
};

export default NotificationBadge;
