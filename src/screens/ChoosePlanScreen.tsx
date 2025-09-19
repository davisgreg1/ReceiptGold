import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  Animated,
  Linking,
} from "react-native";
import { PanGestureHandler, State, Directions } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { HeadingText, BodyText, ButtonText } from "../components/Typography";
import { useRevenueCatPayments } from "../hooks/useRevenueCatPayments";
import { useInAppNotifications } from "../components/InAppNotificationProvider";
import { SUBSCRIPTION_TIERS, revenueCatService } from "../services/revenuecatService";
import { useConfettiContext } from "../context/ConfettiContext";

const { width } = Dimensions.get("window");

type BillingPeriod = 'monthly' | 'annual';

interface PlanCardProps {
  tier: keyof typeof SUBSCRIPTION_TIERS;
  billingPeriod: BillingPeriod;
  isCurrentPlan: boolean;
  isPopular?: boolean;
  onSelect: () => void;
  loading: boolean;
}

const BillingToggle: React.FC<{
  billingPeriod: BillingPeriod;
  onToggle: (period: BillingPeriod) => void;
}> = ({ billingPeriod, onToggle }) => {
  const { theme } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(billingPeriod === 'monthly' ? 0 : 1)).current;

  React.useEffect(() => {
    Animated.spring(animatedValue, {
      toValue: billingPeriod === 'monthly' ? 0 : 1,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  }, [billingPeriod]);

  const handlePress = (period: BillingPeriod) => {
    if (period !== billingPeriod) {
      onToggle(period);
    }
  };

  return (
    <View style={[styles.toggleContainer, { backgroundColor: theme.background.secondary }]}>
      <Animated.View
        style={[
          styles.toggleSlider,
          {
            backgroundColor: theme.gold.primary,
            transform: [
              {
                translateX: animatedValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [2, width * 0.45 - 2],
                }),
              },
            ],
          },
        ]}
      />
      
      <Pressable
        style={styles.toggleOption}
        onPress={() => handlePress('monthly')}
      >
        <Text
          style={[
            styles.toggleText,
            {
              color: billingPeriod === 'monthly' ? theme.background.primary : theme.text.secondary,
              fontWeight: billingPeriod === 'monthly' ? '700' : '500',
            },
          ]}
        >
          Monthly
        </Text>
      </Pressable>

      <Pressable
        style={styles.toggleOption}
        onPress={() => handlePress('annual')}
      >
        <View style={styles.toggleOptionContent}>
          <Text
            style={[
              styles.toggleText,
              {
                color: billingPeriod === 'annual' ? theme.background.primary : theme.text.secondary,
                fontWeight: billingPeriod === 'annual' ? '700' : '500',
              },
            ]}
          >
            Annual
          </Text>
        </View>
      </Pressable>
    </View>
  );
};

