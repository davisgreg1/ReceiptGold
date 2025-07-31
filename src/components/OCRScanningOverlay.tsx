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
      let currentPosition = 0;
      
      const createRandomAnimation = () => {
        // Generate a random position between 0 and 1
        const nextPosition = Math.random();
        
        return Animated.timing(scanLineAnim, {
          toValue: nextPosition,
          duration: 800, // Faster movement for more dynamic feel
          useNativeDriver: true,
        });
      };

      // Create an array of 8 random movements
      const createRandomSequence = () => {
        const animations = [];
        for (let i = 0; i < 8; i++) {
          animations.push(createRandomAnimation());
        }
        return animations;
      };

      const animation = Animated.loop(
        Animated.sequence(createRandomSequence())
      );

      scanLineAnim.setValue(Math.random()); // Start from random position
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
                        outputRange: [0, screenHeight],
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
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  scanLine: {
    position: 'absolute',
    height: 4,
    width: '100%',
    backgroundColor: '#2fff00',
    shadowColor: '#00ff00',
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 15,
    top: 0,
    zIndex: 10, // Ensure scan line is always on top
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
