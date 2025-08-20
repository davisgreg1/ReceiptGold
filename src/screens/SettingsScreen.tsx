import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
  ActivityIndicator,
  Alert,
  useColorScheme,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SettingsStackParamList } from '../navigation/AppNavigator';
import { useTheme } from '../theme/ThemeProvider';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '../context/AuthContext';
import { useStripePayments } from '../hooks/useStripePayments';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth, updateProfile, EmailAuthProvider, updatePassword, reauthenticateWithCredential, deleteUser } from 'firebase/auth';
import { useCustomAlert } from '../hooks/useCustomAlert';
import { FirebaseErrorScenarios } from '../utils/firebaseErrorHandler';
import { BankReceiptService, BankConnection } from '../services/BankReceiptService';
import { PlaidService } from '../services/PlaidService';
import { LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
        {title}
      </Text>
      <View style={[styles.sectionContent, { 
        backgroundColor: theme.background.secondary,
        borderColor: theme.border.primary,
      }]}>
        {children}
      </View>
    </View>
  );
};

interface SettingsRowProps {
  label: string;
  value?: string;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  description?: string;
}

const SettingsRow: React.FC<SettingsRowProps> = ({
  label,
  value,
  isSwitch,
  switchValue,
  onSwitchChange,
  onPress,
  rightElement,
  description,
}) => {
  const { theme } = useTheme();

  const content = (
    <>
      <View style={styles.settingsRowMain}>
        <Text style={[styles.settingsLabel, { color: theme.text.primary }]}>
          {label}
        </Text>
        {isSwitch ? (
          <Switch
            value={switchValue}
            onValueChange={onSwitchChange}
            trackColor={{ false: theme.text.tertiary, true: theme.gold.primary }}
          />
        ) : rightElement ? (
          rightElement
        ) : value ? (
          <Text style={[styles.settingsValue, { color: theme.text.secondary }]}>
            {value}
          </Text>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
        )}
      </View>
      {description && (
        <Text style={[styles.settingsDescription, { color: theme.text.tertiary }]}>
          {description}
        </Text>
      )}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={[styles.settingsRow, { borderColor: theme.border.primary }]}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.settingsRow, { borderColor: theme.border.primary }]}>
      {content}
    </View>
  );
};

const BUSINESS_TYPES = [
  'Sole Proprietorship',
  'Limited Liability Company (LLC)',
  'Corporation',
  'S Corporation',
  'Partnership',
  'Limited Partnership',
  'Limited Liability Partnership (LLP)',
  'Nonprofit Organization',
  'Cooperative',
  'Professional Corporation (PC)',
];

