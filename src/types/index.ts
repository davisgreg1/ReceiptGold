export interface SubscriptionTier {
  name: string;
  limits: {
    maxReceipts: number;
    maxBusinesses: number;
    apiCallsPerMonth: number;
    maxReports?: number;
  };
  features: {
    advancedReporting: boolean;
    taxPreparation: boolean;
    accountingIntegrations: boolean;
    prioritySupport: boolean;
    multiBusinessManagement: boolean;
    whiteLabel: boolean;
    apiAccess: boolean;
    dedicatedManager: boolean;
  };
}

export interface SubscriptionDocument {
  userId: string;
  currentTier: 'free' | 'starter' | 'growth' | 'professional';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  billing: {
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    currentPeriodStart: any;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
    lastPaymentStatus?: string;
    lastPaymentDate?: Date;
    lastInvoiceId?: string;
  };
  limits: SubscriptionTier['limits'];
  features: SubscriptionTier['features'];
  history: Array<{
    tier: string;
    startDate: Date;
    endDate: Date | null;
    reason: string;
  }>;
  createdAt: any;
  updatedAt: any;
}

export interface ReceiptData {
  id?: string;
  userId: string;
  businessId?: string;
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  images: Array<{
    url: string;
    thumbnail?: string;
    size: number;
    uploadedAt: Date;
  }>;
  extractedData?: {
    vendor?: string;
    amount?: number;
    tax?: number;
    date?: string;
    confidence?: number;
    items?: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
  };
  tax: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
  };
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';
  processingErrors: string[];
  createdAt: any;
  updatedAt: any;
}

export interface UsageDocument {
  userId: string;
  month: string;
  receiptsUploaded: number;
  apiCalls: number;
  reportsGenerated: number;
  limits: SubscriptionTier['limits'];
  resetDate: string;
  createdAt: any;
  updatedAt: any;
}

export interface ReportData {
  id?: string;
  userId: string;
  businessId?: string;
  type: 'tax_summary' | 'expense_report' | 'category_breakdown';
  title: string;
  period: {
    startDate: string;
    endDate: string;
  };
  data: {
    totalExpenses: number;
    deductibleExpenses: number;
    categories: Record<string, number>;
    receiptCount: number;
  };
  status: 'completed' | 'processing' | 'error';
  createdAt: any;
  updatedAt: any;
}
