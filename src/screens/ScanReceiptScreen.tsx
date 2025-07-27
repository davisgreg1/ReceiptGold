import React, { useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert, ActivityIndicator, Platform } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { storage } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { receiptService } from '../services/firebaseService';
import { useNavigation } from '@react-navigation/native';
import * as ImageManipulator from 'expo-image-manipulator';
import { testStorageConnection } from '../utils/testStorage';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  captureButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    marginVertical: 5,
  },
  captureText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
    padding: 20,
  },
});

export const ScanReceiptScreen = () => {
  const [isCapturing, setIsCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');

  const handleCapture = async () => {
    if (!cameraRef.current || !user || isCapturing) return;

    try {
      setIsCapturing(true);
      
      // Capture the photo using the CameraView API
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      // Optimize the image
      const optimizedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const filename = `receipts/${user.uid}/${timestamp}.jpg`;
      const storageRef = ref(storage, filename);

      // Convert image to blob with proper path handling
      const uri = Platform.OS === 'ios' ? optimizedImage.uri : `file://${optimizedImage.uri}`;
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      const metadata = {
        contentType: 'image/jpeg',
        cacheControl: 'public,max-age=31536000',
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString()
        }
      };

      try {
        // Try to upload in a single operation
        await uploadBytesResumable(storageRef, blob, metadata);
        const downloadURL = await getDownloadURL(storageRef);

        // Create receipt record in Firestore
        await receiptService.createReceipt({
          userId: user.uid,
          images: [{
            url: downloadURL,
            size: blob.size,
            uploadedAt: new Date(),
          }],
          status: 'uploaded',
          vendor: '',
          amount: 0,
          currency: 'USD',
          date: new Date(),
          description: '',
          category: 'uncategorized',
          tags: [],
          tax: {
            deductible: true,
            deductionPercentage: 100,
            taxYear: new Date().getFullYear(),
            category: 'business_expense',
          },
          processingErrors: [],
        });

        // Navigate back to receipts list
        navigation.goBack();
      } catch (error: any) {
        console.error('Upload error:', error);
        let errorMessage = 'Failed to upload receipt. ';
        
        if (error.code === 'storage/unauthorized') {
          errorMessage += 'Please check your permissions.';
        } else if (error.code === 'storage/canceled') {
          errorMessage += 'Upload was canceled.';
        } else if (error.code === 'storage/retry-limit-exceeded') {
          errorMessage += 'Poor network connection. Please try again.';
        } else {
          errorMessage += error.message || 'Please try again.';
        }
        
        Alert.alert('Error', errorMessage);
      }
    } catch (error) {
      console.error('Capture error:', error);
      Alert.alert('Error', 'Failed to capture receipt. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <Text style={[styles.text, { color: theme.text.primary }]}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          style={[styles.captureButton, { backgroundColor: theme.gold.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.captureText}>Grant Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.captureButton,
              { backgroundColor: theme.gold.primary },
              isCapturing && { opacity: 0.7 }
            ]}
            onPress={handleCapture}
            disabled={isCapturing}
          >
            {isCapturing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.captureText}>
                📸 Capture Receipt
              </Text>
            )}
          </TouchableOpacity>
          
          {/* Test Storage Button */}
          <TouchableOpacity
            style={[
              styles.captureButton,
              { backgroundColor: theme.gold.primary }
            ]}
            onPress={async () => {
              try {
                console.log('Starting storage connection test...');
                const result = await testStorageConnection();
                if (result.success) {
                  console.log('Test succeeded:', result);
                  Alert.alert('Success', `Storage connection test passed!\nFile URL: ${result.downloadURL}`);
                } else {
                  console.error('Test failed:', result.error);
                  Alert.alert(
                    'Error',
                    `Storage test failed:\nCode: ${result.error?.code || 'unknown'}\nMessage: ${result.error?.message || 'Unknown error'}`
                  );
                }
              } catch (error: any) {
                console.error('Test failed with exception:', error);
                Alert.alert(
                  'Error',
                  `Test failed with exception:\nType: ${error.name}\nMessage: ${error.message || 'Unknown error'}`
                );
              }
            }}
          >
            <Text style={styles.captureText}>
              🧪 Test Storage
            </Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </SafeAreaView>
  );
};
