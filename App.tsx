import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AuthNavigator } from './src/navigation/AuthNavigator';

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
      {user ? <HomeScreen /> : <AuthNavigator />}
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}