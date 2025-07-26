import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription, SubscriptionTier } from '../context/SubscriptionContext';

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  feature: string;
  description: string;
  requiredTier?: SubscriptionTier;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  visible,
  onClose,
  feature,
  description,
  requiredTier = 'starter',
}) => {
  const { theme } = useTheme();
  const { upgradeTo, loading } = useSubscription();

  const handleUpgrade = async () => {
    try {
      await upgradeTo(requiredTier);
      onClose();
    } catch (error) {
      console.error('Upgrade failed:', error);
    }
  };

  const getTierInfo = (tier: SubscriptionTier) => {
    switch (tier) {
      case 'starter':
        return { name: 'Starter Plan', price: '$9', color: '#3B82F6' };
      case 'growth':
        return { name: 'Growth Plan', price: '$19', color: '#8B5CF6' };
      case 'professional':
        return { name: 'Professional Plan', price: '$39', color: '#F59E0B' };
      default:
        return { name: 'Starter Plan', price: '$9', color: '#3B82F6' };
    }
  };

  const tierInfo = getTierInfo(requiredTier);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.gold.primary }]}>
              Unlock {feature}
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              {description}
            </Text>
          </View>

          {/* Feature Preview */}
          <View style={[styles.featureCard, { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary 
          }]}>
            <Text style={[styles.featureIcon, { color: tierInfo.color }]}>🔒</Text>
            <Text style={[styles.featureTitle, { color: theme.text.primary }]}>
              Premium Feature
            </Text>
            <Text style={[styles.featureDescription, { color: theme.text.secondary }]}>
              This feature is available with {tierInfo.name} and above
            </Text>
          </View>

          {/* Upgrade Card */}
          <View style={[styles.upgradeCard, { 
            backgroundColor: tierInfo.color + '10',
            borderColor: tierInfo.color 
          }]}>
            <View style={styles.upgradeHeader}>
              <Text style={[styles.upgradeTier, { color: tierInfo.color }]}>
                {tierInfo.name}
              </Text>
              <Text style={[styles.upgradePrice, { color: theme.text.primary }]}>
                {tierInfo.price}<Text style={[styles.upgradePeriod, { color: theme.text.secondary }]}>/month</Text>
              </Text>
            </View>
            
            <Text style={[styles.upgradeDescription, { color: theme.text.secondary }]}>
              Get instant access to {feature} and all {tierInfo.name} features
            </Text>
          </View>

          {/* Benefits */}
          <View style={styles.benefits}>
            <Text style={[styles.benefitsTitle, { color: theme.text.primary }]}>
              What you'll get:
            </Text>
            {getBenefits(requiredTier).map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <Text style={[styles.benefitIcon, { color: theme.status.success }]}>✓</Text>
                <Text style={[styles.benefitText, { color: theme.text.primary }]}>
                  {benefit}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actions, { borderTopColor: theme.border.primary }]}>
          <TouchableOpacity
            style={[styles.cancelButton, { borderColor: theme.border.primary }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelButtonText, { color: theme.text.secondary }]}>
              Maybe Later
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.upgradeButton, { backgroundColor: tierInfo.color }]}
            onPress={handleUpgrade}
            disabled={loading}
          >
            <Text style={styles.upgradeButtonText}>
              {loading ? 'Upgrading...' : `Upgrade to ${tierInfo.name}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getBenefits = (tier: SubscriptionTier): string[] => {
  switch (tier) {
    case 'starter':
      return [
        'Unlimited receipt generation',
        'LLC-specific expense categories',
        'Educational content',
        'Basic compliance features',
        'Email support',
      ];
    case 'growth':
      return [
        'Everything in Starter',
        'Advanced reporting',
        'Tax preparation tools',
        'Accounting software integrations',
        'Priority support',
        'Quarterly tax reminders',
      ];
    case 'professional':
      return [
        'Everything in Growth',
        'Multi-business management',
        'White-label options',
        'API access',
        'Dedicated account manager',
        'Custom compliance workflows',
      ];
    default:
      return [];
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    paddingTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  featureCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 24,
  },
  featureIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  upgradeCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
    marginBottom: 24,
  },
  upgradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeTier: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  upgradePrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  upgradePeriod: {
    fontSize: 16,
    fontWeight: 'normal',
  },
  upgradeDescription: {
    fontSize: 16,
    lineHeight: 22,
  },
  benefits: {
    marginBottom: 20,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitIcon: {
    fontSize: 16,
    marginRight: 12,
    width: 20,
  },
  benefitText: {
    fontSize: 16,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  upgradeButton: {
    flex: 2,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
