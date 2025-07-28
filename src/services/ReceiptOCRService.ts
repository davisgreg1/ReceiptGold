import DocumentIntelligence, {
    isUnexpected,
    DocumentIntelligenceClient,
    AnalyzeResultOutput,
    DocumentFieldOutput
} from "@azure-rest/ai-document-intelligence";
import { AzureKeyCredential } from "@azure/core-auth";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

const endpoint = process.env.EXPO_PUBLIC_AZURE_FORM_RECOGNIZER_ENDPOINT;
const apiKey = process.env.EXPO_PUBLIC_AZURE_FORM_RECOGNIZER_API_KEY;

if (!endpoint || !apiKey) {
    throw new Error("Azure Form Recognizer credentials not found in environment variables");
}

export interface ReceiptData {
    merchantName?: string;
    merchantAddress?: string;
    merchantPhone?: string;
    transactionDate?: Date;
    transactionTime?: string;
    total?: number;
    subtotal?: number;
    tax?: number;
    items?: Array<{
        description: string;
        quantity?: number;
        price: number;
    }>;
    paymentMethod?: string;
}

// Create client instance
const client: DocumentIntelligenceClient = DocumentIntelligence(endpoint, new AzureKeyCredential(apiKey));

const logDebug = (message: string, data?: any): void => {
    console.log(`[OCR Service] ${message}`, data ? data : '');
};

const logError = (message: string, error: any): void => {
    console.error(`[OCR Service Error] ${message}:`, error);
    if (error?.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
    }
};

const validateImageUri = (uri: string): void => {
    if (!uri) {
        throw new Error("No image URI provided");
    }
    if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
        throw new Error("Invalid image URI format");
    }
};

// Helper function to safely get field content
const getFieldContent = (field: DocumentFieldOutput | undefined): string => {
    return field?.content || field?.valueString || '';
};

// Helper function to safely parse number fields
const getNumberField = (field: DocumentFieldOutput | undefined): number | undefined => {
    if (field?.valueNumber !== undefined) {
        return field.valueNumber;
    }
    if (field?.content) {
        const value = parseFloat(field.content);
        return isNaN(value) ? undefined : value;
    }
    return undefined;
};

// Helper function to safely parse dates
const parseDate = (dateString: string): Date | undefined => {
    try {
        // First try parsing as ISO string
        const date = new Date(dateString);
        if (!isNaN(date.getTime())) {
            return date;
        }

        // If that fails, try parsing common date formats
        const formats = [
            // MM/DD/YYYY
            /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
            // MM-DD-YYYY
            /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
            // YYYY/MM/DD
            /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
            // YYYY-MM-DD
            /^(\d{4})-(\d{1,2})-(\d{1,2})$/
        ];

        for (const format of formats) {
            const match = dateString.match(format);
            if (match) {
                const [_, part1, part2, part3] = match;
                // Check if year is first or last in the format
                const year = part3.length === 4 ? part3 : part1;
                const month = part3.length === 4 ? part1 : part2;
                const day = part3.length === 4 ? part2 : part3;
                
                const parsed = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day)
                );
                
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        // If all parsing attempts fail, return undefined
        console.warn(`Could not parse date string: ${dateString}`);
        return undefined;
    } catch (error) {
        console.error(`Error parsing date: ${dateString}`, error);
        return undefined;
    }
};

export const pickImage = async (): Promise<string | null> => {
    try {
        // Request permission
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            throw new Error("Permission to access media library was denied");
        }

        // Pick the image
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            return result.assets[0].uri;
        }

        return null;
    } catch (error) {
        console.error("Error picking image:", error);
        throw error;
    }
};

