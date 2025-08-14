import { useCustomAlert } from '../hooks/useCustomAlert';

// Utility function to create alert replacements
export const createAlertReplacements = () => {
  const { showError, showSuccess, showWarning, showInfo } = useCustomAlert();

  const Alert = {
    alert: (title: string, message?: string, buttons?: any[]) => {
      // Determine alert type based on title
      const lowerTitle = title.toLowerCase();
      
      if (lowerTitle.includes('error') || lowerTitle.includes('failed')) {
        showError(title, message || '');
      } else if (lowerTitle.includes('success') || lowerTitle.includes('created')) {
        showSuccess(title, message || '');
      } else if (lowerTitle.includes('warning') || lowerTitle.includes('confirm')) {
        showWarning(title, message || '');
      } else {
        showInfo(title, message || '');
      }
    }
  };

  return { Alert };
};

// Direct alert functions for easier migration
export const createCustomAlerts = (customAlert: ReturnType<typeof useCustomAlert>) => {
  return {
    errorAlert: (title: string, message: string) => customAlert.showError(title, message),
    successAlert: (title: string, message: string) => customAlert.showSuccess(title, message),
    warningAlert: (title: string, message: string) => customAlert.showWarning(title, message),
    infoAlert: (title: string, message: string) => customAlert.showInfo(title, message),
  };
};
