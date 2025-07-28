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
import { CaptureOptions } from "../components/CaptureOptions";
import { CameraView, CameraType, useCameraPermissions } from "expo-camera";
import { SaveFormat } from "expo-image-manipulator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { useSubscription } from "../context/SubscriptionContext";
import { useFocusEffect } from "@react-navigation/native";
import { useReceiptsNavigation } from "../navigation/navigationHelpers";
import { storage, db } from "../config/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { enforceReceiptLimit } from "../utils/enforceReceiptLimit";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { receiptService } from "../services/firebaseService";
import * as ImageManipulator from "expo-image-manipulator";
// Import the receipt OCR service
import { receiptOCRService } from "../services/ReceiptOCRService";
import { ReceiptCategoryService, ReceiptCategory } from "../services/ReceiptCategoryService";

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
  limitContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    marginHorizontal: 20,
    borderRadius: 12,
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
  limitTitle: {
    fontSize: 20,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  limitMessage: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.8,
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
  const { subscription, canAddReceipt, getRemainingReceipts } =
    useSubscription();
  const { theme } = useTheme();
  const cameraRef = useRef<CameraView>(null);

  // States
  const [initialized, setInitialized] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentReceiptCount, setCurrentReceiptCount] = useState(0);

  // Combined effect for receipt limit check and count fetch
  useFocusEffect(
    useCallback(() => {
      const checkLimitAndFetchCount = async () => {
        if (!user?.uid) {
          setLoading(false);
          return;
        }

        try {
          // Get monthly usage count
          const startOfMonth = new Date();
          startOfMonth.setDate(1);
          startOfMonth.setHours(0, 0, 0, 0);

          const monthlyUsageSnapshot = await getDocs(
            query(
              collection(db, "receipts"),
              where("userId", "==", user.uid),
              where("createdAt", ">=", startOfMonth),
              orderBy("createdAt", "desc")
            )
          );

          setCurrentReceiptCount(monthlyUsageSnapshot.size);

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
                      onPress: () => navigation.navigate("ReceiptsList"),
                    },
                  ]
                );
              }
            );

            if (!allowed) {
              navigation.navigate("ReceiptsList");
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

    // Always get a fresh count from Firestore
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usageSnapshot = await getDocs(
      query(
        collection(db, "receipts"),
        where("userId", "==", user.uid),
        where("createdAt", ">=", startOfMonth),
        orderBy("createdAt", "desc")
      )
    );

    const actualCount = usageSnapshot.size;
    setCurrentReceiptCount(actualCount);
    
    // Professional tier has maxReceipts = -1, indicating unlimited
    const maxReceipts = subscription?.limits.maxReceipts;
    const canAdd = maxReceipts === -1 || actualCount < maxReceipts;

    if (!canAdd) {
      Alert.alert(
        "Monthly Limit Reached",
        "You have reached your monthly receipt limit. Please upgrade your plan or wait until next month to add more receipts.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    }

    return { canAdd, currentCount: actualCount };
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

      setOcrStatus("Optimizing image...");

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

      setOcrStatus("Preparing upload...");

      // Convert image to blob with proper path handling
      const uri =
        Platform.OS === "ios"
          ? optimizedImage.uri
          : `file://${optimizedImage.uri}`;
      const response = await fetch(uri);
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

      try {
        setOcrStatus("Uploading to cloud...");

        // Try to upload in a single operation
        await uploadBytesResumable(storageRef, blob, metadata);
        const downloadURL = await getDownloadURL(storageRef);

        // Analyze receipt with OCR using the new function-based approach
        setIsAnalyzing(true);
        setOcrStatus("Analyzing receipt data...");
        console.log("Analyzing receipt with OCR...");

        try {
          // Use the OCR service to analyze the receipt
          const ocrData = await receiptOCRService.analyzeReceipt(uri);
          console.log("OCR Analysis result:", ocrData);
          setOcrStatus("Processing complete!");

          // Get the receipt category based on the OCR data
          let category: ReceiptCategory = 'other';
          const result = await ReceiptCategoryService.determineCategory(ocrData);
          category = result.category;
          console.log('Determined category:', { 
            merchantName: ocrData.merchantName, 
            category,
            confidence: result.confidence 
          });

          // Create receipt record in Firestore with OCR data - ensure no undefined values
          const receiptData = {
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

          await receiptService.createReceipt(receiptData);
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

        const updatedUsageSnapshot = await getDocs(
          query(
            collection(db, "receipts"),
            where("userId", "==", user.uid),
            where("createdAt", ">=", startOfMonth),
            orderBy("createdAt", "desc")
          )
        );

        const actualCount = updatedUsageSnapshot.size;
        setCurrentReceiptCount(actualCount);

        // Check if we can add more receipts after this one
        if (!canAddReceipt(actualCount)) {
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

      Alert.alert("Camera Error", errorMessage, [
        {
          text: "Try Again",
          onPress: () => {
            setIsCapturing(false);
            setIsAnalyzing(false);
            setOcrStatus("");
          },
        },
        {
          text: "Cancel",
          onPress: () => {
            setIsCapturing(false);
            setIsAnalyzing(false);
            setOcrStatus("");
            navigation.goBack();
          },
          style: "cancel",
        },
      ]);
    } finally {
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
          style={[
            styles.limitContainer,
            { backgroundColor: theme.background.secondary },
          ]}
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

  if (!canAdd) {
    const remaining = getRemainingReceipts(currentReceiptCount);
    return (
      <SafeAreaView
        style={[
          styles.container,
          { backgroundColor: theme.background.primary },
        ]}
      >
        <View
          style={[
            styles.limitContainer,
            {
              backgroundColor: theme.background.secondary,
              borderColor: theme.border.primary,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[styles.limitTitle, { color: theme.text.primary }]}>
            Monthly Receipt Limit Reached
          </Text>
          <Text style={[styles.limitMessage, { color: theme.text.secondary }]}>
            {remaining === 0
              ? "You've used all your receipts for this month. Upgrade your plan for more storage or wait until next month to add more receipts."
              : `You have ${remaining} receipt${
                  remaining === 1 ? "" : "s"
                } remaining this month. Upgrade your plan for more storage.`}
          </Text>
          <TouchableOpacity
            style={[
              styles.captureButton,
              { backgroundColor: theme.gold.primary },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.captureText}>Back to Receipts</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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

      console.log("Gallery image selected, analyzing...");
      setOcrStatus("Analyzing receipt...");

      // Analyze the receipt
      const ocrData = await receiptOCRService.analyzeReceipt(imageUri);
      if (!ocrData) {
        console.error("Failed to analyze receipt");
        setIsAnalyzing(false);
        setOcrStatus("");
        return;
      }

      setOcrStatus("Preparing upload...");

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
        // Get the receipt category based on the OCR data
        const result = await ReceiptCategoryService.determineCategory(ocrData);
        console.log('Determined category:', { 
          merchantName: ocrData.merchantName, 
          category: result.category,
          confidence: result.confidence 
        });

        // Create receipt record in Firestore with OCR data
        const receiptData = {
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
            category: result.category,
          },
          category: result.category,
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

        await receiptService.createReceipt(receiptData);
        setOcrStatus("Processing complete!");

        // Check final count and update UI
        const { canAdd: canAddMore, currentCount } = await checkReceiptLimit();
        if (!canAddMore) {
          Alert.alert(
            "Monthly Limit Reached",
            "The receipt was saved successfully. You have now reached your monthly limit and cannot add more receipts until next month or upgrading your plan.",
            [{ text: "OK" }]
          );
        }

        // Navigate back to receipts list
        navigation.goBack();

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
      Alert.alert(
        "Error",
        "Failed to process image from gallery. Please try again."
      );
    } finally {
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
    </SafeAreaView>
  );
};
