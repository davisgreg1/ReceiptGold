import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/formatCurrency';
import { ReceiptCategoryService } from './ReceiptCategoryService';
import { CustomCategory } from './CustomCategoryService';
import { ExportOptions } from '../components/ExportSelector';

interface Receipt {
  amount: number;
  category: string;
  date?: any;
  createdAt: any;
  businessId?: string;
  description?: string;
  id?: string;
  status?: string;
  tax?: {
    deductible: boolean;
  };
}

export class ExcelExportService {
  private static instance: ExcelExportService;

  private constructor() {}

  public static getInstance(): ExcelExportService {
    if (!ExcelExportService.instance) {
      ExcelExportService.instance = new ExcelExportService();
    }
    return ExcelExportService.instance;
  }

  public async generateExcel(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): Promise<void> {
    try {
      console.log('Generating Excel-compatible CSV for', receipts.length, 'receipts');

      const content = this.generateExcelCompatibleCSV(receipts, options, customCategories, getBusinessById);
      const fileName = `ReceiptGold-Report-${format(new Date(), "yyyy-MM-dd")}.csv`;

      console.log('Generated Excel-compatible content length:', content.length);
      console.log('Content preview:', content.substring(0, 200));

      const filePath = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, content, {
        encoding: FileSystem.EncodingType.UTF8
      });

      await Sharing.shareAsync(filePath, {
        mimeType: 'text/csv',
        dialogTitle: 'Export ReceiptGold Report - Open with Excel or Spreadsheet app'
      });
    } catch (error) {
      console.error('Excel export failed:', error);
      throw new Error('Excel export failed. Please try again.');
    }
  }

  private generateExcelCompatibleCSV(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): string {
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const categoryTotals = receipts.reduce((acc, receipt) => {
      const normalizedCategory = this.normalizeCategory(receipt.category, customCategories);
      acc[normalizedCategory] = (acc[normalizedCategory] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    // Excel-specific CSV formatting with UTF-8 BOM for proper Excel compatibility
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel compatibility

    // Title and metadata
    csvContent += `ReceiptGold Financial Report\n`;
    csvContent += `Generated on,${format(new Date(), 'MMMM d, yyyy')}\n`;
    csvContent += `Date Range,"${format(options.dateRange.start, 'MMMM d, yyyy')} - ${format(options.dateRange.end, 'MMMM d, yyyy')}"\n`;
    csvContent += `\n`; // Empty line

    // Summary section
    csvContent += `SUMMARY\n`;
    csvContent += `Total Receipts,${receipts.length}\n`;
    csvContent += `Total Amount,"${formatCurrency(totalAmount)}"\n`;
    csvContent += `Average Amount,"${formatCurrency(totalAmount / Math.max(receipts.length, 1))}"\n`;
    csvContent += `\n`; // Empty line

    // Category breakdown
    csvContent += `CATEGORY BREAKDOWN\n`;
    csvContent += `Category,Amount,Percentage\n`;
    Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .forEach(([category, amount]) => {
        const percentage = ((amount / totalAmount) * 100).toFixed(1);
        const displayName = ReceiptCategoryService.getCategoryDisplayName(category as any, customCategories);
        csvContent += `"${displayName}","${formatCurrency(amount)}",${percentage}%\n`;
      });
    csvContent += `\n`; // Empty line

    // Detailed transactions
    csvContent += `DETAILED TRANSACTIONS\n`;
    const headers = ["Date", "Amount", "Category", "Business", "Description"];
    if (options.taxDeductibleOnly) {
      headers.push("Tax Deductible");
    }
    csvContent += headers.map(h => `"${h}"`).join(",") + "\n";

    const rows = receipts.map(receipt => {
      const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
      const businessName = receipt.businessId
        ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
        : "Personal";

      const row = [
        receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
        formatCurrency(receipt.amount),
        ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories),
        businessName,
        (receipt.description || "").replace(/"/g, '""'), // Escape quotes for CSV
      ];

      if (options.taxDeductibleOnly) {
        row.push(receipt.tax?.deductible ? "Yes" : "No");
      }

      return row.map(field => `"${field}"`).join(",");
    });

    csvContent += rows.join("\n");

    // Group by option
    if (options.groupBy === 'business' || options.groupBy === 'category') {
      csvContent += `\n\n`; // Extra spacing
      csvContent += `GROUPED VIEW - ${options.groupBy.toUpperCase()}\n`;

      if (options.groupBy === 'business') {
        csvContent += this.generateBusinessGrouping(receipts, options, customCategories, getBusinessById, headers);
      } else if (options.groupBy === 'category') {
        csvContent += this.generateCategoryGrouping(receipts, options, customCategories, getBusinessById, headers);
      }
    }

    console.log('Generated Excel-compatible CSV, length:', csvContent.length);
    return csvContent;
  }

  private generateBusinessGrouping(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined,
    headers: string[]
  ): string {
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
      groupedContent += `\n"${businessName}"\n`;
      groupedContent += headers.map(h => `"${h}"`).join(",") + "\n";
      businessReceipts.forEach(receipt => {
        const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
        const row = [
          receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
          formatCurrency(receipt.amount),
          ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories),
          businessName,
          (receipt.description || "").replace(/"/g, '""'),
        ];
        if (options.taxDeductibleOnly) {
          row.push(receipt.tax?.deductible ? "Yes" : "No");
        }
        groupedContent += row.map(field => `"${field}"`).join(",") + "\n";
      });
    });
    return groupedContent;
  }

  private generateCategoryGrouping(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined,
    headers: string[]
  ): string {
    const grouped = receipts.reduce((acc, receipt) => {
      const category = ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories);
      if (!acc[category]) acc[category] = [];
      acc[category].push(receipt);
      return acc;
    }, {} as Record<string, Receipt[]>);

    let groupedContent = '';
    Object.entries(grouped).forEach(([category, categoryReceipts]) => {
      groupedContent += `\n"${category}"\n`;
      groupedContent += headers.map(h => `"${h}"`).join(",") + "\n";
      categoryReceipts.forEach(receipt => {
        const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
        const businessName = receipt.businessId
          ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
          : "Personal";
        const row = [
          receiptDate ? format(receiptDate, "yyyy-MM-dd") : "Unknown",
          formatCurrency(receipt.amount),
          category,
          businessName,
          (receipt.description || "").replace(/"/g, '""'),
        ];
        if (options.taxDeductibleOnly) {
          row.push(receipt.tax?.deductible ? "Yes" : "No");
        }
        groupedContent += row.map(field => `"${field}"`).join(",") + "\n";
      });
    });
    return groupedContent;
  }

  private normalizeCategory(category: string | undefined, customCategories: CustomCategory[]): string {
    if (!category) return 'Uncategorized';

    // Clean and normalize the category string
    const cleaned = category.toLowerCase().trim().replace(/[^\w\s]/g, '');

    // Check for "Other" variants and bank transaction categories
    if (cleaned === 'other' || cleaned === 'others' ||
        cleaned === 'miscellaneous' || cleaned === 'misc' ||
        cleaned === 'general' || cleaned === 'uncategorized' ||
        cleaned.includes('other') ||
        cleaned.includes('generated from bank transaction') ||
        cleaned.includes('bank transaction')) {
      return 'other';
    }

    // Check if it's a custom category - preserve custom categories as-is
    const isCustomCategory = customCategories.some(cat =>
      cat.name.toLowerCase().trim() === category.toLowerCase().trim()
    );

    if (isCustomCategory) {
      return category.trim(); // Return the custom category name as-is
    }

    // Group categories that don't have specific display names and fall back to "Other"
    const knownCategories = [
      'groceries', 'restaurant', 'entertainment', 'shopping', 'travel',
      'transportation', 'utilities', 'healthcare', 'professional_services', 'office_supplies', 'equipment_software', 'other'
    ];

    if (!knownCategories.includes(cleaned)) {
      // If the category isn't in our known list AND it's not a custom category, group it as "other"
      return 'other';
    }

    return category.trim(); // Return original case but trimmed
  }
}