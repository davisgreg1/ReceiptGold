import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Clipboard,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// Using React Native core Clipboard (deprecated but functional)
import { useTheme } from '../theme/ThemeProvider';
import { useCustomAlert } from '../hooks/useCustomAlert';
import PhoneAuthService from '../services/PhoneAuthService';
import TwilioSMSService from '../services/TwilioSMSService';
import { DisplayText, BodyText, ButtonText } from '../components/Typography';
import { useConfettiContext } from '../context/ConfettiContext';

interface PhoneVerificationScreenProps {
  mode: 'signup' | 'signin';
  initialPhoneNumber?: string;
  onVerificationSuccess: (phoneNumber: string, verificationResult: any) => void;
  onBack: () => void;
  userForLinking?: any; // For linking phone to existing email account
}

export const PhoneVerificationScreen: React.FC<PhoneVerificationScreenProps> = ({
  mode,
  initialPhoneNumber = '',
  onVerificationSuccess,
  onBack,
  userForLinking,
}) => {
  const { theme } = useTheme();
  const { showError, showSuccess } = useCustomAlert();
  const { triggerConfetti } = useConfettiContext();
  
  
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phoneNumber, setPhoneNumber] = useState(initialPhoneNumber);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [formatError, setFormatError] = useState('');
  
  const codeInputs = useRef<(TextInput | null)[]>([]);
  const cooldownTimer = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef(AppState.currentState);
  

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) {
        clearTimeout(cooldownTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      cooldownTimer.current = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
    }
  }, [resendCooldown]);

  // Auto-detect SMS codes from clipboard
  useEffect(() => {
    let isActive = true;
    
    const checkClipboard = async () => {
      if (!isActive || step !== 'code') return;
      
      try {
        const clipboardContent = await Clipboard.getString();
        // Look for 6-digit codes, but be more flexible with surrounding text
        const codeMatch = clipboardContent.match(/(\d{6})/);
        
        if (codeMatch && verificationCode.length < 6) {
          const code = codeMatch[1];
          console.log('📋 Auto-detected SMS code from clipboard:', code);
          setVerificationCode(code);
          
          // Clear the clipboard after using the code
          Clipboard.setString('');
          
          // Auto-verify with the detected code
          setTimeout(() => {
            handleCodeSubmit(code);
          }, 300);
        }
      } catch (error) {
        console.log('Could not read clipboard:', error);
      }
    };

    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active' && step === 'code') {
        // Check clipboard when app becomes active
        setTimeout(checkClipboard, 300);
      }
    };

    // Check clipboard when code step is first shown
    if (step === 'code') {
      setTimeout(checkClipboard, 300);
    }

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      isActive = false;
      subscription?.remove();
    };
  }, [step]);

  const handlePhoneSubmit = async () => {
    const validation = PhoneAuthService.validatePhoneNumber(phoneNumber);
    if (!validation.isValid) {
      setFormatError(validation.error || 'Invalid phone number');
      return;
    }

    setFormatError('');
    setLoading(true);

    try {
      const standardizedPhone = PhoneAuthService.getStandardizedPhoneNumber(phoneNumber);
      const result = await PhoneAuthService.sendVerificationCode(standardizedPhone);

      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        setStep('code');
        setResendCooldown(60); // 60 second cooldown
        showSuccess('Verification Code Sent', `Code sent to ${PhoneAuthService.formatPhoneNumber(standardizedPhone)}`);
      } else {
        showError('Unable to Send Code', 'We couldn\'t send a verification code to your phone. Please check your number and try again.');
      }
    } catch (error) {
      showError('Connection Issue', 'We\'re having trouble connecting right now. Please check your internet and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (codeToSubmit?: string) => {
    const codeToUse = codeToSubmit || verificationCode;
    if (codeToUse.length !== 6) {
      showError('Incomplete Code', 'Please enter all 6 digits of your verification code.');
      return;
    }

    setLoading(true);

    try {
      const verificationData = {
        phoneNumber: PhoneAuthService.getStandardizedPhoneNumber(phoneNumber),
        verificationId,
        verificationCode: codeToUse,
      };

      let result;
      
      if (mode === 'signin') {
        // Sign in with phone number
        result = await PhoneAuthService.verifyCodeAndSignIn(verificationData);
      } else if (userForLinking) {
        // Link phone to existing email account
        result = await PhoneAuthService.verifyCodeAndLink(userForLinking, verificationData);
      } else {
        // Just verify the SMS code without creating account yet
        // The parent component will handle account creation
        const smsResult = await TwilioSMSService.verifyCode({
          phoneNumber: verificationData.phoneNumber,
          verificationCode: verificationData.verificationCode,
        });
        
        result = {
          success: smsResult.success,
          error: smsResult.error,
        };
      }

      if (result.success) {
        showSuccess('Success', 'Phone number verified successfully!');
        onVerificationSuccess(verificationData.phoneNumber, result);
      } else {
        showError('Code Incorrect', 'The verification code you entered is incorrect. Please double-check and try again.');
      }
    } catch (error) {
      showError('Verification Problem', 'We couldn\'t verify your code right now. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      const standardizedPhone = PhoneAuthService.getStandardizedPhoneNumber(phoneNumber);
      const result = await PhoneAuthService.sendVerificationCode(standardizedPhone);

      if (result.success && result.verificationId) {
        setVerificationId(result.verificationId);
        setResendCooldown(60);
        showSuccess('Code Resent', 'New verification code sent');
      } else {
        showError('Unable to Resend', 'We couldn\'t send a new code. Please wait a moment and try again.');
      }
    } catch (error) {
      showError('Connection Issue', 'We\'re having trouble right now. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (text: string, index: number) => {
    // Only allow digits
    const numericText = text.replace(/[^0-9]/g, '');
    
    // Handle pasted code (6 digits at once)
    if (numericText.length === 6) {
      setVerificationCode(numericText);
      // Auto-verify with the pasted code
      setTimeout(() => {
        handleCodeSubmit(numericText);
      }, 300);
      return;
    }
    
    if (numericText.length <= 1) {
      const newCode = verificationCode.split('');
      newCode[index] = numericText;
      const updatedCode = newCode.join('');
      setVerificationCode(updatedCode);

      // Auto-focus next input
      if (numericText.length === 1 && index < 5) {
        codeInputs.current[index + 1]?.focus();
      }
      
      // Auto-verify if all 6 digits are entered
      if (updatedCode.length === 6) {
        setTimeout(() => {
          handleCodeSubmit(updatedCode);
        }, 300);
      }
    }
  };

  const handleBackspace = (index: number) => {
    const newCode = verificationCode.split('');
    
    // Always clear the previous digit and move focus backward
    if (index > 0) {
      // Clear the previous field and focus on it
      newCode[index - 1] = '';
      setVerificationCode(newCode.join(''));
      codeInputs.current[index - 1]?.focus();
    } else {
      // If we're at the first field, just clear it
      newCode[0] = '';
      setVerificationCode(newCode.join(''));
    }
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <DisplayText style={[styles.title, { color: theme.text.primary }]}>
          {mode === 'signin' ? 'Sign In with Phone' : 'Verify Phone Number'}
        </DisplayText>
      </View>

      <BodyText style={[styles.subtitle, { color: theme.text.secondary }]}>
        {mode === 'signin' 
          ? 'Enter your phone number to sign in'
          : 'We\'ll send a verification code to confirm your phone number'
        }
      </BodyText>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.phoneInput,
            {
              color: theme.text.primary,
              borderColor: formatError ? theme.status.error : theme.border.primary,
              backgroundColor: theme.background.secondary,
            },
          ]}
          value={phoneNumber}
          onChangeText={(text) => {
            setPhoneNumber(text);
            setFormatError('');
          }}
          placeholder="+1 (555) 123-4567"
          placeholderTextColor={theme.text.tertiary}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
        />
        
        {formatError ? (
          <Text style={[styles.errorText, { color: theme.status.error }]}>
            {formatError}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: theme.gold.primary },
          loading && { opacity: 0.7 },
        ]}
        onPress={handlePhoneSubmit}
        disabled={loading || !phoneNumber.trim()}
      >
        {loading ? (
          <ActivityIndicator color={theme.background.primary} />
        ) : (
          <ButtonText style={[styles.buttonText, { color: theme.background.primary }]}>
            Send Code
          </ButtonText>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('phone')} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <DisplayText style={[styles.title, { color: theme.text.primary }]}>
          Enter Verification Code
        </DisplayText>
      </View>

      <BodyText style={[styles.subtitle, { color: theme.text.secondary }]}>
        We sent a 6-digit code to{'\n'}
        {PhoneAuthService.formatPhoneNumber(phoneNumber)}
      </BodyText>

      <View style={styles.codeContainer}>
        {Array.from({ length: 6 }, (_, index) => (
          <TextInput
            key={index}
            ref={(ref) => { codeInputs.current[index] = ref; }}
            style={[
              styles.codeInput,
              {
                color: theme.text.primary,
                borderColor: theme.border.primary,
                backgroundColor: theme.background.secondary,
              },
            ]}
            value={verificationCode[index] || ''}
            onChangeText={(text) => handleCodeChange(text, index)}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace') {
                handleBackspace(index);
              }
            }}
            keyboardType="number-pad"
            maxLength={index === 0 ? 6 : 1} // Allow pasting full code in first field
            textAlign="center"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            returnKeyType="done"
            blurOnSubmit={false}
            caretHidden={true}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          { backgroundColor: theme.gold.primary },
          loading && { opacity: 0.7 },
        ]}
        onPress={handleCodeSubmit}
        disabled={loading || verificationCode.length < 6}
      >
        {loading ? (
          <ActivityIndicator color={theme.background.primary} />
        ) : (
          <ButtonText style={[styles.buttonText, { color: theme.background.primary }]}>
            Verify Code
          </ButtonText>
        )}
      </TouchableOpacity>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.resendButton, resendCooldown > 0 && { opacity: 0.5 }]}
          onPress={handleResendCode}
          disabled={resendCooldown > 0 || loading}
        >
          <Text style={[styles.resendText, { color: theme.gold.primary }]}>
            {resendCooldown > 0 
              ? `Resend code in ${resendCooldown}s` 
              : 'Resend code'
            }
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.pasteButton}
          onPress={async () => {
            try {
              const clipboardContent = await Clipboard.getString();
              const codeMatch = clipboardContent.match(/(\d{6})/);
              if (codeMatch) {
                setVerificationCode(codeMatch[1]);
                // Clear the clipboard after using the code
                Clipboard.setString('');
              }
            } catch (error) {
              console.log('Could not read clipboard:', error);
            }
          }}
        >
          <Text style={[styles.pasteText, { color: theme.text.secondary }]}>
            Paste Code
          </Text>
        </TouchableOpacity>

        {/* Debug: Test Confetti Button - Remove in production */}
        <TouchableOpacity
          style={[styles.pasteButton, { marginTop: 10 }]}
          onPress={() => {
            console.log('🎊 Manual confetti test triggered');
            stableTriggerConfetti();
          }}
        >
          <Text style={[styles.pasteText, { color: theme.gold.primary }]}>
            Test Confetti 🎊
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
      </KeyboardAvoidingView>
      
      {/* Confetti Celebration for Account Creation */}
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
  stepContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 24,
  },
  phoneInput: {
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
    marginLeft: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 20,
    fontWeight: '600',
  },
  button: {
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  resendText: {
    fontSize: 16,
    fontWeight: '500',
  },
  pasteButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pasteText: {
    fontSize: 16,
    fontWeight: '500',
  },
});