import { Platform } from 'react-native';
import { ReceiptCategoryService } from './ReceiptCategoryService';
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";

const openaiApiKey = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!openaiApiKey) {
    throw new Error("OpenAI API key not found in environment variables");
}

import { ReceiptCategory } from './ReceiptCategoryService';

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
    category?: ReceiptCategory;
    categoryConfidence?: number;
}

interface OpenAIReceiptResponse {
    isReceipt: boolean;
    confidence?: number;
    merchantName?: string | null;
    merchantAddress?: string | null;
    merchantPhone?: string | null;
    transactionDate?: string | null;
    transactionTime?: string | null;
    total?: number | null;
    subtotal?: number | null;
    tax?: number | null;
    items?: Array<{
        description: string;
        quantity?: number | null;
        price: number;
    }> | null;
    paymentMethod?: string | null;
}

const logDebug = (message: string, data?: any): void => {
    console.log(`[OCR Service] ${message}`, data ? data : '');
};

const logError = (message: string, error: any): void => {
    console.error(`[OCR Service Error] ${message}:`, error);
};

const validateImageUri = (uri: string): void => {
    if (!uri) {
        throw new Error("No image URI provided");
    }

    // For Android, we'll be more permissive since we'll normalize the URI later
    if (Platform.OS === 'android') {
        if (!uri.includes('file:') && !uri.includes('content:')) {
            throw new Error("Invalid image URI format");
        }
    } else {
        // For iOS, we'll be strict about the format
        if (!uri.startsWith('file://') && !uri.startsWith('content://')) {
            throw new Error("Invalid image URI format");
        }
    }

    logDebug("Image URI validation passed", { uri });
};

// Helper function to parse dates from OpenAI response
const parseDate = (dateString: string): Date | undefined => {
    try {
        // If it's already in ISO format with time, parse it directly
        if (dateString.includes('T') || dateString.includes(':')) {
            const date = new Date(dateString);
            if (!isNaN(date.getTime())) {
                return date;
            }
        }

        // For date-only strings, create the date in local timezone to avoid timezone shifts
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
                let year, month, day;
                
                if (part3.length === 4) {
                    // Year is last (MM/DD/YYYY or MM-DD-YYYY)
                    year = parseInt(part3);
                    month = parseInt(part1) - 1; // Month is 0-indexed
                    day = parseInt(part2);
                } else {
                    // Year is first (YYYY/MM/DD or YYYY-MM-DD)
                    year = parseInt(part1);
                    month = parseInt(part2) - 1; // Month is 0-indexed
                    day = parseInt(part3);
                }

                // Create date in local timezone to avoid timezone conversion issues
                const parsed = new Date(year, month, day);

                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
        }

        // If no specific format matches, try parsing as is but create in local timezone
        const isoMatch = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (isoMatch) {
            const [_, year, month, day] = isoMatch;
            const parsed = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            if (!isNaN(parsed.getTime())) {
                return parsed;
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

import * as ImageManipulator from 'expo-image-manipulator';

export type ImageSource = 'camera' | 'gallery';

export const pickImage = async (source: ImageSource = 'gallery'): Promise<string | null> => {
    try {
        // Request appropriate permission
        const { status } = source === 'gallery'
            ? await ImagePicker.requestMediaLibraryPermissionsAsync()
            : await ImagePicker.requestCameraPermissionsAsync();

        if (status !== "granted") {
            throw new Error(`Permission to access ${source} was denied`);
        }

        // Launch picker or camera
        const result = source === 'gallery'
            ? await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: false,
                quality: 1,
                aspect: [2, 3], // Receipt-like aspect ratio
            })
            : await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                quality: 1,
                aspect: [3, 4], // Receipt-like aspect ratio
            });

        if (!result.canceled && result.assets?.[0]?.uri) {
            // Process the image for optimal OCR using the new API
            const context = ImageManipulator.ImageManipulator.manipulate(result.assets[0].uri);
            context.resize({ width: 1200 }); // Keep aspect ratio, set max width
            const renderedImage = await context.renderAsync();
            const processedImage = await renderedImage.saveAsync({
                compress: 0.8, // Good balance of quality and file size
                format: ImageManipulator.SaveFormat.JPEG,
                base64: false,
            });

            return processedImage.uri;
        }

        return null;
    } catch (error) {
        console.error(`Error picking image from ${source}:`, error);
        throw error;
    }
};

