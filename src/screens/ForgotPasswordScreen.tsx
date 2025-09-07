import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { FirebaseErrorScenarios } from '../utils/firebaseErrorHandler';

interface ForgotPasswordScreenProps {
  onNavigateToSignIn: () => void;
}

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onNavigateToSignIn,
}) => {
  const { theme } = useTheme();
  const { resetPassword } = useAuth();
  const { showError, showSuccess, showFirebaseError } = useCustomAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      showError('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
      showSuccess(
        'Reset Email Sent',
        'Check your email for password reset instructions',
        {
          primaryButtonText: 'OK',
          onPrimaryPress: () => onNavigateToSignIn(),
        }
      );
    } catch (error: any) {
      showFirebaseError(error, FirebaseErrorScenarios.AUTH.PASSWORD_RESET);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Header */}
          <View style={styles.header}>
            <Logo size={80} />
            <Text style={[styles.title, { color: theme.gold.primary }]}>
              Reset Password
            </Text>
            <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
              Enter your email address and we'll send you instructions to reset your password
            </Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text.primary }]}>
                Email
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
                placeholder="Enter your email"
                placeholderTextColor={theme.text.tertiary}
                value={email}
                onChangeText={(text) => setEmail(text.trim())}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!sent}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.resetButton,
                {
                  backgroundColor: sent ? theme.status.success : theme.gold.primary,
                },
              ]}
              onPress={handleResetPassword}
              disabled={loading || sent}
            >
              <Text style={[styles.resetButtonText, { color: theme.text.inverse }]}>
                {loading
                  ? 'Sending...'
                  : sent
                  ? 'Email Sent ✓'
                  : 'Send Reset Email'}
              </Text>
            </TouchableOpacity>

            {sent && (
              <View style={styles.successMessage}>
                <Text style={[styles.successText, { color: theme.status.success }]}>
                  ✓ Reset email sent successfully
                </Text>
                <Text style={[styles.instructionText, { color: theme.text.secondary }]}>
                  Please check your email and follow the instructions to reset your password.
                </Text>
              </View>
            )}
          </View>

          {/* Back to Sign In Link */}
          <View style={styles.backContainer}>
            <TouchableOpacity onPress={onNavigateToSignIn}>
              <Text style={[styles.backText, { color: theme.gold.primary }]}>
                ← Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  resetButton: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FFD700',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  resetButtonText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  successMessage: {
    marginTop: 24,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  backContainer: {
    alignItems: 'center',
    marginTop: 'auto',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
