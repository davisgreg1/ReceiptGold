import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';
import { AppSplashScreen } from './src/screens/SplashScreen';
import { HomeScreen } from './src/screens/HomeScreen';

const AppContent: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const { themeMode } = useTheme();

  if (isLoading) {
    return <AppSplashScreen onFinish={() => setIsLoading(false)} />;
  }

  return (
    <>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
      <HomeScreen />
    </>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}