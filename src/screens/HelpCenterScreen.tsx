import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/ThemeProvider";
import { useSubscription } from "../context/SubscriptionContext";
import { Signature } from "../components/Signature";

// Reusable FAQ Components
const FAQText: React.FC<{ children: React.ReactNode; style?: any }> = ({
  children,
  style,
}) => {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        { fontSize: 15, lineHeight: 24, color: theme.text.secondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

const FAQBoldText: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { theme } = useTheme();
  return (
    <Text style={{ fontWeight: "bold", color: theme.text.primary }}>
      {children}
    </Text>
  );
};

const FAQParagraph: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <View style={{ marginBottom: 12 }}>
    <FAQText>{children}</FAQText>
  </View>
);

const FAQNumberedList: React.FC<{ items: string[] }> = ({ items }) => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {items.map((item, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 8,
            paddingRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              marginRight: 8,
              minWidth: 24,
              color: theme.gold.primary,
              lineHeight: 24,
            }}
          >
            {index + 1}.
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              color: theme.text.secondary,
              flex: 1,
            }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
};

const FAQBulletList: React.FC<{ items: string[] }> = ({ items }) => {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: 12 }}>
      {items.map((item, index) => (
        <View
          key={index}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 8,
            paddingRight: 8,
          }}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "bold",
              marginRight: 8,
              minWidth: 20,
              color: theme.gold.primary,
              textAlign: "center",
              lineHeight: 24,
            }}
          >
            •
          </Text>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              color: theme.text.secondary,
              flex: 1,
            }}
          >
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
};

interface HelpCenterScreenProps {
  navigation: any;
}

interface FAQ {
  id: string;
  question: string;
  answer: React.ReactNode;
  category:
    | "scanning"
    | "receipts"
    | "reports"
    | "subscription"
    | "sync"
    | "technical";
  icon: string;
}

