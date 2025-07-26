import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';
import { AuthNavigator } from './src/navigation/AuthNavigator';

const AppContent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { themeMode } = useTheme();
  const { user, loading: authLoading } = useAuth();

  if (isLoading) {
    return <AppSplashScreen onFinish={() => setIsLoading(false)} />;
  }

  if (authLoading) {
    return null; // Or a loading screen
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