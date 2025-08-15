import { Platform } from 'react-native';

// Font family definitions with fallbacks
export const fontFamilies = {
  // Primary font for body text and UI elements
  primary: Platform.select({
    ios: 'SF Pro Display', // iOS system font
    android: 'Roboto', // Android system font
    default: 'System',
  }),
  
  // Secondary font for headings and emphasis
  heading: Platform.select({
    ios: 'SF Pro Display', // iOS system font - bold weights
    android: 'Roboto', // Android system font - bold weights  
    default: 'System',
  }),
  
  // Elegant font for branding and special text
  elegant: Platform.select({
    ios: 'Georgia', // Elegant serif
    android: 'serif', // Android serif
    default: 'serif',
  }),
  
  // Modern font for numbers and data
  numeric: Platform.select({
    ios: 'SF Mono', // Apple's monospace font
    android: 'monospace', // Android monospace
    default: 'monospace',
  }),
  
  // Custom fonts (when loaded)
  custom: {
    // Playfair Display for elegant headings
    playfair: 'PlayfairDisplay-Regular',
    playfairBold: 'PlayfairDisplay-Bold',
    
    // Inter for clean body text
    inter: 'Inter-Regular',
    interMedium: 'Inter-Medium',
    interSemiBold: 'Inter-SemiBold',
    interBold: 'Inter-Bold',
    
    // Poppins for modern UI elements
    poppins: 'Poppins-Regular',
    poppinsMedium: 'Poppins-Medium',
    poppinsSemiBold: 'Poppins-SemiBold',
    poppinsBold: 'Poppins-Bold',
  }
};

// Typography scale with font sizes and line heights
export const typography = {
  // Display text (large headings, hero text)
  display: {
    large: {
      fontSize: 40,
      lineHeight: 48,
      fontFamily: fontFamilies.heading,
      fontWeight: 'bold' as const,
      letterSpacing: -0.5,
    },
    medium: {
      fontSize: 32,
      lineHeight: 40,
      fontFamily: fontFamilies.heading,
      fontWeight: 'bold' as const,
      letterSpacing: -0.25,
    },
    small: {
      fontSize: 28,
      lineHeight: 36,
      fontFamily: fontFamilies.heading,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
  },
  
  // Headings (section titles, page headers)
  heading: {
    h1: {
      fontSize: 24,
      lineHeight: 32,
      fontFamily: fontFamilies.heading,
      fontWeight: 'bold' as const,
      letterSpacing: 0,
    },
    h2: {
      fontSize: 20,
      lineHeight: 28,
      fontFamily: fontFamilies.heading,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    h3: {
      fontSize: 18,
      lineHeight: 24,
      fontFamily: fontFamilies.heading,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    h4: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: fontFamilies.heading,
      fontWeight: '600' as const,
      letterSpacing: 0.1,
    },
  },
  
  // Body text (paragraphs, descriptions)
  body: {
    large: {
      fontSize: 18,
      lineHeight: 28,
      fontFamily: fontFamilies.primary,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    medium: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: fontFamilies.primary,
      fontWeight: '400' as const,
      letterSpacing: 0,
    },
    small: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fontFamilies.primary,
      fontWeight: '400' as const,
      letterSpacing: 0.1,
    },
  },
  
  // UI elements (buttons, labels, navigation)
  ui: {
    button: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: fontFamilies.primary,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
    buttonSmall: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fontFamilies.primary,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
    label: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: fontFamilies.primary,
      fontWeight: '500' as const,
      letterSpacing: 0.1,
    },
    caption: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: fontFamilies.primary,
      fontWeight: '400' as const,
      letterSpacing: 0.5,
    },
  },
  
  // Special purpose text
  special: {
    // For branding and app name - using elegant serif font
    brand: {
      fontSize: 28,
      lineHeight: 36,
      fontFamily: Platform.select({
        ios: 'Georgia',
        android: 'serif',
        default: 'serif'
      }),
      fontWeight: 'bold' as const,
      letterSpacing: 0.8,
    },
    
    // For elegant brand text in smaller contexts
    brandSmall: {
      fontSize: 18,
      lineHeight: 24,
      fontFamily: Platform.select({
        ios: 'Georgia',
        android: 'serif',
        default: 'serif'
      }),
      fontWeight: 'bold' as const,
      letterSpacing: 0.5,
    },
    
    // For monetary values
    money: {
      fontSize: 20,
      lineHeight: 28,
      fontFamily: fontFamilies.numeric,
      fontWeight: '600' as const,
      letterSpacing: 0,
    },
    
    // For dates and timestamps
    timestamp: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: fontFamilies.numeric,
      fontWeight: '400' as const,
      letterSpacing: 0.5,
    },
  },
};

// Helper function to get typography styles
export const getTypographyStyle = (category: keyof typeof typography, variant?: string) => {
  if (variant && typography[category] && typeof typography[category] === 'object') {
    return typography[category][variant as keyof typeof typography[typeof category]] || typography[category];
  }
  return typography[category];
};

// Font weight mappings for different platforms
export const fontWeights = {
  thin: Platform.select({
    ios: '100',
    android: '100',
    default: '100',
  }),
  light: Platform.select({
    ios: '300',
    android: '300',
    default: '300',
  }),
  regular: Platform.select({
    ios: '400',
    android: '400',
    default: '400',
  }),
  medium: Platform.select({
    ios: '500',
    android: '500',
    default: '500',
  }),
  semibold: Platform.select({
    ios: '600',
    android: '600',
    default: '600',
  }),
  bold: Platform.select({
    ios: '700',
    android: '700',
    default: '700',
  }),
  extrabold: Platform.select({
    ios: '800',
    android: '800',
    default: '800',
  }),
  black: Platform.select({
    ios: '900',
    android: '900',
    default: '900',
  }),
};
