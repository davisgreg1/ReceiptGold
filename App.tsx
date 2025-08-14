import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { StripeWrapper } from './src/components/StripeWrapper';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AuthNavigator } from './src/navigation/AuthNavigator';
import { CustomAlertProvider } from './src/components/CustomAlert';

const AppContent: React.FC = () => {
  const [splashFinished, setSplashFinished] = useState(false);
  const { themeMode } = useTheme();
  const { user, loading: authLoading } = useAuth();

  // Show splash screen until both splash animation is done AND auth is initialized
  const showSplash = !splashFinished || authLoading;

  console.log('App State:', {
    splashFinished,
    authLoading,
    showSplash,
    hasUser: !!user,
    userEmail: user?.email
  });

  if (showSplash) {
    return <AppSplashScreen onFinish={() => setSplashFinished(true)} />;
  }

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      {user ? <AppNavigator /> : <AuthNavigator />}
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StripeWrapper>
        <ThemeProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <CustomAlertProvider>
                <AppContent />
              </CustomAlertProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </ThemeProvider>
      </StripeWrapper>
    </SafeAreaProvider>
  );
}