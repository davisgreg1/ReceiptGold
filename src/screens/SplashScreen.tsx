import React, { useEffect, useRef } from "react";
import { StyleSheet, Animated, Dimensions, Easing, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
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

    const AnimatedImage = Animated.createAnimatedComponent(Image);

    return (
      <Animated.View
        style={{
          transform: [
            { scale: pulseAnim },
            { rotateY: rotation },
          ],
        }}
      >
        <AnimatedImage
          source={require("../../assets/splash.png")}
          style={{
            width: 220,
            height: 220,
            backgroundColor: 'transparent',
          }}
          resizeMode="contain"
        />
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
