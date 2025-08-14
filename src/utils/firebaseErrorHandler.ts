import React from 'react';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { getFirebaseErrorMessage, isNetworkError } from '../utils/firebaseErrors';

// Higher-order component for Firebase error handling
export const withFirebaseErrorHandling = <T extends object>(
  Component: React.ComponentType<T>
): React.ComponentType<T & { handleFirebaseOperation?: (operation: () => Promise<any>, errorTitle?: string) => Promise<any> }> => {
  return (props: T & { handleFirebaseOperation?: (operation: () => Promise<any>, errorTitle?: string) => Promise<any> }) => {
    const { showFirebaseError } = useCustomAlert();
    
    const handleFirebaseOperation = async (operation: () => Promise<any>, errorTitle?: string) => {
      try {
        return await operation();
      } catch (error) {
        showFirebaseError(error, errorTitle);
        throw error; // Re-throw so calling code can handle if needed
      }
    };
    
    return React.createElement(Component, { ...props, handleFirebaseOperation });
  };
};

// Hook for Firebase operations with error handling
export const useFirebaseErrorHandler = () => {
  const { showFirebaseError, showSuccess, showWarning } = useCustomAlert();
  
  const handleFirebaseError = (error: any, customTitle?: string) => {
    showFirebaseError(error, customTitle);
  };
  
  const executeFirebaseOperation = async <T,>(
    operation: () => Promise<T>,
    options?: {
      errorTitle?: string;
      successTitle?: string;
      successMessage?: string;
      showSuccess?: boolean;
    }
  ): Promise<T | null> => {
    try {
      const result = await operation();
      
      if (options?.showSuccess && options?.successTitle && options?.successMessage) {
        showSuccess(options.successTitle, options.successMessage);
      }
      
      return result;
    } catch (error) {
      showFirebaseError(error, options?.errorTitle);
      return null;
    }
  };
  
  return {
    handleFirebaseError,
    executeFirebaseOperation,
  };
};

// Common Firebase error scenarios with pre-defined messages
export const FirebaseErrorScenarios = {
  AUTH: {
    SIGN_IN: 'Sign In Error',
    SIGN_UP: 'Sign Up Error',
    PASSWORD_RESET: 'Password Reset Error',
    EMAIL_VERIFICATION: 'Email Verification Error',
    PROFILE_UPDATE: 'Profile Update Error',
  },
  FIRESTORE: {
    READ: 'Failed to Load Data',
    WRITE: 'Failed to Save Data',
    UPDATE: 'Failed to Update Data',
    DELETE: 'Failed to Delete Data',
  },
  STORAGE: {
    UPLOAD: 'Upload Failed',
    DOWNLOAD: 'Download Failed',
    DELETE: 'Failed to Delete File',
  },
  FUNCTIONS: {
    CALL: 'Service Error',
    TIMEOUT: 'Service Timeout',
  },
};