export const SettingsScreen: React.FC = () => {
  const { theme, themeMode, toggleTheme } = useTheme();
  const { subscription, canAccessFeature } = useSubscription();
  console.log("🚀 ~ SettingsScreen ~ subscription:", subscription)
  const { user, logout, refreshUser } = useAuth();
  const { handleSubscriptionWithCloudFunction, SUBSCRIPTION_TIERS } = useStripePayments();
  const navigation = useNavigation<StackNavigationProp<SettingsStackParamList>>();
  const { showSuccess, showError, showWarning, showInfo, showFirebaseError, hideAlert } = useCustomAlert();
  
  const [userData, setUserData] = React.useState<{ firstName?: string; lastName?: string; }>({});
  const [emailUpdates, setEmailUpdates] = React.useState(true);
  const [isUpgrading, setIsUpgrading] = React.useState(false);
  const [showNameDialog, setShowNameDialog] = React.useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = React.useState(false);
  const [showDeleteAccountDialog, setShowDeleteAccountDialog] = React.useState(false);
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [deleteConfirmPassword, setDeleteConfirmPassword] = React.useState('');
  const [showDeletePassword, setShowDeletePassword] = React.useState(false);

  const canUseBankConnection = canAccessFeature('bankConnection');


  // Fetch user data from Firestore
  React.useEffect(() => {
    if (!user) return;
    
    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          setFirstName(data.firstName || '');
          setLastName(data.lastName || '');
          
          // Set business info
          if (data.profile) {
            setBusinessInfo({
              businessName: data.profile.businessName || '',
              businessType: data.profile.businessType || 'Sole Proprietorship',
              taxId: data.profile.taxId || '',
              phone: data.profile.phone || '',
              street: data.profile.address?.street || '',
              city: data.profile.address?.city || '',
              state: data.profile.address?.state || '',
              zipCode: data.profile.address?.zipCode || '',
              country: data.profile.address?.country || 'US'
            });
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [user]);

  // Fetch bank connections on focus - this ensures it refreshes when navigating from Bank Sync
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        refreshBankConnections();
      }
    }, [user])
  );
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [showBusinessDialog, setShowBusinessDialog] = React.useState(false);
  
  // Bank accounts state
  const [bankConnections, setBankConnections] = React.useState<BankConnection[]>([]);
  const [loadingBankConnections, setLoadingBankConnections] = React.useState(true);
  const [disconnectingAccount, setDisconnectingAccount] = React.useState<string | null>(null);
  
  // Services
  const bankReceiptService = BankReceiptService.getInstance();
  const plaidService = PlaidService.getInstance();
  const [showIOSPicker, setShowIOSPicker] = React.useState(false);
  const formatEIN = (ein: string) => {
    // Remove all non-numeric characters
    const numbers = ein.replace(/[^\d]/g, '');
    
    // Format as XX-XXXXXXX
    if (numbers.length <= 2) return numbers;
    return `${numbers.slice(0, 2)}-${numbers.slice(2, 9)}`;
  };

  const [businessInfo, setBusinessInfo] = React.useState({
    businessName: '',
    businessType: 'Sole Proprietorship',
    taxId: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US'
  });
  
  const handleNameChange = async () => {
    if (!user || !firstName.trim()) return;
    
    setIsLoading(true);
    try {
      const trimmedFirstName = firstName.trim();
      const trimmedLastName = lastName.trim();
      const fullName = `${trimmedFirstName}${trimmedLastName ? ' ' + trimmedLastName : ''}`;
      
      const auth = getAuth();
      await updateProfile(auth.currentUser!, {
        displayName: fullName
      });
      
      // Update Firestore user document with both displayName and split name fields
      const updatedData = {
        displayName: fullName,
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
      };
      
      await updateDoc(doc(db, 'users', user.uid), updatedData);
      
      // Update local state
      setUserData(prev => ({ ...prev, ...updatedData }));
      
      // Refresh the Firebase user to get updated displayName
      await refreshUser();
      
      setShowNameDialog(false);
      showSuccess('Success', 'Name updated successfully');
    } catch (error: any) {
      showFirebaseError(error, 'Failed to Update Name');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    console.log('handlePasswordChange called', { 
      hasUser: !!user, 
      currentPasswordLength: currentPassword?.length || 0,
      newPasswordLength: newPassword?.length || 0,
      confirmPasswordLength: confirmPassword?.length || 0
    });

    if (!user || !currentPassword || !newPassword || !confirmPassword) {
      console.log('Missing required fields for password change');
      showError('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      console.log('Passwords do not match');
      showError('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      console.log('Password too short');
      showError('Error', 'New password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting password change process');
      const auth = getAuth();
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      
      // First reauthenticate
      console.log('Reauthenticating user');
      await reauthenticateWithCredential(auth.currentUser!, credential);
      
      // Then update password
      console.log('Updating password');
      await updatePassword(auth.currentUser!, newPassword);
      
      console.log('Password updated successfully');
      setShowPasswordDialog(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      showSuccess('Success', 'Password updated successfully');
    } catch (error: any) {
      console.error('Password change error:', error);
      showFirebaseError(error, FirebaseErrorScenarios.AUTH.PROFILE_UPDATE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (tierId: string) => {
    if (!user?.email) {
      showError('Error', 'You must be logged in to upgrade');
      return;
    }

    setIsUpgrading(true);
    try {
      const showAlert = (type: 'error' | 'success' | 'warning', title: string, message: string) => {
        switch (type) {
          case 'error':
            showError(title, message);
            break;
          case 'success':
            showSuccess(title, message);
            break;
          case 'warning':
            showWarning(title, message);
            break;
        }
      };
      
      await handleSubscriptionWithCloudFunction(
        tierId as any,
        user.email,
        user.displayName || 'User',
        undefined,
        showAlert
      );
    } catch (error) {
      console.error('Failed to upgrade:', error);
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleThemeChange = async (isDark: boolean) => {
    if (!user) return;
    const newTheme = isDark ? 'dark' : 'light';
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        settings: {
          theme: newTheme,
          defaultCurrency: 'USD', // Preserve existing currency setting
        },
      });
      toggleTheme(); // Update the theme in ThemeProvider
    } catch (error) {
      console.error('Failed to update theme setting:', error);
    }
  };

  const handleEmailUpdatesChange = async (value: boolean) => {
    if (!user) return;
    setEmailUpdates(value);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationSettings: {
          emailUpdates: value,
        },
      });
    } catch (error) {
      console.error('Failed to update email settings:', error);
    }
  };

  const handleBusinessInfoUpdate = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        profile: {
          businessName: businessInfo.businessName,
          businessType: businessInfo.businessType,
          taxId: businessInfo.taxId,
          phone: businessInfo.phone,
          address: {
            street: businessInfo.street,
            city: businessInfo.city,
            state: businessInfo.state,
            zipCode: businessInfo.zipCode,
            country: businessInfo.country,
          }
        }
      });
      
      setShowBusinessDialog(false);
      showSuccess('Success', 'Business information updated successfully');
    } catch (error: any) {
      showFirebaseError(error, 'Failed to Update Business Information');
    } finally {
      setIsLoading(false);
    }
  };

  // Bank account handlers
  const handleDisconnectBankAccount = async (connection: BankConnection) => {
    const performDisconnect = async () => {
      if (!user) return;
      
      try {
        hideAlert(); // Close the alert first
        setDisconnectingAccount(connection.id);
        const bankReceiptService = BankReceiptService.getInstance();
        await bankReceiptService.disconnectBankAccount(user.uid, connection.id);
        
        // Update local state
        setBankConnections(prev => prev.filter(conn => conn.id !== connection.id));
        
        showSuccess('Success', `${connection.institutionName} disconnected successfully`);
      } catch (error: any) {
        console.error('Error disconnecting bank account:', error);
        showError('Error', 'Failed to disconnect bank account. Please try again.');
      } finally {
        setDisconnectingAccount(null);
      }
    };

    // Use custom alert with warning type and two buttons
    showWarning(
      'Disconnect Bank Account',
      `Are you sure you want to disconnect ${connection.institutionName}? This will stop automatic receipt generation for this account.`,
      {
        primaryButtonText: 'Disconnect',
        secondaryButtonText: 'Cancel',
        onPrimaryPress: performDisconnect,
        onSecondaryPress: hideAlert // Properly close the alert
      }
    );
  };

  // Refresh bank connections
  const refreshBankConnections = async () => {
    if (!user) return;
    
    try {
      setLoadingBankConnections(true);
      const connections = await bankReceiptService.getBankConnections(user.uid);
      setBankConnections(connections.filter(conn => conn.isActive));
    } catch (error) {
      console.error('Error fetching bank connections:', error);
      setBankConnections([]);
    } finally {
      setLoadingBankConnections(false);
    }
  };

  // Plaid connection functions
  const connectBankAccount = async () => {
    if (!user) return;

    try {
      // Create link token and immediately open Plaid
      const token = await plaidService.createLinkToken(user.uid);
      
      // Import Plaid SDK and open directly
      const { create, open } = await import('react-native-plaid-link-sdk');
      
      console.log('🔗 Creating and opening Plaid Link directly...');
      
      // Create Link with token
      create({ token });
      
      // Wait a moment for create() to complete before opening
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Open Link with callbacks
      open({
        onSuccess: handlePlaidSuccess,
        onExit: (exit: LinkExit) => {
          console.log('Plaid Link exited:', exit);
          if (exit.error) {
            showError('Connection Error', exit.error.errorMessage || 'Failed to connect bank account.');
          }
        },
      });
      
      console.log('🔗 Plaid Link opened successfully');
      
    } catch (error) {
      console.error('Error opening Plaid Link:', error);
      showError('Connection Error', 'Failed to prepare bank connection. Please try again.');
    }
  };

  const handlePlaidSuccess = async (success: LinkSuccess) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const accessToken = await plaidService.exchangePublicToken(success.publicToken);
      const accounts = await plaidService.getAccounts(accessToken);
      
      // Create bank connection record
      const bankConnection = {
        id: `bank_${user.uid}_${Date.now()}`,
        userId: user.uid,
        accessToken,
        institutionName: 'Connected Bank',
        accounts: accounts.map(acc => ({
          accountId: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask,
        })),
        connectedAt: new Date(),
        lastSyncAt: new Date(),
        isActive: true,
      };

      await bankReceiptService.saveBankConnectionLocally(bankConnection);
      
      showSuccess('Bank Connected!', 'Your bank account has been connected successfully.');
      
      // Refresh bank connections list
      await refreshBankConnections();
    } catch (error) {
      console.error('Error handling Plaid success:', error);
      showError('Connection Failed', 'Failed to complete bank connection. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlaidExit = (exit: LinkExit) => {
    console.log('Plaid Link exited:', exit);
    if (exit.error) {
      showError('Connection Error', exit.error.errorMessage || 'Failed to connect bank account.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    
    // Validate password
    if (!deleteConfirmPassword.trim()) {
      showError('Error', 'Please enter your password to confirm account deletion');
      return;
    }

    setIsLoading(true);
    try {
      // Re-authenticate user before deletion
      const credential = EmailAuthProvider.credential(user.email!, deleteConfirmPassword);
      await reauthenticateWithCredential(user, credential);

      // Delete all user data from Firestore
      const batch = writeBatch(db);
      
      // Delete user document
      batch.delete(doc(db, 'users', user.uid));
      
      // Delete all receipts
      const receiptsQuery = query(collection(db, 'receipts'), where('userId', '==', user.uid));
      const receiptsSnapshot = await getDocs(receiptsQuery);
      receiptsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Delete all budgets
      const budgetsQuery = query(collection(db, 'budgets'), where('userId', '==', user.uid));
      const budgetsSnapshot = await getDocs(budgetsQuery);
      budgetsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // Commit the batch delete
      await batch.commit();

      // Delete the user account from Firebase Auth
      await deleteUser(user);

      showSuccess(
        'Account Deleted',
        'Your account and all associated data have been permanently deleted.'
      );
    } catch (error: any) {
      showFirebaseError(error, 'Failed to Delete Account');
    } finally {
      setIsLoading(false);
      setShowDeleteAccountDialog(false);
      setDeleteConfirmPassword('');
      setShowDeletePassword(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView style={styles.content}>
        {/* Account Section */}
        <SettingsSection title="Account">
          <SettingsRow
            label="Email"
            value={user?.email || 'Not signed in'}
          />
          <SettingsRow
            label="Member Since"
            value={user?.metadata?.creationTime ? 
              new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : 'Unknown'
            }
          />
          <SettingsRow
            label="Name"
            value={user?.displayName || 'Not set'}
            onPress={() => {
              setFirstName(userData.firstName || '');
              setLastName(userData.lastName || '');
              setShowNameDialog(true);
            }}
          />
          <SettingsRow
            label="Change Password"
            onPress={() => setShowPasswordDialog(true)}
          />
        </SettingsSection>

        {/* Subscription Section */}
        <SettingsSection title="Subscription">
          <SettingsRow
            label="Current Plan"
            value={subscription.currentTier.charAt(0).toUpperCase() + subscription.currentTier.slice(1)}
            description={subscription.isActive ? 
              `Your plan renews on ${subscription.expiresAt?.toLocaleDateString() || 'N/A'}` : 
              subscription.currentTier === 'free' ? 
                'Free plan' : 
                `Your plan has expired`}
          />
          <View style={[styles.planSelector, { backgroundColor: theme.background.tertiary }]}>
            {Object.values(SUBSCRIPTION_TIERS).filter(tier => tier.id !== 'free').map((tierInfo) => {
              const isSelected = subscription.currentTier === tierInfo.id;
              const tierDescription = tierInfo.features[0];

              return (
                <TouchableOpacity
                  key={tierInfo.id}
                  style={[
                    styles.planOption,
                    { 
                      borderColor: isSelected ? theme.gold.primary : theme.border.primary,
                      backgroundColor: isSelected ? theme.gold.primary + '10' : 'transparent'
                    }
                  ]}
                  onPress={() => handleUpgrade(tierInfo.id)}
                  disabled={isUpgrading || isSelected}
                >
                  <View style={styles.planHeader}>
                    <Text style={[styles.planName, { 
                      color: isSelected ? theme.gold.primary : theme.text.primary,
                      fontWeight: isSelected ? '700' : '600'
                    }]}>
                      {tierInfo.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.currentPlanBadge, { backgroundColor: theme.gold.primary }]}>
                        <Text style={styles.currentPlanText}>Current Plan</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.planPrice, { 
                    color: isSelected ? theme.gold.primary : theme.text.primary 
                  }]}>
                    ${tierInfo.price}/mo
                  </Text>
                  <Text style={[styles.planDescription, { color: theme.text.secondary }]}>
                    {tierDescription}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {isUpgrading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator color={theme.gold.primary} size="large" />
            </View>
          )}
        </SettingsSection>

        {/* Bank Accounts Section */}
        {canUseBankConnection && (
          <SettingsSection title="Connected Bank Accounts">
            {loadingBankConnections ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.gold.primary} />
                <Text style={[styles.loadingText, { color: theme.text.secondary }]}>
                  Loading bank connections...
              </Text>
            </View>
          ) : bankConnections.length > 0 ? (
            <>
              {bankConnections.map((connection) => (
                <View key={connection.id} style={[styles.bankConnectionRow, { 
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}>
                  <View style={styles.bankConnectionInfo}>
                    <View style={styles.bankConnectionHeader}>
                      <Ionicons 
                        name="card" 
                        size={24} 
                        color={theme.gold.primary} 
                        style={styles.bankIcon}
                      />
                      <View style={styles.bankConnectionDetails}>
                        <Text style={[styles.bankName, { color: theme.text.primary }]}>
                          {connection.institutionName}
                        </Text>
                        <Text style={[styles.bankAccountsCount, { color: theme.text.secondary }]}>
                          {connection.accounts.length} account{connection.accounts.length !== 1 ? 's' : ''} connected
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.bankConnectionDate, { color: theme.text.tertiary }]}>
                      Connected {new Date(connection.connectedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.disconnectButton, { 
                      borderColor: theme.status.error,
                      opacity: disconnectingAccount === connection.id ? 0.6 : 1 
                    }]}
                    onPress={() => handleDisconnectBankAccount(connection)}
                    disabled={disconnectingAccount === connection.id}
                  >
                    {disconnectingAccount === connection.id ? (
                      <ActivityIndicator size="small" color={theme.status.error} />
                    ) : (
                      <Text style={[styles.disconnectButtonText, { color: theme.status.error }]}>
                        Disconnect
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              ))}
              <View style={[styles.bankAccountsFooter, { borderTopColor: theme.border.primary }]}>
                <Ionicons name="information-circle" size={16} color={theme.text.tertiary} />
                <Text style={[styles.bankAccountsFooterText, { color: theme.text.tertiary }]}>
                  Disconnecting will stop automatic receipt generation for these accounts
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.noBankAccountsContainer}>
              <Ionicons name="card-outline" size={48} color={theme.text.tertiary} />
              <Text style={[styles.noBankAccountsTitle, { color: theme.text.primary }]}>
                No Bank Accounts Connected
              </Text>
              <Text style={[styles.noBankAccountsDescription, { color: theme.text.secondary }]}>
                Connect your bank account to automatically generate receipts from your transactions
              </Text>
              
              <TouchableOpacity
                style={[styles.connectBankButton, { backgroundColor: theme.gold.primary }]}
                onPress={connectBankAccount}
              >
                <Ionicons name="add" size={20} color="white" />
                <Text style={styles.connectBankButtonText}>Connect Bank Account</Text>
              </TouchableOpacity>
            </View>
          )}
        </SettingsSection>
      )}

        {/* Notifications Section */}
        <SettingsSection title="Notifications">
          <SettingsRow
            label="Notification Settings"
            onPress={() => navigation.navigate('Notifications')}
            rightElement={<Ionicons name="chevron-forward" size={20} color={theme.text.secondary} />}
            description="Manage push notifications, quiet hours, and notification types"
          />
          <SettingsRow
            label="Email Updates"
            isSwitch
            switchValue={emailUpdates}
            onSwitchChange={handleEmailUpdatesChange}
            description="Receive monthly reports and important announcements"
          />
        </SettingsSection>

        {/* Appearance Section */}
        <SettingsSection title="Appearance">
          <SettingsRow
            label="Dark Mode"
            isSwitch
            switchValue={themeMode === 'dark'}
            onSwitchChange={handleThemeChange}
            description="Toggle between light and dark theme"
          />
        </SettingsSection>

        {/* Business Information Section */}
        <SettingsSection title="Business Information">
          <SettingsRow
            label="Business Name"
            value={businessInfo.businessName || 'Not set'}
            onPress={() => setShowBusinessDialog(true)}
          />
          <SettingsRow
            label="Business Type"
            value={businessInfo.businessType}
            onPress={() => setShowBusinessDialog(true)}
          />
          <SettingsRow
            label="Phone"
            value={businessInfo.phone || 'Not set'}
            onPress={() => setShowBusinessDialog(true)}
          />
          <SettingsRow
            label="Address"
            value={businessInfo.street ? `${businessInfo.city}, ${businessInfo.state}` : 'Not set'}
            onPress={() => setShowBusinessDialog(true)}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="Support">
          <SettingsRow
            label="Help Center"
            onPress={() => navigation.navigate('Help')}
          />
          <SettingsRow
            label="Contact Support"
            onPress={() => navigation.navigate('ContactSupport')}
          />
          <SettingsRow
            label="Privacy Policy"
            onPress={() => navigation.navigate('PrivacyPolicy')}
          />
          <SettingsRow
            label="Terms of Service"
            onPress={() => navigation.navigate('TermsOfService')}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Account Actions">
          <TouchableOpacity
            style={[styles.signOutButton, { borderColor: theme.status.error }]}
            onPress={logout}
          >
            <Text style={[styles.signOutButtonText, { color: theme.status.error }]}>
              Sign Out
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.deleteAccountButton, { 
              borderColor: theme.status.error,
              backgroundColor: theme.status.error + '10'
            }]}
            onPress={() => setShowDeleteAccountDialog(true)}
          >
            <Text style={[styles.deleteAccountButtonText, { color: theme.status.error }]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </SettingsSection>
      </ScrollView>

      {/* Name Change Dialog */}
      {showNameDialog && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>Change Name</Text>
            <TextInput
              style={[styles.input, { 
                color: theme.text.primary,
                backgroundColor: theme.background.tertiary,
                borderColor: theme.border.primary 
              }]}
              placeholder="First name"
              placeholderTextColor={theme.text.tertiary}
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
            <TextInput
              style={[styles.input, { 
                color: theme.text.primary,
                backgroundColor: theme.background.tertiary,
                borderColor: theme.border.primary 
              }]}
              placeholder="Last name (optional)"
              placeholderTextColor={theme.text.tertiary}
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, { borderColor: theme.border.primary }]}
                onPress={() => {
                  setShowNameDialog(false);
                  setFirstName('');
                  setLastName('');
                }}
              >
                <Text style={[styles.dialogButtonText, { color: theme.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, { backgroundColor: theme.gold.primary }]}
                onPress={handleNameChange}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: 'white' }]}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Business Information Dialog */}
      {showBusinessDialog && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={styles.modalContainer}>
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={[styles.dialog, { backgroundColor: theme.background.secondary }]}>
                <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>Business Information</Text>
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Business Name"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.businessName}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, businessName: text }))}
              />
              <View style={[styles.pickerContainer, { 
                borderColor: theme.border.primary,
                backgroundColor: theme.background.tertiary,
              }]}>
                {Platform.OS === 'ios' ? (
                  <TouchableOpacity 
                    style={styles.iosPickerButton}
                    onPress={() => setShowIOSPicker(true)}
                  >
                    <Text style={[styles.iosPickerText, { color: theme.text.primary }]}>
                      {businessInfo.businessType}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.text.tertiary} />
                  </TouchableOpacity>
                ) : (
                  <Picker
                    selectedValue={businessInfo.businessType}
                    onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessType: value }))}
                    style={[
                      styles.picker, 
                      { 
                        color: theme.text.primary,
                        backgroundColor: theme.background.tertiary
                      }
                    ]}
                    dropdownIconColor={theme.text.primary}
                    mode="dropdown"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <Picker.Item 
                        key={type} 
                        label={type} 
                        value={type} 
                        color="#000000"
                      />
                    ))}
                  </Picker>
                )}
              </View>
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Tax ID (EIN: XX-XXXXXXX)"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.taxId}
                onChangeText={(text) => {
                  const formatted = formatEIN(text);
                  if (formatted.length <= 10) { // Max length of XX-XXXXXXX
                    setBusinessInfo(prev => ({ ...prev, taxId: formatted }));
                  }
                }}
                keyboardType="numeric"
                maxLength={10} // Length of XX-XXXXXXX
              />
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Phone"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.phone}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, phone: text }))}
                keyboardType="phone-pad"
              />
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Street Address"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.street}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, street: text }))}
              />
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="City"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.city}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, city: text }))}
              />
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="State"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.state}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, state: text }))}
              />
              <TextInput
                style={[styles.input, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="ZIP Code"
                placeholderTextColor={theme.text.tertiary}
                value={businessInfo.zipCode}
                onChangeText={(text) => setBusinessInfo(prev => ({ ...prev, zipCode: text }))}
                keyboardType="numeric"
              />
              <View style={styles.dialogButtons}>
                <TouchableOpacity
                  style={[styles.dialogButton, { borderColor: theme.border.primary }]}
                  onPress={() => setShowBusinessDialog(false)}
                >
                  <Text style={[styles.dialogButtonText, { color: theme.text.primary }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.dialogButton, { backgroundColor: theme.gold.primary }]}
                  onPress={handleBusinessInfoUpdate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text style={[styles.dialogButtonText, { color: 'white' }]}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
              </View>
            </ScrollView>
          </View>
        </View>
      )}

      {/* iOS Business Type Picker Modal */}
      {showIOSPicker && Platform.OS === 'ios' && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.iosPickerModal, { backgroundColor: theme.background.secondary }]}>
            <View style={[styles.iosPickerHeader, { borderBottomColor: theme.border.primary }]}>
              <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <Text style={[styles.iosPickerTitle, { color: theme.text.primary }]}>Business Type</Text>
              <TouchableOpacity onPress={() => setShowIOSPicker(false)}>
                <Text style={[styles.iosPickerAction, { color: theme.gold.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Picker
              selectedValue={businessInfo.businessType}
              onValueChange={(value) => setBusinessInfo(prev => ({ ...prev, businessType: value }))}
              style={[styles.iosPickerWheel, { backgroundColor: theme.background.secondary }]}
              itemStyle={{ color: theme.text.primary, fontSize: 18 }}
            >
              {BUSINESS_TYPES.map((type) => (
                <Picker.Item 
                  key={type} 
                  label={type} 
                  value={type} 
                  color={theme.text.primary}
                />
              ))}
            </Picker>
          </View>
        </View>
      )}

      {/* Password Change Dialog */}
      {showPasswordDialog && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>Change Password</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.passwordInput, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Current password"
                placeholderTextColor={theme.text.tertiary}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrentPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.passwordInput, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="New password"
                placeholderTextColor={theme.text.tertiary}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.passwordInput, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Confirm new password"
                placeholderTextColor={theme.text.tertiary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, { borderColor: theme.border.primary }]}
                onPress={() => {
                  setShowPasswordDialog(false);
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                  setShowCurrentPassword(false);
                  setShowNewPassword(false);
                  setShowConfirmPassword(false);
                }}
              >
                <Text style={[styles.dialogButtonText, { color: theme.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, { backgroundColor: theme.gold.primary }]}
                onPress={handlePasswordChange}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: 'white' }]}>Update</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Delete Account Dialog */}
      {showDeleteAccountDialog && (
        <View style={[styles.modalOverlay, { backgroundColor: theme.background.overlay }]}>
          <View style={[styles.dialog, { backgroundColor: theme.background.secondary }]}>
            <Text style={[styles.dialogTitle, { color: theme.text.primary }]}>Delete Account</Text>
            <Text style={[styles.dialogText, { color: theme.text.secondary, marginBottom: 16 }]}>
              This action cannot be undone. All your receipts, data, and account information will be permanently deleted.
            </Text>
            <Text style={[styles.dialogText, { color: theme.text.secondary, marginBottom: 16 }]}>
              Please enter your password to confirm:
            </Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={[styles.passwordInput, { 
                  color: theme.text.primary,
                  backgroundColor: theme.background.tertiary,
                  borderColor: theme.border.primary 
                }]}
                placeholder="Current password"
                placeholderTextColor={theme.text.tertiary}
                value={deleteConfirmPassword}
                onChangeText={setDeleteConfirmPassword}
                secureTextEntry={!showDeletePassword}
              />
              <TouchableOpacity
                style={styles.passwordToggle}
                onPress={() => setShowDeletePassword(!showDeletePassword)}
              >
                <Ionicons
                  name={showDeletePassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.text.tertiary}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogButton, { borderColor: theme.border.primary }]}
                onPress={() => {
                  setShowDeleteAccountDialog(false);
                  setDeleteConfirmPassword('');
                  setShowDeletePassword(false);
                }}
              >
                <Text style={[styles.dialogButtonText, { color: theme.text.primary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogButton, { backgroundColor: theme.status.error }]}
                onPress={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={[styles.dialogButtonText, { color: 'white' }]}>Delete Account</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      
    </SafeAreaView>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  planSelector: {
    padding: 16,
    borderRadius: 12,
  },
  planOption: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
  },
  currentPlanBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentPlanText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  planDescription: {
    fontSize: 14,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  pickerContainer: {
    height: Platform.OS === 'android' ? 56 : 48,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    height: Platform.OS === 'android' ? 56 : 48,
    width: '100%',
    ...Platform.select({
      android: {
        marginTop: -8,
        marginBottom: -8,
      },
      ios: {
        // Ensure iOS picker is properly positioned
        height: 48,
      },
    }),
  },
  iosPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: 12,
  },
  iosPickerText: {
    fontSize: 16,
    flex: 1,
  },
  hiddenPicker: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
  },
  iosPickerModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  iosPickerAction: {
    fontSize: 16,
    fontWeight: '600',
  },
  iosPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  iosPickerWheel: {
    height: 200,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsRow: {
    padding: 16,
    borderBottomWidth: 1,
  },
  settingsRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsLabel: {
    fontSize: 16,
    flex: 1,
  },
  settingsValue: {
    fontSize: 16,
    marginLeft: 8,
  },
  settingsDescription: {
    fontSize: 12,
    marginTop: 4,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  upgradeIcon: {
    marginRight: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signOutButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  deleteAccountButton: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginHorizontal: 16,
    marginVertical: 8,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  dialog: {
    width: width - 48,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  dialogText: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  dialogButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 6,
    borderWidth: 1,
  },
  dialogButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  passwordInputContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  passwordInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingRight: 48, // Make room for the eye icon
    fontSize: 16,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 4,
  },
  // Bank Accounts Styles
  loadingContainer: {
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
  },
  bankConnectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  bankConnectionInfo: {
    flex: 1,
    marginRight: 12,
  },
  bankConnectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bankIcon: {
    marginRight: 12,
  },
  bankConnectionDetails: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  bankAccountsCount: {
    fontSize: 14,
  },
  bankConnectionDate: {
    fontSize: 12,
    marginTop: 4,
  },
  disconnectButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 90,
    alignItems: 'center',
  },
  disconnectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  bankAccountsFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderTopWidth: 1,
  },
  bankAccountsFooterText: {
    fontSize: 12,
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  noBankAccountsContainer: {
    alignItems: 'center',
    padding: 32,
  },
  noBankAccountsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  noBankAccountsDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  connectBankButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  connectBankButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
});
