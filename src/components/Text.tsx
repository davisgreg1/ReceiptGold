import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

export const Text: React.FC<TextProps> = ({ style, ...props }) => {
  const { theme } = useTheme();
  
  return (
    <RNText
      style={[
        { color: theme.text.primary },
        style
      ]}
      {...props}
    />
  );
};
