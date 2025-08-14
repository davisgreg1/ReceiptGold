// Note: This utility should be refactored to accept an alert callback from components
// For now, using console.warn as a temporary measure until components can pass their showAlert functions

export const checkReceiptLimit = (
  currentReceiptCount: number,
  maxReceipts: number,
  onUpgrade?: () => void,
  showAlert?: (title: string, message: string, options?: { primaryButtonText?: string; secondaryButtonText?: string; onPrimaryPress?: () => void; onSecondaryPress?: () => void; }) => void
): boolean => {
  // For unlimited plans
  if (maxReceipts === -1) return true;

  // Strict check - must be under the limit
  if (currentReceiptCount >= maxReceipts) {
    if (showAlert) {
      showAlert(
        'Receipt Limit Reached',
        'You\'ve reached your monthly receipt limit. Please upgrade your plan to add more receipts.',
        {
          primaryButtonText: onUpgrade ? 'Upgrade' : 'OK',
          secondaryButtonText: onUpgrade ? 'Cancel' : undefined,
          onPrimaryPress: onUpgrade || undefined,
        }
      );
    } else {
      // Fallback for components that haven't been updated yet
      console.warn('Receipt limit reached - component needs to pass showAlert function');
    }
    return false;
  }

  return true;
};
