import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Logo } from '../components/Logo';

interface PrivacyPolicyScreenProps {
  navigation: any;
}

interface PolicySection {
  id: string;
  title: string;
  content: string;
  icon: string;
}

const policySections: PolicySection[] = [
  {
    id: '1',
    title: 'Information We Collect',
    icon: 'information-circle-outline',
    content: `We collect information you provide directly to us, such as when you create an account, scan receipts, or contact us for support.

**Personal Information:**
• Email address and account credentials
• Name and business information (if provided)
• Payment information (processed securely through Stripe)

**Receipt Data:**
• Photos of receipts you scan
• Extracted text and data from receipts
• Categories and tags you assign
• Dates, amounts, and vendor information

**Usage Information:**
• How you interact with our app
• Features you use most frequently
• Device information (model, OS version)
• App performance and error logs

**Financial Data (Professional users):**
• Bank transaction data (via Plaid integration)
• Account balances and transaction history
• This data is encrypted and never stored permanently`
  },
  {
    id: '2',
    title: 'How We Use Your Information',
    icon: 'settings-outline',
    content: `We use your information to provide, maintain, and improve ReceiptGold's services.

**Core Services:**
• Process and organize your receipt data
• Generate expense reports and tax documents
• Sync your data across devices
• Provide customer support

**Service Improvement:**
• Analyze usage patterns to improve features
• Develop new functionality based on user needs
• Ensure app stability and performance
• Prevent fraud and abuse

**Communications:**
• Send important service updates
• Respond to your support requests
• Notify you about new features (with your consent)
• Send billing and account notifications

We never sell your personal information to third parties or use it for advertising purposes outside of our own service improvements.`
  },
  {
    id: '3',
    title: 'Data Storage & Security',
    icon: 'shield-checkmark-outline',
    content: `Your data security is our top priority. We implement industry-standard security measures.

**Encryption:**
• All data is encrypted in transit using TLS 1.3
• Receipt images are encrypted at rest
• Database connections use encrypted protocols
• API communications are secured end-to-end

**Storage:**
• Data is stored on secure Firebase/Google Cloud servers
• Servers are located in secure data centers
• Regular security audits and compliance checks
• Automated backups with encryption

**Access Controls:**
• Multi-factor authentication for our team
• Role-based access to user data
• Regular access reviews and updates
• Logging and monitoring of all data access

**Data Retention:**
• Receipt data is retained while your account is active
• Deleted data is permanently removed within 30 days
• You can request data deletion at any time
• Financial connection data is not permanently stored`
  },
  {
    id: '4',
    title: 'Third-Party Services',
    icon: 'link-outline',
    content: `ReceiptGold integrates with trusted third-party services to provide enhanced functionality.

**Plaid (Bank Connections):**
• Used for secure bank account connections
• Plaid has its own privacy policy and security measures
• Transaction data is encrypted and transmitted securely
• We don't store your banking credentials

**Stripe (Payment Processing):**
• Handles all subscription and payment processing
• Your payment information is never stored on our servers
• Stripe is PCI DSS compliant and highly secure
• Subject to Stripe's privacy policy

**Google Cloud/Firebase:**
• Provides secure data storage and authentication
• Servers located in secure, compliant data centers
• Subject to Google's privacy and security standards
• Automatic scaling and backup capabilities

**OpenAI (Receipt Processing):**
• Used to extract text and data from receipt images
• Receipt images are processed but not permanently stored
• Data is transmitted securely and deleted after processing
• Subject to OpenAI's privacy policy

We carefully vet all third-party services and ensure they meet our security standards.`
  },
  {
    id: '5',
    title: 'Your Privacy Rights',
    icon: 'person-outline',
    content: `You have full control over your personal information and privacy settings.

**Access & Download:**
• View all data we have about you
• Download your receipt data and reports
• Request a complete data export
• Access your account information anytime

**Correction & Updates:**
• Update your profile information
• Correct any inaccurate receipt data
• Modify your preferences and settings
• Change your email or password

**Deletion Rights:**
• Delete individual receipts or data
• Close your account and delete all data
• Request immediate data purging
• Export data before deletion

**Privacy Controls:**
• Control email notifications and communications
• Manage data sharing preferences
• Set up two-factor authentication
• Review connected services and permissions

**California Residents (CCPA):**
• Right to know what personal information is collected
• Right to delete personal information
• Right to opt-out of sale (we don't sell data)
• Non-discrimination for exercising privacy rights`
  },
  {
    id: '6',
    title: 'Data Sharing',
    icon: 'share-outline',
    content: `We are committed to protecting your privacy and do not sell your personal information.

**We Never Share:**
• Your personal receipt data with advertisers
• Individual transaction information
• Personal contact information
• Financial account details

**Limited Sharing Cases:**
• With your explicit consent for specific features
• When required by law or legal process
• To protect our rights and prevent fraud
• With service providers under strict contracts

**Service Providers:**
• Cloud storage providers (encrypted data only)
• Payment processors (for billing purposes)
• Customer support tools (when you contact us)
• Analytics services (anonymized usage data)

**Business Transfers:**
• In case of merger or acquisition
• Your data rights would be maintained
• You would be notified of any changes
• Option to delete data before transfer

**Legal Requirements:**
• Court orders or legal subpoenas
• Government requests where legally required
• To protect safety and prevent harm
• Always with appropriate legal review`
  },
  {
    id: '7',
    title: 'International Users',
    icon: 'globe-outline',
    content: `ReceiptGold is available globally, and we comply with international privacy regulations.

**GDPR Compliance (EU Users):**
• Lawful basis for data processing
• Right to access, rectify, and erase data
• Right to data portability
• Right to object to processing
• Data Protection Officer available for contact

**Data Transfers:**
• Data may be processed in the United States
• We use appropriate safeguards for international transfers
• Standard Contractual Clauses with service providers
• Compliance with Privacy Shield principles

**Local Laws:**
• We comply with applicable local privacy laws
• Regular review of international regulations
• Updates to practices as laws evolve
• Local data residency options where required

**Contact for International Users:**
• EU users can contact our DPO directly
• Specific forms for GDPR requests
• Local language support where possible
• Recognition of all applicable privacy rights`
  },
  {
    id: '8',
    title: 'Updates & Contact',
    icon: 'mail-outline',
    content: `We may update this privacy policy from time to time to reflect changes in our practices.

**Policy Updates:**
• We will notify you of material changes
• Updates posted on our website and in-app
• Continued use constitutes acceptance
• Previous versions available upon request

**Effective Date:**
This privacy policy is effective as of August 16, 2025.

**How to Contact Us:**
If you have questions about this privacy policy or our data practices:

• Email: privacy@receiptgold.com
• Support: Through the app's Contact Support feature
• Mail: ReceiptGold Privacy Team
  123 Business Ave
  San Francisco, CA 94102

**Data Protection Officer:**
• EU users: dpo@receiptgold.com
• Response within 30 days
• Dedicated to privacy matters
• Available for all privacy-related questions

We're committed to transparency and will always respond promptly to your privacy concerns and requests.`
  }
];

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | null>('1');

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  const lastUpdated = 'August 16, 2025';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: theme.gold.background }]}>
            <Logo size={50} />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Privacy Policy
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </Text>
          <View style={[styles.lastUpdated, { backgroundColor: theme.background.secondary }]}>
            <Ionicons name="time-outline" size={16} color={theme.text.secondary} />
            <Text style={[styles.lastUpdatedText, { color: theme.text.secondary }]}>
              Last updated: {lastUpdated}
            </Text>
          </View>
        </View>

        {/* Quick Navigation */}
        <View style={styles.quickNavSection}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Quick Navigation
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickNavContainer}
          >
            {policySections.map((section) => (
              <TouchableOpacity
                key={section.id}
                style={[
                  styles.quickNavChip,
                  {
                    backgroundColor: expandedSection === section.id 
                      ? theme.gold.primary 
                      : theme.background.secondary,
                    borderColor: expandedSection === section.id 
                      ? theme.gold.primary 
                      : theme.border.primary,
                  }
                ]}
                onPress={() => toggleSection(section.id)}
              >
                <Ionicons 
                  name={section.icon as any} 
                  size={16} 
                  color={expandedSection === section.id ? 'white' : theme.text.secondary} 
                />
                <Text
                  style={[
                    styles.quickNavChipText,
                    { color: expandedSection === section.id ? 'white' : theme.text.secondary }
                  ]}
                  numberOfLines={2}
                >
                  {section.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Policy Sections */}
        <View style={styles.sectionsContainer}>
          {policySections.map((section, index) => (
            <View
              key={section.id}
              style={[
                styles.sectionCard,
                {
                  backgroundColor: theme.background.secondary,
                  borderColor: theme.border.primary,
                }
              ]}
            >
              <TouchableOpacity
                style={styles.sectionHeader}
                onPress={() => toggleSection(section.id)}
              >
                <View style={styles.sectionHeaderContent}>
                  <View style={[
                    styles.sectionIcon,
                    { backgroundColor: theme.gold.background }
                  ]}>
                    <Ionicons
                      name={section.icon as any}
                      size={20}
                      color={theme.gold.primary}
                    />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <Text style={[styles.sectionNumber, { color: theme.text.tertiary }]}>
                      {String(index + 1).padStart(2, '0')}
                    </Text>
                    <Text style={[styles.sectionTitleText, { color: theme.text.primary }]}>
                      {section.title}
                    </Text>
                  </View>
                </View>
                <Ionicons
                  name={expandedSection === section.id ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.text.secondary}
                />
              </TouchableOpacity>

              {expandedSection === section.id && (
                <View style={[styles.sectionContent, { borderTopColor: theme.border.primary }]}>
                  <Text style={[styles.contentText, { color: theme.text.secondary }]}>
                    {section.content}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.border.primary }]}>
          <View style={styles.footerContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color={theme.gold.primary} />
            <View style={styles.footerText}>
              <Text style={[styles.footerTitle, { color: theme.text.primary }]}>
                Questions about your privacy?
              </Text>
              <Text style={[styles.footerSubtitle, { color: theme.text.secondary }]}>
                Contact us anytime at privacy@receiptgold.com
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.contactButton, { backgroundColor: theme.gold.primary }]}
            onPress={() => navigation.navigate('ContactSupport')}
          >
            <Text style={styles.contactButtonText}>Contact Support</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  lastUpdatedText: {
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  quickNavSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  quickNavContainer: {
    paddingRight: 20,
  },
  quickNavChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 120,
  },
  quickNavChipText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
    textAlign: 'center',
    lineHeight: 14,
  },
  sectionsContainer: {
    marginBottom: 32,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionNumber: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 1,
  },
  sectionTitleText: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  contentText: {
    fontSize: 14,
    lineHeight: 20,
    paddingTop: 16,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: 24,
    alignItems: 'center',
  },
  footerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  footerText: {
    flex: 1,
    marginLeft: 12,
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSubtitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  contactButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
  },
  contactButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});
