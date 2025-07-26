import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { 
  BottomTabParamList, 
  HomeStackParamList,
  ReceiptsStackParamList,
  ReportsStackParamList,
  SettingsStackParamList 
} from './AppNavigator';

// Navigation hook types for each stack
export type HomeNavigation = StackNavigationProp<HomeStackParamList>;
export type ReceiptsNavigation = StackNavigationProp<ReceiptsStackParamList>;
export type ReportsNavigation = StackNavigationProp<ReportsStackParamList>;
export type SettingsNavigation = StackNavigationProp<SettingsStackParamList>;
export type TabNavigation = BottomTabNavigationProp<BottomTabParamList>;

// Custom hooks for each navigator
export const useHomeNavigation = () => useNavigation<HomeNavigation>();
export const useReceiptsNavigation = () => useNavigation<ReceiptsNavigation>();
export const useReportsNavigation = () => useNavigation<ReportsNavigation>();
export const useSettingsNavigation = () => useNavigation<SettingsNavigation>();
export const useTabNavigation = () => useNavigation<TabNavigation>();

// Generic navigation hook
export const useAppNavigation = () => useNavigation();

// Navigation helpers
export const navigationHelpers = {
  // Quick navigation to common screens
  goToScanReceipt: (navigation: ReceiptsNavigation) => {
    navigation.navigate('ScanReceipt');
  },
  
  goToSubscription: (navigation: HomeNavigation) => {
    navigation.navigate('Subscription');
  },
  
  goToReceiptDetail: (navigation: ReceiptsNavigation, receiptId: string) => {
    navigation.navigate('ReceiptDetail', { receiptId });
  },
  
  goToTaxReport: (navigation: ReportsNavigation) => {
    navigation.navigate('TaxReport');
  },
  
  goToBilling: (navigation: SettingsNavigation) => {
    navigation.navigate('Billing');
  },
  
  // Tab navigation
  switchToReceiptsTab: (navigation: TabNavigation) => {
    navigation.navigate('ReceiptsTab');
  },
  
  switchToReportsTab: (navigation: TabNavigation) => {
    navigation.navigate('ReportsTab');
  },
  
  switchToSettingsTab: (navigation: TabNavigation) => {
    navigation.navigate('SettingsTab');
  },
};
