import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  StatusBar,
  Linking,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useRevenueCatPayments } from "../hooks/useRevenueCatPayments";
import { useInAppNotifications } from "../components/InAppNotificationProvider";
import {
  SUBSCRIPTION_TIERS,
  revenueCatService,
} from "../services/revenuecatService";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { useConfettiContext } from "../context/ConfettiContext";


type BillingPeriod = "monthly" | "annual";

interface AdjustPlanScreenProps {
  navigation: StackNavigationProp<any>;
  route: RouteProp<any>;
}

const AdjustPlanScreen: React.FC<AdjustPlanScreenProps> = ({ navigation }) => {
  const { theme, themeMode } = useTheme();
  const { subscription } = useSubscription();
  const { showNotification } = useInAppNotifications();
  const { handleSubscriptionWithRevenueCat, getCurrentBillingPeriod } =
    useRevenueCatPayments();

  const [currentBillingPeriod, setCurrentBillingPeriod] =
    useState<BillingPeriod>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [revenueCatPricing, setRevenueCatPricing] = useState<any>({});
  const [selectedTier, setSelectedTier] = useState<
    keyof typeof SUBSCRIPTION_TIERS | null
  >(null);
  const [userActualBillingPeriod, setUserActualBillingPeriod] =
    useState<BillingPeriod | null>(null);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const lastRequestTime = useRef(0);
  const { triggerConfetti } = useConfettiContext();

  useEffect(() => {
    // Load current billing period
    loadCurrentBillingPeriod();
    loadRevenueCatPricing();
    loadUserActualBillingPeriod();

    // Smooth shimmer animation with seamless loop
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.delay(500), // Brief pause at the end
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 0, // Instant reset to beginning
          useNativeDriver: true,
        }),
        Animated.delay(500), // Pause before next cycle
      ])
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, []);

  const loadRevenueCatPricing = async () => {
    try {
      console.log("🔍 Loading RevenueCat pricing...");
      const pricing = await revenueCatService.getRevenueCatPricing();
      console.log("💰 Loaded pricing:", pricing);
      setRevenueCatPricing(pricing);
    } catch (error) {
      console.error("❌ Failed to load RevenueCat pricing:", error);
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

  const loadCurrentBillingPeriod = async () => {
    try {
      const period = await getCurrentBillingPeriod();
      if (period) {
        setCurrentBillingPeriod(period);
      }
    } catch (error) {
      console.warn("Failed to get billing period:", error);
    }
    // Note: This function doesn't set isDataLoaded - that's handled by loadUserActualBillingPeriod
  };

  const loadUserActualBillingPeriod = async () => {
    try {
      const period = await getCurrentBillingPeriod();
      if (period) {
        setUserActualBillingPeriod(period);
      } else {
        setUserActualBillingPeriod("monthly"); // Fallback to monthly if no data
      }
    } catch (error) {
      console.warn("Failed to get user actual billing period:", error);
      setUserActualBillingPeriod("monthly"); // Fallback to monthly on error
    } finally {
      setIsDataLoaded(true);
    }
  };

  const getPlanAction = (
    tier: keyof typeof SUBSCRIPTION_TIERS
  ): "upgrade" | "downgrade" | "switch" => {
    const currentTier = subscription.currentTier;
    const tierHierarchy = { trial: 0, starter: 1, growth: 2, professional: 3 };

    const currentLevel =
      tierHierarchy[currentTier as keyof typeof tierHierarchy] || 0;
    const targetLevel = tierHierarchy[tier as keyof typeof tierHierarchy] || 0;

    if (targetLevel > currentLevel) return "upgrade";
    if (targetLevel < currentLevel) return "downgrade";
    return "switch";
  };

  const getActionColor = (action: "upgrade" | "downgrade" | "switch") => {
    switch (action) {
      case "upgrade":
        return theme.gold.primary; // Gold for upgrades
      case "downgrade":
        return theme.gold.muted; // Muted gold for downgrades
      case "switch":
        return theme.gold.rich; // Rich gold for billing switch
      default:
        return theme.gold.primary;
    }
  };

  const getActionText = (
    action: "upgrade" | "downgrade" | "switch",
    tier: string,
    billingPeriod: BillingPeriod
  ) => {
    switch (action) {
      case "upgrade":
        return `Upgrade to ${
          SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS].name
        }`;
      case "downgrade":
        return `Downgrade to ${
          SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS].name
        }`;
      case "switch":
        return billingPeriod === "annual"
          ? "Switch to Yearly"
          : "Switch to Monthly";
      default:
        return "Select Plan";
    }
  };

  const calculateAnnualSavings = (tier: keyof typeof SUBSCRIPTION_TIERS) => {
    const tierPricing = revenueCatPricing[tier];
    console.log("💰 Calculating savings for", tier, ":", tierPricing);

    if (tierPricing && tierPricing.monthly && tierPricing.annual) {
      // Extract numeric values from price strings like "$9.99"
      const monthlyPrice = parseFloat(
        tierPricing.monthly.price.replace("$", "")
      );
      const annualPrice = parseFloat(tierPricing.annual.price.replace("$", ""));

      console.log("💰 Parsed prices:", { monthlyPrice, annualPrice });

      if (monthlyPrice > 0 && annualPrice > 0) {
        // Monthly plan annual cost: monthly price × 12 months
        const monthlyAnnualCost = monthlyPrice * 12;
        // Annual plan cost
        const annualCost = annualPrice;
        // Savings: monthlyAnnualCost - annualCost
        const savingsAmount = monthlyAnnualCost - annualCost;
        // Savings percentage: (savingsAmount ÷ monthlyAnnualCost) × 100
        const savingsPercentage = Math.round(
          (savingsAmount / monthlyAnnualCost) * 100
        );

        console.log("💰 Savings calculation:", {
          monthlyAnnualCost,
          annualCost,
          savingsAmount,
          savingsPercentage,
        });

        return isNaN(savingsPercentage) ? 0 : Math.max(0, savingsPercentage);
      }
    }

    // Return 0 if no RevenueCat data available
    return 0;
  };

  const getDisplayPrice = (tier: string, billingPeriod: BillingPeriod) => {
    // First try to get price from RevenueCat
    const revenueCatTierPricing = revenueCatPricing[tier];
    if (revenueCatTierPricing && revenueCatTierPricing[billingPeriod]) {
      const priceInfo = revenueCatTierPricing[billingPeriod];
      if (billingPeriod === "annual") {
        // For annual, show the full annual price with "/year"
        return `${priceInfo.price}/year`;
      } else {
        // For monthly, show "/mo"
        return `${priceInfo.price}/mo`;
      }
    }

    // Fallback to hardcoded prices with a warning
    console.warn(
      `⚠️ Using fallback pricing for ${tier} ${billingPeriod} - RevenueCat not configured`
    );
    const tierData =
      SUBSCRIPTION_TIERS[tier as keyof typeof SUBSCRIPTION_TIERS];
    if (billingPeriod === "monthly") {
      return `$${tierData.monthlyPrice}/mo`;
    } else {
      // For annual pricing, calculate from monthly price if annualPrice doesn't exist
      const annualPrice =
        (tierData as any).annualPrice ?? tierData.monthlyPrice * 12 * 0.8; // 20% discount
      return `$${annualPrice}/year`;
    }
  };

  const handlePlanSelection = async (
    tier: keyof typeof SUBSCRIPTION_TIERS,
    billingPeriod: BillingPeriod
  ) => {
    console.log("🎯 Plan button tapped:", { tier, billingPeriod });
    console.log("🚀 ENTERING handlePlanSelection function");

    const planKey = `${tier}_${billingPeriod}`;
    const now = Date.now();

    // Prevent concurrent requests
    if (loadingPlan) {
      console.warn(
        "⚠️ Another plan selection is already in progress:",
        loadingPlan
      );
      return;
    }

    // Debounce requests to prevent rapid clicking
    if (now - lastRequestTime.current < 2000) {
      console.warn("⚠️ Request too soon after last request, ignoring");
      return;
    }

    lastRequestTime.current = now;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log("✅ Haptics completed");
    } catch (hapticError) {
      console.warn("⚠️ Haptics failed:", hapticError);
    }

    console.log("🔄 Setting loading plan:", planKey);
    setLoadingPlan(planKey);

    try {
      console.log("📞 About to call handleSubscriptionWithRevenueCat...");
      const success = await handleSubscriptionWithRevenueCat(
        tier,
        billingPeriod,
        "",
        "",
        (type, title, message) => {
          console.log("🔔 Notification callback:", { type, title, message });
          showNotification({ type, title, message });
        }
      );
      console.log(
        "✅ handleSubscriptionWithRevenueCat completed with result:",
        success
      );

      if (success) {
        setCurrentBillingPeriod(billingPeriod);
        setUserActualBillingPeriod(billingPeriod);
        setIsDataLoaded(true); // Ensure data is marked as loaded

        // 🎊 IMMEDIATE CONFETTI CELEBRATION! 🎊
        triggerConfetti();


        // Show contextual success notification
        const tierData = SUBSCRIPTION_TIERS[tier];
        const savings = calculateAnnualSavings(tier);
        const savingsMessage =
          billingPeriod === "annual" && savings > 0
            ? ` You're saving ${savings}% with annual billing! 💰`
            : "";

        const action = getPlanAction(tier);
        let actionMessage = "";
        let celebrationEmoji = "🎉";

        if (action === "upgrade") {
          actionMessage = "Enjoy your upgraded plan!";
          celebrationEmoji = "🎉";
        } else if (action === "downgrade") {
          actionMessage = "Your plan has been updated.";
          celebrationEmoji = "✅";
        } else {
          actionMessage = "Your billing period has been changed!";
          celebrationEmoji = "🔄";
        }

        showNotification({
          type: "success",
          title: `${celebrationEmoji} Welcome to ${tierData.name}!`,
          message: `Your subscription has been activated successfully!${savingsMessage} ${actionMessage}`,
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Plan change error:", error);
      showNotification({
        type: "error",
        title: "Update Failed",
        message: "Unable to update your plan. Please try again.",
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  // Handle swipe gestures for billing toggle area
  const billingToggleSwipeGesture = Gesture.Pan()
    .minDistance(50)
    .onEnd((event) => {
      const { translationX, translationY } = event;
      const swipeThreshold = 50;
      const horizontalThreshold = Math.abs(translationX);
      const verticalThreshold = Math.abs(translationY);

      // Only trigger if horizontal movement is greater than vertical (horizontal swipe)
      if (
        horizontalThreshold > swipeThreshold &&
        horizontalThreshold > verticalThreshold
      ) {
        if (translationX > swipeThreshold) {
          // Swipe right - go to annual
          if (currentBillingPeriod === "monthly") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentBillingPeriod("annual");
          }
        } else if (translationX < -swipeThreshold) {
          // Swipe left - go to monthly
          if (currentBillingPeriod === "annual") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentBillingPeriod("monthly");
          }
        }
      }
    });

  // Handle swipe gestures for tier cards area (flipped logic)
  const tierCardsSwipeGesture = Gesture.Pan()
    .minDistance(50)
    .onEnd((event) => {
      const { translationX, translationY } = event;
      const swipeThreshold = 50;
      const horizontalThreshold = Math.abs(translationX);
      const verticalThreshold = Math.abs(translationY);

      // Only trigger if horizontal movement is greater than vertical (horizontal swipe)
      if (
        horizontalThreshold > swipeThreshold &&
        horizontalThreshold > verticalThreshold
      ) {
        if (translationX > swipeThreshold) {
          // Swipe right - go to monthly (flipped)
          if (currentBillingPeriod === "annual") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentBillingPeriod("monthly");
          }
        } else if (translationX < -swipeThreshold) {
          // Swipe left - go to annual (flipped)
          if (currentBillingPeriod === "monthly") {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setCurrentBillingPeriod("annual");
          }
        }
      }
    });


  const SavingsBadge: React.FC<{
    savings: number;
    tier: keyof typeof SUBSCRIPTION_TIERS;
    billingPeriod: BillingPeriod;
  }> = ({ savings, tier, billingPeriod }) => {
    if (savings <= 0 || billingPeriod !== "annual") return null;

    // Stagger the animation for different tiers
    const staggerDelay = tier === "professional" ? 0.5 : 0;

    const shimmerTranslateX = shimmerValue.interpolate({
      inputRange: [0, staggerDelay, staggerDelay + 0.5, 1],
      outputRange:
        tier === "professional"
          ? [-100, -100, 100, -100] // Professional: delayed cycle
          : [-100, 100, -100, -100], // Growth: immediate cycle
    });

    return (
      <View style={styles.savingsBadgeContainer}>
        <LinearGradient
          colors={[
            theme.status.success,
            theme.status.success + "E0",
            theme.status.success,
          ]}
          style={styles.savingsBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.savingsBadgeText}>Save {savings}%</Text>

          {/* Simple, reliable shimmer effect */}
          <Animated.View
            style={[
              styles.shimmerOverlay,
              {
                transform: [{ translateX: shimmerTranslateX }],
              },
            ]}
          >
            <LinearGradient
              colors={[
                "transparent",
                "rgba(255,255,255,0.6)",
                "rgba(255,255,255,0.8)",
                "rgba(255,255,255,0.6)",
                "transparent",
              ]}
              style={styles.shimmerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
          </Animated.View>
        </LinearGradient>
      </View>
    );
  };

  const PlanCard: React.FC<{
    tier: keyof typeof SUBSCRIPTION_TIERS;
    billingPeriod: BillingPeriod;
  }> = React.memo(({ tier, billingPeriod }) => {
    // A plan is "current" only if it matches both the user's actual tier AND their actual billing period
    // Use userActualBillingPeriod instead of the UI toggle state (currentBillingPeriod)
    // Only show as current plan if data is fully loaded to prevent UI flashing
    const isCurrentPlan =
      isDataLoaded &&
      userActualBillingPeriod &&
      subscription.currentTier === tier &&
      billingPeriod === userActualBillingPeriod;
    const action = getPlanAction(tier);
    const actionColor = getActionColor(action);
    const planData = SUBSCRIPTION_TIERS[tier];
    const planKey = `${tier}_${billingPeriod}`;
    const isLoading = loadingPlan === planKey;

    // Loading state debugging can be uncommented if needed

    const spinValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (isLoading) {
        const spin = Animated.loop(
          Animated.timing(spinValue, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        );
        spin.start();
        return () => spin.stop();
      }
    }, [isLoading, spinValue]);

    const spin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });

    return (
      <Pressable
        onPress={() => setSelectedTier(tier)}
        style={({ pressed }) => [
          styles.planCard,
          isCurrentPlan && {
            borderColor: actionColor,
            borderWidth: 2,
          },
          selectedTier === tier && {
            borderColor: theme.gold.primary,
            borderWidth: 2,
          },
          { opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <LinearGradient
          colors={
            isCurrentPlan
              ? [actionColor + "15", actionColor + "05"]
              : [
                  theme.background.secondary + "90",
                  theme.background.secondary + "60",
                ]
          }
          style={styles.cardGradient}
        >
          {/* Header */}
          <View style={styles.cardHeader}>
            <View>
              <Text style={[styles.tierName, { color: theme.text.primary }]}>
                {planData.name}
              </Text>
              <Text style={[styles.tierPrice, { color: actionColor }]}>
                {getDisplayPrice(tier, currentBillingPeriod)}
              </Text>
            </View>

            <View style={styles.headerBadges}>
              {isCurrentPlan && (
                <View
                  style={[
                    styles.currentBadge,
                    { backgroundColor: actionColor },
                  ]}
                >
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}
              <SavingsBadge
                savings={calculateAnnualSavings(tier)}
                tier={tier}
                billingPeriod={billingPeriod}
              />
            </View>
          </View>

          {/* Features List */}
          <View style={styles.featuresPreview}>
            {planData.features.map((feature, idx) => (
              <View key={idx} style={styles.featureRow}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={actionColor}
                />
                <Text
                  style={[styles.featureText, { color: theme.text.secondary }]}
                  numberOfLines={2}
                >
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Action Button */}
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: isCurrentPlan
                  ? theme.background.secondary
                  : actionColor,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() =>
              !isCurrentPlan && handlePlanSelection(tier, billingPeriod)
            }
            disabled={isCurrentPlan || isLoading}
          >
            <View style={styles.actionButtonContent}>
              {isLoading ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="reload" size={20} color="white" />
                </Animated.View>
              ) : (
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      color: isCurrentPlan ? theme.text.primary : "white",
                    },
                  ]}
                >
                  {(() => {
                    const buttonText = !isDataLoaded
                      ? "Loading..."
                      : isCurrentPlan
                      ? "Current Plan"
                      : getActionText(action, tier, billingPeriod);
                    console.log(
                      "🔲 Button text for",
                      tier,
                      billingPeriod,
                      ":",
                      { isDataLoaded, isCurrentPlan, action, buttonText }
                    );
                    return buttonText || "Select Plan"; // Fallback to ensure never empty
                  })()}
                </Text>
              )}
            </View>
          </Pressable>
        </LinearGradient>
      </Pressable>
    );
  });

  return (
    <View
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <StatusBar
        barStyle={themeMode === "dark" ? "light-content" : "dark-content"}
        backgroundColor="transparent"
        translucent
      />

      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: theme.background.primary + "F0" },
        ]}
      >
        <View style={styles.headerBlur}>
          <View style={styles.headerContent}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name="chevron-back"
                size={20}
                color={theme.text.primary}
              />
              <Text style={[styles.backText, { color: theme.text.primary }]}>
                Back
              </Text>
            </Pressable>

            <Text style={[styles.headerTitle, { color: theme.text.primary }]}>
              Adjust Your Plan
            </Text>

            <View style={styles.headerSpacer} />
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Plans Grid with swipe gesture */}
          <GestureDetector gesture={tierCardsSwipeGesture}>
            <View style={styles.plansGrid}>
              {(["starter", "growth", "professional"] as const)
                .filter(
                  (tier) =>
                    !(tier === "starter" && currentBillingPeriod === "annual")
                )
                .map((tier) => (
                  <PlanCard
                    key={tier}
                    tier={tier}
                    billingPeriod={currentBillingPeriod}
                  />
                ))}
            </View>
          </GestureDetector>

          {/* Billing Toggle with swipe gesture */}
          <GestureDetector gesture={billingToggleSwipeGesture}>
            <View style={styles.billingToggleContainer}>
              <Text
                style={[styles.billingLabel, { color: theme.text.primary }]}
              >
                Billing Period
              </Text>

              <View
                style={[
                  styles.billingToggle,
                  { backgroundColor: theme.background.secondary },
                ]}
              >
                {(["monthly", "annual"] as const).map((period) => (
                  <Pressable
                    key={period}
                    style={[
                      styles.billingOption,
                      currentBillingPeriod === period && {
                        backgroundColor: theme.gold.primary,
                      },
                    ]}
                    onPress={() => {
                      setCurrentBillingPeriod(period);
                      Haptics.selectionAsync();
                    }}
                  >
                    <Text
                      style={[
                        styles.billingOptionText,
                        {
                          color:
                            currentBillingPeriod === period
                              ? "white"
                              : theme.text.secondary,
                        },
                      ]}
                    >
                      {period === "monthly" ? "Monthly" : "Annual"}
                    </Text>
                    {period === "annual" &&
                      selectedTier &&
                      calculateAnnualSavings(selectedTier) > 0 && (
                        <Text
                          style={[
                            styles.savingsText,
                            {
                              color:
                                currentBillingPeriod === period
                                  ? "white"
                                  : theme.gold.primary,
                            },
                          ]}
                        >
                          {selectedTier === subscription.currentTier
                            ? "Saving"
                            : "Save"}{" "}
                          {calculateAnnualSavings(selectedTier)}%
                        </Text>
                      )}
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.swipeHint, { color: theme.text.tertiary }]}>
                💡 Swipe left or right to switch billing periods
              </Text>

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
            </View>
          </GestureDetector>
        </ScrollView>
      </View>

      {/* Confetti Celebration Overlay */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  headerBlur: {
    paddingTop: Platform.OS === "ios" ? 50 : 30,
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    zIndex: -1,
  },
  headerSpacer: {
    width: 60,
  },
  headerSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === "ios" ? 100 : 80,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  plansGrid: {
    gap: 20,
    marginTop: 10,
  },
  planCard: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  cardGradient: {
    padding: 24,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  tierName: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 18,
    fontWeight: "600",
  },
  currentBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  currentBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  featuresPreview: {
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  moreFeatures: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonContent: {
    minHeight: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  billingToggleContainer: {
    marginTop: 40,
    alignItems: "center",
  },
  billingLabel: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  billingToggle: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
  },
  billingOption: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    minWidth: 120,
  },
  billingOptionText: {
    fontSize: 16,
    fontWeight: "600",
  },
  savingsText: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  swipeHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    opacity: 0.8,
  },
  headerBadges: {
    alignItems: "flex-end",
    gap: 8,
  },
  savingsBadgeContainer: {
    overflow: "hidden",
    borderRadius: 12,
  },
  savingsBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    position: "relative",
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  savingsBadgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    left: -50,
    right: -50,
    bottom: 0,
    opacity: 0.7,
  },
  shimmerGradient: {
    width: "100%",
    height: "100%",
  },
  footer: {
    paddingHorizontal: 40,
    paddingBottom: 20,
    paddingTop: 20,
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
});

export default AdjustPlanScreen;
