import { getFunctions, httpsCallable } from 'firebase/functions';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

class DeviceCheckService {
  private static functions = getFunctions();

  /**
   * Check if DeviceCheck is supported on this device
   * For now, using a simpler device identification approach
   */
  static async isSupported(): Promise<boolean> {
    // For Expo compatibility, we'll use device information instead of DeviceCheck
    return Platform.OS === 'ios' && Device.isDevice;
  }

  /**
   * Generate a device token for DeviceCheck
   * Using device information as fallback for Expo compatibility
   */
  static async generateDeviceToken(): Promise<string> {
    if (Platform.OS !== 'ios') {
      throw new Error('Device identification is only available on iOS');
    }

    try {
      // Create a device identifier using available device information
      // Note: osVersion is excluded to prevent bypass via OS updates
      const deviceInfo = {
        deviceId: Device.osInternalBuildId || 'unknown',
        modelName: Device.modelName || 'unknown',
        platform: Platform.OS,
      };
      
      // Create a simple hash-like string from device info
      const deviceString = JSON.stringify(deviceInfo);
      // Use btoa for base64 encoding in React Native
      const deviceToken = btoa(deviceString);
      
      return deviceToken;
    } catch (error) {
      console.error('Error generating device token:', error);
      throw new Error(`Failed to generate device token: ${error}`);
    }
  }

  /**
   * Check if device is eligible for account creation
   */
  static async checkDeviceEligibility(email: string): Promise<{
    canCreateAccount: boolean;
    message: string;
  }> {
    try {
      // Check if DeviceCheck is supported
      const supported = await this.isSupported();
      if (!supported) {
        console.log('DeviceCheck not supported - allowing account creation');
        return {
          canCreateAccount: true,
          message: 'Device check not available - proceeding with account creation'
        };
      }

      // Generate device token
      const deviceToken = await this.generateDeviceToken();
      
      console.log('🔍 DeviceCheck calling Cloud Function to verify device eligibility');
      console.log('Generated device token:', deviceToken);
      
      // Call HTTP Cloud Function to check device eligibility
      const response = await fetch('https://us-central1-receiptgold.cloudfunctions.net/checkDeviceForAccountCreation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceToken,
          email: email.trim().toLowerCase()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error?.code === 'already-exists') {
          return {
            canCreateAccount: false,
            message: errorData.error.message
          };
        }
        throw new Error(`HTTP ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      return {
        canCreateAccount: data.data.canCreateAccount,
        message: data.data.message
      };

    } catch (error: any) {
      console.error('Error checking device eligibility:', error);
      
      // Handle specific error cases
      if (error.code === 'functions/already-exists') {
        return {
          canCreateAccount: false,
          message: error.message || 'This device has already been used to create an account'
        };
      }

      // For other errors, allow account creation to avoid blocking legitimate users
      console.log('DeviceCheck error - allowing account creation as fallback');
      return {
        canCreateAccount: true,
        message: 'Device check failed - proceeding with account creation'
      };
    }
  }

  /**
   * Complete account setup by marking device as used
   */
  static async completeAccountSetup(): Promise<void> {
    try {
      // Check if DeviceCheck is supported
      const supported = await this.isSupported();
      if (!supported) {
        console.log('DeviceCheck not supported - skipping device marking');
        return;
      }

      // Generate device token
      const deviceToken = await this.generateDeviceToken();
      
      // Call HTTP Cloud Function to mark device as used
      const response = await fetch('https://us-central1-receiptgold.cloudfunctions.net/completeAccountCreation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceToken
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      console.log('✅ Device marked as having created account');

    } catch (error) {
      console.error('Error completing account setup:', error);
      // Don't throw error - this is not critical for account creation
      // Log the error but allow the account creation to proceed
    }
  }
}

export default DeviceCheckService;