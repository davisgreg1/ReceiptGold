import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

interface SignatureProps {
  style?: any;
  variant?: 'default' | 'compact' | 'footer';
}

export const Signature: React.FC<SignatureProps> = ({ 
  style,
  variant = 'default'
}) => {
  const { theme } = useTheme();
  
  const getContainerStyle = () => {
    switch (variant) {
      case 'compact':
        return [styles.containerCompact, { borderTopColor: theme.border.secondary }];
      case 'footer':
        return [styles.containerFooter, { backgroundColor: theme.background.secondary }];
      default:
        return styles.container;
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'compact':
        return [styles.textCompact, { color: theme.text.tertiary }];
      case 'footer':
        return [styles.textFooter, { color: theme.text.secondary }];
      default:
        return [styles.text, { color: theme.text.tertiary }];
    }
  };

  const getHeartStyle = () => {
    switch (variant) {
      case 'footer':
        return [styles.heart, { color: theme.status.error }];
      default:
        return [styles.heart, { color: theme.status.error }];
    }
  };

  return (
    <View style={[getContainerStyle(), style]}>
      <Text style={getTextStyle()}>
        GregDavisTech, LLC 2025
      </Text>
      <Text style={[getTextStyle(), { marginTop: 2 }]}>
        Made with{' '}
        <Text style={getHeartStyle()}>❤️</Text>
        {' '}in ATL
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  containerCompact: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    marginTop: 16,
  },
  containerFooter: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  text: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 15,
    fontWeight: '400',
    letterSpacing: 0.1,
  },
  textFooter: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  heart: {
    fontSize: 12,
  },
});