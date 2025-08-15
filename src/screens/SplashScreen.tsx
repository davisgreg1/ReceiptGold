import React, { useEffect } from "react";
import { StyleSheet, Animated, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Circle, Rect, Text, Polygon } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { BrandText, BodyText } from '../components/Typography';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

interface SplashScreenProps {
  onFinish: () => void;
}

export const AppSplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    const prepare = async () => {
      try {
        // Simulate loading time and any async operations
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Start animations
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 50,
            friction: 8,
            useNativeDriver: true,
          }),
        ]).start();

        // Wait for animation to complete then finish
        setTimeout(() => {
          onFinish();
        }, 1500);
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  const ReceiptGoldLogo = () => (
    <Svg width="200" height="200" viewBox="0 0 200 200">
      {/* Circular background */}
      <Circle
        cx="100"
        cy="100"
        r="90"
        fill={theme.background.primary}
        stroke={theme.gold.primary}
        strokeWidth="4"
      />

      {/* Inner gold circle for depth */}
      <Circle
        cx="100"
        cy="100"
        r="75"
        fill="none"
        stroke={theme.gold.rich}
        strokeWidth="1"
        opacity="0.3"
      />

      {/* Receipt icon base */}
      <Rect
        x="65"
        y="45"
        width="70"
        height="90"
        rx="8"
        ry="8"
        fill={theme.text.inverse}
        stroke={theme.gold.primary}
        strokeWidth="2"
      />

      {/* Receipt text lines */}
      <Rect
        x="75"
        y="65"
        width="50"
        height="3"
        rx="1.5"
        fill={theme.background.primary}
      />
      <Rect
        x="75"
        y="75"
        width="40"
        height="3"
        rx="1.5"
        fill={theme.background.primary}
      />
      <Rect
        x="75"
        y="85"
        width="45"
        height="3"
        rx="1.5"
        fill={theme.background.primary}
      />
      <Rect
        x="75"
        y="95"
        width="35"
        height="3"
        rx="1.5"
        fill={theme.background.primary}
      />

      {/* Total line (emphasized) */}
      <Rect
        x="75"
        y="110"
        width="50"
        height="4"
        rx="2"
        fill={theme.gold.rich}
      />

      {/* Gold coin accent */}
      <Circle
        cx="120"
        cy="70"
        r="8"
        fill={theme.gold.primary}
        stroke={theme.gold.rich}
        strokeWidth="1"
      />
      <Text
        x="120"
        y="75"
        textAnchor="middle"
        fontFamily="serif"
        fontSize="10"
        fontWeight="bold"
        fill={theme.text.inverse}
      >
        $
      </Text>

      {/* Geometric gold accents for symmetry */}
      <Polygon points="100,25 105,35 95,35" fill={theme.gold.primary} />
      <Polygon points="100,175 105,165 95,165" fill={theme.gold.primary} />
      <Polygon points="25,100 35,95 35,105" fill={theme.gold.primary} />
      <Polygon points="175,100 165,95 165,105" fill={theme.gold.primary} />

      {/* Inner geometric pattern */}
      <Circle cx="85" cy="85" r="2" fill={theme.gold.primary} opacity="0.6" />
      <Circle cx="115" cy="85" r="2" fill={theme.gold.primary} opacity="0.6" />
      <Circle cx="85" cy="115" r="2" fill={theme.gold.primary} opacity="0.6" />
      <Circle cx="115" cy="115" r="2" fill={theme.gold.primary} opacity="0.6" />
    </Svg>
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ReceiptGoldLogo />
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <BrandText 
          color="gold"
          style={{
            fontSize: 36,
            letterSpacing: 1,
          }}
        >
          ReceiptGold
        </BrandText>
      </Animated.View>

      <Animated.View style={{ opacity: fadeAnim }}>
        <BodyText
          size="large"
          color="secondary"
          style={{
            fontWeight: '300',
            letterSpacing: 0.5,
            marginTop: 8,
          }}
        >
          Premium Receipt Management
        </BodyText>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 30,
  },
  appName: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 16,
    fontWeight: "300",
    letterSpacing: 0.5,
  },
});
