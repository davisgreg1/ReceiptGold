export interface SMSVerificationResult {
  success: boolean;
  verificationSid?: string;
  error?: string;
}

export interface SMSVerificationData {
  phoneNumber: string;
  verificationCode: string;
}

class TwilioSMSService {
  private apiUrl: string;

  constructor() {
    // Use configurable base URL for API endpoints
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3001';
    this.apiUrl = `${baseUrl}/api/sms`;
  }

  // Send SMS verification code to phone number
  async sendVerificationCode(phoneNumber: string): Promise<SMSVerificationResult> {
    try {
      console.log('📱 Sending SMS verification code to:', phoneNumber);
      
      // Format phone number (ensure it starts with +)
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      
      // Call API endpoint to send verification code
      const response = await fetch(`${this.apiUrl}/send-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber: formattedPhone }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ SMS verification code sent, SID:', result.verificationSid);
        return {
          success: true,
          verificationSid: result.verificationSid,
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to send SMS verification code:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send verification code',
      };
    }
  }

  // Verify the SMS code
  async verifyCode(verificationData: SMSVerificationData): Promise<SMSVerificationResult> {
    try {
      console.log('📱 Verifying SMS code for phone:', verificationData.phoneNumber);

      // Format phone number (ensure it starts with +)
      const formattedPhone = verificationData.phoneNumber.startsWith('+') 
        ? verificationData.phoneNumber 
        : `+${verificationData.phoneNumber}`;

      // Call API endpoint to verify code
      const response = await fetch(`${this.apiUrl}/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber: formattedPhone, 
          code: verificationData.verificationCode 
        }),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ SMS verification successful');
        return {
          success: true,
          verificationSid: result.verificationSid,
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ SMS verification error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // Format phone number for display
  formatPhoneNumber(phoneNumber: string): string {
    // Remove non-digits
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Format US numbers
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Format international numbers (basic)
    if (digits.length > 10) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }

  // Validate phone number format
  validatePhoneNumber(phoneNumber: string): { isValid: boolean; error?: string } {
    // Remove non-digits for validation
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length < 10) {
      return {
        isValid: false,
        error: 'Phone number is too short',
      };
    }
    
    if (digits.length > 15) {
      return {
        isValid: false,
        error: 'Phone number is too long',
      };
    }
    
    // Check for valid US number or international format
    const isUSNumber = digits.length === 10;
    const isInternational = digits.length > 10 && phoneNumber.startsWith('+');
    
    if (!isUSNumber && !isInternational && !phoneNumber.startsWith('+')) {
      return {
        isValid: false,
        error: 'International numbers must start with +',
      };
    }
    
    return { isValid: true };
  }

  // Get standardized phone number for storage
  getStandardizedPhoneNumber(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, '');
    
    // US numbers: add +1 prefix
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    // International numbers: ensure + prefix
    if (!phoneNumber.startsWith('+')) {
      return `+${digits}`;
    }
    
    return phoneNumber;
  }
}

export default new TwilioSMSService();