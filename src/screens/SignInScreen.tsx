import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { auth } from '../config/firebase';
import { Logo } from '../components/Logo';
import { CustomAlert } from '../components/CustomAlert';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { Typography, DisplayText, BodyText, ButtonText, BrandText } from '../components/Typography';

interface SignInScreenProps {
  onNavigateToSignUp: () => void;
  onNavigateToForgotPassword: () => void;
}

export const SignInScreen: React.FC<SignInScreenProps> = ({
  onNavigateToSignUp,
  onNavigateToForgotPassword,
}) => {
  const { theme } = useTheme();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isReturningUser, setIsReturningUser] = useState<boolean | null>(null);
  const { alertState, showError, showFirebaseError, hideAlert } = useCustomAlert();

  // Check if user has signed in before
  useEffect(() => {
    checkReturningUser();
  }, []);

  const checkReturningUser = async () => {
    try {
      const hasSignedInBefore = await AsyncStorage.getItem('hasSignedInBefore');
      setIsReturningUser(hasSignedInBefore === 'true');
    } catch (error) {
      console.log('Error checking returning user status:', error);
      setIsReturningUser(false);
    }
  };


  const handleSignIn = async () => {
    // Trim email only, keep password as-is since spaces might be intentional
    const trimmedEmail = email.trim();
    
    if (!trimmedEmail || !password) {
      showError('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(trimmedEmail, password);
      
      // Wait for auth state to be fully established and get fresh ID token
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Check if this is an account holder with team members who needs professional tier
      try {
        // Force token refresh to ensure we have a valid auth token
        if (auth.currentUser) {
          await auth.currentUser.getIdToken(true);
          // Wait a moment for the token to be properly set
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // All teammate access control is now handled server-side:
        // - Professional tier enforcement through automatic teammate suspension
        // - Inactive subscription enforcement through teammate access revocation
        // No client-side checks needed as server-side triggers handle everything automatically
      } catch (checkError) {
        console.log('⚠️ Post-authentication checks failed, allowing sign-in to proceed:', checkError);
        // Continue with sign-in process - the check will happen again in the app context
      }
      
      // Mark that user has successfully signed in
      await AsyncStorage.setItem('hasSignedInBefore', 'true');
    } catch (error: any) {
      console.error('Sign in error:', error);
      showFirebaseError(error, 'Sign In Error');
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
        >
          {/* Flexible spacer */}
          <View style={styles.topSpacer} />
          
          {/* Logo and Header */}
          <View style={styles.header}>
            <Logo size={80} />
            <DisplayText size="medium" color="gold" align="center">
              {isReturningUser === null 
                ? 'Welcome' 
                : isReturningUser 
                  ? 'Welcome Back' 
                  : 'Welcome'}
            </DisplayText>
            <BodyText size="large" color="secondary" align="center" style={styles.subtitle}>
              {isReturningUser === null 
                ? 'Sign in to continue'
                : isReturningUser 
                  ? (
                    <>
                      Sign in to your{' '}
                      <BrandText size="small" color="gold">
                        ReceiptGold
                      </BrandText>
                      {' '}account
                    </>
                  )
                  : (
                    <>
                      Sign in to{' '}
                      <BrandText size="small" color="gold">
                        ReceiptGold
                      </BrandText>
                    </>
                  )}
            </BodyText>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Typography variant="ui-label" color="primary">
                Email
              </Typography>
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
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.inputContainer}>
              <Typography variant="ui-label" color="primary">
                Password
              </Typography>
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
                  placeholder="Enter your password"
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

            <TouchableOpacity
              style={[styles.signInButton, { backgroundColor: theme.gold.primary }]}
              onPress={handleSignIn}
              disabled={loading}
            >
              <ButtonText color="inverse">
                {loading ? 'Signing In...' : 'Sign In'}
              </ButtonText>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={onNavigateToForgotPassword}
            >
              <Typography variant="body-small" color="gold">
                Forgot your password?
              </Typography>
            </TouchableOpacity>

          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <BodyText size="medium" color="secondary">
              Don't have an account?{' '}
            </BodyText>
            <TouchableOpacity onPress={onNavigateToSignUp}>
              <Typography variant="body-medium" color="gold" style={{ fontWeight: '600' }}>
                Create Account
              </Typography>
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
  },
  form: {
    marginBottom: 24,
  },
  bottomSpacer: {
    height: 60,
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
  signInButton: {
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
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  signUpText: {
    fontSize: 16,
  },
  signUpLink: {
    fontSize: 16,
    fontWeight: '600',
  },
});
