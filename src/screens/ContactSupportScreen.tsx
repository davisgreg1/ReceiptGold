import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Signature } from '../components/Signature';
import { useCustomAlert } from '../hooks/useCustomAlert';

interface ContactSupportScreenProps {
  navigation: any;
}

type SupportCategory = 'billing' | 'technical' | 'general';

export const ContactSupportScreen: React.FC<ContactSupportScreenProps> = ({
  navigation,
}) => {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { showError, showSuccess } = useCustomAlert();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [category, setCategory] = useState<SupportCategory>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const supportCategories = [
    { id: 'billing', title: 'Billing & Subscription', icon: 'card-outline' },
    { id: 'technical', title: 'Technical Issues', icon: 'bug-outline' },
    { id: 'general', title: 'General Support', icon: 'help-circle-outline' },
  ] as const;

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      showError('Error', 'Please fill in both subject and message');
      return;
    }

    setLoading(true);
    try {
      // Simulate API call - replace with actual implementation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      showSuccess(
        'Message Sent!', 
        'Thank you for contacting us. We\'ll get back to you within 24 hours.'
      );
      
      // Reset form
      setSubject('');
      setMessage('');
      setCategory('general');
      
      // Navigate back after showing success
      setTimeout(() => {
        navigation.goBack();
      }, 2000);
      
    } catch (error) {
      showError('Error', 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailPress = () => {
    Linking.openURL('mailto:support@receiptgold.com');
  };

  const handleCallPress = () => {
    Linking.openURL('tel:+1-555-RECEIPT');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, { backgroundColor: theme.gold.background }]}>
              <Ionicons name="headset-outline" size={80} color={theme.gold.primary} />
            </View>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              Contact Support
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              We're here to help! Send us a message and we'll respond within 24 hours.
            </Text>
          </View>

          {/* Quick Contact Options */}
          <View style={styles.quickContactSection}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Quick Contact
            </Text>
            <View style={styles.quickContactRow}>
              <TouchableOpacity 
                style={[styles.quickContactButton, { 
                  backgroundColor: theme.background.secondary,
                  borderColor: theme.border.primary 
                }]}
                onPress={handleEmailPress}
              >
                <View style={[styles.quickContactIcon, { backgroundColor: theme.gold.background }]}>
                  <Ionicons name="mail-outline" size={24} color={theme.gold.primary} />
                </View>
                <Text style={[styles.quickContactText, { color: theme.text.primary }]}>
                  Email Us
                </Text>
                <Text style={[styles.quickContactSubtext, { color: theme.text.tertiary }]}>
                  support@receiptgold.com
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.quickContactButton, { 
                  backgroundColor: theme.background.secondary,
                  borderColor: theme.border.primary 
                }]}
                onPress={handleCallPress}
              >
                <View style={[styles.quickContactIcon, { backgroundColor: theme.gold.background }]}>
                  <Ionicons name="call-outline" size={24} color={theme.gold.primary} />
                </View>
                <Text style={[styles.quickContactText, { color: theme.text.primary }]}>
                  Call Us
                </Text>
                <Text style={[styles.quickContactSubtext, { color: theme.text.tertiary }]}>
                  +1 (470) 527-8470
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Support Form */}
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Send us a message
            </Text>

            {/* Category Selection */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text.primary }]}>
                Category
              </Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesContainer}
              >
                {supportCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      { 
                        backgroundColor: category === cat.id 
                          ? theme.gold.primary 
                          : theme.background.secondary,
                        borderColor: category === cat.id 
                          ? theme.gold.primary 
                          : theme.border.primary,
                      }
                    ]}
                    onPress={() => setCategory(cat.id as SupportCategory)}
                  >
                    <Ionicons 
                      name={cat.icon as any} 
                      size={16} 
                      color={category === cat.id ? 'white' : theme.text.secondary} 
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        { 
                          color: category === cat.id ? 'white' : theme.text.secondary 
                        }
                      ]}
                    >
                      {cat.title}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Subject Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text.primary }]}>
                Subject
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background.secondary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                placeholder="Brief description of your issue"
                placeholderTextColor={theme.text.tertiary}
                value={subject}
                onChangeText={setSubject}
                maxLength={100}
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: 480,
                      animated: true,
                    });
                  }, 150);
                }}
              />
            </View>

            {/* Message Input */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text.primary }]}>
                Message
              </Text>
              <TextInput
                style={[
                  styles.textArea,
                  {
                    backgroundColor: theme.background.secondary,
                    borderColor: theme.border.primary,
                    color: theme.text.primary,
                  },
                ]}
                placeholder="Please describe your issue in detail. Include any error messages, steps to reproduce the problem, and your device information."
                placeholderTextColor={theme.text.tertiary}
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                maxLength={1000}
                textAlignVertical="top"
                onFocus={() => {
                  setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                      y: 640,
                      animated: true,
                    });
                  }, 150);
                }}
              />
              <Text style={[styles.charCount, { color: theme.text.tertiary }]}>
                {message.length}/1000
              </Text>
            </View>

            {/* User Info Display */}
            {user && (
              <View style={[styles.userInfoContainer, { 
                backgroundColor: theme.background.tertiary,
                borderColor: theme.border.primary 
              }]}>
                <Ionicons name="person-outline" size={16} color={theme.text.secondary} />
                <Text style={[styles.userInfoText, { color: theme.text.secondary }]}>
                  Message will be sent from: {user.email}
                </Text>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                { 
                  backgroundColor: theme.gold.primary,
                  opacity: loading ? 0.7 : 1,
                },
                Platform.select({
                  ios: {
                    shadowColor: theme.gold.primary,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                  },
                  android: {
                    elevation: 4,
                  },
                })
              ]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color="white" />
                  <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                    Sending...
                  </Text>
                </View>
              ) : (
                <>
                  <Ionicons name="send-outline" size={20} color="white" />
                  <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                    Send Message
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.text.tertiary }]}>
              Response time: Within 24 hours • Available: Mon-Fri, 9 AM - 6 PM EST
            </Text>
          </View>

          {/* Signature */}
          <Signature variant="compact" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 120,
    flexGrow: 1,
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
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  quickContactSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    letterSpacing: 0.3,
  },
  quickContactRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickContactButton: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    minHeight: 120,
    justifyContent: 'center',
    minWidth: 160,
  },
  quickContactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickContactText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickContactSubtext: {
    fontSize: 12,
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  categoriesContainer: {
    paddingRight: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    marginRight: 12,
    minWidth: 120,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 24,
  },
  userInfoText: {
    fontSize: 14,
    marginLeft: 8,
  },
  submitButton: {
    flexDirection: 'row',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  footerText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
