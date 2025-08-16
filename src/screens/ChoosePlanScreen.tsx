import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { useHomeNavigation } from "../navigation/navigationHelpers";
import { HeadingText, BodyText, ButtonText } from '../components/Typography';
import { SubscriptionTier } from "../context/SubscriptionContext";

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
    name: "Starter Plan",
    price: "$9.99/mo",
    icon: "📄",
    features: ["50 receipts/mo", "LLC categories", "Email support"],
  },
  {
    id: "growth",
    name: "Growth Plan",
    price: "$19.99/mo",
    icon: "📈",
    features: ["150 receipts/mo", "Advanced reporting", "Priority support"],
  },
  {
    id: "professional",
    name: "Professional Plan",
    price: "$39.99/mo",
    icon: "💼",
    features: ["Unlimited receipts", "Multi-business", "Dedicated manager"],
  },
];

const ChoosePlanScreen: React.FC = () => {
  const { theme } = useTheme();
  const { subscription, upgradeTo } = useSubscription();
  const homeNavigation = useHomeNavigation();
  const { user } = require("../context/AuthContext").useAuth();
  const { handleSubscription } = require("../hooks/useStripePayments").useStripePayments();
  const [loadingPlan, setLoadingPlan] = React.useState<string | null>(null);
  const [alert, setAlert] = React.useState<{ type: string; title: string; message: string } | null>(null);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.background.primary }} contentContainerStyle={{ padding: 24 }}>
      <HeadingText size="large" color="gold" align="center" style={{ marginBottom: 8 }}>
        Choose Your Plan
      </HeadingText>
      <BodyText size="medium" color="secondary" align="center" style={{ marginBottom: 24 }}>
        Select the best plan for your business needs. You can upgrade or downgrade anytime.
      </BodyText>
      {plans.map((plan) => {
        const isCurrent = subscription.currentTier === plan.id;
        return (
          <View key={plan.id} style={[styles.card, { borderColor: isCurrent ? theme.status.success : theme.gold.primary, backgroundColor: theme.background.secondary }]}> 
            <View style={styles.iconWrap}><Text style={{ fontSize: 32 }}>{plan.icon}</Text></View>
            <HeadingText size="medium" color="primary">{plan.name}</HeadingText>
            <BodyText size="small" color="tertiary" style={{ marginBottom: 8 }}>{plan.price}</BodyText>
            {plan.features.map((feature, idx) => (
              <BodyText key={idx} size="small" color="secondary">• {feature}</BodyText>
            ))}
            <TouchableOpacity
              style={[styles.button, { backgroundColor: isCurrent ? theme.status.success : theme.gold.primary }]}
              disabled={isCurrent || loadingPlan === plan.id}
              onPress={async () => {
                setLoadingPlan(plan.id);
                setAlert(null);
                if (!user) {
                  setAlert({ type: 'error', title: 'Sign In Required', message: 'Please sign in to upgrade your subscription.' });
                  setLoadingPlan(null);
                  return;
                }
                const success = await handleSubscription(
                  plan.id,
                  user.email || '',
                  user.displayName || user.email || 'Customer',
                  undefined,
                  (type: string, title: string, message: string) => setAlert({ type, title, message })
                );
                if (success) {
                  await upgradeTo(plan.id);
                }
                setLoadingPlan(null);
              }}
            >
              <ButtonText size="medium" color="inverse">
                {isCurrent ? "Current Plan" : loadingPlan === plan.id ? "Processing..." : "Choose"}
              </ButtonText>
            </TouchableOpacity>
            {alert && loadingPlan === plan.id && (
              <BodyText size="small" color={alert.type === 'error' ? 'error' : alert.type === 'success' ? 'success' : 'warning'} style={{ marginTop: 8 }}>
                {alert.title}: {alert.message}
              </BodyText>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  iconWrap: {
    marginBottom: 8,
  },
  button: {
    marginTop: 16,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
  },
});

export default ChoosePlanScreen;
