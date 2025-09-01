import React from 'react';
import { StripeProvider } from '@stripe/stripe-react-native';

interface StripeWrapperProps {
  children: React.ReactNode;
}

export const StripeWrapper: React.FC<StripeWrapperProps> = ({ children }) => {
  const publishableKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    console.warn('Stripe publishable key not found. Stripe features will be disabled.');
    return <>{children}</>;
  }

  return (
    <StripeProvider
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.receiptgold" // Replace with your merchant ID
      urlScheme="receiptgold.stripe" // Specific scheme for Stripe to avoid conflicts
    >
      {children as React.ReactElement}
    </StripeProvider>
  );
};
