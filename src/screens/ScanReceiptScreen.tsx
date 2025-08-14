import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { OCRScanningOverlay } from "../components/OCRScanningOverlay";
import { CaptureOptions } from "../components/CaptureOptions";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { SaveFormat } from "expo-image-manipulator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useFocusEffect } from "@react-navigation/native";
import { useReceiptsNavigation } from "../navigation/navigationHelpers";
import { getMonthlyReceiptCount } from '../utils/getMonthlyReceipts';
import { storage, db } from "../config/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { enforceReceiptLimit } from "../utils/enforceReceiptLimit";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { receiptService } from "../services/firebaseService";
import * as ImageManipulator from "expo-image-manipulator";
import { receiptOCRService } from "../services/ReceiptOCRService";
import { ReceiptCategoryService, ReceiptCategory } from "../services/ReceiptCategoryService";
import { USE_DUMMY_DATA, generateDummyReceiptData, logDummyDataStatus } from "../utils/dummyReceiptData";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    backgroundColor: "transparent",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    margin: 20,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  backButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    marginTop: 12,
  },
  captureButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 200,
    marginVertical: 5,
  },
  captureText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  text: {
    textAlign: "center",
    fontSize: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  ocrStatus: {
    color: "white",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
  },
});

export const ScanReceiptScreen = () => {
  const { user } = useAuth();
  const navigation = useReceiptsNavigation();
  const { subscription, canAddReceipt, getRemainingReceipts, currentReceiptCount, refreshReceiptCount } =
    useSubscription();
  const { theme } = useTheme();
  const cameraRef = useRef<CameraView>(null);

  // Log dummy data status on component mount
  useEffect(() => {
    logDummyDataStatus();
  }, []);

  // Refresh receipt count when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        refreshReceiptCount();
      }
    }, [user?.uid, refreshReceiptCount])
  );

  // States
  const [initialized, setInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showScanning, setShowScanning] = useState(false);
  const [scanningError, setScanningError] = useState<string | null>(null);
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);

  // Combined effect for receipt limit check and count fetch
  useFocusEffect(
    useCallback(() => {
      const checkLimitAndFetchCount = async () => {
        if (!user?.uid) {
          setLoading(false);
          return;
        }

        try {
          // Get monthly usage count using the unified counting method
          await refreshReceiptCount();

          // Check receipt limit
          const maxReceipts = subscription?.limits?.maxReceipts || 10;

          // Skip limit check for unlimited plan (professional tier)
          if (maxReceipts !== -1) {
            const allowed = await enforceReceiptLimit(
              user.uid,
              maxReceipts,
              () => {
                Alert.alert(
                  "Receipt Limit Reached",
                  "You have reached your monthly receipt limit. Please upgrade your plan to add more receipts.",
                  [
                    {
                      text: "OK",
                      onPress: () => navigation.goBack(),
                    },
                  ]
                );
              }
            );

            if (!allowed) {
              navigation.goBack();
            }
          }
        } catch (error) {
          console.error("Error in checkLimitAndFetchCount:", error);
        } finally {
          setLoading(false);
          if (!initialized) {
            setInitialized(true);
          }
        }
      };

      checkLimitAndFetchCount();
    }, [user?.uid, subscription?.limits?.maxReceipts, navigation, initialized])
  );

  // Log subscription state for debugging
  useEffect(() => {
    console.log("Subscription state:", subscription);
  }, [subscription]);



  const [facing] = useState<CameraType>("back");
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  
  const checkReceiptLimit = async (): Promise<{ canAdd: boolean; currentCount: number }> => {
    if (!user?.uid) {
      return { canAdd: false, currentCount: 0 };
    }

    // Get the monthly count using our utility that properly handles excluded receipts
    await refreshReceiptCount();
    
    // Professional tier has maxReceipts = -1, indicating unlimited
    const maxReceipts = subscription?.limits.maxReceipts;
    const canAdd = maxReceipts === -1 || currentReceiptCount < maxReceipts;

    if (!canAdd) {
      Alert.alert(
        "Monthly Limit Reached",
        "You have reached your monthly receipt limit. Please upgrade your plan or wait until next month to add more receipts.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    }

    return { canAdd, currentCount: currentReceiptCount };
  };

  const handleCapture = async () => {
    if (!cameraRef.current || !user || isCapturing) return;

    // Check receipt limit before capturing
    const { canAdd } = await checkReceiptLimit();
    if (!canAdd) {
      return;
    }

    try {
      setIsCapturing(true);
      setOcrStatus("Capturing photo...");

      // Capture the photo using the CameraView API
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        skipProcessing: true,
      });

      // Set captured image and show scanning overlay
      setCapturedImageUri(photo.uri);
      setShowScanning(true);
      setScanningError(null);

      setOcrStatus("Optimizing image...");

      // Optimize the image
      const optimizedImage = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      // FIRST: Analyze the image to validate it's a receipt BEFORE uploading
      setIsAnalyzing(true);
      setOcrStatus("Validating receipt...");
      console.log("Validating image as receipt with OCR...");

      let ocrData;
      let receiptData;
      try {
        // Use real OCR service to validate and analyze receipt
        ocrData = await receiptOCRService.analyzeReceipt(optimizedImage.uri);
        console.log("Receipt validation successful:", ocrData);
        setOcrStatus("Receipt validated! Uploading...");

        // Get the receipt category based on the OCR data
        let category: ReceiptCategory = 'other';
        const result = await ReceiptCategoryService.determineCategory(ocrData);
        category = result.category;
        console.log('Determined category:', { 
          merchantName: ocrData.merchantName, 
          category,
          confidence: result.confidence 
        });

      } catch (validationError: any) {
        console.error("Receipt validation failed:", validationError);
        setIsAnalyzing(false);
        setShowScanning(false);
        setCapturedImageUri(null);
        
        // Show specific error message to user
        Alert.alert(
          "Is this a receipt?", 
          validationError.message || "This image does not appear to be a receipt. Please try again with a clear photo of a receipt.",
          [{ text: "OK" }]
        );
        return; // Stop processing - don't upload or save anything
      }

      // ONLY if validation passes, proceed with upload
      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const filename = `receipts/${user.uid}/${timestamp}.jpg`;
      const storageRef = ref(storage, filename);

      console.log("🚀 Starting receipt upload process for user:", user.uid);
      setOcrStatus("Uploading to cloud...");

      // Convert image to blob with proper path handling
      const uri =
        Platform.OS === "ios"
          ? optimizedImage.uri
          : `file://${optimizedImage.uri}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      console.log("🚀 Image converted to blob, size:", blob.size);

      // Upload to Firebase Storage
      const metadata = {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000",
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString(),
        },
      };

      try {
        setOcrStatus("Uploading to cloud...");
        console.log("🚀 Starting upload to Firebase Storage...");

        // Try to upload in a single operation
        await uploadBytesResumable(storageRef, blob, metadata);
        const downloadURL = await getDownloadURL(storageRef);
        console.log("🚀 Upload completed, download URL:", downloadURL);

        // Use the already-analyzed OCR data from validation step
        setOcrStatus("Processing complete!");

        try {
          let receiptData;

          if (USE_DUMMY_DATA) {
            console.log("🚀 ~ handleCapture ~ USE_DUMMY_DATA:", USE_DUMMY_DATA)
            // Use dummy data instead of OCR
            console.log("🎭 Using dummy data instead of OCR analysis");
            
            const dummyData = generateDummyReceiptData();
            console.log("Generated dummy data:", dummyData);

            // Create receipt record with dummy data
            receiptData = {
              userId: user.uid,
              images: [
                {
                  url: downloadURL,
                  size: blob.size,
                  uploadedAt: new Date(),
                },
              ],
              ...dummyData, // Spread all the dummy data
            };
          } else {
            // Use the already-analyzed OCR data (no need to re-analyze)
            console.log("Using pre-validated OCR data:", ocrData);

            // Category was already determined in validation step
            const category = ocrData.category || 'other';
            console.log('Using determined category:', { 
              merchantName: ocrData.merchantName, 
              category,
              confidence: ocrData.categoryConfidence 
            });

            // Create receipt record in Firestore with OCR data - ensure no undefined values
            receiptData = {
              userId: user.uid,
              images: [
                {
                  url: downloadURL,
                  size: blob.size,
                  uploadedAt: new Date(),
                },
              ],
              status: "processed" as const,
              vendor: ocrData.merchantName || "",
              amount: ocrData.total || 0,
              currency: "USD",
              date:
                ocrData.transactionDate instanceof Date
                  ? ocrData.transactionDate
                  : new Date(),
              description: ocrData.merchantName
                ? `Receipt from ${ocrData.merchantName}`
                : "Scanned Receipt",
              tax: {
                deductible: true,
                deductionPercentage: 100,
                taxYear: new Date().getFullYear(),
                category,
              },
              category, // Use determined category
              tags: ["ocr-processed"],
              extractedData: {
                vendor: ocrData.merchantName || "",
                amount: ocrData.total || 0,
                tax: ocrData.tax || 0,
                date:
                  ocrData.transactionDate instanceof Date
                    ? ocrData.transactionDate.toISOString()
                    : new Date().toISOString(),
                confidence: 0.9, // Azure Document Intelligence typically has high confidence
                items:
                  ocrData.items?.map((item) => ({
                    description: item.description || "",
                    amount: item.price || 0,
                    quantity: item.quantity || 1,
                  })) || [],
              },
              processingErrors: [],
            };
          }

          await receiptService.createReceipt(receiptData);
          console.log("✅ Receipt successfully saved to Firestore");
          
          setShowScanning(false);
          setCapturedImageUri(null);
          // navigation.goBack();
        } catch (ocrError: any) {
          console.error("OCR Analysis failed:", ocrError);
          setOcrStatus("OCR failed, saving without analysis...");

          // Still save the receipt even if OCR fails - ensure no undefined values
          const fallbackReceiptData = {
            userId: user.uid,
            images: [
              {
                url: downloadURL,
                size: blob.size,
                uploadedAt: new Date(),
              },
            ],
            status: "error" as const, // Mark as error since OCR failed
            vendor: "",
            amount: 0,
            currency: "USD",
            date: new Date(),
            description: "Scanned Receipt (Manual entry required)",
            tax: {
              deductible: true,
              deductionPercentage: 100,
              taxYear: new Date().getFullYear(),
              category: "business_expense",
            },
            category: "business_expense", // Use the same category as tax
            tags: ["manual-entry-required"],
            extractedData: {
              vendor: "",
              amount: 0,
              tax: 0,
              date: new Date().toISOString(),
              confidence: 0,
              items: [],
            },
            processingErrors: [ocrError.message || "OCR analysis failed"],
          };

          await receiptService.createReceipt(fallbackReceiptData);
          console.log("✅ Fallback receipt successfully saved to Firestore");

          // Show OCR error but don't prevent saving
          Alert.alert(
            "Receipt Saved",
            "The receipt was saved successfully, but automatic data extraction failed. You can manually edit the receipt details.",
            [{ text: "OK" }]
          );
        }

        // Fetch the current count from Firestore to ensure accuracy
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Refresh receipt count after upload
        await refreshReceiptCount();
        
        // Verify the count is correct by checking Firestore directly
        console.log("🚀 Verifying receipt count after upload...");
        const manualCount = await getMonthlyReceiptCount(user.uid);
        console.log("🚀 Manual count check result:", manualCount);
        console.log("🚀 Context count:", currentReceiptCount);

        // Check if we can add more receipts after this one
        if (!canAddReceipt(currentReceiptCount)) {
          Alert.alert(
            "Monthly Limit Reached",
            "You have reached your monthly receipt limit. The receipt was saved successfully, but you cannot add more receipts until next month or upgrading your plan.",
            [{ text: "OK" }]
          );
        }

        // Navigate back to receipts list
        navigation.goBack();
      } catch (error: any) {
        console.error("Upload error:", error);
        let errorMessage = "Failed to upload receipt. ";

        if (error.code === "storage/unauthorized") {
          errorMessage += "Please check your permissions.";
        } else if (error.code === "storage/canceled") {
          errorMessage += "Upload was canceled.";
        } else if (error.code === "storage/retry-limit-exceeded") {
          errorMessage += "Poor network connection. Please try again.";
        } else {
          errorMessage += error.message || "Please try again.";
        }

        Alert.alert("Error", errorMessage);
      }
    } catch (error: any) {
      console.error("Capture error:", error);
      let errorMessage = "Failed to capture receipt. ";

      if (error.code === "camera/not-ready") {
        errorMessage += "Camera is not ready. Please try again.";
      } else if (error.code === "permission/denied") {
        errorMessage += "Camera permission denied.";
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again.";
      }

      setScanningError(errorMessage);
    } finally {
      if (!scanningError) {
        setShowScanning(false);
        setCapturedImageUri(null);
      }
      setIsCapturing(false);
      setIsAnalyzing(false);
      setOcrStatus("");
    }
  };

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.background.primary },
        ]}
      >
        <Text style={[styles.text, { color: theme.text.primary }]}>
          We need your permission to show the camera
        </Text>
        <TouchableOpacity
          style={[
            styles.captureButton,
            { backgroundColor: theme.gold.primary },
          ]}
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
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.background.primary },
        ]}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            alignItems: "center",
            padding: 20,
            marginHorizontal: 20,
            borderRadius: 12,
            backgroundColor: theme.background.secondary,
          }}
        >
          <ActivityIndicator size="large" color={theme.gold.primary} />
          <Text style={[styles.text, { color: theme.text.secondary }]}>
            {!subscription
              ? "Loading subscription info..."
              : "Checking receipt limits..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Check if user can add more receipts
  const canAdd = canAddReceipt(currentReceiptCount);
  const remaining = getRemainingReceipts(currentReceiptCount);
  console.log("Subscription check:", {
    currentReceiptCount,
    canAdd,
    subscription,
    remaining,
  });

  // If user can't add more receipts, redirect to receipts list where they'll see the limit prompt
  if (!canAdd) {
    useEffect(() => {
      navigation.goBack();
    }, [navigation]);
    
    return (
      <View style={[styles.container, { backgroundColor: theme.background.primary, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.gold.primary} />
        <Text style={{ color: theme.text.primary, marginTop: 16, fontSize: 16 }}>
          Redirecting to receipts...
        </Text>
      </View>
    );
  }

  const handleGallerySelect = async () => {
    if (!user) {
      Alert.alert("Error", "You must be logged in to add receipts");
      return;
    }

    try {
      // Check receipt limit before proceeding
      const { canAdd } = await checkReceiptLimit();
      if (!canAdd) {
        return;
      }

      setIsAnalyzing(true);
      setOcrStatus("Selecting image...");

      // First pick the image
      const imageUri = await receiptOCRService.pickImage("gallery");
      if (!imageUri) {
        console.log("No image selected or user cancelled");
        setIsAnalyzing(false);
        setOcrStatus("");
        return;
      }

      // Show scanning animation
      setCapturedImageUri(imageUri);
      setShowScanning(true);
      setScanningError(null);

      console.log("Gallery image selected, validating...");
      setOcrStatus("Validating receipt...");

      // FIRST: Validate the image is a receipt BEFORE uploading
      let ocrData;
      try {
        ocrData = await receiptOCRService.analyzeReceipt(imageUri);
        console.log("Receipt validation successful:", ocrData);
        setOcrStatus("Receipt validated! Uploading...");
      } catch (validationError: any) {
        console.error("Receipt validation failed:", validationError);
        setIsAnalyzing(false);
        setShowScanning(false);
        setCapturedImageUri(null);
        
        // Show specific error message to user
        Alert.alert(
          "Is this a receipt?", 
          validationError.message || "This image does not appear to be a receipt. Please try again with a clear photo of a receipt.",
          [{ text: "OK" }]
        );
        return; // Stop processing - don't upload or save anything
      }

      // ONLY if validation passes, proceed with upload
      // Generate a unique filename with timestamp
      const timestamp = Date.now();
      const filename = `receipts/${user.uid}/${timestamp}.jpg`;
      const storageRef = ref(storage, filename);

      // Convert image to blob with proper path handling
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Firebase Storage
      const metadata = {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000",
        customMetadata: {
          userId: user.uid,
          uploadedAt: new Date().toISOString(),
        },
      };

      setOcrStatus("Uploading to cloud...");
      
      // Upload the image
      await uploadBytesResumable(storageRef, blob, metadata);
      const downloadURL = await getDownloadURL(storageRef);

      setOcrStatus("Processing receipt data...");

      try {
        let receiptData;

        if (USE_DUMMY_DATA) {
          // Use dummy data instead of OCR
          console.log("🎭 Using dummy data for gallery image");
          setOcrStatus("Generating dummy data...");
          
          // Add a small delay to simulate processing
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const dummyData = generateDummyReceiptData();
          console.log("Generated dummy data for gallery image:", dummyData);

          receiptData = {
            userId: user.uid,
            images: [
              {
                url: downloadURL,
                size: blob.size,
                uploadedAt: new Date(),
              },
            ],
            ...dummyData, // Spread all the dummy data
          };
        } else {
          // Use the already-analyzed OCR data from validation step
          console.log("Using pre-validated OCR data:", ocrData);

          // Category was already determined in validation step
          const category = ocrData.category || 'other';
          console.log('Using determined category:', { 
            merchantName: ocrData.merchantName, 
            category,
            confidence: ocrData.categoryConfidence 
          });

          // Create receipt record in Firestore with OCR data
          receiptData = {
            userId: user.uid,
            images: [
              {
                url: downloadURL,
                size: blob.size,
                uploadedAt: new Date(),
              },
            ],
            status: "processed" as const,
            vendor: ocrData.merchantName || "",
            amount: ocrData.total || 0,
            currency: "USD",
            date:
              ocrData.transactionDate instanceof Date
                ? ocrData.transactionDate
                : new Date(),
            description: ocrData.merchantName
              ? `Receipt from ${ocrData.merchantName}`
              : "Scanned Receipt",
            tax: {
              deductible: true,
              deductionPercentage: 100,
              taxYear: new Date().getFullYear(),
              category: category,
            },
            category: category,
            tags: ["ocr-processed"],
            extractedData: {
              vendor: ocrData.merchantName || "",
              amount: ocrData.total || 0,
              tax: ocrData.tax || 0,
              date:
                ocrData.transactionDate instanceof Date
                  ? ocrData.transactionDate.toISOString()
                  : new Date().toISOString(),
              confidence: 0.9,
              items:
                ocrData.items?.map((item: { description: string; quantity?: number; price: number }) => ({
                  description: item.description || "",
                  amount: item.price || 0,
                  quantity: item.quantity || 1,
                })) || [],
            },
            processingErrors: [],
          };
        }

        await receiptService.createReceipt(receiptData);
        setOcrStatus("Processing complete!");

        // Check final count and update UI
        const { canAdd: canAddMore, currentCount } = await checkReceiptLimit();
        if (!canAddMore) {
          Alert.alert(
            "Monthly Limit Reached",
            "The receipt was saved successfully. You have now reached your monthly limit and cannot add more receipts until next month or upgrading your plan.",
            [{ text: "OK", onPress: () => navigation.goBack() }]
          );
        } else {
          // Navigate back to the previous screen (receipts list)
          console.log("Receipt saved successfully, navigating back to Receipts List");
          navigation.navigate("ReceiptsList");
        }

      } catch (error) {
        console.error("Failed to process receipt:", error);
        
        // Save without OCR data
        const fallbackReceiptData = {
          userId: user.uid,
          images: [
            {
              url: downloadURL,
              size: blob.size,
              uploadedAt: new Date(),
            },
          ],
          status: "error" as const,
          vendor: "",
          amount: 0,
          currency: "USD",
          date: new Date(),
          description: "Scanned Receipt (Manual entry required)",
          tax: {
            deductible: true,
            deductionPercentage: 100,
            taxYear: new Date().getFullYear(),
            category: "business_expense",
          },
          category: "business_expense",
          tags: ["manual-entry-required"],
          extractedData: {
            vendor: "",
            amount: 0,
            tax: 0,
            date: new Date().toISOString(),
            confidence: 0,
            items: [],
          },
          processingErrors: [(error as Error).message || "Failed to process receipt"],
        };

        await receiptService.createReceipt(fallbackReceiptData);
        Alert.alert(
          "Receipt Saved",
          "The receipt was saved successfully, but automatic data extraction failed. You can manually edit the receipt details.",
          [{ text: "OK" }]
        );
        navigation.goBack();
      }

    } catch (error) {
      console.error("Gallery selection error:", error);
      setScanningError("Failed to process image from gallery. Please try again.");
    } finally {
      if (!scanningError) {
        setShowScanning(false);
        setCapturedImageUri(null);
      }
      setIsAnalyzing(false);
      setOcrStatus("");
    }
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.background.primary }]}
    >
      {showCamera ? (
        <CameraView ref={cameraRef} style={styles.camera} facing={facing}>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.captureButton,
                { backgroundColor: theme.gold.primary },
                isCapturing && { opacity: 0.7 },
              ]}
              onPress={handleCapture}
              disabled={isCapturing}
            >
              {isCapturing ? (
                <>
                  <ActivityIndicator color="white" />
                  <Text style={[styles.captureText, { marginTop: 8 }]}>
                    {isAnalyzing ? "Analyzing Receipt..." : "Capturing..."}
                  </Text>
                  {ocrStatus && (
                    <Text style={styles.ocrStatus}>{ocrStatus}</Text>
                  )}
                </>
              ) : (
                <Text style={styles.captureText}>📸 Capture Receipt</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.backButton,
                { backgroundColor: theme.gold.primary },
              ]}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.captureText}>Back</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      ) : (
        <CaptureOptions
          onSelectCamera={() => setShowCamera(true)}
          onSelectGallery={handleGallerySelect}
          isLoading={isAnalyzing}
          ocrStatus={ocrStatus}
        />
      )}
      {capturedImageUri && (showScanning || scanningError) && (
        <OCRScanningOverlay
          imageUri={capturedImageUri}
          isScanning={showScanning}
          isError={!!scanningError}
          errorMessage={scanningError || ''}
          statusMessage={ocrStatus}
          onRetry={() => {
            setScanningError(null);
            setShowScanning(false);
            setCapturedImageUri(null);
          }}
        />
      )}
    </SafeAreaView>
  );
};
