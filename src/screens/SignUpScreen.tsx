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
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { CustomAlert } from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { DisplayText, BodyText, ButtonText, BrandText } from '../components/Typography';

interface SignUpScreenProps {
  onNavigateToSignIn: () => void;
}

export const SignUpScreen: React.FC<SignUpScreenProps> = ({
  onNavigateToSignIn,
}) => {
  const { theme } = useTheme();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { alertState, showError, showSuccess, showFirebaseError, hideAlert } = useCustomAlert();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showError('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      showError('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showError('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      showSuccess('Success', 'Account created successfully!');
    } catch (error: any) {
      showFirebaseError(error, 'Sign Up Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          {/* Flexible spacer */}
          <View style={styles.topSpacer} />
          
          {/* Logo and Header */}
          <View style={styles.header}>
            <Logo size={80} />
            <DisplayText size="medium" color="gold" style={{ marginTop: 24, marginBottom: 8 }}>
              Create Account
            </DisplayText>
            <BodyText size="large" color="secondary" align="center">
              Join{' '}
              <BrandText size="small" color="gold">
                ReceiptGold
              </BrandText>
              {' '}and start managing your receipts
            </BodyText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <BodyText size="medium" color="primary" style={{ marginBottom: 8 }}>
                Email
              </BodyText>
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
              />
            </View>

            <View style={styles.inputContainer}>
              <BodyText size="medium" color="primary" style={{ marginBottom: 8 }}>
                Password
              </BodyText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: theme.background.secondary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary,
                    },
                  ]}
                  placeholder="Create a password (min 6 characters)"
                  placeholderTextColor={theme.text.tertiary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={theme.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <BodyText size="medium" color="primary" style={{ marginBottom: 8 }}>
                Confirm Password
              </BodyText>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.passwordInput,
                    {
                      backgroundColor: theme.background.secondary,
                      borderColor: theme.border.primary,
                      color: theme.text.primary,
                    },
                  ]}
                  placeholder="Confirm your password"
                  placeholderTextColor={theme.text.tertiary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={24}
                    color={theme.text.secondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.signUpButton, { backgroundColor: theme.gold.primary }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              <ButtonText size="large" color="inverse">
                {loading ? 'Creating Account...' : 'Create Account'}
              </ButtonText>
            </TouchableOpacity>
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <BodyText size="medium" color="secondary">
              Already have an account?{' '}
            </BodyText>
            <TouchableOpacity onPress={onNavigateToSignIn}>
              <BodyText size="medium" color="gold" style={{ fontWeight: '600' }}>
                Sign In
              </BodyText>
            </TouchableOpacity>
          </View>
          
          {/* Bottom spacer for keyboard */}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      </KeyboardAvoidingView>
      
      <CustomAlert
        visible={alertState.visible}
        type={alertState.options.type}
        title={alertState.options.title}
        message={alertState.options.message}
        onClose={hideAlert}
        primaryButtonText={alertState.options.primaryButtonText}
        secondaryButtonText={alertState.options.secondaryButtonText}
        onPrimaryPress={alertState.options.onPrimaryPress}
        onSecondaryPress={alertState.options.onSecondaryPress}
      />
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
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: '100%',
  },
  topSpacer: {
    flex: 1,
    minHeight: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  form: {
    marginBottom: 24,
  },
  bottomSpacer: {
    height: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingRight: 56,
    fontSize: 16,
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 16,
    padding: 8,
  },
  signUpButton: {
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
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
});
