import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCustomAlert } from '../components/CustomAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hook to detect when a teammate has been automatically logged out
 * due to their account holder's subscription becoming inactive
 */
export const useTeammateLogoutDetection = () => {
  const { user } = useAuth();
  const { showError } = useCustomAlert();
  const wasSignedInRef = useRef(false);
  const hasShownLogoutAlertRef = useRef(false);

  useEffect(() => {
    const checkForUnexpectedLogout = async () => {
      try {
        // Check if user was previously signed in
        const hasSignedInBefore = await AsyncStorage.getItem('hasSignedInBefore');
        const wasSignedIn = hasSignedInBefore === 'true';

        // If user was signed in but now is not, and we haven't shown the alert yet
        if (wasSignedIn && !user && wasSignedInRef.current && !hasShownLogoutAlertRef.current) {
          console.log('🔍 Detected unexpected logout, checking if this was due to subscription issue');
          
          // Mark that we've shown the alert to prevent multiple alerts
          hasShownLogoutAlertRef.current = true;
          
          // Show a user-friendly message about the logout
          showError(
            'Session Expired',
            'Your access has been revoked because the team account\'s subscription is no longer active. Please contact your account holder to resolve the billing issue and restore access.',
            {
              primaryButtonText: 'OK',
              onPrimaryPress: () => {
                // Clear the signed in status since they've been logged out
                AsyncStorage.removeItem('hasSignedInBefore');
              }
            }
          );
        }

        // Update the reference to track current user state
        wasSignedInRef.current = !!user;

        // Reset the alert flag when user signs in again
        if (user && !wasSignedInRef.current) {
          hasShownLogoutAlertRef.current = false;
        }
      } catch (error) {
        console.error('Error checking for unexpected logout:', error);
      }
    };

    checkForUnexpectedLogout();
  }, [user, showError]);

  // Reset alert flag when component unmounts or user changes
  useEffect(() => {
    return () => {
      hasShownLogoutAlertRef.current = false;
    };
  }, []);
};