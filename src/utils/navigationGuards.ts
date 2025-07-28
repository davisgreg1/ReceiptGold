import { Alert } from 'react-native';

export const checkReceiptLimit = (
  currentReceiptCount: number,
  maxReceipts: number,
  onUpgrade?: () => void
): boolean => {
  // For unlimited plans
  if (maxReceipts === -1) return true;

  // Strict check - must be under the limit
  if (currentReceiptCount >= maxReceipts) {
    Alert.alert(
      'Receipt Limit Reached',
      'You\'ve reached your monthly receipt limit. Please upgrade your plan to add more receipts.',
      [
        { text: 'Cancel', style: 'cancel' },
        onUpgrade 
          ? { text: 'Upgrade', style: 'default', onPress: onUpgrade }
          : undefined
      ].filter(Boolean) as any
    );
    return false;
  }

  return true;
};
