import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { Logo } from '../components/Logo';
import { Signature } from '../components/Signature';

interface HelpCenterScreenProps {
  navigation: any;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'scanning' | 'receipts' | 'reports' | 'subscription' | 'sync' | 'technical';
  icon: string;
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'How do I scan my first receipt?',
    answer: 'To scan a receipt:\n\n1. Tap the gold camera button on the Receipts screen\n2. Choose "Camera" to take a photo or "Gallery" to select an existing image\n3. Position your receipt clearly in the frame\n4. Tap the capture button\n5. ReceiptGold will automatically extract and organize all the information\n\nTip: Ensure good lighting and that all text is clearly visible for best results.',
    category: 'scanning',
    icon: 'camera-outline'
  },
  {
    id: '2',
    question: 'Why isn\'t my receipt scanning properly?',
    answer: 'If your receipt isn\'t scanning well, try these solutions:\n\n• Ensure good lighting - natural light works best\n• Keep the receipt flat and avoid wrinkles or folds\n• Make sure all text is clearly visible\n• Clean your camera lens\n• Hold your phone steady when capturing\n• Try different angles if text is still unclear\n\nFor very faded receipts, you can manually edit the details after scanning.',
    category: 'scanning',
    icon: 'scan-outline'
  },
  {
    id: '3',
    question: 'How do I edit receipt information?',
    answer: 'To edit receipt details:\n\n1. Tap on the receipt from your Receipts list\n2. Scroll down \n3. Modify any field including:\n   • Vendor name\n   • Amount and tax\n   • Date and time\n   • Category\n   • Individual items\n   • Business/personal classification\n4. Tap "Save Changes" when done\n\nAll changes are automatically synced across your devices.',
    category: 'receipts',
    icon: 'create-outline'
  },
  {
    id: '4',
    question: 'How do I categorize my receipts for taxes?',
    answer: 'ReceiptGold automatically categorizes receipts, but you can customize them:\n\n1. Open any receipt\n2. Tap on the category field\n3. Choose from categories like:\n   • Office Supplies\n   • Transportation\n   • Restaurant & Dining\n   • Professional Services\n   • Equipment & Software\n4. Mark as "Business" or "Personal"\n5. Add custom categories in Settings\n\nPro tip: Set up custom categories that match your business needs for easier tax preparation.',
    category: 'receipts',
    icon: 'folder-outline'
  },
  {
    id: '12',
    question: 'Why don\'t I see business data? All my receipts appear as personal.',
    answer: 'If all your receipts are showing as personal expenses, you need to set up a business first:\n\n**Why this happens:**\n• When you first sign up, all receipts are automatically marked as "Personal"\n• ReceiptGold needs you to create a business profile to categorize expenses as "Business"\n• Without a business setup, you won\'t see business-related reports or data\n\n**How to set up your business:**\n1. Go to Settings > Business Management\n2. Tap "Add New Business"\n3. Enter your business name and details\n4. Save your business profile\n\n**After setup:**\n• New receipts can be assigned to your business during scanning\n• You can edit existing receipts individually to change them from Personal to Business\n• Business reports and analytics will start showing data\n• You can manage multiple businesses (Professional plan)\n\nTip: To convert existing personal receipts to business receipts, tap on each receipt and change its business assignment in the receipt details.',
    category: 'receipts',
    icon: 'business-outline'
  },
  {
    id: '5',
    question: 'How do I generate tax reports?',
    answer: 'To create tax-ready reports:\n\n1. Go to the Reports tab\n2. Select "Tax Report" (Professional feature)\n3. Choose your date range (monthly, quarterly, or yearly)\n4. Filter by:\n   • Business vs Personal expenses\n   • Specific categories\n   • Amount ranges\n5. Tap "Generate Report"\n6. Export as PDF or Excel for your accountant\n\nReports automatically calculate totals by category and include all receipt images as backup documentation.',
    category: 'reports',
    icon: 'document-text-outline'
  },
    {
    id: '11',
    question: 'What do the trend arrows in reports mean?',
    answer: 'Trend indicators show how your spending has changed compared to the previous period:\n\n📈 **Red Trending Up**: Spending increased by more than 5%\n• This means you spent more than the previous period\n• The percentage shows how much more you spent\n• Appears in red to indicate higher spending\n\n📉 **Green Trending Down**: Spending decreased by more than 5%\n• This means you spent less than the previous period\n• Great for tracking cost-saving efforts\n• Appears in green to indicate savings\n\n➖ **Gray Flat Line**: Spending stayed stable\n• Change was less than 5% up or down\n• Indicates consistent spending patterns\n• Appears in gray to show stability\n\n**New Categories**: If you have spending in a new category that didn\'t exist in the previous period, it shows a red trending up arrow with 100% increase.\n\nThese trends help you quickly identify spending patterns and make informed budgeting decisions.',
    category: 'reports',
    icon: 'trending-up-outline'
  },
  {
    id: '6',
    question: 'What\'s the difference between subscription tiers?',
    answer: 'ReceiptGold offers four subscription tiers:\n\n**Free**\n• 10 receipts per month\n• Basic scanning and storage\n\n**Starter ($9.99/month)**\n• 50 receipts per month\n• LLC categories\n• Email support\n\n**Growth ($19.99/month)**\n• 150 receipts per month\n• Advanced reporting\n• Priority support\n\n**Professional ($39.99/month)**\n• Unlimited receipts\n• Multi-business management\n• Quarterly alerts\n\nUpgrade anytime from Settings > Subscription.',
    category: 'subscription',
    icon: 'card-outline'
  },
  {
    id: '7',
    question: 'How does bank transaction monitoring work?',
    answer: 'Bank monitoring (Professional feature) automatically creates receipts from your transactions:\n\n1. Connect your bank account securely through Plaid\n2. ReceiptGold monitors transactions for potential receipts\n3. AI suggests which transactions need receipts\n4. Auto-generates digital receipts for confirmed transactions\n5. You can approve, edit, or dismiss suggestions\n\nThis feature helps ensure you never miss a deductible expense and maintains complete records for tax purposes.',
    category: 'sync',
    icon: 'card-outline'
  },
  {
    id: '8',
    question: 'Are my receipts and data secure?',
    answer: 'Yes, ReceiptGold uses enterprise-grade security:\n\n• **End-to-end encryption** for all data transmission\n• **Secure cloud storage** with Firebase/Google Cloud\n• **Bank-level security** through Plaid for financial connections\n• **Local device encryption** for stored images\n• **Regular security audits** and compliance checks\n• **No data selling** - your information stays private\n\nYour receipt images and financial data are never shared with third parties.',
    category: 'technical',
    icon: 'shield-checkmark-outline'
  },
  {
    id: '9',
    question: 'How do I backup and sync my receipts?',
    answer: 'Your receipts automatically sync across devices:\n\n**Cloud Backup (Growth/Professional)**\n• Automatic backup to secure cloud storage\n• Access from any device with your account\n• Real-time syncing of new receipts and edits\n\n**Manual Export**\n• Export individual receipts as PDF\n• Bulk export from Reports section\n• Email receipts directly from the app\n\nTo ensure sync is working, check Settings > Account and verify you\'re signed in to the same account on all devices.',
    category: 'sync',
    icon: 'cloud-outline'
  },
  {
    id: '10',
    question: 'The app is running slowly or crashing. What should I do?',
    answer: 'Try these troubleshooting steps:\n\n**Basic fixes:**\n• Force close and restart the app\n• Restart your device\n• Ensure you have the latest app version\n• Free up device storage space\n\n**Advanced solutions:**\n• Clear app cache (Android: Settings > Apps > ReceiptGold > Storage)\n• Check internet connection for sync issues\n• Sign out and back in to refresh your account\n\n**Still having issues?**\nContact our support team through Settings > Contact Support with details about your device and the specific problem.',
    category: 'technical',
    icon: 'settings-outline'
  }
];

