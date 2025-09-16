import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { ReceiptCategoryService } from './ReceiptCategoryService';
import { CustomCategory } from './CustomCategoryService';
import { ExportOptions } from '../components/ExportSelector';

interface ReceiptImage {
  url: string;
  thumbnail?: string;
  size: number;
  uploadedAt: any;
}

interface Receipt {
  amount: number;
  category: string;
  date?: any;
  createdAt: any;
  businessId?: string;
  description?: string;
  id?: string;
  status?: string;
  images?: ReceiptImage[];
  tax?: {
    deductible: boolean;
  };
}

export class CSVExportService {
  private static instance: CSVExportService;

  private constructor() {}

  public static getInstance(): CSVExportService {
    if (!CSVExportService.instance) {
      CSVExportService.instance = new CSVExportService();
    }
    return CSVExportService.instance;
  }

  public async generateCSV(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): Promise<void> {
    try {
      console.log('Generating CSV for', receipts.length, 'receipts');

      const content = this.generateCSVContent(receipts, options, customCategories, getBusinessById);
      const fileName = `ReceiptGold-Report-${format(new Date(), "yyyy-MM-dd")}.csv`;

      console.log('Generated content length:', content.length);
      console.log('Content preview:', content.substring(0, 200));

      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, content);
      await Sharing.shareAsync(filePath);
    } catch (error) {
      console.error('CSV export failed:', error);
      throw new Error('CSV export failed. Please try again.');
    }
  }

  private generateCSVContent(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): string {
    const headers = ["Date", "Amount", "Category", "Business", "Description"];
    if (options.taxDeductibleOnly) {
      headers.push("Tax Deductible");
    }

    console.log('CSV Headers:', headers);

    const rows = receipts.map((receipt, index) => {
      const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
      const businessName = receipt.businessId
        ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
        : "Personal";

      const row = [
        receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
        receipt.amount.toString(),
        ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories),
        businessName,
        (receipt.description || "").replace(/,/g, ";"),
      ];

      if (options.taxDeductibleOnly) {
        row.push(receipt.tax?.deductible ? "Yes" : "No");
      }

      if (index < 3) {
        console.log(`CSV Row ${index}:`, row);
      }

      return row.join(",");
    });

    console.log('Generated', rows.length, 'CSV rows');

    // Group by option
    if (options.groupBy === 'business') {
      return this.generateGroupedCSV(receipts, options, customCategories, getBusinessById, 'business');
    } else if (options.groupBy === 'category') {
      return this.generateGroupedCSV(receipts, options, customCategories, getBusinessById, 'category');
    }

    const finalContent = [headers.join(","), ...rows].join("\n");
    console.log('Final CSV content length:', finalContent.length);
    console.log('Final CSV preview:', finalContent.substring(0, 150));
    return finalContent;
  }

  private generateGroupedCSV(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined,
    groupType: 'business' | 'category'
  ): string {
    const headers = ["Date", "Amount", "Category", "Business", "Description"];
    if (options.taxDeductibleOnly) {
      headers.push("Tax Deductible");
    }

    if (groupType === 'business') {
      const grouped = receipts.reduce((acc, receipt) => {
        const businessName = receipt.businessId
          ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
          : "Personal";
        if (!acc[businessName]) acc[businessName] = [];
        acc[businessName].push(receipt);
        return acc;
      }, {} as Record<string, Receipt[]>);

      let groupedContent = '';
      Object.entries(grouped).forEach(([businessName, businessReceipts]) => {
        groupedContent += `\n\n=== ${businessName} ===\n`;
        groupedContent += headers.join(",") + "\n";
        businessReceipts.forEach(receipt => {
          const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
          const row = [
            receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
            receipt.amount.toString(),
            ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories),
            businessName,
            (receipt.description || "").replace(/,/g, ";"),
          ];
          if (options.taxDeductibleOnly) {
            row.push(receipt.tax?.deductible ? "Yes" : "No");
          }
          groupedContent += row.join(",") + "\n";
        });
      });
      return groupedContent;
    } else {
      const grouped = receipts.reduce((acc, receipt) => {
        const category = ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories);
        if (!acc[category]) acc[category] = [];
        acc[category].push(receipt);
        return acc;
      }, {} as Record<string, Receipt[]>);

      let groupedContent = '';
      Object.entries(grouped).forEach(([category, categoryReceipts]) => {
        groupedContent += `\n\n=== ${category} ===\n`;
        groupedContent += headers.join(",") + "\n";
        categoryReceipts.forEach(receipt => {
          const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
          const businessName = receipt.businessId
            ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
            : "Personal";
          const row = [
            receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
            receipt.amount.toString(),
            ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories),
            businessName,
            (receipt.description || "").replace(/,/g, ";"),
          ];
          if (options.taxDeductibleOnly) {
            row.push(receipt.tax?.deductible ? "Yes" : "No");
          }
          groupedContent += row.join(",") + "\n";
        });
      });
      return groupedContent;
    }
  }
}