import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated, Dimensions, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import Svg, { Circle, Rect, Text, Polygon, Defs, LinearGradient, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";
import { BrandText, BodyText } from '../components/Typography';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

interface SplashScreenProps {
  onFinish: () => void;
}

export const AppSplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const { theme } = useTheme();
  
  // Enhanced animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const prepare = async () => {
      try {

        // Continuous pulse animation
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.15,
              duration: 1800,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1800,
              easing: Easing.bezier(0.4, 0.0, 0.2, 1),
              useNativeDriver: true,
            }),
          ])
        ).start();

        // Simulate loading time
        await new Promise((resolve) => setTimeout(resolve, 800));

        // Logo entrance with rotation and scale
        Animated.parallel([
          Animated.timing(logoOpacity, {
            toValue: 1,
            duration: 1000,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            tension: 40,
            friction: 8,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }),
        ]).start();

        // App name entrance (staggered)
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 1,
              duration: 800,
              easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
              useNativeDriver: true,
            }),
            Animated.spring(slideUpAnim, {
              toValue: 0,
              tension: 35,
              friction: 8,
              useNativeDriver: true,
            }),
          ]).start();
        }, 700);

        // Tagline entrance
        setTimeout(() => {
          Animated.timing(taglineOpacity, {
            toValue: 1,
            duration: 600,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }).start();
        }, 1200);

        // Final fade and transition
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 400,
            easing: Easing.bezier(0.25, 0.46, 0.45, 0.94),
            useNativeDriver: true,
          }).start(() => {
            setTimeout(onFinish, 300);
          });
        }, 3000);
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  const ReceiptGoldLogo = () => {
    // Animation interpolations
    const rotation = rotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });


    const AnimatedSvg = Animated.createAnimatedComponent(Svg);

    return (
      <Animated.View
        style={{
          transform: [
            { scale: pulseAnim },
            { rotateY: rotation },
          ],
        }}
      >
        <AnimatedSvg width="220" height="220" viewBox="0 0 220 220">
          <Defs>
            {/* Premium gold gradient */}
            <LinearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="1" />
              <Stop offset="30%" stopColor="#FFA500" stopOpacity="1" />
              <Stop offset="70%" stopColor="#FF8C00" stopOpacity="1" />
              <Stop offset="100%" stopColor="#DAA520" stopOpacity="1" />
            </LinearGradient>
            

            {/* Radial glow */}
            <LinearGradient id="glowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFD700" stopOpacity="0.8" />
              <Stop offset="50%" stopColor="#FFA500" stopOpacity="0.4" />
              <Stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Outer glow rings */}
          <Circle
            cx="110"
            cy="110"
            r="105"
            fill="none"
            stroke="url(#goldGradient)"
            strokeWidth="2"
            opacity="0.3"
          />
          <Circle
            cx="110"
            cy="110"
            r="100"
            fill="none"
            stroke="url(#goldGradient)"
            strokeWidth="3"
            opacity="0.5"
          />

          {/* Main circular background */}
          <Circle
            cx="110"
            cy="110"
            r="90"
            fill={theme.background.primary}
            stroke="url(#goldGradient)"
            strokeWidth="4"
          />

          {/* Inner depth circles */}
          <Circle
            cx="110"
            cy="110"
            r="75"
            fill="none"
            stroke={theme.gold.primary}
            strokeWidth="1"
            opacity="0.6"
          />
          <Circle
            cx="110"
            cy="110"
            r="60"
            fill="none"
            stroke={theme.gold.rich}
            strokeWidth="1"
            opacity="0.4"
          />

          {/* Enhanced receipt icon */}
          <Rect
            x="75"
            y="50"
            width="70"
            height="95"
            rx="10"
            ry="10"
            fill={theme.text.inverse}
            stroke="url(#goldGradient)"
            strokeWidth="3"
          />

          {/* Receipt header with gradient */}
          <Rect
            x="75"
            y="50"
            width="70"
            height="18"
            rx="10"
            ry="10"
            fill="url(#goldGradient)"
          />

          {/* Receipt text lines */}
          <Rect x="85" y="75" width="50" height="3" rx="1.5" fill={theme.background.primary} />
          <Rect x="85" y="83" width="40" height="3" rx="1.5" fill={theme.background.primary} />
          <Rect x="85" y="91" width="45" height="3" rx="1.5" fill={theme.background.primary} />
          <Rect x="85" y="99" width="35" height="3" rx="1.5" fill={theme.background.primary} />
          <Rect x="85" y="107" width="42" height="3" rx="1.5" fill={theme.background.primary} />

          {/* Total line (emphasized with gold) */}
          <Rect
            x="85"
            y="120"
            width="50"
            height="5"
            rx="2.5"
            fill="url(#goldGradient)"
          />

          {/* Enhanced gold coin */}
          <Circle
            cx="125"
            cy="75"
            r="10"
            fill="url(#goldGradient)"
            stroke={theme.gold.rich}
            strokeWidth="2"
          />
          <Circle
            cx="125"
            cy="75"
            r="7"
            fill="none"
            stroke="#ffffff"
            strokeWidth="1"
            opacity="0.6"
          />
          <Text
            x="125"
            y="80"
            textAnchor="middle"
            fontFamily="serif"
            fontSize="11"
            fontWeight="bold"
            fill={theme.text.inverse}
          >
            $
          </Text>

          {/* Geometric accents */}
          <Polygon points="110,20 118,35 102,35" fill="url(#goldGradient)" />
          <Polygon points="110,200 118,185 102,185" fill="url(#goldGradient)" />
          <Polygon points="20,110 35,102 35,118" fill="url(#goldGradient)" />
          <Polygon points="200,110 185,102 185,118" fill="url(#goldGradient)" />

          {/* Decorative corner elements */}
          <Circle cx="85" cy="85" r="2.5" fill="url(#goldGradient)" opacity="0.8" />
          <Circle cx="135" cy="85" r="2.5" fill="url(#goldGradient)" opacity="0.8" />
          <Circle cx="85" cy="135" r="2.5" fill="url(#goldGradient)" opacity="0.8" />
          <Circle cx="135" cy="135" r="2.5" fill="url(#goldGradient)" opacity="0.8" />
        </AnimatedSvg>

      </Animated.View>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      {/* Subtle background gradient overlay */}
      <Animated.View style={[styles.backgroundOverlay, { opacity: fadeAnim }]} />
      
      {/* Logo with complex animations */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <ReceiptGoldLogo />
      </Animated.View>

      {/* App name with slide up animation */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: slideUpAnim }],
          },
        ]}
      >
        <BrandText 
          color="gold"
          style={styles.appName}
        >
          ReceiptGold
        </BrandText>
      </Animated.View>

      {/* Tagline with elegant fade in */}
      <Animated.View 
        style={[
          styles.taglineContainer,
          { opacity: taglineOpacity }
        ]}
      >
        <BodyText
          size="large"
          color="secondary"
          style={styles.tagline}
        >
          Premium Receipt Management
        </BodyText>
      </Animated.View>

      {/* Elegant loading dots */}
      <Animated.View 
        style={[
          styles.loadingContainer,
          { opacity: textOpacity }
        ]}
      >
        <Animated.View
          style={[
            styles.loadingDot,
            { backgroundColor: theme.gold.primary },
            { transform: [{ scale: pulseAnim }] }
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDot,
            { backgroundColor: theme.gold.primary },
            { transform: [{ scale: pulseAnim }] }
          ]}
        />
        <Animated.View
          style={[
            styles.loadingDot,
            { backgroundColor: theme.gold.primary },
            { transform: [{ scale: pulseAnim }] }
          ]}
        />
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'transparent',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 215, 0, 0.03)',
    zIndex: -1,
  },
  logoContainer: {
    marginBottom: 35,
    shadowColor: "#FFD700",
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  textContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  appName: {
    fontSize: 38,
    fontWeight: "bold",
    letterSpacing: 2.5,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    lineHeight: 46,
  },
  taglineContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 32,
  },
  tagline: {
    fontSize: 17,
    fontWeight: '300',
    letterSpacing: 1.2,
    textAlign: 'center',
    opacity: 0.9,
    lineHeight: 24,
  },
  loadingContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginHorizontal: 6,
    shadowColor: "#FFD700",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