export interface OCRProgressCallback {
    onStart?: () => void;
    onError?: (error: Error) => void;
    onSuccess?: () => void;
}

export const analyzeReceipt = async (
    imageUri: string,
    progressCallback?: OCRProgressCallback
): Promise<ReceiptData> => {
    try {
        validateImageUri(imageUri);
        logDebug("Starting receipt analysis with OpenAI...", { imageUri });

        // Notify analysis start
        progressCallback?.onStart?.();

        // Normalize the URI for Android
        let normalizedUri = imageUri;
        if (Platform.OS === 'android') {
            // First, remove any duplicate 'file:' prefixes and normalize slashes
            normalizedUri = imageUri
                .replace(/^\/+/, '') // Remove leading slashes
                .replace(/file:\/\/+file:\/\/+/, 'file://') // Remove duplicate file:// prefixes
                .replace(/file:\/\/+file:\//, 'file://') // Handle file://file:/ case
                .replace(/file:\/([^\/])/, 'file://$1') // Ensure double slash after file:
                .replace(/([^:])\/+/g, '$1/'); // Remove duplicate slashes except after colon

            // If still no file:// prefix, add it
            if (!normalizedUri.startsWith('file://')) {
                normalizedUri = `file://${normalizedUri}`;
            }

            logDebug("Normalized URI for Android", {
                originalUri: imageUri,
                normalizedUri,
            });
        }

        // Check if file exists
        const fileInfo = await FileSystem.getInfoAsync(normalizedUri, { size: true })
            .catch(error => {
                logError("Error checking file info", error);
                throw new Error(`Unable to access image file: ${error.message}`);
            });

        if (!fileInfo.exists) {
            throw new Error("Image file does not exist");
        }
        logDebug("File info", fileInfo);

        // Validate file size
        const maxSize = 20 * 1024 * 1024; // 20MB (OpenAI limit)
        if (fileInfo.size && fileInfo.size > maxSize) {
            throw new Error("Image file is too large (max 20MB)");
        }

        logDebug("Converting image to base64...");
        const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
            encoding: FileSystem.EncodingType.Base64,
        }).catch(error => {
            logError("Error reading file as base64", error);
            throw new Error(`Unable to read image file: ${error.message}`);
        });

        if (!base64) {
            throw new Error("Failed to read image data");
        }

        console.log("Sending to OpenAI Vision API...");

        // Call OpenAI Vision API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `First, determine if this image contains a receipt, invoice, or purchase document. Then analyze and extract the following information in JSON format. Return ONLY the JSON object, no other text:

{
  "isReceipt": boolean,
  "confidence": number (0.0 to 1.0),
  "merchantName": "string or null",
  "merchantAddress": "string or null", 
  "merchantPhone": "string or null",
  "transactionDate": "YYYY-MM-DD format or null",
  "transactionTime": "HH:MM format or null",
  "total": number or null,
  "subtotal": number or null,
  "tax": number or null,
  "items": [
    {
      "description": "string",
      "quantity": number or null,
      "price": number
    }
  ] or null,
  "paymentMethod": "string or null"
}

Guidelines:
- First determine if this is actually a receipt, invoice, or purchase document
- Set isReceipt to true only if you can clearly identify it as a receipt/invoice/purchase document
- Set confidence to your certainty level (1.0 = definitely a receipt, 0.0 = definitely not a receipt)
- If isReceipt is false, set all other fields to null
- Extract exact text as it appears on the receipt
- For numbers, include only the numeric value (no currency symbols)  
- For dates, use YYYY-MM-DD format
- For times, use HH:MM 24-hour format
- If information is not clearly visible or present, use null
- Items array should only include line items with prices, not totals or taxes`
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1
            })
        }).catch(error => {
            console.error('OpenAI API error:', error);
            throw new Error('Failed to connect to OpenAI service. Please check your internet connection and try again.');
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenAI API response error:', response.status, response.statusText, errorData);
            throw new Error(`OpenAI API error: ${response.statusText} (${response.status})`);
        }

        const data = await response.json();
        console.log("OpenAI response received");

        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error("Invalid response from OpenAI API");
        }

        const content = data.choices[0].message.content;
        console.log("Raw OpenAI response:", content);

        // Parse the JSON response
        let parsedData: OpenAIReceiptResponse;
        try {
            // Clean the response to extract just the JSON
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : content;
            parsedData = JSON.parse(jsonString) as OpenAIReceiptResponse;
        } catch (parseError) {
            console.error('Error parsing OpenAI response:', parseError);
            console.error('Raw content:', content);
            throw new Error("Could not parse receipt data from image. Please try again with a clearer photo.");
        }

        // Validate that this is actually a receipt
        if (!parsedData.isReceipt || (parsedData.confidence && parsedData.confidence < 0.7)) {
            const confidenceText = parsedData.confidence ? ` (confidence: ${Math.round(parsedData.confidence * 100)}%)` : '';
            throw new Error(`This image does not appear to be a receipt${confidenceText}. Please try again with a receipt, invoice, or purchase document.`);
        }

        console.log(`Receipt detected with ${Math.round((parsedData.confidence || 1) * 100)}% confidence`);

        // Convert the parsed data to our ReceiptData format
        const receiptData: ReceiptData = {
            merchantName: parsedData.merchantName || undefined,
            merchantAddress: parsedData.merchantAddress || undefined,
            merchantPhone: parsedData.merchantPhone || undefined,
            transactionDate: parsedData.transactionDate ? parseDate(parsedData.transactionDate) : undefined,
            transactionTime: parsedData.transactionTime || undefined,
            total: typeof parsedData.total === 'number' ? parsedData.total : undefined,
            subtotal: typeof parsedData.subtotal === 'number' ? parsedData.subtotal : undefined,
            tax: typeof parsedData.tax === 'number' ? parsedData.tax : undefined,
            items: Array.isArray(parsedData.items) ? parsedData.items
                .filter((item: any) => item && item.description && typeof item.price === 'number' && item.price > 0)
                .map((item: any) => ({
                    description: item.description,
                    quantity: typeof item.quantity === 'number' ? item.quantity : undefined,
                    price: item.price
                })) : undefined,
            paymentMethod: parsedData.paymentMethod || undefined,
        };

        // Determine category
        const { category, confidence } = await ReceiptCategoryService.determineCategory(receiptData);
        receiptData.category = category;
        receiptData.categoryConfidence = confidence;

        logDebug("Extracted receipt data:", receiptData);

        // Notify success
        progressCallback?.onSuccess?.();

        return receiptData;

    } catch (error: any) {
        logError("Error analyzing receipt", error);

        // Provide more descriptive error messages
        let finalError: Error;
        if (error.message?.includes("does not appear to be a receipt")) {
            finalError = error; // Use the specific non-receipt error message
        } else if (error.message?.includes("image data") || error.message?.includes("parse receipt data")) {
            finalError = new Error("Could not detect a receipt in the image. Please try again with a clearer photo.");
        } else if (error.message?.includes("connect to OpenAI") || error.message?.includes("OpenAI API")) {
            finalError = new Error("Please check your internet connection and try again.");
        } else {
            finalError = error;
        }

        // Notify error
        progressCallback?.onError?.(finalError);
        throw finalError;
    }
};

export const captureAndAnalyzeReceipt = async (source: ImageSource = 'camera'): Promise<ReceiptData | null> => {
    try {
        const imageUri = await pickImage(source);
        if (!imageUri) {
            return null;
        }

        // Analyze the captured receipt
        return await analyzeReceipt(imageUri);
    } catch (error) {
        console.error(`Error ${source === 'camera' ? 'capturing' : 'selecting'} and analyzing receipt:`, error);
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