import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';

export interface CustomCategory {
    id: string;
    name: string;
    icon: string;
    userId: string;
    createdAt: Date;
    lastUsed?: Date;
}

export class CustomCategoryService {
    private static readonly COLLECTION_NAME = 'customCategories';

    static async getCustomCategories(userId: string): Promise<CustomCategory[]> {
        try {
            const q = query(
                collection(db, this.COLLECTION_NAME),
                where('userId', '==', userId)
            );
            const snapshot = await getDocs(q);
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt.toDate(),
                lastUsed: doc.data().lastUsed?.toDate()
            })) as CustomCategory[];
        } catch (error) {
            console.error('Error fetching custom categories:', error);
            return [];
        }
    }

    static async createCustomCategory(
        userId: string, 
        name: string, 
        icon: string = '📁'
    ): Promise<CustomCategory | null> {
        try {
            // Validate input
            const trimmedName = name.trim();
            if (!trimmedName || trimmedName.length < 2) {
                throw new Error('Category name must be at least 2 characters long');
            }

            if (trimmedName.length > 30) {
                throw new Error('Category name cannot exceed 30 characters');
            }

            // Check if category already exists for this user
            const existingCategories = await this.getCustomCategories(userId);
            const categoryExists = existingCategories.some(
                cat => cat.name.toLowerCase() === trimmedName.toLowerCase()
            );

            if (categoryExists) {
                throw new Error('A category with this name already exists');
            }

            const newCategory = {
                name: trimmedName,
                icon: icon,
                userId: userId,
                createdAt: new Date(),
            };

            const docRef = await addDoc(collection(db, this.COLLECTION_NAME), newCategory);
            
            return {
                id: docRef.id,
                ...newCategory
            };
        } catch (error) {
            console.error('Error creating custom category:', error);
            return null;
        }
    }

    static async deleteCustomCategory(userId: string, categoryId: string): Promise<boolean> {
        try {
            // Verify ownership
            const categoryDoc = await getDoc(doc(db, this.COLLECTION_NAME, categoryId));
            if (!categoryDoc.exists() || categoryDoc.data()?.userId !== userId) {
                throw new Error('Category not found or access denied');
            }

            await deleteDoc(doc(db, this.COLLECTION_NAME, categoryId));
            return true;
        } catch (error) {
            console.error('Error deleting custom category:', error);
            return false;
        }
    }

    static async updateLastUsed(categoryId: string): Promise<void> {
        try {
            await setDoc(
                doc(db, this.COLLECTION_NAME, categoryId),
                { lastUsed: new Date() },
                { merge: true }
            );
        } catch (error) {
            console.error('Error updating category last used:', error);
        }
    }

    static validateCategoryName(name: string): { isValid: boolean; error?: string } {
        const trimmedName = name.trim();
        
        if (!trimmedName) {
            return { isValid: false, error: 'Category name is required' };
        }
        
        if (trimmedName.length < 2) {
            return { isValid: false, error: 'Category name must be at least 2 characters' };
        }
        
        if (trimmedName.length > 30) {
            return { isValid: false, error: 'Category name cannot exceed 30 characters' };
        }
        
        // Check for invalid characters
        const invalidChars = /[<>:"/\\|?*]/;
        if (invalidChars.test(trimmedName)) {
            return { isValid: false, error: 'Category name contains invalid characters' };
        }
        
        return { isValid: true };
    }

    static getDefaultIcons(): string[] {
        return ['📁', '💼', '🏠', '🚗', '🎓', '💊', '🛒', '🎵', '📱', '⚽', '🎨', '🔧', '📚', '💰', '🍔'];
    }
}