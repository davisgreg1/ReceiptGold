import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  shimmerSpeed?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  shimmerSpeed = 1500,
}) => {
  const { theme } = useTheme();
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: shimmerSpeed,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: shimmerSpeed,
          useNativeDriver: false,
        }),
      ])
    );

    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerValue, shimmerSpeed]);

  const backgroundColor = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.background.tertiary, theme.background.secondary],
  });

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

// Preset skeleton components for common use cases
export const SkeletonText: React.FC<{ 
  lines?: number; 
  lineHeight?: number; 
  style?: ViewStyle;
}> = ({ 
  lines = 1, 
  lineHeight = 16, 
  style 
}) => (
  <View style={style}>
    {Array.from({ length: lines }).map((_, index) => (
      <Skeleton
        key={index}
        height={lineHeight}
        width={index === lines - 1 ? '80%' : '100%'} // Last line slightly shorter
        style={{ marginBottom: index < lines - 1 ? 8 : 0 }}
      />
    ))}
  </View>
);

export const SkeletonCard: React.FC<{
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => {
  const { theme } = useTheme();
  
  return (
    <View
      style={[
        {
          backgroundColor: theme.background.secondary,
          borderRadius: 20,
          padding: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};