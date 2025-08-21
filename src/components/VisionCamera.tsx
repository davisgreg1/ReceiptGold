import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  PhotoFile,
  CameraPermissionStatus,
} from 'react-native-vision-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

interface VisionCameraProps {
  onPhotoTaken: (photo: PhotoFile) => void;
  onClose: () => void;
  isActive?: boolean;
  isProcessing?: boolean;
  processingMessage?: string;
  onError?: (error: string) => void;
}

export const VisionCamera: React.FC<VisionCameraProps> = ({
  onPhotoTaken,
  onClose,
  isActive = true,
  isProcessing = false,
  processingMessage,
  onError,
}) => {
  const { theme } = useTheme();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashMode, setFlashMode] = useState<'off' | 'on' | 'auto'>('off');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraInitialized, setCameraInitialized] = useState(false);

  // Add debugging logs for device and permissions
  useEffect(() => {
    console.log('VisionCamera - Device:', device ? {
      id: device.id,
      name: device.name,
      position: device.position,
      hasFlash: device.hasFlash,
      hasTorch: device.hasTorch,
      isMultiCam: device.isMultiCam,
    } : 'No device found');
    
    console.log('VisionCamera - Permission status:', hasPermission, typeof hasPermission);
    
    // Log all available devices
    try {
      const allDevices = Camera.getAvailableCameraDevices();
      console.log('VisionCamera - All available devices:', allDevices.length);
      allDevices.forEach((d, i) => {
        console.log(`Device ${i}: ${d.id} (${d.position}) - ${d.name}`);
      });
    } catch (error) {
      console.error('VisionCamera - Error getting devices:', error);
    }
  }, [device, hasPermission]);

  useEffect(() => {
    const checkPermission = async () => {
      console.log('VisionCamera - Checking permission, current status:', hasPermission);
      if (!hasPermission) {
        console.log('VisionCamera - Requesting permission...');
        const permission = await requestPermission();
        console.log('VisionCamera - Permission result:', permission);
      }
    };
    
    checkPermission();
  }, [hasPermission, requestPermission]);

  // Add delay before activating camera to ensure proper initialization
  useEffect(() => {
    if (hasPermission && device && !cameraError) {
      const timer = setTimeout(() => {
        setCameraReady(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [hasPermission, device, cameraError]);

  const handleCameraError = useCallback((error: any) => {
    console.error('Camera session error:', error);
    const errorMessage = error?.message || 'Camera session error occurred';
    setCameraError(errorMessage);
    
    // Notify parent component about the error
    if (onError) {
      onError(errorMessage);
    }
    
    // Auto-retry after a short delay
    setTimeout(() => {
      setCameraError(null);
    }, 3000);
  }, [onError]);

  // Show error screen if camera has persistent errors
  if (cameraError) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Ionicons name="camera" size={48} color={theme.text.secondary} />
        <Text style={[styles.permissionText, { color: theme.text.primary }]}>
          Camera Error
        </Text>
        <Text style={[styles.permissionText, { color: theme.text.secondary, fontSize: 14 }]}>
          {cameraError}
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold.primary, marginTop: 16 }]}
          onPress={() => setCameraError(null)}
        >
          <Text style={styles.buttonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: 'transparent', marginTop: 10 }]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = useCallback(async () => {
    try {
      if (!camera.current) {
        console.error('Camera ref is null!');
        Alert.alert('Error', 'Camera not ready. Please wait and try again.');
        return;
      }
      if (!device) {
        console.error('No camera device available!');
        Alert.alert('Error', 'No camera device available. Please check your device permissions.');
        return;
      }
      if (!cameraInitialized) {
        console.error('Camera not initialized!');
        Alert.alert('Error', 'Camera is still initializing. Please wait and try again.');
        return;
      }
      
      console.log('Taking photo with device:', device.id, 'initialized:', cameraInitialized);
      setIsCapturing(true);
      
      // Add a longer delay to ensure camera is fully ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const photo = await camera.current.takePhoto({
        flash: flashMode,
        enableShutterSound: false,
      });
      
      console.log('Photo taken successfully:', photo.path);
      onPhotoTaken(photo);
    } catch (error) {
      console.error('Failed to take photo:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to take photo. Please try again.';
      if (error instanceof Error) {
        if (error.message.includes('session/invalid-output-configuration')) {
          errorMessage = 'Camera configuration error. Please restart the app and try again.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'Camera permission denied. Please check your app permissions.';
        } else if (error.message.includes('Not bound to a valid Camera')) {
          errorMessage = 'Camera is not ready. Please wait a moment and try again.';
          // Reset camera initialization to trigger retry
          setCameraInitialized(false);
          setCameraReady(false);
          setTimeout(() => {
            setCameraReady(true);
          }, 1000);
        } else {
          errorMessage = `Camera error: ${error.message}`;
        }
      }
      
      Alert.alert('Camera Error', errorMessage);
    } finally {
      setIsCapturing(false);
    }
  }, [device, flashMode, onPhotoTaken, cameraInitialized]);

  const toggleFlash = useCallback(() => {
    setFlashMode(prev => {
      switch (prev) {
        case 'off': return 'auto';
        case 'auto': return 'on';
        case 'on': return 'off';
        default: return 'off';
      }
    });
  }, []);

  // Show permission request screen
  if (hasPermission === false) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={[styles.permissionText, { color: theme.text.primary }]}>
          Camera permission is required to scan receipts
        </Text>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.gold.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.buttonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, { backgroundColor: 'transparent', marginTop: 10 }]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading while checking permission or device
  if (!hasPermission || !device) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={theme.gold.primary} />
        <Text style={[styles.permissionText, { color: theme.text.primary }]}>
          {hasPermission === undefined ? 'Checking camera permission...' : 
           !hasPermission ? 'Camera permission denied' :
           'Loading camera...'}
        </Text>
        {!hasPermission && hasPermission !== undefined && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.gold.primary, marginTop: 16 }]}
            onPress={async () => {
              const result = await requestPermission();
              console.log('Manual permission request result:', result);
            }}
          >
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        )}
        {!device && hasPermission && (
          <>
            <Text style={[styles.permissionText, { color: theme.text.secondary, fontSize: 14, marginTop: 10 }]}>
              No camera device found. This may be an issue with the device or app configuration.
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: 'transparent', marginTop: 10 }]}
              onPress={() => {
                console.log('=== CAMERA DEBUG INFO ===');
                console.log('Available camera devices:');
                try {
                  const devices = Camera.getAvailableCameraDevices();
                  console.log('Total devices:', devices.length);
                  devices.forEach((d, i) => {
                    console.log(`Device ${i}:`, {
                      id: d.id,
                      name: d.name,
                      position: d.position,
                      hasFlash: d.hasFlash,
                      isMultiCam: d.isMultiCam,
                    });
                  });
                } catch (error) {
                  console.error('Error getting camera devices:', error);
                }
                console.log('Current device:', device);
                console.log('Permission status:', hasPermission);
                console.log('Platform:', Platform.OS);
                console.log('=========================');
              }}
            >
              <Text style={[styles.buttonText, { color: theme.text.primary }]}>Debug Info</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: 'transparent', marginTop: 10 }]}
          onPress={onClose}
        >
          <Text style={[styles.buttonText, { color: theme.text.primary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Use minimal configuration as suggested by troubleshooting guide */}
      <Camera
        ref={camera}
        device={device}
        isActive={true}
        // isActive={cameraReady && isActive && !isProcessing && hasPermission === true && !cameraError}
        style={StyleSheet.absoluteFill}
        photo={true}
        onError={handleCameraError}
        onInitialized={() => {
          console.log('Camera initialized successfully');
          setCameraInitialized(true);
        }}
      />

      <View style={styles.overlay}>
        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
            onPress={onClose}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
            onPress={toggleFlash}
          >
            <Ionicons 
              name={flashMode === 'off' ? 'flash-off' : flashMode === 'on' ? 'flash' : 'flash-outline'} 
              size={24} 
              color="white" 
            />
          </TouchableOpacity>
        </View>

        {/* Center Frame Guide */}
        <View style={styles.centerContent}>
          <View style={styles.frameGuide}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Bottom Controls */}
        <View style={styles.bottomControls}>
          <View style={styles.captureContainer}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                { borderColor: theme.gold.primary },
                (isCapturing || isProcessing || !cameraInitialized) && styles.captureButtonDisabled
              ]}
              onPress={takePhoto}
              disabled={isCapturing || isProcessing || !cameraInitialized}
            >
              {(isCapturing || isProcessing) ? (
                <ActivityIndicator size="small" color={theme.gold.primary} />
              ) : (
                <View style={[styles.captureButtonInner, { backgroundColor: theme.gold.primary }]} />
              )}
            </TouchableOpacity>
            {(isProcessing && processingMessage) && (
              <Text style={[styles.instructionText, { color: theme.text.primary, marginTop: 8 }]}>
                {processingMessage}
              </Text>
            )}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={[styles.instructionText, { color: theme.text.primary }]}>
            {(isCapturing || isProcessing) ? 
              (processingMessage || "Processing...") :
              !cameraInitialized ?
                "Initializing camera..." :
                "Position receipt within the frame"
            }
          </Text>
        </View>

        {/* Camera Status Indicator */}
        {!cameraInitialized && (
          <View style={styles.statusIndicator}>
            <ActivityIndicator size="small" color={theme.gold.primary} />
            <Text style={[styles.statusText, { color: theme.text.secondary }]}>
              Initializing camera...
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
    zIndex: 1,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frameGuide: {
    width: 300,
    height: 200,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFD700',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderBottomWidth: 0,
    borderRightWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderBottomWidth: 0,
    borderLeftWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderTopWidth: 0,
    borderRightWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderTopWidth: 0,
    borderLeftWidth: 0,
  },
  bottomControls: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  captureContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  instructions: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  statusText: {
    fontSize: 14,
    marginLeft: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
});
