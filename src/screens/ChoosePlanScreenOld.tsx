import React from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
// import { useHomeNavigation } from "../navigation/navigationHelpers"; // Removed - not used
import { HeadingText, BodyText, ButtonText } from "../components/Typography";
import { SubscriptionTier } from "../context/SubscriptionContext";
import { useRevenueCatPayments } from "../hooks/useRevenueCatPayments";
// import { useCustomAlert } from "../components/CustomAlert"; // Removed - not currently used
import { useInAppNotifications } from "../components/InAppNotificationProvider";

const { width } = Dimensions.get("window");

interface Plan {
  id: SubscriptionTier;
  name: string;
  price: string;
  icon: string;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "$9.99/mo",
    icon: "📄",
    features: ["50 receipts/mo", "LLC categories", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: "$19.99/mo",
    icon: "📈",
    features: ["150 receipts/mo", "Advanced reporting", "Priority support"],
  },
  {
    id: "professional",
    name: "Professional",
    price: "$39.99/mo",
    icon: "💼",
    features: ["Unlimited receipts", "Multi-business", "Quarterly Alerts"],
  },
];

const ChoosePlanScreen: React.FC = () => {
  const { showNotification } = useInAppNotifications();

  const { theme } = useTheme();
  const { subscription } = useSubscription();
  // const homeNavigation = useHomeNavigation(); // Removed - not currently used
  const { user } = require("../context/AuthContext").useAuth();
  const { handleSubscriptionWithRevenueCat } = useRevenueCatPayments();

  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [alert, setAlert] = React.useState<{
    type: string;
    title: string;
    message: string;
  } | null>(null);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background.primary }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <HeadingText
          size="large"
          color="gold"
          align="center"
          style={styles.title}
        >
          Choose Your Plan
        </HeadingText>
        <BodyText
          size="medium"
          color="secondary"
          align="center"
          style={styles.subtitle}
        >
          Unlock your business potential with our premium features
        </BodyText>
      </View>

      <View style={styles.plansContainer}>
        {plans.map((plan) => {
          const isCurrent = subscription.currentTier === plan.id;
          const isPopular = plan.id === "professional";
          
          return (
            <View key={plan.id} style={styles.cardWrapper}>
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
                  isCurrent
                    ? [theme.status.success + "15", theme.status.success + "05"]
                    : isPopular
                    ? [theme.gold.background, theme.background.secondary]
                    : [theme.background.secondary, theme.background.tertiary]
                }
                style={[
                  styles.card,
                  {
                    borderColor: isCurrent
                      ? theme.status.success
                      : isPopular
                      ? theme.gold.primary
                      : theme.border.primary,
                  },
                  (isCurrent || isPopular) && styles.cardNoShadow,
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
              >
                {isCurrent && (
                  <View style={[styles.currentBadge, { backgroundColor: theme.background.secondary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }]}>
                    <Text style={[styles.currentBadgeText, { color: theme.status.success }]}>
                      CURRENT PLAN
                    </Text>
                  </View>
                )}

                <View style={styles.cardHeader}>
                  <View style={styles.iconContainer}>
                    <Text style={styles.planIcon}>{plan.icon}</Text>
                  </View>
                  
                  <HeadingText size="medium" color="primary" style={styles.planName}>
                    {plan.name}
                  </HeadingText>
                  
                  <View style={styles.priceContainer}>
                    <HeadingText size="large" color="gold" style={styles.price}>
                      {plan.price.split('/')[0]}
                    </HeadingText>
                    <BodyText size="small" color="tertiary" style={styles.pricePeriod}>
                      /{plan.price.split('/')[1]}
                    </BodyText>
                  </View>
                </View>

                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, idx) => (
                    <View key={idx} style={styles.featureRow}>
                      <Text style={[styles.checkmark, { color: theme.status.success }]}>✓</Text>
                      <BodyText size="small" color="secondary" style={styles.featureText}>
                        {feature}
                      </BodyText>
                    </View>
                  ))}
                </View>

                <Pressable
                  style={styles.buttonWrapper}
                  disabled={isCurrent || loadingPlan === plan.id}
                  onPress={async () => {
                    setLoadingPlan(plan.id);
                    setAlert(null);
                    if (!user) {
                      setAlert({
                        type: "error",
                        title: "Sign In Required",
                        message: "Please sign in to upgrade your subscription.",
                      });
                      setLoadingPlan(null);
                      return;
                    }
                    const success = await handleSubscriptionWithRevenueCat(
                      plan.id,
                      user.email || "",
                      user.displayName || user.email || "Customer",
                      (type: 'error' | 'success' | 'warning', title: string, message: string) =>
                        setAlert({ type, title, message })
                    );
                    if (success) {
                      showNotification({
                        type: "success",
                        title: "Subscription",
                        message:
                          "Your subscription has been updated successfully.",
                      });
                    }
                    setLoadingPlan(null);
                  }}
                >
                  {({ pressed }) => (
                    <LinearGradient
                      colors={
                        isCurrent
                          ? [theme.status.success, theme.status.success]
                          : isPopular
                          ? [theme.gold.primary, theme.gold.rich]
                          : [theme.gold.muted, theme.gold.rich]
                      }
                      style={[
                        styles.button,
                        {
                          opacity: isCurrent || loadingPlan === plan.id ? 0.7 : pressed ? 0.9 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }],
                        },
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <ButtonText size="medium" color="inverse" style={styles.buttonText}>
                        {isCurrent
                          ? "Current Plan"
                          : loadingPlan === plan.id
                          ? "Processing..."
                          : "Choose Plan"}
                      </ButtonText>
                    </LinearGradient>
                  )}
                </Pressable>

                {alert && loadingPlan === plan.id && (
                  <View style={styles.alertContainer}>
                    <BodyText
                      size="small"
                      color={
                        alert.type === "error"
                          ? "error"
                          : alert.type === "success"
                          ? "success"
                          : "warning"
                      }
                      align="center"
                    >
                      {alert.title}: {alert.message}
                    </BodyText>
                  </View>
                )}
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 32,
    paddingTop: 20,
  },
  title: {
    marginBottom: 8,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    maxWidth: width * 0.8,
    alignSelf: "center",
  },
  plansContainer: {
    gap: 20,
  },
  cardWrapper: {
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    left: 20,
    right: 20,
    zIndex: 10,
    alignItems: "center",
  },
  popularBadgeGradient: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  popularText: {
    color: "#000",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  currentBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 5,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    opacity: 0.8,
  },
  card: {
    borderRadius: 24,
    borderWidth: 2,
    padding: 24,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.2)",
  },
  planIcon: {
    fontSize: 36,
  },
  planName: {
    marginBottom: 8,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
  },
  price: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  pricePeriod: {
    fontSize: 16,
    marginLeft: 4,
    opacity: 0.7,
  },
  featuresContainer: {
    marginBottom: 24,
    gap: 12,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 12,
    width: 20,
  },
  featureText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
  },
  buttonWrapper: {
    width: "100%",
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  alertContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
  },
  cardNoShadow: {
    ...Platform.select({
      ios: {
        shadowOpacity: 0,
      },
      android: {
        elevation: 0,
      },
    }),
  },
});

export default ChoosePlanScreen;
