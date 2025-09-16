import React, { useState, useRef } from 'react';
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
  content: PolicyContent[];
  icon: string;
}

interface PolicyContent {
  type: 'header' | 'text' | 'list';
  text?: string;
  items?: string[];
}

const policySections: PolicySection[] = [
  {
    id: '1',
    title: 'Information We Collect',
    icon: 'information-circle-outline',
    content: [
      {
        type: 'text',
        text: 'We collect information you provide directly to us, such as when you create an account, scan receipts, or contact us for support.'
      },
      {
        type: 'header',
        text: 'Personal Information:'
      },
      {
        type: 'list',
        items: [
          'Email address and account credentials',
          'Name and business information (if provided)',
          'Payment information (processed securely through payment processing services)',
          'Device identifiers and push notification tokens',
          'Team member information when you invite collaborators'
        ]
      },
      {
        type: 'header',
        text: 'Receipt Data:'
      },
      {
        type: 'list',
        items: [
          'Photos of receipts you scan using camera or image picker',
          'Extracted text and data from receipts (processed via AI/OCR)',
          'Categories and tags you assign',
          'Dates, amounts, vendor information, and tax details',
          'Receipt metadata (location if enabled, timestamp)'
        ]
      },
      {
        type: 'header',
        text: 'Usage Information:'
      },
      {
        type: 'list',
        items: [
          'How you interact with our app features',
          'Subscription tier and billing information',
          'Team management activities',
          'Device information (model, OS version, platform)',
          'App performance metrics and crash reports',
          'Feature usage analytics and user preferences'
        ]
      },
      {
        type: 'header',
        text: 'Financial Data (Professional users):'
      },
      {
        type: 'list',
        items: [
          'Bank transaction data (via financial services integration providers)',
          'Account balances and transaction history',
          'This data is encrypted in transit and not permanently stored',
          'Financial connections are tokenized for security'
        ]
      },
      {
        type: 'header',
        text: 'Team Data:'
      },
      {
        type: 'list',
        items: [
          'Business information for team accounts',
          'Team member roles and permissions',
          'Invitation tokens and collaboration history',
          'Team usage statistics and billing information'
        ]
      }
    ]
  },
  {
    id: '2',
    title: 'How We Use Your Information',
    icon: 'settings-outline',
    content: [
      {
        type: 'text',
        text: 'We use your information to provide, maintain, and improve ReceiptGold\'s services.'
      },
      {
        type: 'header',
        text: 'Core Services:'
      },
      {
        type: 'list',
        items: [
          'Process and organize your receipt data using AI/OCR technology',
          'Generate expense reports and tax documents in multiple formats',
          'Sync your data across devices using cloud infrastructure and database services',
          'Provide customer support and troubleshooting',
          'Manage team accounts and collaboration features',
          'Process subscription payments through subscription and payment processing services'
        ]
      },
      {
        type: 'header',
        text: 'Service Improvement:'
      },
      {
        type: 'list',
        items: [
          'Analyze usage patterns to improve features and performance',
          'Develop new functionality based on user needs and feedback',
          'Ensure app stability through crash reporting and monitoring',
          'Prevent fraud, abuse, and unauthorized access',
          'Optimize AI models for better receipt processing accuracy'
        ]
      },
      {
        type: 'header',
        text: 'Communications:'
      },
      {
        type: 'list',
        items: [
          'Send important service updates and security notifications',
          'Respond to your support requests and feedback',
          'Send push notifications for app updates (with your consent)',
          'Send billing and subscription notifications',
          'Facilitate team invitations and collaboration'
        ]
      },
      {
        type: 'header',
        text: 'Legal and Compliance:'
      },
      {
        type: 'list',
        items: [
          'Comply with applicable laws and regulations',
          'Respond to legal requests and government inquiries',
          'Protect our rights and investigate potential violations',
          'Maintain audit trails for security purposes'
        ]
      },
      {
        type: 'text',
        text: 'We never sell your personal information to third parties or use it for advertising purposes outside of our own service improvements.'
      }
    ]
  },
  {
    id: '3',
    title: 'Data Storage & Security',
    icon: 'shield-checkmark-outline',
    content: [
      {
        type: 'text',
        text: 'Your data security is our top priority. We implement industry-standard security measures.'
      },
      {
        type: 'header',
        text: 'Encryption:'
      },
      {
        type: 'list',
        items: [
          'All data is encrypted in transit using TLS 1.3',
          'Receipt images are encrypted at rest in cloud storage services',
          'Database connections use encrypted protocols',
          'API communications are secured end-to-end',
          'Payment data is tokenized and never stored locally'
        ]
      },
      {
        type: 'header',
        text: 'Storage:'
      },
      {
        type: 'list',
        items: [
          'Data is stored on secure cloud infrastructure providers',
          'Servers are located in secure, compliant data centers',
          'Regular security audits and vulnerability assessments',
          'Automated backups with encryption and versioning',
          'Geographic redundancy for data protection'
        ]
      },
      {
        type: 'header',
        text: 'Access Controls:'
      },
      {
        type: 'list',
        items: [
          'Multi-factor authentication for our development team',
          'Role-based access controls with principle of least privilege',
          'Regular access reviews and security updates',
          'Comprehensive logging and monitoring of all data access',
          'Secure service account keys with rotation policies'
        ]
      },
      {
        type: 'header',
        text: 'Application Security:'
      },
      {
        type: 'list',
        items: [
          'React Native app with secure coding practices',
          'Device-level security features (biometric authentication)',
          'Secure token management for API access',
          'Regular security testing and code reviews',
          'Vulnerability scanning and penetration testing'
        ]
      },
      {
        type: 'header',
        text: 'Data Retention:'
      },
      {
        type: 'list',
        items: [
          'Receipt data is retained while your account is active',
          'Deleted data is permanently removed within 30 days',
          'You can request immediate data deletion at any time',
          'Financial connection data is not permanently stored',
          'Team data is retained for audit and compliance purposes',
          'Backup data follows the same retention policies'
        ]
      }
    ]
  },
  {
    id: '4',
    title: 'Third-Party Services',
    icon: 'link-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold integrates with trusted third-party services to provide enhanced functionality.'
      },
      {
        type: 'header',
        text: 'Financial Services Integration Providers:'
      },
      {
        type: 'list',
        items: [
          'Used for secure bank account connections in Professional tier',
          'Transaction data is encrypted and transmitted securely',
          'We don\'t store your banking credentials or account numbers',
          'Connections use tokenized access that can be revoked anytime',
          'Subject to respective provider privacy policies and security measures'
        ]
      },
      {
        type: 'header',
        text: 'Subscription and Payment Processing Services:'
      },
      {
        type: 'list',
        items: [
          'Handle all subscription billing and payment processing',
          'Integrate with Apple App Store and Google Play Store',
          'Your payment information is never stored on our servers',
          'Provide secure subscription validation and receipt verification',
          'Subject to respective provider privacy policies'
        ]
      },
      {
        type: 'header',
        text: 'Cloud Infrastructure and Database Services:'
      },
      {
        type: 'list',
        items: [
          'Provide secure data storage, authentication, and cloud functions',
          'Real-time database synchronization across devices',
          'Push notification services for app updates',
          'Servers located in secure, compliant data centers worldwide',
          'Automatic scaling, monitoring, and backup capabilities',
          'Subject to industry-leading privacy and security standards'
        ]
      },
      {
        type: 'header',
        text: 'AI and Machine Learning Processing Services:'
      },
      {
        type: 'list',
        items: [
          'Used to extract text and data from receipt images',
          'Receipt images are processed using machine learning models',
          'Images are processed securely and not permanently stored by providers',
          'Data transmission is encrypted and time-limited',
          'Multiple providers may be used for optimal accuracy'
        ]
      },
      {
        type: 'header',
        text: 'Development and Distribution Platforms:'
      },
      {
        type: 'list',
        items: [
          'Provide app development and distribution infrastructure',
          'Handle app updates and development tools',
          'Subject to platform privacy policies and security standards',
          'Do not access user data within the app'
        ]
      },
      {
        type: 'header',
        text: 'Analytics and Performance Monitoring Services:'
      },
      {
        type: 'list',
        items: [
          'Monitor app performance and crash reporting',
          'Analyze usage patterns for service improvement',
          'Provide anonymized analytics data',
          'Help ensure app stability and optimal user experience'
        ]
      },
      {
        type: 'header',
        text: 'Device and Platform Services:'
      },
      {
        type: 'list',
        items: [
          'Camera and image picker functionality',
          'Device storage and file system access',
          'Push notification services',
          'App store distribution and update mechanisms'
        ]
      },
      {
        type: 'text',
        text: 'We carefully vet all third-party services and ensure they meet our security standards before integration. For a current list of our data processing partners and subprocessors, please visit: https://receiptgold.com/data-processors'
      }
    ]
  },
  {
    id: '5',
    title: 'Your Privacy Rights',
    icon: 'person-outline',
    content: [
      {
        type: 'text',
        text: 'You have full control over your personal information and privacy settings.'
      },
      {
        type: 'header',
        text: 'Access & Download:'
      },
      {
        type: 'list',
        items: [
          'View all data we have about you',
          'Download your receipt data and reports',
          'Request a complete data export',
          'Access your account information anytime'
        ]
      },
      {
        type: 'header',
        text: 'Correction & Updates:'
      },
      {
        type: 'list',
        items: [
          'Update your profile information',
          'Correct any inaccurate receipt data',
          'Modify your preferences and settings',
          'Change your email or password'
        ]
      },
      {
        type: 'header',
        text: 'Deletion Rights:'
      },
      {
        type: 'list',
        items: [
          'Delete individual receipts or data',
          'Close your account and delete all data',
          'Request immediate data purging',
          'Export data before deletion'
        ]
      },
      {
        type: 'header',
        text: 'Privacy Controls:'
      },
      {
        type: 'list',
        items: [
          'Control email notifications and communications',
          'Manage data sharing preferences',
          'Set up two-factor authentication',
          'Review connected services and permissions'
        ]
      },
      {
        type: 'header',
        text: 'California Residents (CCPA):'
      },
      {
        type: 'list',
        items: [
          'Right to know what personal information is collected',
          'Right to delete personal information',
          'Right to opt-out of sale (we don\'t sell data)',
          'Non-discrimination for exercising privacy rights'
        ]
      }
    ]
  },
  {
    id: '6',
    title: 'Data Sharing',
    icon: 'share-outline',
    content: [
      {
        type: 'text',
        text: 'We are committed to protecting your privacy and do not sell your personal information.'
      },
      {
        type: 'header',
        text: 'We Never Share:'
      },
      {
        type: 'list',
        items: [
          'Your personal receipt data with advertisers or marketers',
          'Individual transaction information with third parties',
          'Personal contact information for marketing purposes',
          'Financial account details or banking information',
          'Team collaboration data outside your organization'
        ]
      },
      {
        type: 'header',
        text: 'Limited Sharing Cases:'
      },
      {
        type: 'list',
        items: [
          'With your explicit consent for specific features',
          'When required by law or valid legal process',
          'To protect our rights and prevent fraud or abuse',
          'With authorized service providers under strict data processing agreements',
          'For team features when you invite team members'
        ]
      },
      {
        type: 'header',
        text: 'Service Providers (Data Processors):'
      },
      {
        type: 'list',
        items: [
          'Cloud infrastructure and database services (encrypted data only)',
          'Subscription and payment processing services (for billing and subscription management)',
          'AI and machine learning processing services (for receipt text extraction - temporary processing only)',
          'Customer support tools (when you contact us for assistance)',
          'Analytics services (anonymized usage data for app improvement)',
          'Security monitoring services (for fraud prevention and system protection)'
        ]
      },
      {
        type: 'header',
        text: 'Team Features:'
      },
      {
        type: 'list',
        items: [
          'Data shared within your team is controlled by your team settings',
          'Team administrators can access team member receipt data as configured',
          'Business information is shared with invited team members',
          'Team usage statistics may be shared with account holders'
        ]
      },
      {
        type: 'header',
        text: 'Business Transfers:'
      },
      {
        type: 'list',
        items: [
          'In case of merger, acquisition, or business restructuring',
          'Your data rights and protections would be maintained',
          'You would be notified of any material changes',
          'Option to delete data before transfer if legally permissible'
        ]
      },
      {
        type: 'header',
        text: 'Legal Requirements:'
      },
      {
        type: 'list',
        items: [
          'Court orders or valid legal subpoenas',
          'Government requests where legally required and appropriate',
          'To protect safety and prevent harm to users or others',
          'To investigate fraud or violations of our terms',
          'Always reviewed by legal counsel before compliance'
        ]
      }
    ]
  },
  {
    id: '7',
    title: 'International Users',
    icon: 'globe-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold is available globally, and we comply with international privacy regulations.'
      },
      {
        type: 'header',
        text: 'GDPR Compliance (EU Users):'
      },
      {
        type: 'list',
        items: [
          'Lawful basis for data processing',
          'Right to access, rectify, and erase data',
          'Right to data portability',
          'Right to object to processing',
          'Data Protection Officer available for contact'
        ]
      },
      {
        type: 'header',
        text: 'Data Transfers:'
      },
      {
        type: 'list',
        items: [
          'Data may be processed in the United States',
          'We use appropriate safeguards for international transfers',
          'Standard Contractual Clauses with service providers',
          'Compliance with Privacy Shield principles'
        ]
      },
      {
        type: 'header',
        text: 'Local Laws:'
      },
      {
        type: 'list',
        items: [
          'We comply with applicable local privacy laws',
          'Regular review of international regulations',
          'Updates to practices as laws evolve',
          'Local data residency options where required'
        ]
      },
      {
        type: 'header',
        text: 'Contact for International Users:'
      },
      {
        type: 'list',
        items: [
          'EU users can contact our DPO directly',
          'Specific forms for GDPR requests',
          'Local language support where possible',
          'Recognition of all applicable privacy rights'
        ]
      }
    ]
  },
  {
    id: '8',
    title: 'Updates & Contact',
    icon: 'mail-outline',
    content: [
      {
        type: 'text',
        text: 'We may update this privacy policy from time to time to reflect changes in our practices.'
      },
      {
        type: 'header',
        text: 'Policy Updates:'
      },
      {
        type: 'list',
        items: [
          'We will notify you of material changes',
          'Updates posted on our website and in-app',
          'Continued use constitutes acceptance',
          'Previous versions available upon request'
        ]
      },
      {
        type: 'header',
        text: 'Effective Date:'
      },
      {
        type: 'text',
        text: 'This privacy policy is effective as of January 15, 2025.'
      },
      {
        type: 'header',
        text: 'How to Contact Us:'
      },
      {
        type: 'text',
        text: 'If you have questions about this privacy policy or our data practices:'
      },
      {
        type: 'list',
        items: [
          'Email: privacy@receiptgold.com',
          'Support: Through the app\'s Contact Support feature',
          'Mail: GregDavisTech, LLC\n  Privacy Team\n  123 Business Ave\n  San Francisco, CA 94102'
        ]
      },
      {
        type: 'header',
        text: 'Data Protection Officer:'
      },
      {
        type: 'list',
        items: [
          'EU users: dpo@receiptgold.com',
          'Response within 30 days',
          'Dedicated to privacy matters',
          'Available for all privacy-related questions'
        ]
      },
      {
        type: 'header',
        text: 'Data Processing Partners:'
      },
      {
        type: 'text',
        text: 'For a current list of our data processing partners and subprocessors, please visit: https://receiptgold.com/data-processors'
      },
      {
        type: 'text',
        text: 'We\'re committed to transparency and will always respond promptly to your privacy concerns and requests.'
      }
    ]
  }
];

