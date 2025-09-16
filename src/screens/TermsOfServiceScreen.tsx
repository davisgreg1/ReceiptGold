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

interface TermsOfServiceScreenProps {
  navigation: any;
}

interface TermsSection {
  id: string;
  title: string;
  content: TermsContent[];
  icon: string;
}

interface TermsContent {
  type: 'header' | 'text' | 'list';
  text?: string;
  items?: string[];
}

const termsSections: TermsSection[] = [
  {
    id: '1',
    title: 'Acceptance of Terms',
    icon: 'checkmark-circle-outline',
    content: [
      {
        type: 'text',
        text: 'By downloading, installing, or using ReceiptGold ("the App"), you agree to be bound by these Terms of Service ("Terms").'
      },
      {
        type: 'header',
        text: 'Agreement to Terms:'
      },
      {
        type: 'list',
        items: [
          'These Terms constitute a legal agreement between you and GregDavisTech, LLC',
          'If you don\'t agree to these Terms, you may not use our service',
          'Continued use of the App indicates acceptance of any updates to these Terms',
          'You must be at least 18 years old or have parental consent to use ReceiptGold',
          'Business users must have authority to bind their organization to these Terms'
        ]
      },
      {
        type: 'header',
        text: 'Updates to Terms:'
      },
      {
        type: 'list',
        items: [
          'We may modify these Terms at any time with reasonable notice',
          'Material changes will be communicated through the App and email',
          'Continued use after changes constitutes acceptance',
          'Previous versions are available upon request',
          'We will provide 30 days notice for material changes affecting paid users'
        ]
      },
      {
        type: 'header',
        text: 'Applicable Law:'
      },
      {
        type: 'list',
        items: [
          'These Terms are governed by California law, without regard to conflict of law principles',
          'Any disputes will be resolved in California state or federal courts',
          'If any provision is invalid or unenforceable, the rest remain in effect',
          'These Terms supersede any previous agreements or communications',
          'Both parties consent to the jurisdiction of California courts'
        ]
      }
    ]
  },
  {
    id: '2',
    title: 'Service Description',
    icon: 'document-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold provides comprehensive digital receipt management and expense tracking services for individuals and teams.'
      },
      {
        type: 'header',
        text: 'Core Services:'
      },
      {
        type: 'list',
        items: [
          'Receipt scanning using device camera or image picker',
          'AI-powered OCR technology for automatic data extraction',
          'Intelligent expense categorization and organization',
          'Tax report generation and export in multiple formats (PDF, CSV, Excel)',
          'Real-time cloud backup and multi-device synchronization',
          'Team collaboration and business management features',
          'Bank transaction monitoring and matching via financial services integration providers (Professional tier)',
          'Subscription management through subscription management services'
        ]
      },
      {
        type: 'header',
        text: 'Subscription Tiers:'
      },
      {
        type: 'list',
        items: [
          'Free: Limited receipts per month with basic features',
          'Starter: Enhanced features with increased receipt limits',
          'Growth: Advanced reporting, analytics, and integrations',
          'Professional: Unlimited features, advanced team management, and priority support',
          'Teammate: Special access for team members of Professional accounts'
        ]
      },
      {
        type: 'header',
        text: 'Service Availability:'
      },
      {
        type: 'list',
        items: [
          'We strive for 99.9% uptime but cannot guarantee uninterrupted service',
          'Scheduled maintenance will be communicated in advance via app and email',
          'Emergency maintenance may occur with minimal notice',
          'Service availability may vary by region due to infrastructure',
          'Mobile app works offline with data sync when connection resumes'
        ]
      },
      {
        type: 'header',
        text: 'Service Limitations:'
      },
      {
        type: 'list',
        items: [
          'OCR accuracy depends on receipt image quality and legibility',
          'Some features require internet connectivity for full functionality',
          'Storage and processing limits apply based on subscription tier',
          'Processing speed may vary based on system load and device performance',
          'AI extraction accuracy may vary by receipt type and language',
          'Team features require Professional tier subscription'
        ]
      },
      {
        type: 'header',
        text: 'Beta and Experimental Features:'
      },
      {
        type: 'list',
        items: [
          'Some features may be in beta, preview, or testing phases',
          'Beta features are provided "as-is" without warranties or SLA guarantees',
          'We may discontinue, modify, or graduate beta features at any time',
          'Feedback on beta features is appreciated and helps improve the service',
          'Beta features may have additional limitations or usage restrictions'
        ]
      }
    ]
  },
  {
    id: '3',
    title: 'User Accounts & Responsibilities',
    icon: 'person-outline',
    content: [
      {
        type: 'text',
        text: 'You are responsible for your account and the information you provide to ReceiptGold.'
      },
      {
        type: 'header',
        text: 'Account Creation:'
      },
      {
        type: 'list',
        items: [
          'You must provide accurate, current, and complete information',
          'You\'re responsible for maintaining your login credentials and account security',
          'One account per person or business entity (team accounts managed separately)',
          'You must notify us immediately of any unauthorized account access',
          'Business accounts must be created by authorized representatives',
          'Team members require valid invitations from account holders'
        ]
      },
      {
        type: 'header',
        text: 'User Responsibilities:'
      },
      {
        type: 'list',
        items: [
          'Keep your login information secure and confidential',
          'Use the service only for lawful business and personal expense tracking purposes',
          'Don\'t share accounts or allow unauthorized access to your account',
          'Maintain accurate receipt and expense information for your records',
          'Report any bugs, security issues, or vulnerabilities promptly',
          'Comply with applicable tax laws and regulations in your jurisdiction',
          'Respect team member access controls and permissions',
          'Keep your subscription and billing information current'
        ]
      },
      {
        type: 'header',
        text: 'Prohibited Activities:'
      },
      {
        type: 'list',
        items: [
          'Uploading false, misleading, or fraudulent receipt data',
          'Attempting to hack, reverse engineer, or compromise the service',
          'Using the service to violate any laws, regulations, or third-party rights',
          'Sharing copyrighted content without proper authorization',
          'Creating fake accounts, impersonating others, or providing false identity information',
          'Transmitting viruses, malware, or any malicious code',
          'Attempting to access other users\' accounts or data without authorization',
          'Using the service for any illegal financial activities or money laundering',
          'Circumventing subscription limits or attempting to defraud our billing system',
          'Scraping, crawling, or automated data extraction from our services',
          'Reselling or redistributing our services without authorization'
        ]
      },
      {
        type: 'header',
        text: 'Team Account Responsibilities:'
      },
      {
        type: 'list',
        items: [
          'Account holders are responsible for managing team member access',
          'Ensure team members comply with these Terms and your organization\'s policies',
          'Monitor team usage and maintain appropriate subscription levels',
          'Properly configure team permissions and data access controls',
          'Remove team member access when employment or collaboration ends'
        ]
      },
      {
        type: 'header',
        text: 'Account Termination:'
      },
      {
        type: 'list',
        items: [
          'You may delete your account at any time through app settings or by contacting support',
          'We may suspend or terminate accounts for Terms violations after appropriate notice',
          'Upon termination, your data will be deleted according to our Privacy Policy',
          'Outstanding subscription fees remain due upon termination',
          'You may export your data before account deletion',
          'Terminated accounts cannot be reactivated; you must create a new account'
        ]
      }
    ]
  },
  {
    id: '4',
    title: 'Subscription & Billing',
    icon: 'card-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold offers multiple subscription tiers with different features and varying prices based on tier and billing period. Current pricing information is available in the mobile app.'
      },
      {
        type: 'header',
        text: 'Subscription Tiers:'
      },
      {
        type: 'list',
        items: [
          'Free: Limited receipts per month with basic features and email support',
          'Starter: Paid monthly subscription with unlimited storage, LLC categories, and educational content',
          'Growth: Paid monthly or annual subscription with advanced reporting, integrations, and priority support',
          'Professional: Paid monthly or annual subscription with multi-business management, advanced team features, and dedicated support',
          'Teammate: Free access for team members invited by Professional account holders',
          'Subscription pricing varies by tier and billing period - current prices are displayed in the app',
          'Pricing may vary by region and is subject to applicable taxes and app store fees',
          'All pricing is subject to change with advance notice as described in our pricing change policy'
        ]
      },
      {
        type: 'header',
        text: 'Billing Terms:'
      },
      {
        type: 'list',
        items: [
          'Subscriptions are processed through device app stores',
          'Billing is handled by subscription management services and your device\'s app store payment method',
          'Subscriptions are billed monthly or annually in advance',
          'All fees are non-refundable except as required by law or app store policies',
          'Subscription auto-renews unless cancelled before renewal date through your device\'s subscription settings',
          'Taxes and fees are determined by your location and app store policies'
        ]
      },
      {
        type: 'header',
        text: 'Changes to Pricing:'
      },
      {
        type: 'list',
        items: [
          'We may change subscription prices with 30 days advance notice',
          'Existing subscribers will be notified before price changes take effect',
          'You may cancel before price changes to avoid new rates',
          'Grandfathered pricing may apply to existing subscribers at our discretion',
          'Price changes are subject to app store approval processes'
        ]
      },
      {
        type: 'header',
        text: 'Refund Policy:'
      },
      {
        type: 'list',
        items: [
          'Generally, all payments are final and non-refundable',
          'Refund requests must be made through your device\'s app store (Apple App Store or Google Play)',
          'We cannot process refunds directly; all refunds are handled by app stores',
          'Exceptions may be made for technical issues preventing service use',
          'Refund requests should be made within 30 days of payment',
          'Contact our support team for assistance with refund requests'
        ]
      },
      {
        type: 'header',
        text: 'Free Trial and Promotions:'
      },
      {
        type: 'list',
        items: [
          'New users may be eligible for free trial periods as offered by app stores',
          'Trial periods automatically convert to paid subscriptions unless cancelled',
          'Cancel through your device\'s subscription settings before trial ends to avoid charges',
          'One trial per user or payment method',
          'Promotional pricing may be offered at our discretion',
          'Promotional terms may have additional restrictions'
        ]
      },
      {
        type: 'header',
        text: 'Team Billing:'
      },
      {
        type: 'list',
        items: [
          'Professional account holders are responsible for their team\'s usage',
          'Team members cannot have active individual subscriptions',
          'Account holders manage team size and access through subscription settings',
          'Team member limits may apply based on subscription tier'
        ]
      }
    ]
  },
  {
    id: '5',
    title: 'Intellectual Property',
    icon: 'library-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold and its content are protected by intellectual property laws.'
      },
      {
        type: 'header',
        text: 'Our Intellectual Property:'
      },
      {
        type: 'list',
        items: [
          'The ReceiptGold app, website, and services are our property',
          'All trademarks, logos, and brand elements belong to us',
          'The software, algorithms, and user interface are proprietary',
          'You may not copy, modify, or redistribute our intellectual property'
        ]
      },
      {
        type: 'header',
        text: 'Your Content:'
      },
      {
        type: 'list',
        items: [
          'You retain ownership of receipt images and data you upload',
          'You grant us license to process, store, and display your content',
          'This license is necessary to provide our services',
          'You can revoke this license by deleting your content or account'
        ]
      },
      {
        type: 'header',
        text: 'Third-Party Content:'
      },
      {
        type: 'list',
        items: [
          'Some features may include third-party content or services',
          'Third-party content is subject to separate terms and licenses',
          'We don\'t claim ownership of third-party intellectual property',
          'Report any copyright infringement to legal@receiptgold.com'
        ]
      },
      {
        type: 'header',
        text: 'DMCA Policy:'
      },
      {
        type: 'list',
        items: [
          'We comply with the Digital Millennium Copyright Act',
          'Submit takedown notices to legal@receiptgold.com',
          'Include all required DMCA information in your notice',
          'False claims may result in legal liability'
        ]
      },
      {
        type: 'header',
        text: 'License to Use:'
      },
      {
        type: 'list',
        items: [
          'We grant you a limited, non-exclusive license to use ReceiptGold',
          'This license is personal and non-transferable',
          'You may not sublicense or resell access to our services',
          'This license terminates when your account is closed'
        ]
      }
    ]
  },
  {
    id: '6',
    title: 'Data & Privacy',
    icon: 'shield-outline',
    content: [
      {
        type: 'text',
        text: 'Your privacy and data security are important to us, as detailed in our Privacy Policy.'
      },
      {
        type: 'header',
        text: 'Data Collection:'
      },
      {
        type: 'list',
        items: [
          'We collect information as described in our Privacy Policy',
          'Receipt images and extracted data are encrypted and secured',
          'Usage analytics help us improve the service',
          'You control what data you share with us'
        ]
      },
      {
        type: 'header',
        text: 'Data Use:'
      },
      {
        type: 'list',
        items: [
          'We use your data to provide and improve our services',
          'We don\'t sell your personal information to third parties',
          'Data may be shared with service providers under strict contracts',
          'You can request data deletion at any time'
        ]
      },
      {
        type: 'header',
        text: 'Data Security:'
      },
      {
        type: 'list',
        items: [
          'We implement industry-standard security measures',
          'All data transmission is encrypted using modern protocols',
          'Regular security audits ensure ongoing protection',
          'We promptly address any security vulnerabilities'
        ]
      },
      {
        type: 'header',
        text: 'Data Retention:'
      },
      {
        type: 'list',
        items: [
          'We retain your data while your account is active',
          'Deleted data is permanently removed within 30 days',
          'Some data may be retained for legal or regulatory requirements',
          'You can export your data before account deletion'
        ]
      },
      {
        type: 'header',
        text: 'International Transfers:'
      },
      {
        type: 'list',
        items: [
          'Your data may be processed in the United States',
          'We comply with applicable international privacy laws',
          'Appropriate safeguards protect data during transfers',
          'EU users have specific rights under GDPR'
        ]
      }
    ]
  },
  {
    id: '7',
    title: 'Disclaimers & Limitations',
    icon: 'warning-outline',
    content: [
      {
        type: 'text',
        text: 'ReceiptGold is provided "as-is" with certain limitations on our liability and warranties.'
      },
      {
        type: 'header',
        text: 'Service Disclaimers:'
      },
      {
        type: 'list',
        items: [
          'We provide the service "as-is" and "as-available" without warranties of any kind',
          'We don\'t guarantee uninterrupted, error-free, or completely secure operation',
          'AI/OCR accuracy may vary based on image quality, receipt type, and language',
          'Third-party integrations (financial services, app stores, cloud infrastructure providers) are subject to their own terms and availability',
          'Mobile app functionality depends on device capabilities and operating system versions',
          'Data synchronization depends on internet connectivity and may experience delays'
        ]
      },
      {
        type: 'header',
        text: 'No Professional Advice:'
      },
      {
        type: 'list',
        items: [
          'ReceiptGold is a tool for organizing receipts and tracking expenses',
          'We don\'t provide tax, legal, accounting, or financial advice',
          'Our categorizations and reports are suggestions, not professional recommendations',
          'Consult qualified professionals for tax preparation, legal guidance, and financial planning',
          'You\'re responsible for compliance with applicable laws, regulations, and tax requirements',
          'Always verify AI-extracted data for accuracy before using for official purposes'
        ]
      },
      {
        type: 'header',
        text: 'Data and Accuracy Disclaimers:'
      },
      {
        type: 'list',
        items: [
          'While we strive for accuracy, AI/OCR processing may contain errors',
          'You\'re responsible for reviewing and verifying all extracted data',
          'We don\'t guarantee the completeness or accuracy of receipt processing',
          'Currency conversions and calculations are estimates only',
          'Tax category suggestions may not be appropriate for your specific situation',
          'Bank transaction matching may have false positives or missed matches'
        ]
      },
      {
        type: 'header',
        text: 'Limitation of Liability:'
      },
      {
        type: 'list',
        items: [
          'Our total liability is limited to the amount you paid for the service in the 12 months preceding the claim',
          'We\'re not liable for indirect, incidental, consequential, special, or punitive damages',
          'This includes loss of data, profits, business opportunities, or revenue',
          'We\'re not liable for damages caused by third-party services or integrations',
          'Some jurisdictions don\'t allow liability limitations, so these may not apply to you',
          'Our liability limitations apply even if we\'ve been advised of the possibility of such damages'
        ]
      },
      {
        type: 'header',
        text: 'Force Majeure:'
      },
      {
        type: 'list',
        items: [
          'We\'re not liable for delays or failures caused by circumstances beyond our reasonable control',
          'This includes natural disasters, government actions, pandemics, or technical infrastructure failures',
          'Third-party service outages (app stores, cloud providers, payment processors)',
          'Internet connectivity issues or mobile network problems',
          'Service credits may be provided for extended outages at our discretion',
          'We\'ll communicate service disruptions through available channels as soon as possible'
        ]
      },
      {
        type: 'header',
        text: 'Indemnification:'
      },
      {
        type: 'list',
        items: [
          'You agree to indemnify and hold us harmless from claims arising from your use of the service',
          'This includes claims related to your content, data, or violations of these Terms',
          'Claims arising from your team members\' use of the service (for team accounts)',
          'Violations of third-party rights or applicable laws through your use of the service',
          'We\'ll notify you of any claims and reasonably cooperate in defense',
          'This obligation survives termination of these Terms and your account'
        ]
      }
    ]
  },
  {
    id: '8',
    title: 'Termination & Contact',
    icon: 'mail-outline',
    content: [
      {
        type: 'text',
        text: 'These Terms remain effective until terminated by either party.'
      },
      {
        type: 'header',
        text: 'Termination by You:'
      },
      {
        type: 'list',
        items: [
          'You may terminate your account at any time through app settings',
          'Cancellation stops future billing but doesn\'t refund past charges',
          'Your data will be deleted according to our Privacy Policy',
          'Downloaded reports remain accessible after termination'
        ]
      },
      {
        type: 'header',
        text: 'Termination by Us:'
      },
      {
        type: 'list',
        items: [
          'We may terminate accounts for Terms violations',
          'We may discontinue the service with reasonable notice',
          'Paid subscribers will receive refunds for unused subscription time',
          'We\'ll provide data export opportunities before termination'
        ]
      },
      {
        type: 'header',
        text: 'Effect of Termination:'
      },
      {
        type: 'list',
        items: [
          'Your license to use ReceiptGold ends immediately',
          'You must stop using the service and delete any copies',
          'Provisions regarding liability and indemnification survive termination',
          'Outstanding payment obligations remain due'
        ]
      },
      {
        type: 'header',
        text: 'Effective Date:'
      },
      {
        type: 'text',
        text: 'These Terms of Service are effective as of January 15, 2025.'
      },
      {
        type: 'header',
        text: 'Data Processors:'
      },
      {
        type: 'text',
        text: 'A complete list of our data processors and their privacy practices is available in our Privacy Policy and can be requested by contacting legal@receiptgold.com.'
      },
      {
        type: 'header',
        text: 'Contact Information:'
      },
      {
        type: 'text',
        text: 'For questions about these Terms:'
      },
      {
        type: 'list',
        items: [
          'Email: legal@receiptgold.com',
          'Support: Through the app\'s Contact Support feature',
          'Address: GregDavisTech, LLC\n  Legal Department\n  123 Business Ave\n  San Francisco, CA 94102'
        ]
      },
      {
        type: 'header',
        text: 'Dispute Resolution:'
      },
      {
        type: 'list',
        items: [
          'We encourage resolving disputes through direct communication',
          'California law governs these Terms',
          'Disputes will be resolved in California state or federal courts',
          'You may have rights to arbitration under applicable law'
        ]
      },
      {
        type: 'header',
        text: 'Severability:'
      },
      {
        type: 'text',
        text: 'If any provision of these Terms is found invalid, the remaining provisions continue in full force and effect.'
      }
    ]
  }
];

export const TermsOfServiceScreen: React.FC<TermsOfServiceScreenProps> = ({
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
