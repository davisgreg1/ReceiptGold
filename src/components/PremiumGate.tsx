import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription, SubscriptionTier } from '../context/SubscriptionContext';
import { useTeam } from '../context/TeamContext';
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
  const { isTeamMember } = useTeam();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const hasAccess = canAccessFeature(feature);

  if (hasAccess) {
    return <>{children}</>;
  }

  // Team members should see a different message instead of upgrade prompts
  if (isTeamMember) {
    if (fallbackComponent) {
      return <>{fallbackComponent}</>;
    }
    
    // Show a simple "not available" message for team members
    return (
      <View style={[styles.lockedContainer, { 
        backgroundColor: theme.background.secondary,
        borderColor: theme.border.primary 
      }]}>
        <Text style={[styles.lockIcon, { color: theme.text.tertiary }]}>🚫</Text>
        <Text style={[styles.lockedTitle, { color: theme.text.primary }]}>
          {featureName}
        </Text>
        <Text style={[styles.lockedDescription, { color: theme.text.secondary }]}>
          This feature is not available for team members
        </Text>
      </View>
    );
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

const styles = StyleSheet.create({
  lockedContainer: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    margin: 20,
  },
  lockIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  lockedTitle: {
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
