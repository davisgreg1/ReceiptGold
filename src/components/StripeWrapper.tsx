import React, { useEffect } from 'react';
import { revenueCatService } from '../services/revenuecatService';
import { useAuth } from '../context/AuthContext';

interface RevenueCatWrapperProps {
  children: React.ReactNode;
}

export const RevenueCatWrapper: React.FC<RevenueCatWrapperProps> = ({ children }) => {
  const { user } = useAuth();

  useEffect(() => {
    const initializeRevenueCat = async () => {
      try {
        // Initialize RevenueCat with user ID if available
        await revenueCatService.initialize(user?.uid);
        
        // If user is logged in, identify them to RevenueCat
        if (user?.uid) {
          await revenueCatService.loginUser(user.uid);
        }
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
      }
    };

    initializeRevenueCat();
  }, [user?.uid]);

  return <>{children}</>;
};

// Export both names for backward compatibility
export const StripeWrapper = RevenueCatWrapper;