const faqs: FAQ[] = [
  {
    id: "1",
    question: "How do I scan my first receipt?",
    answer: (
      <View>
        <FAQParagraph>To scan a receipt:</FAQParagraph>
        <FAQNumberedList
          items={[
            "Tap the gold camera button on the Receipts screen",
            'Choose "Camera" to take a photo or "Gallery" to select an existing image',
            "Position your receipt clearly in the frame",
            "Tap the capture button",
            "ReceiptGold will automatically extract and organize all the information",
          ]}
        />
        <FAQText>
          Tip: Ensure good lighting and that all text is clearly visible for
          best results.
        </FAQText>
      </View>
    ),
    category: "scanning",
    icon: "camera-outline",
  },
  {
    id: "2",
    question: "Why isn't my receipt scanning properly?",
    answer: (
      <View>
        <FAQParagraph>
          If your receipt isn't scanning well, try these solutions:
        </FAQParagraph>
        <FAQBulletList
          items={[
            "Ensure good lighting - natural light works best",
            "Keep the receipt flat and avoid wrinkles or folds",
            "Make sure all text is clearly visible",
            "Clean your camera lens",
            "Hold your phone steady when capturing",
            "Try different angles if text is still unclear",
          ]}
        />
        <FAQText>
          For very faded receipts, you can manually edit the details after
          scanning.
        </FAQText>
      </View>
    ),
    category: "scanning",
    icon: "scan-outline",
  },
  {
    id: "3",
    question: "How do I edit receipt information?",
    answer: (
      <View>
        <FAQParagraph>To edit receipt details:</FAQParagraph>
        <FAQNumberedList
          items={[
            "Tap on the receipt from your Receipts list",
            "Scroll down",
            "Modify any field including:",
          ]}
        />
        <FAQBulletList
          items={[
            "Vendor name",
            "Amount and tax",
            "Date and time",
            "Category",
            "Individual items",
            "Business/personal classification",
          ]}
        />
        <FAQNumberedList items={['Tap "Save Changes" when done']} />
        <FAQText>
          All changes are automatically synced across your devices.
        </FAQText>
      </View>
    ),
    category: "receipts",
    icon: "create-outline",
  },
  {
    id: "4",
    question: "How do I categorize my receipts for taxes?",
    answer: (
      <View>
        <FAQParagraph>
          ReceiptGold automatically categorizes receipts, but you can customize
          them:
        </FAQParagraph>
        <FAQNumberedList
          items={[
            "Open any receipt",
            "Tap on the category field",
            "Choose from categories like:",
          ]}
        />
        <FAQBulletList
          items={[
            "Office Supplies",
            "Transportation",
            "Restaurant & Dining",
            "Professional Services",
            "Equipment & Software",
          ]}
        />
        <FAQNumberedList
          items={[
            'Mark as "Business" or "Personal"',
            "Add custom categories in Settings",
          ]}
        />
        <FAQText>
          Pro tip: Set up custom categories that match your business needs for
          easier tax preparation.
        </FAQText>
      </View>
    ),
    category: "receipts",
    icon: "folder-outline",
  },
  {
    id: "12",
    question:
      "Why don't I see business data? All my receipts appear as personal.",
    answer: (
      <View>
        <FAQParagraph>
          If all your receipts are showing as personal expenses, you need to set
          up a business first:
        </FAQParagraph>

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Why this happens:</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            'When you first sign up, all receipts are automatically marked as "Personal"',
            'ReceiptGold needs you to create a business profile to categorize expenses as "Business"',
            "Without a business setup, you won't see business-related reports or data",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>How to set up your business:</FAQBoldText>
        </View>
        <FAQNumberedList
          items={[
            "Go to Settings > Business Management",
            'Tap "Add New Business"',
            "Enter your business name and details",
            "Save your business profile",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>After setup:</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "New receipts will automatically be assigned to your business during scanning",
            "You can edit existing receipts individually to change them from Personal to Business",
            "Business reports and analytics will start showing data",
            "You can manage multiple businesses (Professional plan)",
          ]}
        />

        <FAQText>
          Tip: To convert existing personal receipts to business receipts, tap
          on each receipt and change its business assignment in the receipt
          details.
        </FAQText>
      </View>
    ),
    category: "receipts",
    icon: "business-outline",
  },
  {
    id: "5",
    question: "How do I generate tax reports?",
    answer: (
      <View>
        <FAQParagraph>To create tax-ready reports:</FAQParagraph>
        <FAQNumberedList
          items={[
            "Go to the Reports tab",
            "Choose your date range (week, month, or yearly)",
            'Tap "Export CSV"',
          ]}
        />
        <FAQText>
          Reports automatically calculate totals by category and include all
          receipt images as backup documentation.
        </FAQText>
      </View>
    ),
    category: "reports",
    icon: "document-text-outline",
  },
  {
    id: "11",
    question: "What do the trend arrows in reports mean?",
    answer: (
      <View>
        <FAQParagraph>
          Trend indicators show how your spending has changed compared to the
          previous period:
        </FAQParagraph>

        <View style={{ marginBottom: 12 }}>
          <FAQText>
            📈 <FAQBoldText>Red Trending Up</FAQBoldText>: Spending increased by
            more than 5%
          </FAQText>
        </View>
        <FAQBulletList
          items={[
            "This means you spent more than the previous period",
            "The percentage shows how much more you spent",
            "Appears in red to indicate higher spending",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQText>
            📉 <FAQBoldText>Green Trending Down</FAQBoldText>: Spending
            decreased by more than 5%
          </FAQText>
        </View>
        <FAQBulletList
          items={[
            "This means you spent less than the previous period",
            "Great for tracking cost-saving efforts",
            "Appears in green to indicate savings",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQText>
            ➖ <FAQBoldText>Gray Flat Line</FAQBoldText>: Spending stayed stable
          </FAQText>
        </View>
        <FAQBulletList
          items={[
            "Change was less than 5% up or down",
            "Indicates consistent spending patterns",
            "Appears in gray to show stability",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>New Categories</FAQBoldText>
          <FAQText>
            If you have spending in a new category that didn't exist in the
            previous period, it shows a red trending up arrow with 100%
            increase.
          </FAQText>
        </View>

        <FAQText>
          These trends help you quickly identify spending patterns and make
          informed budgeting decisions.
        </FAQText>
      </View>
    ),
    category: "reports",
    icon: "trending-up-outline",
  },
  {
    id: "6",
    question: "What's the difference between subscription tiers?",
    answer: (
      <View>
        <FAQParagraph>
          ReceiptGold offers three subscription tiers:
        </FAQParagraph>

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Free</FAQBoldText>
        </View>
        <FAQBulletList
          items={["10 receipts per month", "Basic scanning and storage"]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Starter</FAQBoldText>
        </View>
        <FAQBulletList
          items={["50 receipts per month", "LLC categories", "Email support"]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Growth</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "150 receipts per month",
            "Advanced reporting",
            "Priority support",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Professional</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "Unlimited receipts",
            "Multi-business management",
            "Add team members",
            "Generate receipts from bank transactions",
          ]}
        />

        <FAQText>
          Upgrade anytime from Settings {">"} Manage Subscription.
        </FAQText>
      </View>
    ),
    category: "subscription",
    icon: "card-outline",
  },
  {
    id: "7",
    question: "How does bank transaction monitoring work?",
    answer: (
      <View>
        <FAQParagraph>
          Bank monitoring (Professional feature) automatically creates receipts
          from your transactions:
        </FAQParagraph>
        <FAQNumberedList
          items={[
            "Connect your bank account securely through Plaid®",
            "ReceiptGold monitors transactions for potential receipts",
            "AI suggests which transactions need receipts",
            "Manually generate digital receipts for confirmed transactions",
            "You can approve, edit, or dismiss suggested transactions",
          ]}
        />
        <FAQText>
          This feature helps ensure you never miss a deductible expense and
          maintains complete records for tax purposes.
        </FAQText>
      </View>
    ),
    category: "sync",
    icon: "card-outline",
  },
  {
    id: "8",
    question: "Are my receipts and data secure?",
    answer: (
      <View>
        <FAQParagraph>
          Yes, ReceiptGold uses enterprise-grade security:
        </FAQParagraph>
        <FAQBulletList
          items={[
            "End-to-end encryption for all data transmission",
            "Secure cloud storage with Firebase/Google Cloud",
            "Bank-level security through Plaid® for financial connections",
            "Local device encryption for stored images",
            "Regular security audits and compliance checks",
            "No data selling - your information stays private",
          ]}
        />
        <FAQText>
          Your receipt images and financial data are never shared with third
          parties.
        </FAQText>
      </View>
    ),
    category: "technical",
    icon: "shield-checkmark-outline",
  },
  {
    id: "9",
    question: "How do I backup and sync my receipts?",
    answer: (
      <View>
        <FAQParagraph>
          Your receipts automatically sync across devices:
        </FAQParagraph>

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Cloud Backup (Growth/Professional)</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "Automatic backup to secure cloud storage",
            "Access from any device with your account",
            "Real-time syncing of new receipts and edits",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Manual Export</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "Export individual receipts as PDF",
            "Bulk export from Reports section",
            "Email receipts directly from the app",
          ]}
        />

        <FAQText>
          To ensure sync is working, check Settings {">"} Account and verify
          you're signed in to the same account on all devices.
        </FAQText>
      </View>
    ),
    category: "sync",
    icon: "cloud-outline",
  },
  {
    id: "10",
    question: "The app is running slowly or crashing. What should I do?",
    answer: (
      <View>
        <FAQParagraph>Try these troubleshooting steps:</FAQParagraph>

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Basic fixes:</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "Force close and restart the app",
            "Restart your device",
            "Ensure you have the latest app version",
            "Free up device storage space",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Advanced solutions:</FAQBoldText>
        </View>
        <FAQBulletList
          items={[
            "Clear app cache (Android: Settings > Apps > ReceiptGold > Storage)",
            "Check internet connection for sync issues",
            "Sign out and back in to refresh your account",
          ]}
        />

        <View style={{ marginBottom: 12 }}>
          <FAQBoldText>Still having issues?</FAQBoldText>
        </View>
        <FAQText>
          Contact our support team through Settings {">"} Contact Support with
          details about your device and the specific problem.
        </FAQText>
      </View>
    ),
    category: "technical",
    icon: "settings-outline",
  },
];

const categoryInfo = {
  scanning: { name: "Scanning", color: "#4CAF50", icon: "camera-outline" },
  receipts: { name: "Receipts", color: "#2196F3", icon: "receipt-outline" },
  reports: { name: "Reports", color: "#FF9800", icon: "bar-chart-outline" },
  subscription: { name: "Plans", color: "#9C27B0", icon: "star-outline" },
  sync: { name: "Sync & Backup", color: "#00BCD4", icon: "cloud-outline" },
  technical: { name: "Technical", color: "#F44336", icon: "build-outline" },
};

export const HelpCenterScreen: React.FC<HelpCenterScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const { subscription } = useSubscription();
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const faqLayouts = useRef<{ [key: string]: number }>({});

  const getSupportMessage = () => {
    switch (subscription.currentTier) {
      case 'trial':
        return "We're here to help! Check our help center and community forums for answers to common questions.";
      case 'starter':
        return "We're here to help! Send us an email and we'll respond within 48 hours.";
      case 'growth':
        return "We're here to help! Send us a message and we'll respond within 24 hours with priority support.";
      case 'professional':
        return "We're here to help! Your dedicated account manager will respond within 12 hours for immediate assistance.";
      default:
        return `We're here to help! [Tier: ${subscription.currentTier}] Check our help center and community forums for answers to common questions.`;
    }
  };

  const toggleFAQ = (id: string) => {
    setExpandedFAQ(expandedFAQ === id ? null : id);

    // Scroll to the FAQ section when expanded
    if (expandedFAQ !== id) {
      setTimeout(() => {
        const yPosition = faqLayouts.current[id];
        if (yPosition !== undefined && scrollViewRef.current) {
          scrollViewRef.current.scrollTo({
            y: yPosition - 20, // Add some padding from top
            animated: true,
          });
        }
      }, 100); // Small delay to allow expansion animation
    }
  };

  const filteredFAQs = faqs.filter((faq) => {
    const matchesCategory =
      !selectedCategory || faq.category === selectedCategory;
    return matchesCategory;
  });

  const handleContactSupport = () => {
    navigation.navigate("ContactSupport");
  };

  const handleEmailSupport = () => {
    Linking.openURL("mailto:support@receiptgold.com?subject=Help Request");
  };

  const handleFeatureRequestEmail = () => {
    const emailBody = `Hi ReceiptGold team,

I have an idea for a new feature:

[Describe your feature idea here]

Why would this be helpful:
[Explain how this would improve your experience]

Thanks!`;

    const mailtoUrl = `mailto:ideas@receiptgold.com?subject=${encodeURIComponent(
      "Feature Request - ReceiptGold"
    )}&body=${encodeURIComponent(emailBody)}`;
    Linking.openURL(mailtoUrl);
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View
            style={[
              styles.logoContainer,
              { backgroundColor: theme.gold.background },
            ]}
          >
            <Ionicons
              name="help-circle-outline"
              size={80}
              color={theme.gold.primary}
            />
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
                },
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Ionicons
                name="apps-outline"
                size={16}
                color={!selectedCategory ? "white" : theme.text.secondary}
              />
              <Text
                style={[
                  styles.categoryChipText,
                  { color: !selectedCategory ? "white" : theme.text.secondary },
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
                    backgroundColor:
                      selectedCategory === key
                        ? theme.gold.primary
                        : theme.background.secondary,
                    borderColor:
                      selectedCategory === key
                        ? theme.gold.primary
                        : theme.border.primary,
                  },
                ]}
                onPress={() => setSelectedCategory(key)}
              >
                <Ionicons
                  name={info.icon as any}
                  size={16}
                  color={selectedCategory === key ? "white" : info.color}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    {
                      color:
                        selectedCategory === key
                          ? "white"
                          : theme.text.secondary,
                    },
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
              <Ionicons
                name="help-circle-outline"
                size={64}
                color={theme.text.secondary}
              />
              <Text style={[styles.emptyTitle, { color: theme.text.primary }]}>
                No FAQs found
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: theme.text.secondary }]}
              >
                Try selecting a different category or contact support for help
              </Text>
            </View>
          ) : (
            filteredFAQs.map((faq) => (
              <View
                key={faq.id}
                onLayout={(event) => {
                  faqLayouts.current[faq.id] = event.nativeEvent.layout.y;
                }}
                style={[
                  styles.faqCard,
                  {
                    backgroundColor: theme.background.secondary,
                    borderColor: theme.border.primary,
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.faqHeader}
                  onPress={() => toggleFAQ(faq.id)}
                >
                  <View style={styles.faqHeaderContent}>
                    <View
                      style={[
                        styles.faqIcon,
                        {
                          backgroundColor: `${
                            categoryInfo[faq.category].color
                          }20`,
                        },
                      ]}
                    >
                      <Ionicons
                        name={categoryInfo[faq.category].icon as any}
                        size={18}
                        color={categoryInfo[faq.category].color}
                      />
                    </View>
                    <View style={styles.faqHeaderText}>
                      <Text
                        style={[
                          styles.faqQuestion,
                          { color: theme.text.primary },
                        ]}
                      >
                        {faq.question}
                      </Text>
                      <Text
                        style={[
                          styles.faqCategory,
                          { color: theme.text.tertiary },
                        ]}
                      >
                        {categoryInfo[faq.category].name}
                      </Text>
                    </View>
                  </View>
                  <Ionicons
                    name={
                      expandedFAQ === faq.id ? "chevron-up" : "chevron-down"
                    }
                    size={20}
                    color={theme.text.secondary}
                  />
                </TouchableOpacity>

                {expandedFAQ === faq.id && (
                  <View
                    style={[
                      styles.faqAnswer,
                      { borderTopColor: theme.border.primary },
                    ]}
                  >
                    <View style={styles.answerContainer}>{faq.answer}</View>
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
          <View
            style={[
              styles.supportCard,
              {
                backgroundColor: theme.gold.background,
                borderColor: theme.gold.primary,
              },
            ]}
          >
            <View style={styles.supportContent}>
              <View
                style={[
                  styles.supportIcon,
                  { backgroundColor: theme.gold.primary },
                ]}
              >
                <Ionicons name="headset-outline" size={24} color="white" />
              </View>
              <View style={styles.supportText}>
                <Text
                  style={[styles.supportTitle, { color: theme.text.primary }]}
                >
                  Contact Our Support Team
                </Text>
                <Text
                  style={[
                    styles.supportSubtitle,
                    { color: theme.text.secondary },
                  ]}
                >
                  {getSupportMessage()}
                </Text>
              </View>
            </View>
            <View style={styles.supportActions}>
              {subscription.currentTier !== 'trial' && (
                <TouchableOpacity
                  style={[
                    styles.supportButton,
                    { backgroundColor: theme.gold.primary },
                  ]}
                  onPress={handleContactSupport}
                >
                  <Ionicons name="chatbubble-outline" size={16} color="white" />
                  <Text style={styles.supportButtonText} numberOfLines={1}>
                    Contact Support
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.supportButton,
                  {
                    backgroundColor: "transparent",
                    borderColor: theme.gold.primary,
                    borderWidth: 1,
                    flex: subscription.currentTier === 'trial' ? 1 : 1,
                  },
                ]}
                onPress={handleEmailSupport}
              >
                <Ionicons
                  name="mail-outline"
                  size={16}
                  color={theme.gold.primary}
                />
                <Text
                  style={[
                    styles.supportButtonText,
                    { color: theme.gold.primary },
                  ]}
                  numberOfLines={1}
                >
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
          <View
            style={[
              styles.supportCard,
              {
                backgroundColor: theme.background.secondary,
                borderColor: theme.border.primary,
              },
            ]}
          >
            <View style={styles.supportContent}>
              <View
                style={[
                  styles.supportIcon,
                  { backgroundColor: theme.status.info },
                ]}
              >
                <Ionicons name="bulb-outline" size={24} color="white" />
              </View>
              <View style={styles.supportText}>
                <Text
                  style={[styles.supportTitle, { color: theme.text.primary }]}
                >
                  Request a Feature
                </Text>
                <Text
                  style={[
                    styles.supportSubtitle,
                    { color: theme.text.secondary },
                  ]}
                >
                  We love hearing your ideas for making ReceiptGold even better
                </Text>
              </View>
            </View>
            <View style={styles.supportActions}>
              <TouchableOpacity
                style={[
                  styles.supportButton,
                  {
                    backgroundColor: "transparent",
                    borderColor: theme.status.info,
                    borderWidth: 1,
                  },
                ]}
                onPress={handleFeatureRequestEmail}
              >
                <Ionicons
                  name="send-outline"
                  size={16}
                  color={theme.status.info}
                />
                <Text
                  style={[
                    styles.supportButtonText,
                    { color: theme.status.info },
                  ]}
                >
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
    paddingTop: 0,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 10,
    marginTop: 10,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  categorySection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  categoryContainer: {
    paddingRight: 20,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 12,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 8,
  },
  faqSection: {
    marginBottom: 32,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  faqCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  faqHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  faqHeaderContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  faqIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  faqHeaderText: {
    flex: 1,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 4,
  },
  faqCategory: {
    fontSize: 12,
    fontWeight: "500",
    textTransform: "uppercase",
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
  listText: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  answerContainer: {
    paddingTop: 16,
  },
  listContainer: {
    marginBottom: 12,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
    paddingRight: 8,
  },
  listNumber: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
    minWidth: 24,
    textAlign: "left",
  },
  bullet: {
    fontSize: 15,
    fontWeight: "bold",
    marginRight: 8,
    minWidth: 20,
    textAlign: "center",
  },
  boldText: {
    fontWeight: "bold",
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
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  supportText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  supportSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  supportActions: {
    flexDirection: "row",
    gap: 12,
  },
  supportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 10,
    minHeight: 44,
    minWidth: 0,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    color: "white",
    textAlign: "center",
    flexShrink: 0,
  },
  footer: {
    alignItems: "center",
    marginTop: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
});
