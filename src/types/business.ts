export interface BusinessData {
  id?: string;
  userId: string;
  name: string;
  type: 'LLC' | 'Corporation' | 'Sole Proprietorship' | 'Partnership' | 'Other';
  taxId?: string;
  industry?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  settings: {
    defaultCurrency: string;
    taxYear: number;
    categories: string[];
  };
  stats: {
    totalReceipts: number;
    totalAmount: number;
    lastReceiptDate: Date | null;
  };
  isActive: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface CreateBusinessRequest {
  name: string;
  type: 'LLC' | 'Corporation' | 'Sole Proprietorship' | 'Partnership' | 'Other';
  taxId?: string;
  industry?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  settings?: {
    defaultCurrency?: string;
    taxYear?: number;
    categories?: string[];
  };
}