import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface MockPlaidLinkButtonProps {
  linkToken: string;
  onSuccess: (success: any) => void;
  onExit: (exit: any) => void;
  children: React.ReactNode;
  style?: any;
}

export const MockPlaidLinkButton: React.FC<MockPlaidLinkButtonProps> = ({
  linkToken,
  onSuccess,
  onExit,
  children,
  style
}) => {
  const { theme } = useTheme();

  const handlePress = () => {
    Alert.alert(
      'Mock Plaid Link',
      'This is a mock Plaid Link for development with Expo Go. Would you like to simulate a successful bank connection?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            onExit({
              error: null,
              metadata: {
                linkSessionId: 'mock-session-id',
                institution: null,
                status: 'institution_not_found'
              }
            });
          }
        },
        {
          text: 'Connect Mock Bank',
          onPress: () => {
            // Simulate successful connection after a brief delay
            setTimeout(() => {
              onSuccess({
                publicToken: 'public-sandbox-mock-token-' + Date.now(),
                metadata: {
                  accounts: [
                    {
                      id: 'mock-account-1',
                      name: 'Mock Checking',
                      mask: '0000',
                      type: 'depository',
                      subtype: 'checking'
                    },
                    {
                      id: 'mock-account-2', 
                      name: 'Mock Savings',
                      mask: '1111',
                      type: 'depository',
                      subtype: 'savings'
                    }
                  ],
                  institution: {
                    name: 'Mock Bank',
                    id: 'ins_mock'
                  },
                  linkSessionId: 'mock-session-' + Date.now()
                }
              });
            }, 1000);
          }
        }
      ]
    );
  };

  return (
    <TouchableOpacity style={[styles.button, style]} onPress={handlePress}>
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
