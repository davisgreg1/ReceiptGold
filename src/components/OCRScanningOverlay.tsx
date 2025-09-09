import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Image,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';

interface OCRScanningOverlayProps {
  imageUri: string;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  isScanning: boolean;
  statusMessage?: string;
}

export const OCRScanningOverlay: React.FC<OCRScanningOverlayProps> = ({
  imageUri,
  isError = false,
  errorMessage,
  onRetry,
  isScanning,
  statusMessage,
}) => {
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const { height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    if (isScanning) {
      // Smooth up and down scanning animation
      const animation = Animated.loop(
        Animated.sequence([
          // Start from top (2.5% of screen) and go to bottom (97.5% of screen)
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000, // 2 seconds down
            useNativeDriver: true,
          }),
          // Go back up from bottom to top
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000, // 2 seconds up
            useNativeDriver: true,
          }),
        ])
      );

      scanLineAnim.setValue(0); // Start from top
      animation.start();

      return () => {
        animation.stop();
        scanLineAnim.setValue(0);
      };
    }
  }, [isScanning, scanLineAnim]);

  return (
    <View style={styles.container}>
      <Image source={{ uri: imageUri }} style={styles.image} />
      <View
        style={[
          styles.overlay,
          {
            backgroundColor: isError
              ? 'rgba(255, 0, 0, 0.3)'
              : 'rgba(0, 255, 0, 0.3)',
          },
        ]}
      >
        {isScanning && (
          <>
            <Animated.View
              style={[
                styles.scanLine,
                {
                  transform: [
                    {
                      translateY: scanLineAnim.interpolate({
                        inputRange: [0, 1],
                        // Use 95% of screen height, centered (2.5% margin on top and bottom)
                        outputRange: [screenHeight * 0.025, screenHeight * 0.975],
                      }),
                    },
                  ],
                },
              ]}
            />
            {statusMessage && (
              <View style={styles.statusContainer}>
                <Text style={styles.statusText}>{statusMessage}</Text>
              </View>
            )}
          </>
        )}
        {isError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    zIndex: 10, // Higher z-index to appear above scan line
    elevation: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  scanLine: {
    position: 'absolute',
    height: 6,
    width: '100%',
    backgroundColor: '#00ff00',
    shadowColor: '#00ff00',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    top: 0,
    zIndex: 1, // Lower z-index so it appears behind the status boxes
    // Enhanced glow effect
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: '#88ff88',
    borderBottomColor: '#88ff88',
    opacity: 0.9,
  },
  errorContainer: {
    padding: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  retryText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
