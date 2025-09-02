import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

interface TrialExpiredModalProps {
  visible: boolean;
  onUpgrade: () => void;
  onDismiss: () => void;
}

const { width: screenWidth } = Dimensions.get('window');

export const TrialExpiredModal: React.FC<TrialExpiredModalProps> = ({
  visible,
  onUpgrade,
  onDismiss,
}) => {
  const { theme } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: theme.background.elevated }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconContainer, { backgroundColor: '#FF4444' }]}>
              <Ionicons name="time-outline" size={32} color="white" />
            </View>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              Trial Expired
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              Your 3-day trial has ended. Upgrade to continue enjoying all features.
            </Text>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            <Text style={[styles.featuresTitle, { color: theme.text.primary }]}>
              With Professional:
            </Text>
            
            {[
              'Unlimited receipt scanning',
              'Bank account connections',
              'Advanced reporting & analytics',
              'Tax preparation tools',
              'Multiple business management',
              'Priority customer support'
            ].map((feature, index) => (
              <View key={index} style={styles.featureRow}>
                <Ionicons 
                  name="checkmark-circle" 
                  size={16} 
                  color={theme.gold.primary} 
                />
                <Text style={[styles.featureText, { color: theme.text.secondary }]}>
                  {feature}
                </Text>
              </View>
            ))}
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.upgradeButton, { backgroundColor: theme.gold.primary }]}
              onPress={onUpgrade}
              activeOpacity={0.8}
            >
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
              <Ionicons name="arrow-forward" size={16} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={onDismiss}
              activeOpacity={0.6}
            >
              <Text style={[styles.dismissButtonText, { color: theme.text.tertiary }]}>
                Maybe Later
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    width: Math.min(screenWidth - 40, 400),
    borderRadius: 20,
    padding: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  featuresContainer: {
    marginBottom: 32,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingLeft: 8,
  },
  featureText: {
    fontSize: 15,
    marginLeft: 12,
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 12,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  dismissButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
});