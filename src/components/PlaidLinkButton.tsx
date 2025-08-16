import React, { useState } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { LinkSuccess, LinkExit, create, open } from 'react-native-plaid-link-sdk';
import { useTheme } from '../theme/ThemeProvider';

interface PlaidLinkButtonProps {
  linkToken: string;
  onSuccess: (success: LinkSuccess) => void;
  onExit: (exit: LinkExit) => void;
  children: React.ReactNode;
  style?: any;
}

export const PlaidLinkButton: React.FC<PlaidLinkButtonProps> = ({
  linkToken,
  onSuccess,
  onExit,
  children,
  style
}) => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    console.log('🔗 PlaidLinkButton pressed with token:', linkToken.substring(0, 20) + '...');
    setLoading(true);

    try {
      // Create Link with token - simple object structure
      console.log('🔗 Creating Plaid Link from component...');
      create({ token: linkToken });
      
      // Wait a moment for create() to complete before opening
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Open Link with callbacks - separate object structure
      console.log('🔗 Opening Plaid Link from component...');
      const openProps = {
        onSuccess: (success: LinkSuccess) => {
          console.log('✅ PlaidLinkButton success:', success);
          setLoading(false);
          onSuccess(success);
        },
        onExit: (exit: LinkExit) => {
          console.log('⚠️ PlaidLinkButton exit:', exit);
          setLoading(false);
          onExit(exit);
        },
      };
      
      open(openProps);
      console.log('🔗 Plaid Link open() called successfully');
      
    } catch (error) {
      console.error('❌ Error in PlaidLinkButton:', error);
      setLoading(false);
    }
  };

  if (!linkToken) {
    return (
      <TouchableOpacity style={[styles.button, style]} disabled>
        <Text style={[styles.buttonText, { opacity: 0.5 }]}>Loading...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.button, style]} 
      onPress={handlePress}
      disabled={loading}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFFFFF" />
          <Text style={[styles.buttonText, { marginLeft: 8 }]}>Connecting...</Text>
        </View>
      ) : (
        children
      )}
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
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
