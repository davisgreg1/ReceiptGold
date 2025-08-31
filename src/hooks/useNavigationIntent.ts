import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationService from '../context/NavigationService';

interface NavigationIntent {
  screen: string;
  params?: any;
  timestamp: number;
}

/**
 * Hook to handle navigation intents from push notifications
 * Call this in your main App component
 */
export const useNavigationIntent = () => {
  
  useEffect(() => {
    // Check for navigation intent when app becomes active
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        await processNavigationIntent();
      }
    };

    // Check immediately when hook mounts
    processNavigationIntent();

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, []);

  const processNavigationIntent = async () => {
    try {
      const intentData = await AsyncStorage.getItem('navigationIntent');
      
      if (intentData) {
        const intent: NavigationIntent = JSON.parse(intentData);
        
        // Check if intent is not too old (e.g., within 5 minutes)
        const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
        if (intent.timestamp > fiveMinutesAgo) {
          console.log('🔗 Processing navigation intent:', intent);
          
          // Wait a bit for navigation to be ready
          setTimeout(() => {
            NavigationService.navigate(intent.screen, intent.params);
            
            // Clear the intent after processing
            AsyncStorage.removeItem('navigationIntent');
          }, 1000);
        } else {
          console.log('🔗 Navigation intent expired, clearing');
          AsyncStorage.removeItem('navigationIntent');
        }
      }
    } catch (error) {
      console.error('Error processing navigation intent:', error);
    }
  };
};

export default useNavigationIntent;