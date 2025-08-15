/**
 * Font Loading Utility for ReceiptGold
 * 
 * This utility handles loading custom fonts and provides fallback fonts
 * for a consistent typography experience across platforms.
 */

import { Platform } from 'react-native';

// Font loading state
export interface FontLoadingState {
  loaded: boolean;
  error: boolean;
  progress: number;
}

// Available font families after loading
export interface LoadedFonts {
  inter: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  poppins: {
    regular: string;
    medium: string;
    semibold: string;
    bold: string;
  };
  playfair: {
    regular: string;
    bold: string;
  };
}

// Font configuration for expo-font
export const fontAssets = {
  // Inter - Clean, modern sans-serif
  'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
  'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
  
  // Poppins - Friendly, geometric sans-serif
  'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
  'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
  'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
  'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  
  // Playfair Display - Elegant serif for branding
  'PlayfairDisplay-Regular': require('../../assets/fonts/PlayfairDisplay-Regular.ttf'),
  'PlayfairDisplay-Bold': require('../../assets/fonts/PlayfairDisplay-Bold.ttf'),
};

// System font fallbacks
export const systemFonts = {
  ios: {
    primary: 'SF Pro Display',
    mono: 'SF Mono',
    serif: 'New York',
  },
  android: {
    primary: 'Roboto',
    mono: 'monospace',
    serif: 'serif',
  },
  web: {
    primary: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, monospace',
    serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  },
};

// Get platform-appropriate font family
export const getPlatformFont = (fontType: keyof typeof systemFonts.ios): string => {
  const platform = Platform.OS as keyof typeof systemFonts;
  return systemFonts[platform]?.[fontType] || systemFonts.ios[fontType];
};

// Font preloading utility (when using custom fonts)
export const preloadFonts = async (): Promise<FontLoadingState> => {
  try {
    // This would be used with expo-font
    // await Font.loadAsync(fontAssets);
    
    return {
      loaded: true,
      error: false,
      progress: 1,
    };
  } catch (error) {
    console.warn('Font loading failed, falling back to system fonts:', error);
    return {
      loaded: false,
      error: true,
      progress: 0,
    };
  }
};

// Typography improvements for existing text
export const enhanceTextStyle = (baseStyle: any, variant?: string) => {
  const enhancements = {
    // Better letter spacing
    letterSpacing: variant?.includes('heading') ? -0.2 : 0.1,
    
    // Better line height
    lineHeight: baseStyle.fontSize ? baseStyle.fontSize * 1.4 : undefined,
    
    // Platform-specific adjustments
    ...Platform.select({
      ios: {
        // iOS specific adjustments
        fontVariant: ['tabular-nums'] as any,
      },
      android: {
        // Android specific adjustments
        includeFontPadding: false,
        textAlignVertical: 'center' as any,
      },
    }),
  };

  return {
    ...baseStyle,
    ...enhancements,
  };
};

// Font weight mapping for better cross-platform consistency
export const normalizeFontWeight = (weight: string | number): any => {
  const weightMap: { [key: string]: any } = {
    '100': Platform.select({ ios: '100', android: '100', default: 'normal' }),
    '200': Platform.select({ ios: '200', android: '200', default: 'normal' }),
    '300': Platform.select({ ios: '300', android: '300', default: 'normal' }),
    '400': Platform.select({ ios: '400', android: '400', default: 'normal' }),
    '500': Platform.select({ ios: '500', android: '500', default: 'normal' }),
    '600': Platform.select({ ios: '600', android: '600', default: 'bold' }),
    '700': Platform.select({ ios: '700', android: '700', default: 'bold' }),
    '800': Platform.select({ ios: '800', android: '800', default: 'bold' }),
    '900': Platform.select({ ios: '900', android: '900', default: 'bold' }),
    'normal': '400',
    'bold': '700',
  };

  return weightMap[weight.toString()] || weight;
};
