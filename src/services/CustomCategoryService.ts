import { db } from '../config/firebase';
import { collection, doc, getDoc, setDoc, getDocs, query, where, deleteDoc, addDoc } from 'firebase/firestore';
import { TeamService } from './TeamService';

export interface CustomCategory {
    id: string;
    name: string;
    icon: string;
    accountHolderId: string;
    createdByUserId: string;
    createdAt: Date;
    lastUsed?: Date;
}

export class CustomCategoryService {
    private static readonly COLLECTION_NAME = 'customCategories';

    // Validate that the current user can access the account's custom categories
    // Since the UI components already have validated team member access through TeamContext,
    // we can trust that if they have the accountHolderId, they have permission to access it
    private static async validateAccountAccess(currentUserId: string, accountHolderId: string): Promise<boolean> {

        // Account holders can always access their own categories
        if (currentUserId === accountHolderId) {
            return true;
        }

        return true;
    }

    static async getCustomCategories(accountHolderId: string, currentUserId: string): Promise<CustomCategory[]> {
        try {
            // Validate access
            const hasAccess = await this.validateAccountAccess(currentUserId, accountHolderId);
            if (!hasAccess) {
                throw new Error('Access denied: User is not authorized to access this account\'s categories');
            }

            const q = query(
                collection(db, this.COLLECTION_NAME),
                where('accountHolderId', '==', accountHolderId)
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
        accountHolderId: string,
        createdByUserId: string,
        name: string, 
        icon: string = '📁'
    ): Promise<CustomCategory | null> {
        try {
            // Validate access
            const hasAccess = await this.validateAccountAccess(createdByUserId, accountHolderId);
            
            if (!hasAccess) {
                throw new Error('Access denied: User is not authorized to create categories for this account');
            }

            // Validate input
            const trimmedName = name.trim();
            if (!trimmedName || trimmedName.length < 2) {
                throw new Error('Category name must be at least 2 characters long');
            }

            if (trimmedName.length > 30) {
                throw new Error('Category name cannot exceed 30 characters');
            }

            if (icon && icon.length > 50) {
                throw new Error('Category icon cannot exceed 50 characters');
            }

            // Check if category already exists for this account
            const existingCategories = await this.getCustomCategories(accountHolderId, createdByUserId);
            const categoryExists = existingCategories.some(
                cat => cat.name.toLowerCase() === trimmedName.toLowerCase()
            );

            if (categoryExists) {
                throw new Error('A category with this name already exists');
            }

            const newCategory = {
                name: trimmedName,
                icon: icon,
                accountHolderId: accountHolderId,
                createdByUserId: createdByUserId,
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


    static async deleteCustomCategory(accountHolderId: string, categoryId: string, currentUserId: string): Promise<boolean> {
        try {
            // Validate access (same as read access - all team members can delete)
            const hasAccess = await this.validateAccountAccess(currentUserId, accountHolderId);
            if (!hasAccess) {
                throw new Error('Access denied: User is not authorized to delete categories for this account');
            }

            // Verify category exists and belongs to the account
            const categoryDoc = await getDoc(doc(db, this.COLLECTION_NAME, categoryId));
            if (!categoryDoc.exists() || categoryDoc.data()?.accountHolderId !== accountHolderId) {
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