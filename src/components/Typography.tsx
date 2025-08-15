import React from 'react';
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

// Typography variant types
type TypographyVariant = 
  | 'display-large' | 'display-medium' | 'display-small'
  | 'heading-h1' | 'heading-h2' | 'heading-h3' | 'heading-h4'
  | 'body-large' | 'body-medium' | 'body-small'
  | 'ui-button' | 'ui-button-small' | 'ui-label' | 'ui-caption'
  | 'special-brand' | 'special-brandSmall' | 'special-money' | 'special-timestamp';

interface TypographyProps extends RNTextProps {
  variant?: TypographyVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'inverse' | 'success' | 'error' | 'warning' | 'info' | 'gold';
  align?: 'left' | 'center' | 'right' | 'justify';
  children: React.ReactNode;
}

export const Typography: React.FC<TypographyProps> = ({
  variant = 'body-medium',
  color = 'primary',
  align = 'left',
  style,
  children,
  ...props
}) => {
  const { theme } = useTheme();

  // Get typography style based on variant
  const getTypographyStyle = () => {
    const [category, size] = variant.split('-');
    
    switch (category) {
      case 'display':
        return typography.display[size as keyof typeof typography.display];
      case 'heading':
        return typography.heading[size as keyof typeof typography.heading];
      case 'body':
        return typography.body[size as keyof typeof typography.body];
      case 'ui':
        const uiKey = size === 'button' ? 'button' : 
                     size === 'button' && variant === 'ui-button-small' ? 'buttonSmall' :
                     size;
        return typography.ui[uiKey as keyof typeof typography.ui];
      case 'special':
        return typography.special[size as keyof typeof typography.special];
      default:
        return typography.body.medium;
    }
  };

  // Get text color based on color prop
  const getTextColor = () => {
    switch (color) {
      case 'primary':
        return theme.text.primary;
      case 'secondary':
        return theme.text.secondary;
      case 'tertiary':
        return theme.text.tertiary;
      case 'accent':
        return theme.text.accent;
      case 'inverse':
        return theme.text.inverse;
      case 'success':
        return theme.status.success;
      case 'error':
        return theme.status.error;
      case 'warning':
        return theme.status.warning;
      case 'info':
        return theme.status.info;
      case 'gold':
        return theme.gold.primary;
      default:
        return theme.text.primary;
    }
  };

  const typographyStyle = getTypographyStyle();
  const textColor = getTextColor();

  const combinedStyle = [
    typographyStyle,
    {
      color: textColor,
      textAlign: align,
    },
    style,
  ];

  return (
    <RNText style={combinedStyle} {...props}>
      {children}
    </RNText>
  );
};

// Export convenience components for easier use
export const DisplayText = (props: Omit<TypographyProps, 'variant'> & { size?: 'large' | 'medium' | 'small' }) =>
  <Typography {...props} variant={props.size ? `display-${props.size}` as TypographyVariant : 'display-large' as TypographyVariant} />;

export const HeadingText = (props: Omit<TypographyProps, 'variant'> & { size?: 'large' | 'medium' | 'small' }) =>
  <Typography {...props} variant={props.size ? `heading-${props.size}` as TypographyVariant : 'heading-large' as TypographyVariant} />;

export const BodyText = (props: Omit<TypographyProps, 'variant'> & { size?: 'large' | 'medium' | 'small' }) =>
  <Typography {...props} variant={props.size ? `body-${props.size}` as TypographyVariant : 'body-medium' as TypographyVariant} />;

export const ButtonText = (props: Omit<TypographyProps, 'variant'> & { size?: 'large' | 'medium' | 'small' }) =>
  <Typography {...props} variant={props.size ? `button-${props.size}` as TypographyVariant : 'button-medium' as TypographyVariant} />;

export const BrandText = (props: Omit<TypographyProps, 'variant'> & { size?: 'large' | 'small' }) =>
  <Typography {...props} variant={props.size === 'small' ? 'special-brandSmall' : 'special-brand'} />;

export const MoneyText: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="special-money" {...props} />
);

export const CaptionText: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="ui-caption" {...props} />
);

export const LabelText: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="ui-label" {...props} />
);
