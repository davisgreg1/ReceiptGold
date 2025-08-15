import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import {
  Typography,
  DisplayText,
  HeadingText,
  BodyText,
  ButtonText,
  BrandText,
} from './Typography';

/**
 * Typography Showcase Component
 * 
 * This component demonstrates all the typography variants and components
 * available in the ReceiptGold app. Useful for design review and testing.
 * 
 * Usage: Import and add to any screen for typography preview
 */
export const TypographyShowcase: React.FC = () => {
  const { theme } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Brand Typography */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Brand Typography
          </HeadingText>
          <BrandText size="large" color="gold" align="center">
            ReceiptGold
          </BrandText>
          <BodyText size="medium" color="secondary" align="center" style={styles.spacing}>
            Welcome to{' '}
            <BrandText size="small" color="gold">ReceiptGold</BrandText>
            {' '}- your premium receipt manager
          </BodyText>
        </View>

        {/* Display Text */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Display Text
          </HeadingText>
          <DisplayText size="large" color="primary">Display Large</DisplayText>
          <DisplayText size="medium" color="primary">Display Medium</DisplayText>
          <DisplayText size="small" color="primary">Display Small</DisplayText>
        </View>

        {/* Heading Text */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Heading Text
          </HeadingText>
          <HeadingText size="large" color="primary">Heading Large</HeadingText>
          <HeadingText size="medium" color="primary">Heading Medium</HeadingText>
          <HeadingText size="small" color="primary">Heading Small</HeadingText>
        </View>

        {/* Body Text */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Body Text
          </HeadingText>
          <BodyText size="large" color="primary">
            Body Large - Perfect for important content and subtitles
          </BodyText>
          <BodyText size="medium" color="primary">
            Body Medium - Standard body text for most content
          </BodyText>
          <BodyText size="small" color="secondary">
            Body Small - Helper text and captions
          </BodyText>
        </View>

        {/* Button Text */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Button Text
          </HeadingText>
          <View style={[styles.button, { backgroundColor: theme.gold.primary }]}>
            <ButtonText size="large" color="inverse">Button Large</ButtonText>
          </View>
          <View style={[styles.button, { backgroundColor: theme.background.secondary }]}>
            <ButtonText size="medium" color="primary">Button Medium</ButtonText>
          </View>
          <View style={[styles.button, { backgroundColor: theme.border.primary }]}>
            <ButtonText size="small" color="primary">Button Small</ButtonText>
          </View>
        </View>

        {/* Color Variants */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Color Variants
          </HeadingText>
          <BodyText size="medium" color="primary">Primary Text</BodyText>
          <BodyText size="medium" color="secondary">Secondary Text</BodyText>
          <BodyText size="medium" color="tertiary">Tertiary Text</BodyText>
          <BodyText size="medium" color="gold">Gold Text</BodyText>
          <View style={[styles.darkBackground, { backgroundColor: theme.gold.primary }]}>
            <BodyText size="medium" color="inverse">Inverse Text</BodyText>
          </View>
        </View>

        {/* Alignment */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Text Alignment
          </HeadingText>
          <BodyText size="medium" color="primary" align="left">Left Aligned</BodyText>
          <BodyText size="medium" color="primary" align="center">Center Aligned</BodyText>
          <BodyText size="medium" color="primary" align="right">Right Aligned</BodyText>
        </View>

        {/* Real-world Example */}
        <View style={styles.section}>
          <HeadingText size="medium" color="gold" style={styles.sectionTitle}>
            Real-world Example
          </HeadingText>
          <DisplayText size="medium" color="gold" align="center">
            Welcome Back
          </DisplayText>
          <BodyText size="large" color="secondary" align="center" style={styles.spacing}>
            Sign in to your{' '}
            <BrandText size="small" color="gold">ReceiptGold</BrandText>
            {' '}account to continue managing your receipts
          </BodyText>
          <HeadingText size="small" color="primary" style={styles.spacing}>
            Quick Actions
          </HeadingText>
          <BodyText size="medium" color="primary">
            • Scan new receipts with your camera
          </BodyText>
          <BodyText size="medium" color="primary">
            • View detailed expense reports
          </BodyText>
          <BodyText size="medium" color="primary">
            • Export data for tax preparation
          </BodyText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  spacing: {
    marginTop: 8,
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 4,
  },
  darkBackground: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginVertical: 4,
  },
});