const categoryInfo = {
  scanning: { name: 'Scanning', color: '#4CAF50', icon: 'camera-outline' },
  receipts: { name: 'Receipts', color: '#2196F3', icon: 'receipt-outline' },
  reports: { name: 'Reports', color: '#FF9800', icon: 'bar-chart-outline' },
  subscription: { name: 'Plans', color: '#9C27B0', icon: 'star-outline' },
  sync: { name: 'Sync & Backup', color: '#00BCD4', icon: 'cloud-outline' },
  technical: { name: 'Technical', color: '#F44336', icon: 'build-outline' },
};

export const HelpCenterScreen: React.FC<HelpCenterScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);
  };

  const filteredFAQs = faqs.filter(faq => {
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    const matchesSearch = !searchQuery || 
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleContactSupport = () => {
    navigation.navigate('ContactSupport');
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:support@receiptgold.com?subject=Help Request');
  };

  const handleFeatureRequest = () => {
    navigation.navigate('ContactSupport');
  };

  const handleFeatureRequestEmail = () => {
    Linking.openURL('mailto:ideas@receiptgold.com?subject=Feature Request - ReceiptGold&body=Hi ReceiptGold team,%0D%0A%0D%0AI have an idea for a new feature:%0D%0A%0D%0A[Describe your feature idea here]%0D%0A%0D%0AWhy would this be helpful:%0D%0A[Explain how this would improve your experience]%0D%0A%0D%0AThanks!');
  };

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
            <Ionicons name="help-circle-outline" size={80} color={theme.gold.primary} />
          </View>
          <Text style={[styles.title, { color: theme.text.primary }]}>
            Help Center
          </Text>
          <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
            Find answers to common questions about using ReceiptGold
          </Text>
        </View>

        {/* Category Filter */}
        <View style={styles.categorySection}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Browse by Category
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryContainer}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  backgroundColor: !selectedCategory 
                    ? theme.gold.primary 
                    : theme.background.secondary,
                  borderColor: !selectedCategory 
                    ? theme.gold.primary 
                    : theme.border.primary,
                }
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Ionicons 
                name="apps-outline" 
                size={16} 
                color={!selectedCategory ? 'white' : theme.text.secondary} 
              />
              <Text
                style={[
                  styles.categoryChipText,
                  { color: !selectedCategory ? 'white' : theme.text.secondary }
                ]}
              >
                All
              </Text>
            </TouchableOpacity>

            {Object.entries(categoryInfo).map(([key, info]) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selectedCategory === key 
                      ? theme.gold.primary 
                      : theme.background.secondary,
                    borderColor: selectedCategory === key 
                      ? theme.gold.primary 
                      : theme.border.primary,
                  }
                ]}
                onPress={() => setSelectedCategory(key)}
              >
                <Ionicons 
                  name={info.icon as any} 
                  size={16} 
                  color={selectedCategory === key ? 'white' : info.color} 
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selectedCategory === key ? 'white' : theme.text.secondary }
                  ]}
                >
                  {info.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* FAQ List */}
        <View style={styles.faqSection}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Frequently Asked Questions
          </Text>
          
          {filteredFAQs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="help-circle-outline" size={64} color={theme.text.secondary} />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                No FAQs found
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.text.secondary }]}>
                Try selecting a different category or contact support for help
              </Text>
            </View>
          ) : (
            filteredFAQs.map((faq) => (
              <View
                key={faq.id}
                style={[
                  styles.faqCard,
                  {
                    backgroundColor: theme.background.secondary,
                    borderColor: theme.border.primary,
                  }
                ]}
              >
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFAQ(faq.id)}
                >
                  <View style={styles.faqHeaderContent}>
                    <View style={[
                      styles.faqIcon,
                      { backgroundColor: `${categoryInfo[faq.category].color}20` }
                    ]}>
                      <Ionicons
                        name={categoryInfo[faq.category].icon as any}
                        size={18}
                        color={categoryInfo[faq.category].color}
                      />
                    </View>
                    <View style={styles.faqHeaderText}>
                      <Text style={[styles.faqQuestion, { color: theme.text.primary }]}>
                        {faq.question}
                      </Text>
                      <Text style={[styles.faqCategory, { color: theme.text.tertiary }]}>
                        {categoryInfo[faq.category].name}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={expandedFAQ === faq.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={theme.text.secondary}
                  />
                </TouchableOpacity>

                {expandedFAQ === faq.id && (
                  <View style={[styles.faqAnswer, { borderTopColor: theme.border.primary }]}>
                    <Text style={[styles.answerText, { color: theme.text.secondary }]}>
                      {faq.answer}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>

        {/* Contact Support Section */}
        <View style={styles.supportSection}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Still Need Help?
          </Text>
          <View style={[styles.supportCard, { 
            backgroundColor: theme.gold.background,
            borderColor: theme.gold.primary 
          }]}>
            <View style={styles.supportContent}>
              <View style={[styles.supportIcon, { backgroundColor: theme.gold.primary }]}>
                <Ionicons name="headset-outline" size={24} color="white" />
              </View>
              <View style={styles.supportText}>
                <Text style={[styles.supportTitle, { color: theme.text.primary }]}>
                  Contact Our Support Team
                </Text>
                <Text style={[styles.supportSubtitle, { color: theme.text.secondary }]}>
                  Get personalized help from our team within 24 hours
                </Text>
              </View>
            </View>
            <View style={styles.supportActions}>
              <TouchableOpacity
                style={[styles.supportButton, { backgroundColor: theme.gold.primary }]}
                onPress={handleContactSupport}
              >
                <Ionicons name="chatbubble-outline" size={16} color="white" />
                <Text style={styles.supportButtonText}>Contact Support</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.supportButton, { 
                  backgroundColor: 'transparent',
                  borderColor: theme.gold.primary,
                  borderWidth: 1,
                }]}
                onPress={handleEmailSupport}
              >
                <Ionicons name="mail-outline" size={16} color={theme.gold.primary} />
                <Text style={[styles.supportButtonText, { color: theme.gold.primary }]}>
                  Email Us
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Feature Requests Section */}
        <View style={styles.supportSection}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Have an Idea?
          </Text>
          <View style={[styles.supportCard, { 
            backgroundColor: theme.background.secondary,
            borderColor: theme.border.primary 
          }]}>
            <View style={styles.supportContent}>
              <View style={[styles.supportIcon, { backgroundColor: theme.status.info }]}>
                <Ionicons name="bulb-outline" size={24} color="white" />
              </View>
              <View style={styles.supportText}>
                <Text style={[styles.supportTitle, { color: theme.text.primary }]}>
                  Request a Feature
                </Text>
                <Text style={[styles.supportSubtitle, { color: theme.text.secondary }]}>
                  We love hearing your ideas for making ReceiptGold even better
                </Text>
              </View>
            </View>
            <View style={styles.supportActions}>
              <TouchableOpacity
                style={[styles.supportButton, { 
                  backgroundColor: 'transparent',
                  borderColor: theme.status.info,
                  borderWidth: 1,
                }]}
                onPress={handleFeatureRequestEmail}
              >
                <Ionicons name="send-outline" size={16} color={theme.status.info} />
                <Text style={[styles.supportButtonText, { color: theme.status.info }]}>
                  Email Ideas
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.text.tertiary }]}>
            ReceiptGold Help Center • Updated regularly with new guides and FAQs
          </Text>
        </View>

        {/* Signature */}
        <Signature variant="footer" />
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
  },
  categorySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  categoryContainer: {
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  faqSection: {
    marginBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  faqCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  faqHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  faqIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  faqHeaderText: {
    flex: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: 4,
  },
  faqCategory: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
  },
  answerText: {
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 16,
  },
  supportSection: {
    marginBottom: 32,
  },
  supportCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
  },
  supportContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  supportText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  supportSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  supportActions: {
    flexDirection: 'row',
    gap: 12,
  },
  supportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    color: 'white',
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});
