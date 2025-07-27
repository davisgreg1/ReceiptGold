import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription, SubscriptionTier } from "../context/SubscriptionContext";
import { useAuth } from "../context/AuthContext";
import { useStripePayments } from "../hooks/useStripePayments";

const { width, height } = Dimensions.get("window");

interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: number;
  period: string;
  description: string;
  icon: string;
  gradientStart: string;
  gradientEnd: string;
  features: string[];
  popular: boolean;
}

interface PricingCardProps {
  tier: PricingTier;
  index: number;
}

interface PricingLandingProps {}

const PricingLanding: React.FC<PricingLandingProps> = () => {
  const { theme } = useTheme();
  const { subscription, upgradeTo, loading: subscriptionLoading } = useSubscription();
  console.log("🚀 ~ PricingLanding ~ subscription zzg:", subscription)
  const { user } = useAuth();
  console.log("🚀 ~ PricingLanding ~ user xxc:", user)
  const { handleSubscription, formatPrice } = useStripePayments();
  
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const scaleAnim = new Animated.Value(1);

  const pricingTiers: PricingTier[] = [
    {
      id: "starter",
      name: "Starter Plan",
      price: 9.99,
      period: "month",
      description: "Perfect for new LLCs getting started",
      icon: "📄",
      gradientStart: "#3B82F6",
      gradientEnd: "#06B6D4",
      features: [
        "50 receipt uploads per month",
        "LLC-specific expense categories",
        "Educational content",
        "Basic compliance features",
        "Email support",
      ],
      popular: false,
    },
    {
      id: "growth",
      name: "Growth Plan",
      price: 19.99,
      period: "month",
      description: "Best for growing businesses",
      icon: "📈",
      gradientStart: "#8B5CF6",
      gradientEnd: "#EC4899",
      features: [
        "Everything in Starter",
        "150 receipt uploads per month",
        "Advanced reporting",
        "Tax preparation tools",
        "Accounting software integrations",
        "Priority support",
        "Quarterly tax reminders",
        "Expense trend analysis",
      ],
      popular: true,
    },
    {
      id: "professional",
      name: "Professional Plan",
      price: 39.99,
      period: "month",
      description: "For established businesses & accountants",
      icon: "💼",
      gradientStart: "#F59E0B",
      gradientEnd: "#EA580C",
      features: [
        "Everything in Growth",
        "Unlimited receipt uploads",
        "Multi-business management",
        "White-label options",
        "API access",
        "Dedicated account manager",
        "Custom compliance workflows",
        "Bulk client management",
        "Advanced tax optimization",
      ],
      popular: false,
    },
  ];

  const handleTierSelect = async (tier: PricingTier): Promise<void> => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please sign in to upgrade your subscription.');
      return;
    }

    if (tier.id === subscription?.currentTier) {
      Alert.alert('Current Plan', 'You are already on this plan!');
      return;
    }

    setIsSelecting(true);
    setSelectedTier(tier.id);

    // Animate selection
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const customerEmail = user.email || '';
      const customerName = user.displayName || 'Customer';
      
      // Use the Stripe service to handle subscription
      const success = await handleSubscription(
        tier.id,
        customerEmail,
        customerName
      );

      if (success) {
        console.log(`Successfully initiated upgrade to: ${tier.name}`);
        // Update local subscription state
        await upgradeTo(tier.id);
      }
    } catch (error) {
      console.error('Upgrade failed:', error);
      Alert.alert(
        'Upgrade Error',
        'Failed to process subscription. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSelecting(false);
    }
  };

  const PricingCard: React.FC<PricingCardProps> = ({ tier, index }) => {
    const isSelected = selectedTier === tier.id;
    const isCurrentTier = subscription?.currentTier === tier.id;
    const cardScale = tier.popular ? 1.02 : 1;

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [{ scale: isSelected ? scaleAnim : cardScale }],
            // marginTop: tier.popular ? -10 : 0,
          },
        ]}
      >
        {tier.popular && (
          <View style={styles.popularBadge}>
            <Text style={styles.popularText}>Most Popular</Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.card,
            (isSelected || isCurrentTier) && styles.selectedCard,
            {
              backgroundColor: tier.popular
                ? theme.gold.background
                : theme.background.secondary,
              borderColor: isCurrentTier 
                ? theme.status.success 
                : (isSelected ? theme.gold.primary : theme.border.primary),
            },
          ]}
          onPress={() => handleTierSelect(tier)}
          activeOpacity={0.9}
          disabled={isCurrentTier}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: tier.gradientStart },
            ]}
          >
            <Text style={styles.iconText}>{tier.icon}</Text>
          </View>

          <Text style={[styles.tierName, { color: theme.text.primary }]}>{tier.name}</Text>
          <Text style={[styles.tierDescription, { color: theme.text.secondary }]}>{tier.description}</Text>

          <View style={styles.priceContainer}>
            <Text style={[styles.price, { color: theme.text.primary }]}>${tier.price}</Text>
            <Text style={[styles.period, { color: theme.text.secondary }]}>/{tier.period}</Text>
          </View>

          <View style={styles.featuresContainer}>
            {tier.features.map((feature: string, idx: number) => (
              <View key={idx} style={styles.featureItem}>
                <Text style={[styles.checkmark, { color: theme.status.success }]}>✓</Text>
                <Text style={[styles.featureText, { color: theme.text.primary }]}>{feature}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: isCurrentTier 
                  ? theme.status.success 
                  : (isSelected ? "#10B981" : tier.gradientStart),
                shadowColor: isCurrentTier 
                  ? theme.status.success 
                  : (isSelected ? "#10B981" : tier.gradientStart),
                opacity: isCurrentTier ? 0.7 : 1,
              },
            ]}
            disabled={isSelecting || isCurrentTier}
            onPress={() => handleTierSelect(tier)}
          >
            {isSelecting && selectedTier === tier.id ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={[styles.buttonText, { color: 'white' }]}>Upgrading...</Text>
              </View>
            ) : isCurrentTier ? (
              <Text style={[styles.buttonText, { color: 'white' }]}>Current Plan ✓</Text>
            ) : isSelected ? (
              <Text style={[styles.buttonText, { color: 'white' }]}>Selected ✓</Text>
            ) : (
              <Text style={[styles.buttonText, { color: 'white' }]}>
                {subscription?.currentTier === 'free' ? `Choose ${tier.name}` : `Upgrade to ${tier.name}`}
              </Text>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Decorative background elements */}
        <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: theme.gold.primary }]} />
        <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: theme.gold.muted }]} />
        <View style={[styles.bgCircle, styles.bgCircle3, { backgroundColor: theme.gold.rich }]} />

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.gold.primary }]}>Choose Your Plan</Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Streamline your LLC expenses and maximize your tax savings with the perfect plan for your business
          </Text>
        </View>

        {/* Pricing Cards */}
        <View style={styles.cardsContainer}>
          {pricingTiers.map((tier, index) => (
            <PricingCard key={tier.id} tier={tier} index={index} />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.benefits}>
            <Text style={[styles.benefit, { color: theme.text.tertiary }]}>• No setup fees</Text>
            <Text style={[styles.benefit, { color: theme.text.tertiary }]}>• Cancel anytime</Text>
            <Text style={[styles.benefit, { color: theme.text.tertiary }]}>• Tax deductible</Text>
          </View>
        </View>
      </ScrollView>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  bgCircle: {
    position: "absolute",
    borderRadius: 200,
    opacity: 0.1,
  },
  bgCircle1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  bgCircle2: {
    width: 250,
    height: 250,
    bottom: -50,
    left: -80,
  },
  bgCircle3: {
    width: 200,
    height: 200,
    top: height * 0.4,
    left: width * 0.7,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
    zIndex: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 40,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  cardsContainer: {
    gap: 20,
    zIndex: 10,
  },
  cardContainer: {
    position: "relative",
  },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: "50%",
    marginLeft: -60,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 10,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  popularText: {
    fontSize: 14,
    fontWeight: "600",
  },
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 0,
  },
  selectedCard: {
    borderWidth: 2,
    shadowOpacity: 0.25,
    elevation: 5,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  iconText: {
    fontSize: 24,
  },
  tierName: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  tierDescription: {
    fontSize: 16,
    marginBottom: 24,
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 24,
  },
  price: {
    fontSize: 48,
    fontWeight: "bold",
  },
  period: {
    fontSize: 16,
    marginLeft: 8,
  },
  featuresContainer: {
    marginBottom: 24,
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkmark: {
    fontSize: 16,
    fontWeight: "bold",
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  footer: {
    alignItems: "center",
    marginTop: 40,
    zIndex: 10,
  },
  guarantee: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 16,
  },
  benefits: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 20,
  },
  benefit: {
    fontSize: 14,
  },
});

export default PricingLanding;
