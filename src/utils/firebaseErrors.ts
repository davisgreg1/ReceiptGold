// Firebase error code to user-friendly message mapping
export const firebaseErrorMessages: Record<string, { title: string; message: string }> = {
  // Authentication errors
  'auth/user-not-found': {
    title: 'Account Not Found',
    message: 'No account exists with this email address. Please check your email or create a new account.'
  },
  'auth/wrong-password': {
    title: 'Incorrect Password',
    message: 'The password you entered is incorrect. Please try again or reset your password.'
  },
  'auth/invalid-email': {
    title: 'Invalid Email',
    message: 'Please enter a valid email address.'
  },
  'auth/user-disabled': {
    title: 'Account Disabled',
    message: 'This account has been disabled. Please contact support for assistance.'
  },
  'auth/email-already-in-use': {
    title: 'Email Already Registered',
    message: 'An account with this email address already exists. Please sign in or use a different email.'
  },
  'auth/weak-password': {
    title: 'Weak Password',
    message: 'Please choose a stronger password with at least 6 characters.'
  },
  'auth/too-many-requests': {
    title: 'Too Many Attempts',
    message: 'Too many failed attempts. Please wait a few minutes before trying again.'
  },
  'auth/network-request-failed': {
    title: 'Connection Error',
    message: 'Please check your internet connection and try again.'
  },
  'auth/requires-recent-login': {
    title: 'Login Required',
    message: 'For security, please sign in again to complete this action.'
  },
  'auth/invalid-credential': {
    title: 'Invalid Credentials',
    message: 'The email or password is incorrect. Please check your credentials and try again.'
  },
  
  // Firestore errors
  'firestore/permission-denied': {
    title: 'Access Denied',
    message: 'You don\'t have permission to access this data. Please sign in and try again.'
  },
  'firestore/not-found': {
    title: 'Data Not Found',
    message: 'The requested information could not be found. It may have been deleted or moved.'
  },
  'firestore/already-exists': {
    title: 'Already Exists',
    message: 'This item already exists and cannot be created again.'
  },
  'firestore/resource-exhausted': {
    title: 'Service Busy',
    message: 'Our servers are currently busy. Please try again in a few moments.'
  },
  'firestore/failed-precondition': {
    title: 'Update Failed',
    message: 'This item has been modified by another user. Please refresh and try again.'
  },
  'firestore/aborted': {
    title: 'Operation Cancelled',
    message: 'The operation was cancelled. Please try again.'
  },
  'firestore/out-of-range': {
    title: 'Invalid Data',
    message: 'Some of the provided data is invalid. Please check your input.'
  },
  'firestore/unimplemented': {
    title: 'Feature Unavailable',
    message: 'This feature is not available at the moment. Please try again later.'
  },
  'firestore/internal': {
    title: 'Server Error',
    message: 'An internal server error occurred. Please try again later.'
  },
  'firestore/unavailable': {
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable. Please try again in a few minutes.'
  },
  'firestore/deadline-exceeded': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please check your connection and try again.'
  },
  
  // Storage errors
  'storage/object-not-found': {
    title: 'File Not Found',
    message: 'The requested file could not be found. It may have been deleted.'
  },
  'storage/bucket-not-found': {
    title: 'Storage Error',
    message: 'There was an error accessing file storage. Please try again.'
  },
  'storage/project-not-found': {
    title: 'Configuration Error',
    message: 'There was a configuration error. Please contact support.'
  },
  'storage/quota-exceeded': {
    title: 'Storage Full',
    message: 'Storage quota exceeded. Please free up space or upgrade your plan.'
  },
  'storage/unauthenticated': {
    title: 'Authentication Required',
    message: 'Please sign in to upload files.'
  },
  'storage/unauthorized': {
    title: 'Upload Not Allowed',
    message: 'You don\'t have permission to upload files. Please check your account status.'
  },
  'storage/retry-limit-exceeded': {
    title: 'Upload Failed',
    message: 'File upload failed after multiple attempts. Please check your connection and try again.'
  },
  'storage/invalid-checksum': {
    title: 'File Corrupted',
    message: 'The file appears to be corrupted. Please try uploading again.'
  },
  'storage/canceled': {
    title: 'Upload Cancelled',
    message: 'File upload was cancelled. Please try again if needed.'
  },
  'storage/invalid-event-name': {
    title: 'Upload Error',
    message: 'There was an error during file upload. Please try again.'
  },
  'storage/invalid-url': {
    title: 'Invalid File',
    message: 'The file URL is invalid. Please try uploading again.'
  },
  'storage/invalid-argument': {
    title: 'Invalid File',
    message: 'The selected file is not valid. Please choose a different file.'
  },
  'storage/no-default-bucket': {
    title: 'Storage Error',
    message: 'File storage is not configured. Please contact support.'
  },
  'storage/cannot-slice-blob': {
    title: 'File Error',
    message: 'There was an error processing the file. Please try again.'
  },
  'storage/server-file-wrong-size': {
    title: 'File Size Error',
    message: 'The file size doesn\'t match expected size. Please try uploading again.'
  },
  
  // Functions errors
  'functions/cancelled': {
    title: 'Operation Cancelled',
    message: 'The operation was cancelled. Please try again.'
  },
  'functions/unknown': {
    title: 'Unknown Error',
    message: 'An unknown error occurred. Please try again.'
  },
  'functions/invalid-argument': {
    title: 'Invalid Request',
    message: 'Some of the provided information is invalid. Please check and try again.'
  },
  'functions/deadline-exceeded': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.'
  },
  'functions/not-found': {
    title: 'Service Not Found',
    message: 'The requested service is not available. Please try again later.'
  },
  'functions/already-exists': {
    title: 'Already Exists',
    message: 'This item already exists and cannot be created again.'
  },
  'functions/permission-denied': {
    title: 'Access Denied',
    message: 'You don\'t have permission to perform this action.'
  },
  'functions/resource-exhausted': {
    title: 'Service Busy',
    message: 'The service is currently busy. Please try again in a few moments.'
  },
  'functions/failed-precondition': {
    title: 'Invalid State',
    message: 'The operation cannot be completed in the current state. Please refresh and try again.'
  },
  'functions/aborted': {
    title: 'Operation Aborted',
    message: 'The operation was aborted. Please try again.'
  },
  'functions/out-of-range': {
    title: 'Invalid Data',
    message: 'Some of the provided data is out of range. Please check your input.'
  },
  'functions/unimplemented': {
    title: 'Feature Unavailable',
    message: 'This feature is not implemented yet. Please try again later.'
  },
  'functions/internal': {
    title: 'Server Error',
    message: 'An internal server error occurred. Please try again later.'
  },
  'functions/unavailable': {
    title: 'Service Unavailable',
    message: 'The service is temporarily unavailable. Please try again later.'
  },
  'functions/data-loss': {
    title: 'Data Error',
    message: 'There was a data error. Please try again or contact support.'
  },
  'functions/unauthenticated': {
    title: 'Authentication Required',
    message: 'Please sign in to access this feature.'
  }
};

