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

interface TermsOfServiceScreenProps {
  navigation: any;
}

interface TermsSection {
  id: string;
  title: string;
  content: string;
  icon: string;
}

const termsSections: TermsSection[] = [
  {
    id: '1',
    title: 'Acceptance of Terms',
    icon: 'checkmark-circle-outline',
    content: `By downloading, installing, or using ReceiptGold ("the App"), you agree to be bound by these Terms of Service ("Terms").

**Agreement to Terms:**
• These Terms constitute a legal agreement between you and ReceiptGold
• If you don't agree to these Terms, you may not use our service
• Continued use of the App indicates acceptance of any updates to these Terms
• You must be at least 18 years old to use ReceiptGold

**Updates to Terms:**
• We may modify these Terms at any time
• Material changes will be communicated through the App
• Continued use after changes constitutes acceptance
• Previous versions are available upon request

**Applicable Law:**
• These Terms are governed by California law
• Any disputes will be resolved in California courts
• If any provision is invalid, the rest remain in effect
• These Terms supersede any previous agreements`
  },
  {
    id: '2',
    title: 'Service Description',
    icon: 'document-outline',
    content: `ReceiptGold provides digital receipt management and expense tracking services.

**Core Services:**
• Receipt scanning and digital storage
• Automatic data extraction using OCR technology
• Expense categorization and organization
• Tax report generation and export
• Cloud backup and multi-device synchronization
• Bank transaction monitoring (Professional tier)

**Service Availability:**
• We strive for 99.9% uptime but cannot guarantee uninterrupted service
• Scheduled maintenance will be communicated in advance
• Emergency maintenance may occur with minimal notice
• Service availability may vary by region

**Service Limitations:**
• OCR accuracy depends on receipt image quality
• Some features require internet connectivity
• Storage limits apply based on subscription tier
• Processing speed may vary based on system load

**Beta Features:**
• Some features may be in beta or testing phases
• Beta features are provided "as-is" without warranties
• We may discontinue beta features at any time
• Feedback on beta features is appreciated but not required`
  },
  {
    id: '3',
    title: 'User Accounts & Responsibilities',
    icon: 'person-outline',
    content: `You are responsible for your account and the information you provide.

**Account Creation:**
• You must provide accurate and complete information
• You're responsible for maintaining your login credentials
• One account per person or business entity
• You must notify us of any unauthorized account access

**User Responsibilities:**
• Keep your login information secure and confidential
• Use the service only for lawful purposes
• Don't share accounts or allow others to use your account
• Maintain accurate receipt and expense information
• Report any bugs or security issues promptly

**Prohibited Activities:**
• Uploading false, misleading, or fraudulent receipt data
• Attempting to hack, reverse engineer, or compromise the service
• Using the service to violate any laws or regulations
• Sharing copyrighted content without permission
• Creating fake accounts or impersonating others
• Transmitting viruses, malware, or malicious code

**Account Termination:**
• You may delete your account at any time
• We may suspend accounts for Terms violations
• Upon termination, your data will be deleted per our Privacy Policy
• Outstanding subscription fees remain due upon termination`
  },
  {
    id: '4',
    title: 'Subscription & Billing',
    icon: 'card-outline',
    content: `ReceiptGold offers multiple subscription tiers with different features and pricing.

**Subscription Tiers:**
• Free: Basic receipt scanning with monthly limits
• Growth ($4.99/month): Enhanced features and increased limits
• Professional ($9.99/month): Unlimited receipts and advanced features
• Pricing may vary by region and is subject to applicable taxes

**Billing Terms:**
• Subscriptions are billed monthly or annually in advance
• All fees are non-refundable except as required by law
• We use Stripe for secure payment processing
• Subscription auto-renews unless cancelled before renewal date

**Changes to Pricing:**
• We may change subscription prices with 30 days notice
• Existing subscribers will be notified before price changes take effect
• You may cancel before price changes to avoid new rates
• Grandfathered pricing may apply to existing subscribers

**Refund Policy:**
• Generally, all payments are final and non-refundable
• Exceptions may be made for technical issues preventing service use
• Refund requests must be made within 30 days of payment
• Refunds, if approved, will be processed through the original payment method

**Free Trial:**
• New users may be eligible for free trial periods
• Trial periods automatically convert to paid subscriptions
• Cancel before trial ends to avoid charges
• One trial per user or payment method`
  },
  {
    id: '5',
    title: 'Intellectual Property',
    icon: 'library-outline',
    content: `ReceiptGold and its content are protected by intellectual property laws.

**Our Intellectual Property:**
• The ReceiptGold app, website, and services are our property
• All trademarks, logos, and brand elements belong to us
• The software, algorithms, and user interface are proprietary
• You may not copy, modify, or redistribute our intellectual property

**Your Content:**
• You retain ownership of receipt images and data you upload
• You grant us license to process, store, and display your content
• This license is necessary to provide our services
• You can revoke this license by deleting your content or account

**Third-Party Content:**
• Some features may include third-party content or services
• Third-party content is subject to separate terms and licenses
• We don't claim ownership of third-party intellectual property
• Report any copyright infringement to legal@receiptgold.com

**DMCA Policy:**
• We comply with the Digital Millennium Copyright Act
• Submit takedown notices to legal@receiptgold.com
• Include all required DMCA information in your notice
• False claims may result in legal liability

**License to Use:**
• We grant you a limited, non-exclusive license to use ReceiptGold
• This license is personal and non-transferable
• You may not sublicense or resell access to our services
• This license terminates when your account is closed`
  },
  {
    id: '6',
    title: 'Data & Privacy',
    icon: 'shield-outline',
    content: `Your privacy and data security are important to us, as detailed in our Privacy Policy.

**Data Collection:**
• We collect information as described in our Privacy Policy
• Receipt images and extracted data are encrypted and secured
• Usage analytics help us improve the service
• You control what data you share with us

**Data Use:**
• We use your data to provide and improve our services
• We don't sell your personal information to third parties
• Data may be shared with service providers under strict contracts
• You can request data deletion at any time

**Data Security:**
• We implement industry-standard security measures
• All data transmission is encrypted using modern protocols
• Regular security audits ensure ongoing protection
• We promptly address any security vulnerabilities

**Data Retention:**
• We retain your data while your account is active
• Deleted data is permanently removed within 30 days
• Some data may be retained for legal or regulatory requirements
• You can export your data before account deletion

**International Transfers:**
• Your data may be processed in the United States
• We comply with applicable international privacy laws
• Appropriate safeguards protect data during transfers
• EU users have specific rights under GDPR`
  },
  {
    id: '7',
    title: 'Disclaimers & Limitations',
    icon: 'warning-outline',
    content: `ReceiptGold is provided "as-is" with certain limitations on our liability.

**Service Disclaimers:**
• We provide the service "as-is" without warranties of any kind
• We don't guarantee uninterrupted or error-free operation
• OCR accuracy may vary based on image quality
• Third-party integrations are subject to their own terms and availability

**No Tax or Legal Advice:**
• ReceiptGold is a tool for organizing receipts and expenses
• We don't provide tax, legal, or financial advice
• Consult qualified professionals for tax and legal guidance
• You're responsible for compliance with applicable laws

**Limitation of Liability:**
• Our liability is limited to the amount you paid for the service
• We're not liable for indirect, incidental, or consequential damages
• This includes loss of data, profits, or business opportunities
• Some jurisdictions don't allow liability limitations

**Force Majeure:**
• We're not liable for delays caused by circumstances beyond our control
• This includes natural disasters, government actions, or technical failures
• Service credits may be provided for extended outages
• We'll communicate service disruptions as soon as possible

**Indemnification:**
• You agree to indemnify us against claims arising from your use of the service
• This includes claims related to your content or Terms violations
• We'll notify you of any claims and cooperate in defense
• This obligation survives termination of these Terms`
  },
  {
    id: '8',
    title: 'Termination & Contact',
    icon: 'mail-outline',
    content: `These Terms remain effective until terminated by either party.

**Termination by You:**
• You may terminate your account at any time through app settings
• Cancellation stops future billing but doesn't refund past charges
• Your data will be deleted according to our Privacy Policy
• Downloaded reports remain accessible after termination

**Termination by Us:**
• We may terminate accounts for Terms violations
• We may discontinue the service with reasonable notice
• Paid subscribers will receive refunds for unused subscription time
• We'll provide data export opportunities before termination

**Effect of Termination:**
• Your license to use ReceiptGold ends immediately
• You must stop using the service and delete any copies
• Provisions regarding liability and indemnification survive termination
• Outstanding payment obligations remain due

**Effective Date:**
These Terms of Service are effective as of August 16, 2025.

**Contact Information:**
For questions about these Terms:

• Email: legal@receiptgold.com
• Support: Through the app's Contact Support feature
• Address: ReceiptGold Legal Department
  123 Business Ave
  San Francisco, CA 94102

**Dispute Resolution:**
• We encourage resolving disputes through direct communication
• California law governs these Terms
• Disputes will be resolved in California state or federal courts
• You may have rights to arbitration under applicable law

**Severability:**
If any provision of these Terms is found invalid, the remaining provisions continue in full force and effect.`
  }
];

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
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
            <Ionicons name="document-text-outline" size={80} color={theme.gold.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Terms of Service
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            These terms govern your use of ReceiptGold. Please read them carefully.
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
            {termsSections.map((section) => (
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

        {/* Terms Sections */}
        <View style={styles.sectionsContainer}>
          {termsSections.map((section, index) => (
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
            <Ionicons name="document-text-outline" size={24} color={theme.gold.primary} />
            <View style={styles.footerText}>
              <Text style={[styles.footerTitle, { color: theme.text.primary }]}>
                Questions about these terms?
              </Text>
              <Text style={[styles.footerSubtitle, { color: theme.text.secondary }]}>
                Contact us anytime at legal@receiptgold.com
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
    width: 80,
    height: 80,
    borderRadius: 20,
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
    justifyContent: 'center',
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
