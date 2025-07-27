import { storage } from '../config/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

// Simple base64 encoded test image (1x1 pixel transparent PNG)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

export const testStorageConnection = async () => {
    try {
        // Create a response from the base64 image
        const response = await fetch(`data:image/png;base64,${TEST_IMAGE_BASE64}`);
        const blob = await response.blob();

        // Create a reference to the test file location
        const timestamp = Date.now();
        const testRef = ref(storage, `test/storage-test-${timestamp}.png`);
        
        // Upload using the same method as handleCapture
        const metadata = {
            contentType: 'image/png',
            cacheControl: 'public,max-age=31536000',
            customMetadata: {
                testUpload: 'true',
                uploadedAt: new Date().toISOString()
            }
        };

        // Upload the blob
        await uploadBytesResumable(testRef, blob, metadata);
        console.log('✅ Test file uploaded successfully');
        
        // Try to get the download URL
        const downloadURL = await getDownloadURL(testRef);
        console.log('✅ Download URL obtained:', downloadURL);
        
        return { success: true, downloadURL };
    } catch (error: any) {
        console.error('❌ Storage test failed:', error);
        return { 
            success: false, 
            error: {
                code: error.code,
                message: error.message
            }
        };
    }
};
