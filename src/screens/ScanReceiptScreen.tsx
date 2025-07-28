import React, { useState, useRef, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Alert, ActivityIndicator, Platform } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SaveFormat } from 'expo-image-manipulator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { useAuth } from '../context/AuthContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useFocusEffect } from '@react-navigation/native';
import { useReceiptsNavigation } from '../navigation/navigationHelpers';
import { storage, db } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { enforceReceiptLimit } from '../utils/enforceReceiptLimit';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { receiptService } from '../services/firebaseService';
import * as ImageManipulator from 'expo-image-manipulator';
// Import the receipt OCR service
import { receiptOCRService } from '../services/ReceiptOCRService';

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
  limitContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 12,
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
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  limitTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  limitMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.8,
  },
  ocrStatus: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.9,
  },
});

export const ScanReceiptScreen = () => {
  const { user } = useAuth();
  const navigation = useReceiptsNavigation();
  const { subscription } = useSubscription();
  const [initialized, setInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');

  // Check receipt limit whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      const checkLimit = async () => {
        if (!user?.uid) return;
        
        const maxReceipts = subscription?.limits?.maxReceipts || 10;
        
        // Skip limit check for unlimited plan (professional tier)
        if (maxReceipts === -1) return;
        
        const allowed = await enforceReceiptLimit(user.uid, maxReceipts, () => {
          Alert.alert(
            "Receipt Limit Reached",
            "You have reached your monthly receipt limit. Please upgrade your plan to add more receipts.",
            [{ text: "OK", onPress: () => navigation.navigate("ReceiptsList") }]
          );
        });
        
        if (!allowed) {
          navigation.navigate("ReceiptsList");
        }
      };
      
      if (initialized) {
        checkLimit();
      } else {
        setInitialized(true);
      }
    }, [user?.uid, subscription?.limits?.maxReceipts, navigation, initialized])
  );

  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);
  const cameraRef = useRef<CameraView>(null);
  const { theme } = useTheme();
  const { canAddReceipt, getRemainingReceipts } = useSubscription();

  // Log subscription state for debugging
  React.useEffect(() => {
    console.log('Subscription state:', subscription);
  }, [subscription]);

  // Get receipt count on mount
  React.useEffect(() => {
    const fetchCurrentUsage = async () => {
      try {
        if (!user?.uid) {
          setLoading(false);
          return;
        }
      
        // Get monthly usage count for current month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
      
        const monthlyUsageSnapshot = await getDocs(query(
          collection(db, 'receipts'),
          where('userId', '==', user.uid),
          where('createdAt', '>=', startOfMonth),
          orderBy('createdAt', 'desc')
        ));
      
        setCurrentReceiptCount(monthlyUsageSnapshot.size);
      } catch (error) {
        console.error('Error fetching receipt count:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCurrentUsage();
  }, [user?.uid]);

  const [permission, requestPermission] = useCameraPermissions();
  const [facing] = useState<CameraType>('back');

  const handleCapture = async () => {
    if (!cameraRef.current || !user || isCapturing) return;

    // Check receipt limit before capturing
    const remaining = getRemainingReceipts(currentReceiptCount);
    console.log('Capture check:', { 
      currentReceiptCount, 
      canCapture: canAddReceipt(currentReceiptCount),
      subscription,
      remaining
    });

    // Professional tier has maxReceipts = -1, indicating unlimited
    if (subscription.limits.maxReceipts !== -1 && (!canAddReceipt(currentReceiptCount) || remaining <= 0)) {
      Alert.alert(
        'Monthly Limit Reached',
        'You have reached your monthly receipt limit. Please upgrade your plan or wait until next month to add more receipts.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return;
    }

    try {
      setIsCapturing(true);
      setOcrStatus('Capturing photo...');
      
      // Capture the photo using the CameraView API
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      setOcrStatus('Optimizing image...');
      
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

      setOcrStatus('Preparing upload...');

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
        setOcrStatus('Uploading to cloud...');
        
        // Try to upload in a single operation
        await uploadBytesResumable(storageRef, blob, metadata);
        const downloadURL = await getDownloadURL(storageRef);

        // Double check we can still add the receipt
        const finalCheck = canAddReceipt(currentReceiptCount);
        if (!finalCheck) {
          Alert.alert(
            'Monthly Limit Reached',
            'You have reached your monthly receipt limit while processing this upload. Please upgrade your plan or wait until next month to add more receipts.',
            [{ text: 'OK', onPress: () => navigation.goBack() }]
          );
          return;
        }

        // Analyze receipt with OCR using the new function-based approach
        setIsAnalyzing(true);
        setOcrStatus('Analyzing receipt data...');
        console.log('Analyzing receipt with OCR...');
        
        try {
          // Use the OCR service to analyze the receipt
          const ocrData = await receiptOCRService.analyzeReceipt(uri);
          console.log('OCR Analysis result:', ocrData);
          setOcrStatus('Processing complete!');
          
          // Create receipt record in Firestore with OCR data - ensure no undefined values
          const receiptData = {
            userId: user.uid,
            images: [{
              url: downloadURL,
              size: blob.size,
              uploadedAt: new Date(),
            }],
            status: 'processed' as const, // Change to processed since we have OCR data
            vendor: ocrData.merchantName || '',
            amount: ocrData.total || 0,
            currency: 'USD',
            date: ocrData.transactionDate instanceof Date ? ocrData.transactionDate : new Date(),
            description: ocrData.merchantName ? `Receipt from ${ocrData.merchantName}` : 'Scanned Receipt',
            tax: {
              deductible: true,
              deductionPercentage: 100,
              taxYear: new Date().getFullYear(),
              category: 'business_expense',
            },
            category: 'business_expense', // Use the same category as tax
            tags: ['ocr-processed'],
            extractedData: {
              vendor: ocrData.merchantName || '',
              amount: ocrData.total || 0,
              tax: ocrData.tax || 0,
              date: ocrData.transactionDate instanceof Date ? ocrData.transactionDate.toISOString() : new Date().toISOString(),
              confidence: 0.9, // Azure Document Intelligence typically has high confidence
              items: ocrData.items?.map(item => ({
                description: item.description || '',
                amount: item.price || 0,
                quantity: item.quantity || 1
              })) || []
            },
            processingErrors: []
          };

          await receiptService.createReceipt(receiptData);

        } catch (ocrError: any) {
          console.error('OCR Analysis failed:', ocrError);
          setOcrStatus('OCR failed, saving without analysis...');
          
          // Still save the receipt even if OCR fails - ensure no undefined values
          const fallbackReceiptData = {
            userId: user.uid,
            images: [{
              url: downloadURL,
              size: blob.size,
              uploadedAt: new Date(),
            }],
            status: 'error' as const, // Mark as error since OCR failed
            vendor: '',
            amount: 0,
            currency: 'USD',
            date: new Date(),
            description: 'Scanned Receipt (Manual entry required)',
            tax: {
              deductible: true,
              deductionPercentage: 100,
              taxYear: new Date().getFullYear(),
              category: 'business_expense',
            },
            category: 'business_expense', // Use the same category as tax
            tags: ['manual-entry-required'],
            extractedData: {
              vendor: '',
              amount: 0,
              tax: 0,
              date: new Date().toISOString(),
              confidence: 0,
              items: []
            },
            processingErrors: [ocrError.message || 'OCR analysis failed']
          };

          await receiptService.createReceipt(fallbackReceiptData);

          // Show OCR error but don't prevent saving
          Alert.alert(
            'Receipt Saved',
            'The receipt was saved successfully, but automatic data extraction failed. You can manually edit the receipt details.',
            [{ text: 'OK' }]
          );
        }

        // Fetch the current count from Firestore to ensure accuracy
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        
        const updatedUsageSnapshot = await getDocs(query(
          collection(db, 'receipts'),
          where('userId', '==', user.uid),
          where('createdAt', '>=', startOfMonth),
          orderBy('createdAt', 'desc')
        ));
        
        const actualCount = updatedUsageSnapshot.size;
        setCurrentReceiptCount(actualCount);

        // Check if we can add more receipts after this one
        if (!canAddReceipt(actualCount)) {
          Alert.alert(
            'Monthly Limit Reached',
            'You have reached your monthly receipt limit. The receipt was saved successfully, but you cannot add more receipts until next month or upgrading your plan.',
            [{ text: 'OK' }]
          );
        }

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
    } catch (error: any) {
      console.error('Capture error:', error);
      let errorMessage = 'Failed to capture receipt. ';
      
      if (error.code === 'camera/not-ready') {
        errorMessage += 'Camera is not ready. Please try again.';
      } else if (error.code === 'permission/denied') {
        errorMessage += 'Camera permission denied.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      Alert.alert('Camera Error', errorMessage, [
        { 
          text: 'Try Again',
          onPress: () => {
            setIsCapturing(false);
            setIsAnalyzing(false);
            setOcrStatus('');
          }
        },
        {
          text: 'Cancel',
          onPress: () => {
            setIsCapturing(false);
            setIsAnalyzing(false);
            setOcrStatus('');
            navigation.goBack();
          },
          style: 'cancel'
        }
      ]);
    } finally {
      setIsCapturing(false);
      setIsAnalyzing(false);
      setOcrStatus('');
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

  // Show loading state
  if (loading || !subscription) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[styles.limitContainer, { backgroundColor: theme.background.secondary }]}>
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.text, { color: theme.text.secondary }]}>
            {!subscription ? 'Loading subscription info...' : 'Checking receipt limits...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user can add more receipts
  const canAdd = canAddReceipt(currentReceiptCount);
  const remaining = getRemainingReceipts(currentReceiptCount);
  console.log('Subscription check:', { 
    currentReceiptCount, 
    canAdd, 
    subscription,
    remaining
  });

  if (!canAdd) {
    const remaining = getRemainingReceipts(currentReceiptCount);
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
        <View style={[styles.limitContainer, { 
          backgroundColor: theme.background.secondary,
          borderColor: theme.border.primary,
          borderWidth: 1
        }]}>
          <Text style={[styles.limitTitle, { color: theme.text.primary }]}>
            Monthly Receipt Limit Reached
          </Text>
          <Text style={[styles.limitMessage, { color: theme.text.secondary }]}>
            {remaining === 0
              ? "You've used all your receipts for this month. Upgrade your plan for more storage or wait until next month to add more receipts."
              : `You have ${remaining} receipt${remaining === 1 ? '' : 's'} remaining this month. Upgrade your plan for more storage.`}
          </Text>
          <TouchableOpacity
            style={[styles.captureButton, { backgroundColor: theme.gold.primary }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.captureText}>Back to Receipts</Text>
          </TouchableOpacity>
        </View>
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
              <>
                <ActivityIndicator color="white" />
                <Text style={[styles.captureText, { marginTop: 8 }]}>
                  {isAnalyzing ? 'Analyzing Receipt...' : 'Capturing...'}
                </Text>
                {ocrStatus && (
                  <Text style={styles.ocrStatus}>
                    {ocrStatus}
                  </Text>
                )}
              </>
            ) : (
              <Text style={styles.captureText}>
                📸 Capture Receipt
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </CameraView>
    </SafeAreaView>
  );
};