import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { formatCurrency } from '../utils/formatCurrency';
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

export class ReportExportService {
  private static instance: ReportExportService;

  private constructor() {}

  public static getInstance(): ReportExportService {
    if (!ReportExportService.instance) {
      ReportExportService.instance = new ReportExportService();
    }
    return ReportExportService.instance;
  }

  public async generatePDF(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): Promise<void> {
    try {
      console.log('Generating PDF report...');
      const htmlContent = this.generatePDFHTML(receipts, options, customCategories, getBusinessById);
      const fileName = `ReceiptGold-Report-${format(new Date(), "yyyy-MM-dd")}.pdf`;

      console.log('Generated HTML content length:', htmlContent.length);

      // Create PDF from HTML
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
        margins: {
          left: 50,
          right: 50,
          top: 50,
          bottom: 50,
        },
      });

      console.log('PDF generated successfully:', uri);

      // Create permanent file path
      const permanentPath = `${FileSystem.documentDirectory}${fileName}`;

      // Copy to permanent location
      await FileSystem.copyAsync({
        from: uri,
        to: permanentPath
      });

      // Clean up temporary file
      await FileSystem.deleteAsync(uri, { idempotent: true });

      console.log('PDF saved to:', permanentPath);
      await Sharing.shareAsync(permanentPath);
    } catch (error) {
      console.error('PDF generation failed:', error);
      throw new Error('PDF generation failed. Please try again.');
    }
  }

  private generatePDFHTML(
    receipts: Receipt[],
    options: ExportOptions,
    customCategories: CustomCategory[],
    getBusinessById: (id: string) => { name: string } | undefined
  ): string {
    const totalAmount = receipts.reduce((sum, receipt) => sum + receipt.amount, 0);
    const categoryTotals = receipts.reduce((acc, receipt) => {
      // Use original category for display purposes, normalize for grouping logic only
      const originalCategory = receipt.category || 'Uncategorized';
      acc[originalCategory] = (acc[originalCategory] || 0) + receipt.amount;
      return acc;
    }, {} as Record<string, number>);

    const currentDate = format(new Date(), 'MMMM d, yyyy');
    const startDate = format(options.dateRange.start, 'MMMM d, yyyy');
    const endDate = format(options.dateRange.end, 'MMMM d, yyyy');

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>ReceiptGold Financial Report</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background: #fff;
        }
        .header {
          text-align: center;
          border-bottom: 3px solid #FFD700;
          padding-bottom: 20px;
          margin-bottom: 30px;
        }
        .logo {
          color: #FFD700;
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        .report-title {
          font-size: 24px;
          color: #333;
          margin: 10px 0;
        }
        .date-range {
          color: #666;
          font-size: 16px;
        }
        .summary-section {
          background: #f8f9fa;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }
        .summary-title {
          font-size: 20px;
          color: #333;
          margin-bottom: 15px;
          border-bottom: 2px solid #FFD700;
          padding-bottom: 5px;
        }
        .summary-stats {
          display: flex;
          justify-content: space-around;
          text-align: center;
        }
        .stat-item {
          flex: 1;
        }
        .stat-value {
          font-size: 24px;
          font-weight: bold;
          color: #FFD700;
          margin: 5px 0;
        }
        .stat-label {
          color: #666;
          font-size: 14px;
        }
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .table th, .table td {
          border: 1px solid #ddd;
          padding: 12px;
          text-align: left;
        }
        .table th {
          background: #FFD700;
          color: #333;
          font-weight: bold;
        }
        .table tr:nth-child(even) {
          background: #f9f9f9;
        }
        .amount {
          text-align: right;
          font-weight: bold;
        }
        .category-section {
          margin: 30px 0;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        .receipt-images {
          margin: 30px 0;
        }
        .receipt-image-section {
          margin: 20px 0;
          padding: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          background: #f9f9f9;
        }
        .receipt-image-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #333;
        }
        .receipt-image {
          max-width: 100%;
          height: auto;
          border: 1px solid #ccc;
          border-radius: 4px;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">ReceiptGold</div>
        <div class="report-title">Financial Report</div>
        <div class="date-range">${startDate} - ${endDate}</div>
        <div class="date-range">Generated on ${currentDate}</div>
      </div>

      <div class="summary-section">
        <div class="summary-title">Summary</div>
        <div class="summary-stats">
          <div class="stat-item">
            <div class="stat-value">${receipts.length}</div>
            <div class="stat-label">Receipts</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatCurrency(totalAmount)}</div>
            <div class="stat-label">Total Amount</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${formatCurrency(totalAmount / Math.max(receipts.length, 1))}</div>
            <div class="stat-label">Average</div>
          </div>
        </div>
      </div>

      <div class="category-section">
        <h3>Category Breakdown</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Amount</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            ${Object.entries(categoryTotals)
              .sort(([, a], [, b]) => b - a)
              .map(([category, amount]) => {
                const percentage = ((amount / totalAmount) * 100).toFixed(1);
                const displayName = ReceiptCategoryService.getCategoryDisplayName(category as any, customCategories);
                return `
                  <tr>
                    <td>${displayName}</td>
                    <td class="amount">${formatCurrency(amount)}</td>
                    <td class="amount">${percentage}%</td>
                  </tr>
                `;
              }).join('')}
          </tbody>
        </table>
      </div>

      ${options.groupBy === 'none' ? `
      <div>
        <h3>Detailed Transactions</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Business</th>
              <th>Description</th>
              ${options.taxDeductibleOnly ? '<th>Tax Deductible</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${receipts.map(receipt => {
              const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
              const businessName = receipt.businessId
                ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
                : "Personal";
              return `
                <tr>
                  <td>${receiptDate ? format(receiptDate, "MM/dd/yyyy") : "Unknown"}</td>
                  <td class="amount">${formatCurrency(receipt.amount)}</td>
                  <td>${ReceiptCategoryService.getCategoryDisplayName(receipt.category as any, customCategories)}</td>
                  <td>${businessName}</td>
                  <td>${receipt.description || "-"}</td>
                  ${options.taxDeductibleOnly ? `<td>${receipt.tax?.deductible ? "Yes" : "No"}</td>` : ''}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${options.includeImages ? `
      <div class="receipt-images">
        <h3>Receipt Images</h3>
        ${receipts
          .filter(receipt => receipt.images && receipt.images.length > 0)
          .map(receipt => {
            const receiptDate = receipt.createdAt?.toDate() || receipt.date?.toDate();
            const businessName = receipt.businessId
              ? getBusinessById(receipt.businessId)?.name || "Unknown Business"
              : "Personal";
            return `
              <div class="receipt-image-section">
                <div class="receipt-image-title">
                  ${businessName} - ${formatCurrency(receipt.amount)}
                  ${receiptDate ? ` - ${format(receiptDate, "MM/dd/yyyy")}` : ''}
                  ${receipt.description ? ` - ${receipt.description}` : ''}
                </div>
                ${receipt.images?.map(image => `
                  <img src="${image.url}" alt="Receipt Image" class="receipt-image" />
                `).join('')}
              </div>
            `;
          }).join('')}
      </div>
      ` : ''}

      <div class="footer">
        <p>This report was generated by ReceiptGold on ${currentDate}</p>
        <p>For questions about this report, please contact support</p>
      </div>
    </body>
    </html>
    `;
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