export const analyzeReceipt = async (imageUri: string): Promise<ReceiptData> => {
    try {
        validateImageUri(imageUri);
        logDebug("Starting receipt analysis...", { imageUri });

        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
            throw new Error("Image file does not exist");
        }
        logDebug("File info", fileInfo);

        // Validate file size
        const maxSize = 4 * 1024 * 1024; // 4MB
        if (fileInfo.size && fileInfo.size > maxSize) {
            throw new Error("Image file is too large (max 4MB)");
        }

        logDebug("Converting image to base64...");
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        if (!base64) {
            throw new Error("Failed to read image data");
        }

        console.log("Converting image data for Azure...");

        // Convert base64 to bytes for Azure
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));

        console.log("Sending to Azure Document Intelligence...");

        // Start the analysis using the official pattern
        const initialResponse = await client
            .path("/documentModels/{modelId}:analyze", "prebuilt-receipt")
            .post({
                contentType: "application/octet-stream",
                body: bytes
            });

        if (isUnexpected(initialResponse)) {
            throw new Error(initialResponse.body?.error?.message || 'Analysis request failed');
        }

        console.log("Analysis started, waiting for results...");

        // Get the operation location from headers
        const operationLocation = initialResponse.headers["operation-location"];
        if (!operationLocation) {
            throw new Error("No operation location found in response headers");
        }

        console.log("Operation location:", operationLocation);

        // Poll for results using the operation location directly
        let attempts = 0;
        const maxAttempts = 30;
        let analyzeResult: AnalyzeResultOutput | undefined;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`Polling attempt ${attempts}/${maxAttempts}...`);

            // Wait before polling
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Check the operation status using the operation location URL directly
            const statusResponse = await fetch(operationLocation, {
                method: 'GET',
                headers: {
                    'Ocp-Apim-Subscription-Key': apiKey,
                },
            });

            if (!statusResponse.ok) {
                console.error('Status response not OK:', statusResponse.status, statusResponse.statusText);
                throw new Error(`Status check failed: ${statusResponse.statusText} (${statusResponse.status})`);
            }

            const statusData = await statusResponse.json();
            console.log(`Status check ${attempts}:`, statusData.status);

            if (statusData.status === "succeeded") {
                analyzeResult = statusData.analyzeResult;
                console.log("Analysis completed successfully!");
                break;
            } else if (statusData.status === "failed") {
                const errorMsg = statusData.error?.message || 'Document analysis failed';
                console.error('Analysis failed with error:', errorMsg);
                throw new Error(`Document analysis failed: ${errorMsg}`);
            }

            // Continue polling if status is "running" or "notStarted"
        }

        if (!analyzeResult) {
            throw new Error("Analysis timed out or failed to complete");
        }

        const documents = analyzeResult?.documents;
        const document = documents?.[0];

        if (!document) {
            throw new Error("No receipt data found");
        }

        logDebug("Document found:", {
            docType: document.docType,
            confidence: document.confidence ?? "<undefined>"
        });

        const fields = document.fields || {};

        // Extract receipt data
        const receiptData: ReceiptData = {
            merchantName: getFieldContent(fields.MerchantName),
            merchantAddress: getFieldContent(fields.MerchantAddress),
            merchantPhone: getFieldContent(fields.MerchantPhoneNumber),
            transactionDate: fields.TransactionDate?.content
                ? parseDate(fields.TransactionDate.content)
                : undefined,
            total: getNumberField(fields.Total),
            subtotal: getNumberField(fields.Subtotal),
            tax: getNumberField(fields.TotalTax),
            items: fields.Items?.valueArray
                ? fields.Items.valueArray.map((item: any) => {
                    const itemFields = item.valueObject || {};
                    return {
                        description: getFieldContent(itemFields.Description),
                        quantity: getNumberField(itemFields.Quantity),
                        price: getNumberField(itemFields.TotalPrice) || 0,
                    };
                }).filter((item: any) => item.description && item.price > 0)
                : undefined,
            paymentMethod: getFieldContent(fields.PaymentMethod),
        };

        logDebug("Extracted receipt data:", receiptData);
        return receiptData;

    } catch (error: any) {
        logError("Error analyzing receipt", error);

        // Provide more descriptive error messages
        if (error.message?.includes("image data")) {
            throw new Error("Failed to process the image. Please try taking the photo again.");
        } else if (error.message?.includes("No receipt data found")) {
            throw new Error("Could not detect a receipt in the image. Please try again with a clearer photo.");
        } else if (error.name === "RestError" || error.code) {
            throw new Error("Connection error with Azure Document Intelligence. Please check your internet connection and try again.");
        }

        throw error;
    }
};

export const captureAndAnalyzeReceipt = async (): Promise<ReceiptData | null> => {
    try {
        // Request camera permission
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            throw new Error("Permission to access camera was denied");
        }

        // Launch camera
        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 1,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
            // Analyze the captured receipt
            return await analyzeReceipt(result.assets[0].uri);
        }

        return null;
    } catch (error) {
        console.error("Error capturing and analyzing receipt:", error);
        throw error;
    }
};

// For backward compatibility, export an object that mimics the class interface
export const receiptOCRService = {
    pickImage,
    analyzeReceipt,
    captureAndAnalyzeReceipt,
};

// Main function for testing (similar to the official example)
export const testReceiptAnalysis = async (imageUri?: string): Promise<ReceiptData | void> => {
    try {
        let uri = imageUri;
        if (!uri) {
            const picked = await pickImage();
            uri = picked === null ? undefined : picked;
            if (!uri) {
                console.log("No image selected");
                return;
            }
        }

        const receiptData = await analyzeReceipt(uri);
        console.log("Extracted receipt data:", receiptData);
        return receiptData;
    } catch (error) {
        console.error("Test failed:", error);
        throw error;
    }
};