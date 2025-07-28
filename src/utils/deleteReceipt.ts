import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { storage, db } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getBlob } from 'firebase/storage';

interface ReceiptImage {
  url: string;
  size: number;
  uploadedAt: Date;
}

export const deleteReceiptAndImage = async (receiptId: string) => {
  try {
    // Get the receipt document first
    const receiptRef = doc(db, 'receipts', receiptId);
    const receiptSnap = await getDoc(receiptRef);
    
    if (!receiptSnap.exists()) {
      throw new Error('Receipt not found');
    }

    const receiptData = receiptSnap.data();
    const images = receiptData.images || [];

    // Move each image to the deleted folder
    const updatedImages = await Promise.all(images.map(async (img: ReceiptImage) => {
      try {
        // Get the original image path from the URL
        const decodedUrl = decodeURIComponent(img.url);
        const originalPath = decodedUrl.split('/o/')[1].split('?')[0];
        
        // Create new path in deleted folder
        const newPath = `deleted/${originalPath}`;
        
        // Get the image data
        const originalRef = ref(storage, originalPath);
        const blob = await getBlob(originalRef);
        
        // Upload to new location
        const newRef = ref(storage, newPath);
        await uploadBytes(newRef, blob);
        
        // Get new URL
        const newUrl = await getDownloadURL(newRef);
        
        return {
          ...img,
          url: newUrl
        };
      } catch (error) {
        console.error('Error moving image to deleted folder:', error);
        return img; // Keep original if move fails
      }
    }));

    // Update receipt with deleted status and new image URLs
    await updateDoc(receiptRef, {
      status: 'deleted',
      updatedAt: new Date(),
      images: updatedImages
    });
    
    return true;
  } catch (error) {
    console.error('Error marking receipt as deleted:', error);
    throw error;
  }
};
