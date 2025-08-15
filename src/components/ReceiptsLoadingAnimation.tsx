import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

export const ReceiptsLoadingAnimation: React.FC = () => {
  const { theme } = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Pulse animation for the main icon
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    // Rotation animation for the receipt cards
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    // Fade animation for the floating receipts
    const fadeAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.8,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    pulseAnimation.start();
    rotateAnimation.start();
    fadeAnimation.start();

    return () => {
      pulseAnimation.stop();
      rotateAnimation.stop();
      fadeAnimation.stop();
    };
  }, [pulseAnim, rotateAnim, fadeAnim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Floating receipt cards in background */}
      <Animated.View 
        style={[
          styles.floatingReceipt, 
          styles.receipt1,
          { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
            opacity: fadeAnim,
            transform: [{ rotate: rotateInterpolate }]
          }
        ]}
      >
        <View style={[styles.receiptLine, { backgroundColor: theme.text.tertiary }]} />
        <View style={[styles.receiptLine, styles.shortLine, { backgroundColor: theme.text.tertiary }]} />
        <View style={[styles.receiptLine, styles.mediumLine, { backgroundColor: theme.text.tertiary }]} />
      </Animated.View>

      <Animated.View 
        style={[
          styles.floatingReceipt, 
          styles.receipt2,
          { 
            backgroundColor: theme.gold.background,
            borderColor: theme.gold.primary + '40',
            opacity: fadeAnim,
            transform: [{ rotate: rotateInterpolate }, { rotateY: '180deg' }]
          }
        ]}
      >
        <View style={[styles.receiptLine, { backgroundColor: theme.gold.primary + '60' }]} />
        <View style={[styles.receiptLine, styles.shortLine, { backgroundColor: theme.gold.primary + '60' }]} />
        <View style={[styles.receiptLine, styles.mediumLine, { backgroundColor: theme.gold.primary + '60' }]} />
      </Animated.View>

      <Animated.View 
        style={[
          styles.floatingReceipt, 
          styles.receipt3,
          { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary,
            opacity: fadeAnim,
            transform: [{ rotate: rotateInterpolate }, { rotateX: '180deg' }]
          }
        ]}
      >
        <View style={[styles.receiptLine, { backgroundColor: theme.text.tertiary }]} />
        <View style={[styles.receiptLine, styles.shortLine, { backgroundColor: theme.text.tertiary }]} />
        <View style={[styles.receiptLine, styles.mediumLine, { backgroundColor: theme.text.tertiary }]} />
      </Animated.View>

      {/* Main loading content */}
      <View style={styles.centerContent}>
        <Animated.View 
          style={[
            styles.iconContainer,
            { 
              backgroundColor: theme.gold.background,
              borderColor: theme.gold.primary,
              transform: [{ scale: pulseAnim }]
            }
          ]}
        >
          <Ionicons 
            name="receipt-outline" 
            size={48} 
            color={theme.gold.primary} 
          />
        </Animated.View>

        <Text style={[styles.loadingTitle, { color: theme.text.primary }]}>
          Loading Receipts
        </Text>
        
        <Text style={[styles.loadingSubtitle, { color: theme.text.secondary }]}>
          Gathering your financial records...
        </Text>

        {/* Loading dots */}
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((index) => (
            <LoadingDot 
              key={index} 
              delay={index * 200} 
              color={theme.gold.primary}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

const LoadingDot: React.FC<{ delay: number; color: string }> = ({ delay, color }) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.5,
          duration: 400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [scaleAnim, delay]);

  return (
    <Animated.View 
      style={[
        styles.dot, 
        { 
          backgroundColor: color,
          transform: [{ scale: scaleAnim }]
        }
      ]} 
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  floatingReceipt: {
    position: 'absolute',
    width: 60,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    justifyContent: 'space-around',
  },
  receipt1: {
    top: '15%',
    left: '10%',
  },
  receipt2: {
    top: '25%',
    right: '15%',
  },
  receipt3: {
    bottom: '20%',
    left: '20%',
  },
  receiptLine: {
    height: 2,
    borderRadius: 1,
  },
  shortLine: {
    width: '60%',
  },
  mediumLine: {
    width: '80%',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
