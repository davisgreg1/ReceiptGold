import React, { useRef, useEffect, createContext, useContext, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';
import { getFirebaseErrorMessage, isNetworkError, requiresReauth } from '../utils/firebaseErrors';

interface AlertOptions {
  type: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
}

interface CustomAlertContextType {
  alertState: {
    visible: boolean;
    options: AlertOptions;
  };
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
  showError: (title: string, message: string, options?: Partial<AlertOptions>) => void;
  showSuccess: (title: string, message: string, options?: Partial<AlertOptions>) => void;
  showWarning: (title: string, message: string, options?: Partial<AlertOptions>) => void;
  showInfo: (title: string, message: string, options?: Partial<AlertOptions>) => void;
  showFirebaseError: (error: any, fallbackTitle?: string) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

export const useCustomAlert = (): CustomAlertContextType => {
  const context = useContext(CustomAlertContext);
  if (context === undefined) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
};

interface CustomAlertProviderProps {
  children: React.ReactNode;
}

export const CustomAlertProvider: React.FC<CustomAlertProviderProps> = ({ children }) => {
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    options: AlertOptions;
  }>({
    visible: false,
    options: {
      type: 'info',
      title: '',
      message: '',
    },
  });

  const showAlert = useCallback((options: AlertOptions) => {
    setAlertState({
      visible: true,
      options,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState(prev => ({
      ...prev,
      visible: false,
    }));
  }, []);

  // Enhanced method to show Firebase errors with user-friendly messages
  const showFirebaseError = useCallback((error: any, fallbackTitle?: string) => {
    const { title, message } = getFirebaseErrorMessage(error);
    
    // Add additional context for network errors
    let enhancedMessage = message;
    if (isNetworkError(error)) {
      enhancedMessage += ' Please check your internet connection.';
    }
    
    showAlert({
      type: 'error',
      title: fallbackTitle || title,
      message: enhancedMessage,
      primaryButtonText: requiresReauth(error) ? 'Sign In Again' : 'OK',
      onPrimaryPress: requiresReauth(error) ? () => {
        hideAlert();
        // Could trigger re-auth flow here
      } : undefined,
    });
  }, [showAlert, hideAlert]);

  // Convenience methods for different alert types
  const showError = useCallback((title: string, message: string, options?: Partial<AlertOptions>) => {
    showAlert({
      type: 'error',
      title,
      message,
      ...options,
    });
  }, [showAlert]);

  const showSuccess = useCallback((title: string, message: string, options?: Partial<AlertOptions>) => {
    showAlert({
      type: 'success',
      title,
      message,
      ...options,
    });
  }, [showAlert]);

  const showWarning = useCallback((title: string, message: string, options?: Partial<AlertOptions>) => {
    showAlert({
      type: 'warning',
      title,
      message,
      ...options,
    });
  }, [showAlert]);

  const showInfo = useCallback((title: string, message: string, options?: Partial<AlertOptions>) => {
    showAlert({
      type: 'info',
      title,
      message,
      ...options,
    });
  }, [showAlert]);

  const value: CustomAlertContextType = {
    alertState,
    showAlert,
    hideAlert,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    showFirebaseError,
  };

  return (
    <CustomAlertContext.Provider value={value}>
      {children}
      <CustomAlertModal />
    </CustomAlertContext.Provider>
  );
};

const CustomAlertModal: React.FC = () => {
  const { alertState, hideAlert } = useCustomAlert();
  
  if (!alertState.visible) return null;
  
  return (
    <CustomAlert
      visible={alertState.visible}
      type={alertState.options.type}
      title={alertState.options.title}
      message={alertState.options.message}
      onClose={hideAlert}
      primaryButtonText={alertState.options.primaryButtonText}
      secondaryButtonText={alertState.options.secondaryButtonText}
      onPrimaryPress={alertState.options.onPrimaryPress || hideAlert}
      onSecondaryPress={alertState.options.onSecondaryPress}
    />
  );
};

interface CustomAlertProps {
  visible: boolean;
  type: 'error' | 'success' | 'warning' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  primaryButtonText?: string;
  secondaryButtonText?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
}

const { width, height } = Dimensions.get('window');

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
  primaryButtonText = 'OK',
  secondaryButtonText,
  onPrimaryPress,
  onSecondaryPress,
}) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (visible) {
        onClose();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [visible, onClose]);

  const getAlertConfig = () => {
    switch (type) {
      case 'error':
        return {
          icon: 'alert-circle' as const,
          iconColor: '#FF6B6B',
          borderColor: '#FF6B6B',
          backgroundColor: '#FFF5F5',
        };
      case 'success':
        return {
          icon: 'checkmark-circle' as const,
          iconColor: '#51CF66',
          borderColor: '#51CF66',
          backgroundColor: '#F0FFF4',
        };
      case 'warning':
        return {
          icon: 'warning' as const,
          iconColor: '#FFD43B',
          borderColor: '#FFD43B',
          backgroundColor: '#FFFBF0',
        };
      case 'info':
        return {
          icon: 'information-circle' as const,
          iconColor: '#339AF0',
          borderColor: '#339AF0',
          backgroundColor: '#F0F8FF',
        };
    }
  };

  const config = getAlertConfig();

  const handlePrimaryPress = () => {
    if (onPrimaryPress) {
      onPrimaryPress();
    } else {
      onClose();
    }
  };

  const handleSecondaryPress = () => {
    if (onSecondaryPress) {
      onSecondaryPress();
    } else {
      onClose();
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: opacityAnim }
        ]}
      >
        <TouchableOpacity 
          style={styles.overlayTouch}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <Animated.View
          style={[
            styles.alertContainer,
            {
              backgroundColor: theme.background.primary,
              borderColor: config.borderColor,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
                {
                  scale: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header with Icon */}
          <View style={[styles.header, { backgroundColor: config.backgroundColor }]}>
            <View style={[styles.iconContainer, { backgroundColor: config.iconColor }]}>
              <Ionicons name={config.icon} size={32} color="white" />
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={[styles.title, { color: theme.text.primary }]}>
              {title}
            </Text>
            <Text style={[styles.message, { color: theme.text.secondary }]}>
              {message}
            </Text>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {secondaryButtonText && (
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.secondaryButton,
                  { borderColor: theme.border.primary }
                ]}
                onPress={handleSecondaryPress}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.text.secondary }]}>
                  {secondaryButtonText}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                { 
                  backgroundColor: config.iconColor,
                  ...(secondaryButtonText 
                    ? { flex: 1, marginLeft: 12, minWidth: 100 } 
                    : { minWidth: 120 }
                  ),
                }
              ]}
              onPress={handlePrimaryPress}
            >
              <Text style={styles.primaryButtonText} numberOfLines={1}>
                {primaryButtonText}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayTouch: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  alertContainer: {
    width: width * 0.85,
    maxWidth: 350,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 48,
  },
  primaryButton: {
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1.5,
    marginRight: 12,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});

// Wrapper component that uses the custom alert hook
