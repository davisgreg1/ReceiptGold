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
import { HeadingText, BodyText, ButtonText, BrandText } from '../components/Typography';

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
  const { user } = useAuth();
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
        "50 receipts per month",
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
        "150 receipts per month",
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
        "Unlimited receipts",
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
    const cardScale = tier.popular ? 1.0 : 1;
    const cardAnimValue = new Animated.Value(1);

    React.useEffect(() => {
      // Stagger the entrance animation
      Animated.timing(cardAnimValue, {
        toValue: 1,
        duration: 600 + index * 150,
        useNativeDriver: true,
      }).start();
    }, [index]);

    return (
      <Animated.View
        style={[
          styles.cardContainer,
          {
            transform: [
              { scale: isSelected ? scaleAnim : cardScale },
              { 
                translateY: cardAnimValue.interpolate({
                  inputRange: [0, 1],
                  outputRange: [50, 0],
                })
              },
            ],
            opacity: cardAnimValue,
          },
        ]}
      >
        {tier.popular && (
          <View style={styles.popularBadgeContainer}>
            <View style={[styles.popularBadge, { backgroundColor: theme.gold.primary }]}>
              <BodyText size="small" color="inverse" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                ⭐ MOST POPULAR
              </BodyText>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.card,
            (isSelected || isCurrentTier) && styles.selectedCard,
            tier.popular && styles.popularCard,
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
          activeOpacity={0.95}
          disabled={isCurrentTier}
        >
          <View
            style={[
              styles.iconContainer,
              { 
                backgroundColor: tier.gradientStart,
                shadowColor: tier.gradientStart,
              },
            ]}
          >
            <Text style={styles.iconText}>{tier.icon}</Text>
          </View>

          <HeadingText size="small" color="primary" align="center" style={styles.tierNameSpacing}>
            {tier.name}
          </HeadingText>
          <BodyText size="medium" color="secondary" align="center" style={styles.descriptionSpacing}>
            {tier.description}
          </BodyText>

          <View style={styles.priceContainer}>
            <View style={styles.priceWrapper}>
              <BodyText size="small" color="secondary" style={styles.currency}>$</BodyText>
              <HeadingText size="large" color="primary" style={styles.priceNumber}>
                {tier.price.toString().split('.')[0]}
              </HeadingText>
              <BodyText size="small" color="secondary" style={styles.cents}>
                .{tier.price.toString().split('.')[1] || '00'}
              </BodyText>
            </View>
            <BodyText size="small" color="tertiary" style={styles.period}>
              per {tier.period}
            </BodyText>
          </View>

          <View style={styles.featuresContainer}>
            {tier.features.map((feature: string, idx: number) => (
              <View key={idx} style={styles.featureItem}>
                <View style={[styles.checkmarkContainer, { backgroundColor: theme.status.success + '20' }]}>
                  <Text style={[styles.checkmark, { color: theme.status.success }]}>✓</Text>
                </View>
                <BodyText size="medium" color="primary" style={styles.featureText}>
                  {feature}
                </BodyText>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.button,
              {
                backgroundColor: isCurrentTier 
                  ? theme.status.success 
                  : (isSelected ? theme.gold.primary : tier.gradientStart),
                shadowColor: isCurrentTier 
                  ? theme.status.success 
                  : (isSelected ? theme.gold.primary : tier.gradientStart),
                opacity: isCurrentTier ? 0.8 : 1,
              },
            ]}
            disabled={isSelecting || isCurrentTier}
            onPress={() => handleTierSelect(tier)}
          >
            {/* Button gradient overlay */}
            <View style={[
              styles.buttonGradient,
              {
                backgroundColor: isCurrentTier 
                  ? theme.status.success + '10' 
                  : (isSelected ? theme.gold.primary + '10' : tier.gradientStart + '10'),
              }
            ]} />
            
            {isSelecting && selectedTier === tier.id ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="white" />
                <ButtonText size="medium" color="inverse" style={{ marginLeft: 8, fontWeight: '700' }}>
                  Upgrading...
                </ButtonText>
              </View>
            ) : isCurrentTier ? (
              <View style={styles.currentPlanContainer}>
                <Text style={styles.checkIcon}>✓</Text>
                <ButtonText size="medium" color="inverse" style={{ fontWeight: '700' }}>
                  Current Plan
                </ButtonText>
              </View>
            ) : isSelected ? (
              <View style={styles.selectedContainer}>
                <Text style={styles.sparkleIcon}>✨</Text>
                <ButtonText size="medium" color="inverse" style={{ fontWeight: '700' }}>
                  Selected
                </ButtonText>
              </View>
            ) : (
              <ButtonText size="medium" color="inverse" style={{ fontWeight: '700', letterSpacing: 0.5 }}>
                {subscription?.currentTier === 'free' ? `Get ${tier.name}` : `Upgrade Now`}
              </ButtonText>
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
        {/* Enhanced decorative background elements */}
        <View style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: theme.gold.primary }]} />
        <View style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: theme.gold.muted }]} />
        <View style={[styles.bgCircle, styles.bgCircle3, { backgroundColor: theme.gold.rich }]} />
        <View style={[styles.bgCircle, styles.bgCircle4, { backgroundColor: theme.gold.primary }]} />
        
        {/* Subtle gradient overlay */}
        <View style={[styles.gradientOverlay, { 
          backgroundColor: `${theme.gold.primary}05`
        }]} />

        {/* Header */}
        <View style={styles.header}>
          <HeadingText size="large" color="gold" align="center" style={styles.mainTitle}>
            Choose Your Perfect Plan
          </HeadingText>
          <BodyText size="large" color="secondary" align="center" style={styles.headerSubtitle}>
            Streamline your LLC expenses and maximize your tax savings with the perfect plan for your business growth
          </BodyText>
          
          {/* Trust indicators */}
          <View style={styles.trustIndicators}>
            <BodyText size="small" color="tertiary" style={styles.trustItem}>
              💎 Premium Quality
            </BodyText>
            <BodyText size="small" color="tertiary" style={styles.trustItem}>
              🔒 Bank-Level Security
            </BodyText>
            <BodyText size="small" color="tertiary" style={styles.trustItem}>
              ⚡ Lightning Fast
            </BodyText>
          </View>
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
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✨</Text>
              <BodyText size="small" color="tertiary" style={styles.benefitText}>No setup fees</BodyText>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>🔄</Text>
              <BodyText size="small" color="tertiary" style={styles.benefitText}>Cancel anytime</BodyText>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>�</Text>
              <BodyText size="small" color="tertiary" style={styles.benefitText}>Tax deductible</BodyText>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>🏆</Text>
              <BodyText size="small" color="tertiary" style={styles.benefitText}>Premium support</BodyText>
            </View>
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
    opacity: 0.08,
  },
  bgCircle1: {
    width: 400,
    height: 400,
    top: -150,
    right: -150,
  },
  bgCircle2: {
    width: 350,
    height: 350,
    bottom: -100,
    left: -120,
  },
  bgCircle3: {
    width: 250,
    height: 250,
    top: height * 0.4,
    left: width * 0.75,
  },
  bgCircle4: {
    width: 180,
    height: 180,
    bottom: height * 0.2,
    right: width * 0.1,
  },
  gradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
    zIndex: 10,
    paddingHorizontal: 10,
  },
  mainTitle: {
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  headerSubtitle: {
    lineHeight: 28,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  trustIndicators: {
    flexDirection: 'row',
    gap: 20,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  trustItem: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  cardsContainer: {
    gap: 24,
    zIndex: 10,
    marginBottom: 20,
  },
  cardContainer: {
    position: "relative",
  },
  popularBadgeContainer: {
    position: "absolute",
    top: -30,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  popularBadge: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 25,
    shadowColor: "#FFD700",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderRadius: 24,
    padding: 32,
    borderWidth: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
    position: "relative",
  },
  selectedCard: {
    borderWidth: 3,
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  popularCard: {
    borderWidth: 3,
    shadowColor: "#FFD700",
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    marginVertical: 4,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    alignSelf: "center",
  },
  iconText: {
    fontSize: 28,
  },
  tierNameSpacing: {
    marginBottom: 8,
    fontWeight: '700',
  },
  descriptionSpacing: {
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  priceContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  priceWrapper: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  currency: {
    marginTop: 8,
    marginRight: 2,
    fontWeight: '600',
  },
  priceNumber: {
    fontWeight: '800',
    fontSize: 56,
    lineHeight: 60,
  },
  cents: {
    marginTop: 8,
    marginLeft: 2,
    fontWeight: '600',
  },
  period: {
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '500',
  },
  featuresContainer: {
    marginBottom: 32,
    gap: 16,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 2,
  },
  checkmarkContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  checkmark: {
    fontSize: 14,
    fontWeight: "bold",
  },
  featureText: {
    flex: 1,
    lineHeight: 22,
    fontWeight: '500',
  },
  button: {
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  buttonGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  currentPlanContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  selectedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  checkIcon: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
  },
  sparkleIcon: {
    fontSize: 16,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  footer: {
    alignItems: "center",
    marginTop: 48,
    zIndex: 10,
    paddingTop: 32,
  },
  benefits: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 24,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  benefitIcon: {
    fontSize: 16,
  },
  benefitText: {
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});

export default PricingLanding;
