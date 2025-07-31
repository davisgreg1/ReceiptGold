import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription, SubscriptionTier } from '../context/SubscriptionContext';
import { UpgradePrompt } from './UpgradePrompt';

interface PremiumGateProps {
  children: React.ReactNode;
  feature: keyof import('../context/SubscriptionContext').SubscriptionFeatures;
  featureName: string;
  description: string;
  requiredTier?: SubscriptionTier;
  fallbackComponent?: React.ReactNode;
  showUpgradeButton?: boolean;
}

export const PremiumGate: React.FC<PremiumGateProps> = ({
  children,
  feature,
  featureName,
  description,
  requiredTier = 'starter',
  fallbackComponent,
  showUpgradeButton = true,
}) => {
  const { theme } = useTheme();
  const { canAccessFeature } = useSubscription();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  if (fallbackComponent) {
    return <>{fallbackComponent}</>;
  }

  // Default locked state
  return (
    <View style={[styles.lockedContainer, { 
      backgroundColor: theme.background.secondary,
      borderColor: theme.border.primary 
    }]}>
      <Text style={[styles.lockIcon, { color: theme.gold.primary }]}>🔒</Text>
      <Text style={[styles.lockedTitle, { color: theme.text.primary }]}>
        {featureName}
      </Text>
      <Text style={[styles.lockedDescription, { color: theme.text.secondary }]}>
        {description}
      </Text>
      
      {showUpgradeButton && (
        <TouchableOpacity
          style={[styles.upgradeButton, { backgroundColor: theme.gold.primary }]}
          onPress={() => setShowUpgradePrompt(true)}
        >
          <Text style={styles.upgradeButtonText}>Upgrade to Access</Text>
        </TouchableOpacity>
      )}

      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature={featureName}
        description={description}
        requiredTier={requiredTier}
      />
    </View>
  );
};

interface ReceiptLimitGateProps {
  children: React.ReactNode;
  currentReceiptCount: number;
  onUpgrade?: () => void;
}

export const ReceiptLimitGate: React.FC<ReceiptLimitGateProps> = ({
  children,
  currentReceiptCount,
  onUpgrade,
}) => {
  const { theme } = useTheme();
  const { canAddReceipt, getRemainingReceipts, subscription } = useSubscription();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const canAdd = canAddReceipt(currentReceiptCount);
  const remaining = getRemainingReceipts(currentReceiptCount);

  if (canAdd) {
    return <>{children}</>;
  }

  // Show limit reached message
  return (
    <View style={[styles.limitContainer, { 
      backgroundColor: theme.background.secondary,
      borderColor: theme.status.warning 
    }]}>
      <Text style={[styles.limitIcon, { color: theme.status.warning }]}>⚠️</Text>
      <Text style={[styles.limitTitle, { color: theme.text.primary }]}>
        Receipt Limit Reached
      </Text>
      <Text style={[styles.limitDescription, { color: theme.text.secondary }]}>
        You've reached your limit of {subscription.limits.maxReceipts} receipts on the {subscription.currentTier} plan.
      </Text>
      
      <TouchableOpacity
        style={[styles.upgradeButton, { backgroundColor: theme.gold.primary }]}
        onPress={() => {
          setShowUpgradePrompt(true);
          onUpgrade?.();
        }}
      >
        <Text style={styles.upgradeButtonText}>Upgrade for $9.99/month</Text>
      </TouchableOpacity>

      <UpgradePrompt
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        feature="Unlimited Receipts"
        description="Store unlimited receipts and never worry about limits again"
        requiredTier="starter"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  lockedContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    margin: 20,
  },
  limitContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    margin: 20,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  limitIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  limitTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  limitDescription: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  upgradeButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
