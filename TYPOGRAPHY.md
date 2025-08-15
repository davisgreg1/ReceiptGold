# ReceiptGold Typography System

ReceiptGold now includes a comprehensive typography system designed to provide a premium, professional appearance throughout the app.

## Features

- **Modern Font Stack**: Uses system fonts (SF Pro Display on iOS, Roboto on Android) with elegant fallbacks
- **Typography Scale**: Consistent font sizes, line heights, and spacing across all components
- **Easy-to-Use Components**: Pre-built components for common text elements
- **Theme Integration**: Fully integrated with the existing theme system

## Usage

### Basic Typography Component

```tsx
import { Typography } from '../components/Typography';

<Typography variant="heading-h1" color="gold">
  Welcome to ReceiptGold
</Typography>
```

### Convenience Components

```tsx
import { 
  DisplayText, 
  HeadingText, 
  BodyText, 
  ButtonText, 
  BrandText, 
  MoneyText 
} from '../components/Typography';

// Display text for hero sections
<DisplayText size="large" color="gold">Premium Receipt Management</DisplayText>

// Headings for sections
<HeadingText level={1}>Dashboard</HeadingText>
<HeadingText level={2}>Recent Receipts</HeadingText>

// Body text for content
<BodyText size="large">Your receipts are automatically categorized...</BodyText>
<BodyText size="medium" color="secondary">Additional details here</BodyText>

// Button text
<ButtonText>Sign In</ButtonText>

// Special text types
<BrandText>ReceiptGold</BrandText>
<MoneyText>$1,234.56</MoneyText>
```

## Typography Variants

### Display Text (Hero/Large Text)
- `display-large`: 40px, bold, for hero sections
- `display-medium`: 32px, bold, for page headers
- `display-small`: 28px, semibold, for section headers

### Headings
- `heading-h1`: 24px, bold, main page titles
- `heading-h2`: 20px, semibold, section titles  
- `heading-h3`: 18px, semibold, subsections
- `heading-h4`: 16px, semibold, minor headings

### Body Text
- `body-large`: 18px, regular, important content
- `body-medium`: 16px, regular, standard content
- `body-small`: 14px, regular, secondary content

### UI Elements
- `ui-button`: 16px, semibold, button labels
- `ui-button-small`: 14px, semibold, small buttons
- `ui-label`: 14px, medium, form labels
- `ui-caption`: 12px, regular, captions/metadata

### Special Purpose
- `special-brand`: 28px, bold, serif, brand text
- `special-money`: 20px, semibold, monospace, monetary values
- `special-timestamp`: 12px, regular, monospace, dates/times

## Color Options

All typography components support these color props:
- `primary`: Main text color
- `secondary`: Secondary text color
- `tertiary`: Subtle text color
- `accent`: Theme accent color
- `inverse`: Inverse text (for dark backgrounds)
- `gold`: Gold accent color
- `success`: Success state color
- `error`: Error state color
- `warning`: Warning state color
- `info`: Info state color

## Adding Custom Fonts

To add premium custom fonts like Inter, Poppins, or Playfair Display:

1. **Add font files** to `/assets/fonts/`:
   ```
   assets/
   └── fonts/
       ├── Inter-Regular.ttf
       ├── Inter-Medium.ttf
       ├── Inter-SemiBold.ttf
       ├── Inter-Bold.ttf
       ├── Poppins-Regular.ttf
       ├── Poppins-Medium.ttf
       ├── Poppins-SemiBold.ttf
       ├── Poppins-Bold.ttf
       ├── PlayfairDisplay-Regular.ttf
       └── PlayfairDisplay-Bold.ttf
   ```

2. **Install expo-font**:
   ```bash
   npx expo install expo-font
   ```

3. **Load fonts in App.tsx**:
   ```tsx
   import * as Font from 'expo-font';
   import { useFonts } from 'expo-font';

   export default function App() {
     const [fontsLoaded] = useFonts({
       'Inter-Regular': require('./assets/fonts/Inter-Regular.ttf'),
       'Inter-Medium': require('./assets/fonts/Inter-Medium.ttf'),
       'Inter-SemiBold': require('./assets/fonts/Inter-SemiBold.ttf'),
       'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf'),
       'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
       'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
       'Poppins-SemiBold': require('./assets/fonts/Poppins-SemiBold.ttf'),
       'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
       'PlayfairDisplay-Regular': require('./assets/fonts/PlayfairDisplay-Regular.ttf'),
       'PlayfairDisplay-Bold': require('./assets/fonts/PlayfairDisplay-Bold.ttf'),
     });

     if (!fontsLoaded) {
       return <AppSplashScreen />;
     }

     // ... rest of app
   }
   ```

4. **Update typography.ts** to use custom fonts:
   ```tsx
   export const fontFamilies = {
     primary: 'Inter-Regular',
     heading: 'Poppins-SemiBold', 
     elegant: 'PlayfairDisplay-Regular',
     // ... etc
   };
   ```

## Recommended Font Combinations

### Professional & Clean
- **Primary**: Inter (body text)
- **Headings**: Poppins (headings)
- **Brand**: Playfair Display (elegant serif)

### Modern & Friendly  
- **Primary**: Poppins (body text)
- **Headings**: Montserrat (headings)
- **Brand**: Lora (readable serif)

### Elegant & Premium
- **Primary**: Source Sans Pro (body text)
- **Headings**: Playfair Display (elegant headings)
- **Brand**: Cormorant Garamond (luxury serif)

## Current Implementation

The current typography system:
- ✅ Uses high-quality system fonts (SF Pro Display, Roboto)
- ✅ Provides consistent typography scale
- ✅ Includes convenience components
- ✅ Integrates with theme system
- ✅ Supports all text colors
- ✅ Ready for custom font integration

The SignInScreen has been updated as an example of the new typography system in action.