export const PrivacyPolicyScreen: React.FC<PrivacyPolicyScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const [expandedSection, setExpandedSection] = useState<string | null>('1');
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<{ [key: string]: number }>({});

  const toggleSection = (id: string) => {
    const newExpandedSection = expandedSection === id ? null : id;
    setExpandedSection(newExpandedSection);

    // Scroll to section if expanding
    if (newExpandedSection && sectionPositions.current[id] !== undefined) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, sectionPositions.current[id] - 20),
          animated: true
        });
      }, 100); // Small delay to ensure section is expanded
    }
  };

  const handleSectionLayout = (id: string, event: any) => {
    const { y } = event.nativeEvent.layout;
    sectionPositions.current[id] = y;
  };

  const lastUpdated = 'January 15, 2025';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: theme.gold.background }]}>
            <Ionicons name="shield-checkmark-outline" size={80} color={theme.gold.primary} />
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
              onLayout={(event) => handleSectionLayout(section.id, event)}
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
                  {section.content.map((item, index) => {
                    if (item.type === 'header') {
                      return (
                        <Text key={index} style={[styles.contentHeader, { color: theme.text.primary }]}>
                          {item.text}
                        </Text>
                      );
                    } else if (item.type === 'text') {
                      return (
                        <Text key={index} style={[styles.contentText, { color: theme.text.secondary }]}>
                          {item.text}
                        </Text>
                      );
                    } else if (item.type === 'list') {
                      return (
                        <View key={index} style={styles.listContainer}>
                          {item.items?.map((listItem, listIndex) => (
                            <View key={listIndex} style={styles.listItem}>
                              <Text style={[styles.listBullet, { color: theme.gold.primary }]}>•</Text>
                              <Text style={[styles.listText, { color: theme.text.secondary }]}>
                                {listItem}
                              </Text>
                            </View>
                          ))}
                        </View>
                      );
                    }
                    return null;
                  })}
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
    marginBottom: 12,
  },
  contentHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  listContainer: {
    marginBottom: 16,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingLeft: 8,
  },
  listBullet: {
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8,
    marginTop: 1,
  },
  listText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
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