// Extract Firebase error code from error object
export const getFirebaseErrorCode = (error: any): string | null => {
  if (!error) return null;
  
  // Direct error code
  if (error.code) return error.code;
  
  // Error message that might contain code
  if (error.message) {
    const codeMatch = error.message.match(/\(([^)]+)\)/);
    if (codeMatch) return codeMatch[1];
  }
  
  return null;
};

// Get user-friendly error message from Firebase error
export const getFirebaseErrorMessage = (error: any): { title: string; message: string } => {
  const errorCode = getFirebaseErrorCode(error);
  
  if (errorCode && firebaseErrorMessages[errorCode]) {
    return firebaseErrorMessages[errorCode];
  }
  
  // Default error message for unknown codes
  return {
    title: 'Something Went Wrong',
    message: error?.message || 'An unexpected error occurred. Please try again.'
  };
};

// Helper function to check if error is network related
export const isNetworkError = (error: any): boolean => {
  const errorCode = getFirebaseErrorCode(error);
  const networkCodes = [
    'auth/network-request-failed',
    'firestore/unavailable',
    'firestore/deadline-exceeded'
  ];
  
  return networkCodes.includes(errorCode || '') || 
         (error?.message && error.message.toLowerCase().includes('network'));
};

// Helper function to check if error requires re-authentication
export const requiresReauth = (error: any): boolean => {
  const errorCode = getFirebaseErrorCode(error);
  const reauthCodes = [
    'auth/requires-recent-login',
    'auth/user-token-expired'
  ];
  
  return reauthCodes.includes(errorCode || '');
};
