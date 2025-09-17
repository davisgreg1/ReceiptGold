import {
  reauthenticateWithCredential,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../config/firebase';

export class AccountService {
  /**
   * Delete user account and all associated data
   * @param user - Firebase User object
   * @param password - User's password for re-authentication
   */
  static async deleteAccount(user: User, password: string): Promise<void> {
    if (!user || !password) {
      throw new Error('User and password are required for account deletion');
    }

    try {
      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(user.email!, password);
      await reauthenticateWithCredential(user, credential);

      // Small delay to ensure auth state is updated
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Ensure we have a current user and valid auth token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User session expired. Please sign in again.');
      }

      // Get a fresh ID token to ensure authentication
      const idToken = await currentUser.getIdToken(true);
      console.log('🔑 Got fresh ID token for account deletion', {
        uid: currentUser.uid,
        email: currentUser.email,
        tokenLength: idToken.length
      });

      // Call the Cloud Function to delete the account with admin privileges
      // Use the pre-configured functions instance from Firebase config
      const deleteUserAccount = httpsCallable<
        { password: string },
        { success: boolean; message: string; deletedDocuments: number }
      >(functions, 'deleteUserAccount');

      console.log('📞 Calling deleteUserAccount Cloud Function...');
      const result = await deleteUserAccount({ password });
      console.log('✅ Cloud Function call completed:', result.data);

      if (!result.data.success) {
        throw new Error(result.data.message || 'Failed to delete account');
      }

      console.log(`✅ Account deleted successfully. ${result.data.deletedDocuments} documents removed.`);

    } catch (error: any) {
      console.error('Error deleting account:', error);

      // Handle Firebase Function errors
      if (error.code === 'functions/invalid-argument') {
        throw new Error('Password is required for account deletion.');
      } else if (error.code === 'functions/unauthenticated') {
        throw new Error('You must be logged in to delete your account.');
      } else if (error.code === 'functions/failed-precondition') {
        throw new Error('Please sign out and sign back in, then try deleting your account again.');
      } else if (error.code === 'functions/not-found') {
        throw new Error('User account not found.');
      }

      // Handle Firebase Auth re-authentication errors
      if (error.code === 'auth/wrong-password') {
        throw new Error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        throw new Error('Too many failed attempts. Please try again later.');
      } else if (error.code === 'auth/user-mismatch') {
        throw new Error('User credentials do not match. Please try again.');
      } else if (error.code === 'auth/user-not-found') {
        throw new Error('User not found. Please try again.');
      } else if (error.code === 'auth/requires-recent-login') {
        throw new Error('Please sign out and sign back in, then try deleting your account again.');
      } else {
        throw new Error(error.message || 'Failed to delete account. Please try again.');
      }
    }
  }


  /**
   * Validate password format (basic validation)
   * @param password - Password to validate
   */
  static validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password || password.trim().length === 0) {
      return {
        isValid: false,
        error: 'Please enter your password to confirm account deletion'
      };
    }

    if (password.length < 6) {
      return {
        isValid: false,
        error: 'Password must be at least 6 characters long'
      };
    }

    return { isValid: true };
  }
}