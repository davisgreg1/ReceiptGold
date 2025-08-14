import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { ReceiptData } from './ReceiptOCRService';

// Define receipt categories
export type ReceiptCategory =
    | 'groceries'
    | 'restaurant'
    | 'entertainment'
    | 'shopping'
    | 'travel'
    | 'transportation'
    | 'utilities'
    | 'healthcare'
    | 'other';

interface MerchantCategory {
    merchantName: string;
    category: ReceiptCategory;
    confidence: number;
    lastUpdated: Date;
}

const MERCHANT_CATEGORIES_COLLECTION = 'merchantCategories';

// Keywords that suggest specific categories
const categoryKeywords: Record<ReceiptCategory, string[]> = {
    groceries: ['grocery', 'supermarket', 'food', 'market', 'produce', 'fruits', 'vegetables'],
    restaurant: ['restaurant', 'cafe', 'diner', 'bistro', 'bar', 'grill', 'kitchen'],
    entertainment: ['cinema', 'theater', 'movie', 'concert', 'show', 'event', 'ticket'],
    shopping: ['mall', 'store', 'retail', 'shop', 'boutique', 'clothing'],
    travel: ['hotel', 'motel', 'airline', 'flight', 'booking', 'reservation'],
    transportation: ['gas', 'fuel', 'parking', 'taxi', 'uber', 'lyft', 'transit'],
    utilities: ['electric', 'water', 'gas', 'internet', 'phone', 'utility'],
    healthcare: ['pharmacy', 'drug', 'medical', 'health', 'clinic', 'doctor'],
    other: []
};

export class ReceiptCategoryService {
    private static async getMerchantCategory(merchantName: string): Promise<MerchantCategory | null> {
        try {
            const docRef = doc(db, MERCHANT_CATEGORIES_COLLECTION, merchantName.toLowerCase());
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data() as MerchantCategory;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting merchant category:', error);
            return null;
        }
    }

    private static async saveMerchantCategory(merchantName: string, category: ReceiptCategory, confidence: number) {
        try {
            const docRef = doc(db, MERCHANT_CATEGORIES_COLLECTION, merchantName.toLowerCase());
            await setDoc(docRef, {
                merchantName: merchantName.toLowerCase(),
                category,
                confidence,
                lastUpdated: new Date()
            });
        } catch (error) {
            console.error('Error saving merchant category:', error);
        }
    }

    private static getCategoryFromKeywords(text: string): { category: ReceiptCategory; confidence: number } {
        text = text.toLowerCase();
        let maxMatches = 0;
        let bestCategory: ReceiptCategory = 'other';
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase())).length;
            if (matches > maxMatches) {
                maxMatches = matches;
                bestCategory = category as ReceiptCategory;
            }
        }
        
        // Calculate confidence based on number of keyword matches
        const confidence = maxMatches > 0 ? Math.min(maxMatches * 0.2, 0.8) : 0.3;
        
        return { category: bestCategory, confidence };
    }

    private static getCategoryFromItems(items: Array<{ description: string; }>): { category: ReceiptCategory; confidence: number } {
        let allItemText = items.map(item => item.description).join(' ').toLowerCase();
        return this.getCategoryFromKeywords(allItemText);
    }

    static async determineCategory(receipt: ReceiptData): Promise<{ category: ReceiptCategory; confidence: number }> {
        // Try to get category from merchant mapping first
        if (receipt.merchantName) {
            const merchantCategory = await this.getMerchantCategory(receipt.merchantName);
            if (merchantCategory && merchantCategory.confidence > 0.7) {
                return {
                    category: merchantCategory.category,
                    confidence: merchantCategory.confidence
                };
            }
        }

        // Analyze merchant name if available
        let merchantNameCategory = receipt.merchantName 
            ? this.getCategoryFromKeywords(receipt.merchantName)
            : { category: 'other' as ReceiptCategory, confidence: 0 };

        // Analyze items if available
        let itemsCategory = receipt.items 
            ? this.getCategoryFromItems(receipt.items)
            : { category: 'other' as ReceiptCategory, confidence: 0 };

        // Combine results
        if (merchantNameCategory.confidence >= itemsCategory.confidence) {
            // Save the merchant category for future use if confidence is high enough
            if (receipt.merchantName && merchantNameCategory.confidence > 0.5) {
                await this.saveMerchantCategory(
                    receipt.merchantName,
                    merchantNameCategory.category,
                    merchantNameCategory.confidence
                );
            }
            return merchantNameCategory;
        }

        return itemsCategory;
    }

    static async updateMerchantCategory(merchantName: string, category: ReceiptCategory, confidence: number = 1.0) {
        await this.saveMerchantCategory(merchantName, category, confidence);
    }

    static async getAvailableCategories(): Promise<ReceiptCategory[]> {
        return [
            'groceries',
            'restaurant', 
            'entertainment',
            'shopping',
            'travel',
            'transportation',
            'utilities',
            'healthcare',
            'other'
        ];
    }

    static getCategoryDisplayName(category: ReceiptCategory): string {
        const displayNames: Record<ReceiptCategory, string> = {
            groceries: 'Groceries',
            restaurant: 'Restaurant & Dining',
            entertainment: 'Entertainment',
            shopping: 'Shopping',
            travel: 'Travel',
            transportation: 'Transportation',
            utilities: 'Utilities',
            healthcare: 'Healthcare',
            other: 'Other'
        };
        return displayNames[category] || 'Other';
    }
}
