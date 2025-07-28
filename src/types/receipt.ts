export interface Receipt {
  receiptId: string;
  userId: string;
  vendor: string;
  amount: number;
  date: Date;
  description: string;
  category: string;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  status: string;
  images: Array<{
    url: string;
    size: number;
    uploadedAt: Date;
  }>;
  extractedData?: {
    amount: number;
    confidence: number;
    date: string;
    items: Array<ReceiptItem>;
  };
  tax: {
    category: string;
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
  };
  tags: string[];
  processingErrors?: string[];
}

export interface ReceiptItem {
  description: string;
  quantity: number;
  price: number;
  amount: number;
  tax: number;
  vendor?: string;
}