const PlanCard: React.FC<PlanCardProps> = ({
  tier,
  billingPeriod,
  isCurrentPlan,
  isPopular,
  onSelect,
  loading,
}) => {
  const { theme } = useTheme();
  const tierData = SUBSCRIPTION_TIERS[tier];
  const [pricing, setPricing] = React.useState<{
    monthly?: { price: string; amount: number; };
    annual?: { price: string; amount: number; };
  }>({});
  const [loadingPricing, setLoadingPricing] = React.useState(true);
  
  // Check if this tier supports the current billing period
  const monthlyProductId = tierData.productIds.monthly;
  const annualProductId = tierData.productIds.annual;
  
  // Fetch pricing from RevenueCat - MUST be called before any early returns
  React.useEffect(() => {
    const fetchPricing = async () => {
      setLoadingPricing(true);
      const newPricing: { monthly?: { price: string; amount: number; }; annual?: { price: string; amount: number; }; } = {};
      
      // Fetch monthly pricing
      if (monthlyProductId) {
        const monthlyPricing = await revenueCatService.getProductPricing(monthlyProductId);
        if (monthlyPricing) {
          newPricing.monthly = {
            price: monthlyPricing.price,
            amount: monthlyPricing.priceAmountMicros
          };
        }
      }
      
      // Fetch annual pricing
      if (annualProductId) {
        const annualPricing = await revenueCatService.getProductPricing(annualProductId);
        if (annualPricing) {
          newPricing.annual = {
            price: annualPricing.price,
            amount: annualPricing.priceAmountMicros
          };
        }
      }
      
      setPricing(newPricing);
      setLoadingPricing(false);
    };
    
    fetchPricing();
  }, [monthlyProductId, annualProductId]);

  // Early returns after all hooks are called
  if (tier === 'trial' || tier === 'teammate') {
    return null; // Don't show these tiers in the plan selection
  }
  
  if (billingPeriod === 'annual' && !annualProductId) {
    return null; // Don't show tier if annual billing is selected but tier doesn't support annual
  }
  
  if (billingPeriod === 'monthly' && !monthlyProductId) {
    return null; // Don't show tier if monthly billing is selected but tier doesn't support monthly
  }

  // Use RevenueCat pricing if available, fallback to hardcoded
  const currentPricing = billingPeriod === 'monthly' ? pricing.monthly : pricing.annual;
  const displayPrice = currentPricing ? currentPricing.price : 
    (billingPeriod === 'monthly' ? `$${tierData.monthlyPrice.toFixed(2)}` : 
     ('annualPrice' in tierData && tierData.annualPrice ? `$${tierData.annualPrice.toFixed(2)}` : `$${tierData.monthlyPrice.toFixed(2)}`));
  
  // Calculate savings for annual plans
  const annualSavings = (billingPeriod === 'annual' && pricing.monthly && pricing.annual) ? 
    Math.round((1 - (pricing.annual.amount / 12) / pricing.monthly.amount) * 100) : 
    (billingPeriod === 'annual' && 'annualPrice' in tierData && tierData.annualPrice ? 
     Math.round((1 - (tierData.annualPrice / 12) / tierData.monthlyPrice) * 100) : 0);

  return (
    <View style={styles.cardWrapper}>
      {isPopular && (
        <View style={styles.popularBadge}>
          <LinearGradient
            colors={[theme.gold.primary, theme.gold.rich]}
            style={styles.popularBadgeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.popularText}>MOST POPULAR</Text>
          </LinearGradient>
        </View>
      )}
      
      <LinearGradient
        colors={
          isCurrentPlan
            ? [theme.status.success + "15", theme.status.success + "05"]
            : isPopular
            ? [theme.gold.background, theme.background.secondary]
            : [theme.background.secondary, theme.background.tertiary]
        }
        style={[
          styles.card,
          {
            borderColor: isCurrentPlan
              ? theme.status.success
              : isPopular
              ? theme.gold.primary
              : theme.border.primary,
          },
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >

        <View style={styles.cardHeader}>
          <HeadingText size="large" color="primary" style={styles.planName}>
            {tierData.name}
          </HeadingText>
          
          <View style={styles.priceContainer}>
            <HeadingText size="large" color="gold" style={styles.price}>
              {loadingPricing ? '...' : displayPrice}
            </HeadingText>
            <BodyText size="small" color="tertiary" style={styles.pricePeriod}>
              /{billingPeriod === 'monthly' ? 'month' : 'year'}
            </BodyText>
          </View>

          {billingPeriod === 'annual' && annualSavings > 0 && !loadingPricing && (
            <View style={[styles.savingsContainer, { backgroundColor: theme.status.success }]}>
              <Text style={styles.savingsMainText}>
                Save {annualSavings}% • Billed {currentPricing?.price || displayPrice} annually
              </Text>
            </View>
          )}
        </View>

        <View style={styles.featuresContainer}>
          {tierData.features.slice(0, 4).map((feature, idx) => (
            <View key={idx} style={styles.featureRow}>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={theme.status.success}
                style={styles.featureIcon}
              />
              <BodyText size="small" color="secondary" style={styles.featureText}>
                {feature}
              </BodyText>
            </View>
          ))}
          
          {tierData.features.length > 4 && (
            <BodyText size="small" color="tertiary" style={styles.moreFeatures}>
              +{tierData.features.length - 4} more features
            </BodyText>
          )}
        </View>

        <Pressable
          style={styles.buttonWrapper}
          disabled={isCurrentPlan || loading}
          onPress={onSelect}
        >
          {({ pressed }) => (
            <LinearGradient
              colors={
                isCurrentPlan
                  ? [theme.status.success, theme.status.success]
                  : isPopular
                  ? [theme.gold.primary, theme.gold.rich]
                  : [theme.gold.muted, theme.gold.rich]
              }
              style={[
                styles.button,
                {
                  opacity: isCurrentPlan || loading ? 0.7 : pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <ButtonText size="medium" color="inverse" style={styles.buttonText}>
                {isCurrentPlan
                  ? "Current Plan"
                  : loading
                  ? "Processing..."
                  : `Choose ${tierData.name}`}
              </ButtonText>
            </LinearGradient>
          )}
        </Pressable>
      </LinearGradient>
    </View>
  );
};

const ChoosePlanScreen: React.FC = () => {
  const { showNotification } = useInAppNotifications();
  const { theme } = useTheme();
  const { subscription } = useSubscription();
  const { user } = require("../context/AuthContext").useAuth();
  const { handleSubscriptionWithRevenueCat, restorePurchases, getCurrentBillingPeriod } = useRevenueCatPayments();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [currentBillingPeriod, setCurrentBillingPeriod] = useState<BillingPeriod | null>(null);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const rotationValue = React.useRef(new Animated.Value(0)).current;
  const { triggerConfetti } = useConfettiContext();

  // Load current billing period on mount and when tier changes
  React.useEffect(() => {
    const loadCurrentBillingPeriod = async () => {
      try {
        // Only check RevenueCat billing period if user has an active paid subscription
        if (subscription.isActive && subscription.currentTier !== 'trial') {
          const currentPeriod = await getCurrentBillingPeriod();
          setCurrentBillingPeriod(currentPeriod);
        } else {
          // No active subscription - clear billing period
          setCurrentBillingPeriod(null);
        }
      } catch (error) {
        console.error('Failed to load current billing period:', error);
        setCurrentBillingPeriod(null);
      }
    };

    loadCurrentBillingPeriod();
  }, [getCurrentBillingPeriod, subscription.currentTier, subscription.isActive]);

  // Handle swipe gestures for billing toggle area
  const onBillingToggleSwipe = (event: any) => {
    const { translationX, translationY, state } = event.nativeEvent;
    
    if (state === State.END) {
      const swipeThreshold = 50; // Minimum distance for a swipe
      const horizontalThreshold = Math.abs(translationX);
      const verticalThreshold = Math.abs(translationY);
      
      // Only trigger if horizontal movement is greater than vertical (horizontal swipe)
      if (horizontalThreshold > swipeThreshold && horizontalThreshold > verticalThreshold) {
        if (translationX > swipeThreshold) {
          // Swipe right - go to annual
          if (billingPeriod === 'monthly') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBillingPeriod('annual');
          }
        } else if (translationX < -swipeThreshold) {
          // Swipe left - go to monthly
          if (billingPeriod === 'annual') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBillingPeriod('monthly');
          }
        }
      }
    }
  };

  // Handle swipe gestures for tier cards area (flipped logic)
  const onTierCardsSwipe = (event: any) => {
    const { translationX, translationY, state } = event.nativeEvent;
    
    if (state === State.END) {
      const swipeThreshold = 50; // Minimum distance for a swipe
      const horizontalThreshold = Math.abs(translationX);
      const verticalThreshold = Math.abs(translationY);
      
      // Only trigger if horizontal movement is greater than vertical (horizontal swipe)
      if (horizontalThreshold > swipeThreshold && horizontalThreshold > verticalThreshold) {
        if (translationX > swipeThreshold) {
          // Swipe right - go to monthly (flipped)
          if (billingPeriod === 'annual') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBillingPeriod('monthly');
          }
        } else if (translationX < -swipeThreshold) {
          // Swipe left - go to annual (flipped)
          if (billingPeriod === 'monthly') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setBillingPeriod('annual');
          }
        }
      }
    }
  };

  const handlePlanSelect = async (planId: keyof typeof SUBSCRIPTION_TIERS) => {
    if (!user) {
      showNotification({
        type: "error",
        title: "Sign In Required",
        message: "Please sign in to upgrade your subscription.",
      });
      return;
    }

    setLoadingPlan(planId);
    
    try {
      const success = await handleSubscriptionWithRevenueCat(
        planId, // Type assertion for compatibility
        billingPeriod,
        user.email || "",
        user.displayName || user.email || "Customer",
        (type, title, message) => {
          showNotification({ type, title, message });
        }
      );

      if (success) {
        // 🎊 CELEBRATE PAID SUBSCRIPTION! 🎊
        triggerConfetti();
        
        // Update the current billing period after successful subscription
        setCurrentBillingPeriod(billingPeriod);
        
        showNotification({
          type: "success",
          title: "Subscription Updated",
          message: `Welcome to ${SUBSCRIPTION_TIERS[planId].name}!`,
        });
      }
    } catch (error) {
      console.error('Subscription error:', error);
      showNotification({
        type: "error",
        title: "Subscription Failed",
        message: "Something went wrong. Please try again.",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleRestorePurchases = async () => {
    setRestoringPurchases(true);
    
    // Start rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotationValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    rotateAnimation.start();
    try {
      const success = await restorePurchases((type, title, message) => {
        showNotification({ type, title, message });
      });
      
      if (success) {
        // 🎊 CELEBRATE RESTORED SUBSCRIPTION! 🎊
        triggerConfetti();
        
        // Refresh the current billing period after successful restore
        try {
          const currentPeriod = await getCurrentBillingPeriod();
          setCurrentBillingPeriod(currentPeriod);
        } catch (error) {
          console.error('Failed to refresh billing period after restore:', error);
        }
        
        showNotification({
          type: "success",
          title: "Purchases Restored",
          message: "Your subscription has been restored successfully!",
        });
      }
    } catch (error) {
      console.error('Restore purchases error:', error);
      showNotification({
        type: "error",
        title: "Restore Failed",
        message: "Unable to restore purchases. Please try again.",
      });
    } finally {
      setRestoringPurchases(false);
      // Stop rotation animation
      rotationValue.stopAnimation();
      rotationValue.setValue(0);
    }
  };

  const handleCancelSubscription = () => {
    // For iOS/Android app stores, users need to cancel through their platform settings
    const cancelUrl = Platform.OS === 'ios' 
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
    
    Linking.openURL(cancelUrl).catch(() => {
      showNotification({
        type: "error",
        title: "Unable to Open",
        message: "Please visit your App Store account settings to manage subscriptions.",
      });
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header */}
        <View style={styles.header}>
          <HeadingText size="large" color="gold" align="center" style={styles.title}>
            Choose Your Plan
          </HeadingText>
          <BodyText size="medium" color="secondary" align="center" style={styles.subtitle}>
            Unlock your business potential with powerful expense management tools
          </BodyText>
        </View>

        {/* Billing Toggle with separate gesture handler */}
        <PanGestureHandler 
          onHandlerStateChange={onBillingToggleSwipe}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-5, 5]}
        >
          <View style={styles.billingSection}>
            <BillingToggle
              billingPeriod={billingPeriod}
              onToggle={setBillingPeriod}
            />
            <Text style={[styles.swipeHint, { color: theme.text.tertiary }]}>
              💡 Swipe left or right to switch billing periods
            </Text>
          </View>
        </PanGestureHandler>

        {/* Plan Cards with separate gesture handler (flipped logic) */}
        <PanGestureHandler 
          onHandlerStateChange={onTierCardsSwipe}
          activeOffsetX={[-10, 10]}
          failOffsetY={[-5, 5]}
        >
          <View style={styles.plansContainer}>
        <PlanCard
          tier="starter"
          billingPeriod={billingPeriod}
          isCurrentPlan={subscription.currentTier === "starter" && currentBillingPeriod === billingPeriod}
          onSelect={() => handlePlanSelect("starter")}
          loading={loadingPlan === "starter"}
        />

        <PlanCard
          tier="growth"
          billingPeriod={billingPeriod}
          isCurrentPlan={subscription.currentTier === "growth" && currentBillingPeriod === billingPeriod}
          onSelect={() => handlePlanSelect("growth")}
          loading={loadingPlan === "growth"}
        />

        <PlanCard
          tier="professional"
          billingPeriod={billingPeriod}
          isCurrentPlan={subscription.currentTier === "professional" && currentBillingPeriod === billingPeriod}
          isPopular={true}
          onSelect={() => handlePlanSelect("professional")}
          loading={loadingPlan === "professional"}
        />
          </View>
        </PanGestureHandler>

        {/* Restore Purchases Button */}
      <View style={styles.restoreSection}>
        <Pressable
          onPress={handleRestorePurchases}
          disabled={restoringPurchases}
          style={({ pressed }) => [
            styles.restoreButton,
            {
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.primary,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.restoreIcon,
              {
                transform: [
                  {
                    rotate: rotationValue.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Ionicons 
              name="refresh" 
              size={18} 
              color={theme.text.secondary}
            />
          </Animated.View>
          <BodyText size="medium" color="secondary">
            {restoringPurchases ? "Restoring..." : "Restore Purchases"}
          </BodyText>
        </Pressable>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerTextContainer}>
          <Pressable onPress={handleCancelSubscription}>
            <Text style={[styles.footerText, styles.cancelLink, { color: theme.gold.primary }]}>
              Cancel
            </Text>
          </Pressable>
          <Text style={[styles.footerText, { color: theme.text.tertiary }]}>
            {" anytime • Secure payment"}
          </Text>
        </View>
      </View>
      </ScrollView>
      
      {/* Confetti Celebration for Subscription Success */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    maxWidth: width * 0.85,
    opacity: 0.8,
  },
  billingSection: {
    paddingHorizontal: 20,
    marginBottom: 32,
    alignItems: "center",
  },
  swipeHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.8,
  },
  toggleContainer: {
    flexDirection: "row",
    width: width * 0.9,
    maxWidth: 400,
    height: 56,
    borderRadius: 28,
    padding: 2,
    position: "relative",
  },
  toggleSlider: {
    position: "absolute",
    width: width * 0.45,
    maxWidth: 200,
    height: 52,
    borderRadius: 26,
    top: 2,
  },
  toggleOption: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  toggleOptionContent: {
    alignItems: "center",
    justifyContent: "center",
  },
  toggleText: {
    fontSize: 16,
    fontWeight: "600",
  },
  savingsBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 2,
  },
  savingsText: {
    color: "white",
    fontSize: 10,
    fontWeight: "700",
  },
  plansContainer: {
    paddingHorizontal: 20,
    gap: 20,
  },
  cardWrapper: {
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: "center",
  },
  popularBadgeGradient: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#FFD700",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  popularText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  currentBadge: {
    position: "absolute",
    top: 20,
    right: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 5,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 28,
  },
  planName: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    marginBottom: 8,
  },
  price: {
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -2,
  },
  pricePeriod: {
    fontSize: 18,
    marginLeft: 8,
    opacity: 0.7,
    fontWeight: "500",
  },
  savingsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    marginTop: 8,
  },
  savingsMainText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  featuresContainer: {
    marginBottom: 32,
    gap: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIcon: {
    marginRight: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  moreFeatures: {
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 8,
  },
  buttonWrapper: {
    width: "100%",
  },
  button: {
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 32,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: 40,
    paddingTop: 40,
    alignItems: "center",
  },
  footerTextContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  footerText: {
    fontSize: 12,
    lineHeight: 20,
    textAlign: "center",
  },
  cancelLink: {
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  restoreSection: {
    paddingHorizontal: 40,
    paddingTop: 20,
    alignItems: "center",
  },
  restoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
  },
  restoreIcon: {
    marginRight: 8,
  },
});

export default ChoosePlanScreen;