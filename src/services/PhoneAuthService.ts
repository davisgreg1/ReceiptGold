import TwilioSMSService, { SMSVerificationResult, SMSVerificationData } from './TwilioSMSService';
import { 
  updateProfile,
  User,
  UserCredential 
} from 'firebase/auth';

// Keep interface compatible with existing implementation
export interface PhoneVerificationResult {
  success: boolean;
  verificationId?: string;
  error?: string;
  userCredential?: UserCredential;
}

export interface PhoneVerificationData {
  phoneNumber: string;
  verificationId: string;
  verificationCode: string;
}

class PhoneAuthService {
  // Send verification code to phone number using Twilio SMS
  async sendVerificationCode(phoneNumber: string): Promise<PhoneVerificationResult> {
    try {
      console.log('📱 Sending SMS verification code to:', phoneNumber);
      
      // Use Twilio SMS service instead of Firebase
      const result = await TwilioSMSService.sendVerificationCode(phoneNumber);

      if (result.success) {
        return {
          success: true,
          verificationId: result.verificationSid || 'twilio-verification',
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.error('❌ Failed to send SMS verification code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification code',
      };
    }
  }

  // Verify SMS code for sign in (just verifies the code, doesn't create user)
  async verifyCodeAndSignIn(verificationData: PhoneVerificationData): Promise<PhoneVerificationResult> {
    try {
      console.log('📱 Verifying SMS code for phone auth sign in');

      // Just verify the SMS code with Twilio
      const smsVerification: SMSVerificationData = {
        phoneNumber: verificationData.phoneNumber,
        verificationCode: verificationData.verificationCode,
      };

      const smsResult = await TwilioSMSService.verifyCode(smsVerification);

      if (!smsResult.success) {
        return {
          success: false,
          error: smsResult.error || 'SMS verification failed',
        };
      }

      console.log('✅ Phone verification successful for sign in');

      return {
        success: true,
      };
    } catch (error) {
      console.error('❌ Phone verification failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Verify SMS code and link to existing user (for sign up with email + phone)
  async verifyCodeAndLink(
    user: User, 
    verificationData: PhoneVerificationData
  ): Promise<PhoneVerificationResult> {
    try {
      console.log('📱 Verifying SMS code and linking to existing user');

      // First verify the SMS code with Twilio
      const smsVerification: SMSVerificationData = {
        phoneNumber: verificationData.phoneNumber,
        verificationCode: verificationData.verificationCode,
      };

      const smsResult = await TwilioSMSService.verifyCode(smsVerification);

      if (!smsResult.success) {
        return {
          success: false,
          error: smsResult.error || 'SMS verification failed',
        };
      }

      // Update user profile to include phone number
      const currentDisplayName = user.displayName || user.email || 'User';
      await updateProfile(user, {
        displayName: `${currentDisplayName} (${verificationData.phoneNumber})`,
      });

      // For linking, we'll store the phone number in user's profile
      // In a production app, you might want to store this in Firestore
      console.log('✅ Phone number linked to user:', user.uid);

      return {
        success: true,
        userCredential: { user } as UserCredential,
      };
    } catch (error) {
      console.error('❌ Phone linking failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to link phone number',
      };
    }
  }


  // Delegate utility methods to TwilioSMSService
  formatPhoneNumber(phoneNumber: string): string {
    return TwilioSMSService.formatPhoneNumber(phoneNumber);
  }

  validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    return TwilioSMSService.validatePhoneNumber(phoneNumber);
  }

  getStandardizedPhoneNumber(phoneNumber: string): string {
    return TwilioSMSService.getStandardizedPhoneNumber(phoneNumber);
  }

  // Clean up resources
  cleanup(): void {
    // No cleanup needed for Twilio SMS
  }
}

export default new PhoneAuthService();