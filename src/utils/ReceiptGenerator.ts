import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { PlaidTransaction } from '../services/PlaidService';
import { ReceiptTemplateService } from '../services/ReceiptTemplateService';
import { FirebaseReceiptIntegration, GeneratedReceiptData } from '../services/FirebaseReceiptIntegration';

export interface ReceiptGenerationOptions {
  format: 'html' | 'pdf';
  save?: boolean;
  share?: boolean;
  saveToFirestore?: boolean;
  userId?: string;
  userInfo?: {
    name?: string;
    email?: string;
  };
}

export interface ReceiptGenerationResult {
  success: boolean;
  filePath?: string;
  firestoreReceiptId?: string;
  error?: string;
  receiptNumber?: string;
}

export class ReceiptGenerator {
  private static instance: ReceiptGenerator;
  private templateService: ReceiptTemplateService;
  private firebaseIntegration: FirebaseReceiptIntegration;

  private constructor() {
    this.templateService = ReceiptTemplateService.getInstance();
    this.firebaseIntegration = FirebaseReceiptIntegration.getInstance();
  }

  public static getInstance(): ReceiptGenerator {
    if (!ReceiptGenerator.instance) {
      ReceiptGenerator.instance = new ReceiptGenerator();
    }
    return ReceiptGenerator.instance;
  }

  /**
   * Generate receipt from Plaid transaction
   */
  public async generateFromTransaction(
    transaction: PlaidTransaction,
    options: ReceiptGenerationOptions = { format: 'pdf' }
  ): Promise<ReceiptGenerationResult> {
    try {
      console.log('🧾 Generating receipt for transaction:', transaction.transaction_id);

      // Generate receipt data
      const receiptData = await this.templateService.generateReceipt(
        transaction,
        options.userInfo
      );

      // Generate HTML template
      const template = this.templateService.generateHTML(receiptData);

      let filePath: string | undefined;

      if (options.format === 'pdf') {
        filePath = await this.generatePDF(template, receiptData.receiptNumber);
      } else {
        filePath = await this.generateHTML(template, receiptData.receiptNumber);
      }

      // Save to device if requested
      if (options.save && filePath) {
        await this.saveToDevice(filePath, receiptData.receiptNumber, options.format);
      }

      // Share if requested
      if (options.share && filePath) {
        await this.shareReceipt(filePath, receiptData.receiptNumber);
      }

      // Save to Firestore if requested
      let firestoreReceiptId: string | undefined;
      console.log('🔥 ReceiptGenerator - Checking if should save to Firestore:', {
        saveToFirestore: options.saveToFirestore,
        userId: options.userId,
        filePath: filePath
      });
      
      if (options.saveToFirestore && options.userId && filePath) {
        try {
          console.log('🔥 ReceiptGenerator - Saving to Firestore...');
          const generatedReceiptData: GeneratedReceiptData = {
            transaction,
            merchantInfo: receiptData.merchantInfo,
            receiptNumber: receiptData.receiptNumber,
            pdfFilePath: filePath,
            htmlContent: template.html,
          };

          console.log('🔥 ReceiptGenerator - Generated receipt data for Firestore:', {
            receiptNumber: generatedReceiptData.receiptNumber,
            pdfFilePath: generatedReceiptData.pdfFilePath
          });

          firestoreReceiptId = await this.firebaseIntegration.saveReceiptToFirestore(
            generatedReceiptData,
            options.userId
          );

          console.log('✅ Receipt saved to Firestore with ID:', firestoreReceiptId);
        } catch (firestoreError) {
          console.error('⚠️ Failed to save to Firestore, but receipt was generated:', firestoreError);
          // Don't fail the entire operation if Firestore save fails
        }
      }

      console.log('✅ Receipt generated successfully:', receiptData.receiptNumber);

      return {
        success: true,
        filePath,
        firestoreReceiptId,
        receiptNumber: receiptData.receiptNumber
      };

    } catch (error) {
      console.error('❌ Failed to generate receipt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Generate PDF receipt
   */
  private async generatePDF(
    template: { html: string; styles: string },
    receiptNumber: string
  ): Promise<string> {
    const htmlWithStyles = `
      <html>
        <head>
          <style>${template.styles}</style>
        </head>
        <body>
          ${template.html.replace(/<html>[\s\S]*?<body>/i, '').replace(/<\/body>[\s\S]*?<\/html>/i, '')}
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({
      html: htmlWithStyles,
      width: 612, // Standard letter width in points
      height: 792, // Standard letter height in points
      margins: {
        left: 20,
        top: 20,
        right: 20,
        bottom: 20,
      },
    });

    console.log('📄 PDF generated at temporary location:', uri);
    
    // Copy PDF to a permanent location in the app's document directory
    const fileName = `receipt_${receiptNumber.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const permanentPath = `${FileSystem.documentDirectory}receipts/${fileName}`;
    
    console.log('📄 Attempting to save PDF to permanent path:', permanentPath);
    console.log('📄 Document directory:', FileSystem.documentDirectory);
    
    // Ensure receipts directory exists
    const receiptsDir = `${FileSystem.documentDirectory}receipts/`;
    const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
    console.log('📁 Receipts directory info:', dirInfo);
    
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });
      console.log('📁 Created receipts directory:', receiptsDir);
      
      // Verify it was created
      const newDirInfo = await FileSystem.getInfoAsync(receiptsDir);
      console.log('📁 Directory created successfully:', newDirInfo);
    }
    
    // Check if temporary file exists before copying
    const tempFileInfo = await FileSystem.getInfoAsync(uri);
    console.log('📄 Temporary file info:', tempFileInfo);
    
    if (!tempFileInfo.exists) {
      throw new Error(`Temporary PDF file does not exist at: ${uri}`);
    }
    
    // Copy the file to permanent location
    try {
      await FileSystem.copyAsync({
        from: uri,
        to: permanentPath
      });
      console.log('✅ PDF copied successfully to:', permanentPath);
      
      // Verify the copy was successful
      const finalFileInfo = await FileSystem.getInfoAsync(permanentPath);
      console.log('📄 Final file info:', finalFileInfo);
      
      if (!finalFileInfo.exists) {
        throw new Error(`Failed to copy PDF to permanent location: ${permanentPath}`);
      }
      
    } catch (copyError) {
      console.error('❌ Error copying PDF:', copyError);
      throw new Error(`Failed to copy PDF: ${copyError}`);
    }
    
    console.log('📄 PDF successfully saved to permanent location:', permanentPath);
    return permanentPath;
  }

  /**
   * Generate HTML receipt file
   */
  private async generateHTML(
    template: { html: string; styles: string },
    receiptNumber: string
  ): Promise<string> {
    const htmlWithStyles = `
      <html>
        <head>
          <style>${template.styles}</style>
        </head>
        <body>
          ${template.html.replace(/<html>[\s\S]*?<body>/i, '').replace(/<\/body>[\s\S]*?<\/html>/i, '')}
        </body>
      </html>
    `;

    const fileName = `receipt-${receiptNumber}.html`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, htmlWithStyles, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    console.log('📝 HTML generated at:', filePath);
    return filePath;
  }

  /**
   * Save receipt to device storage
   */
  private async saveToDevice(
    tempFilePath: string,
    receiptNumber: string,
    format: 'html' | 'pdf'
  ): Promise<void> {
    try {
      const fileName = `receipt-${receiptNumber}.${format}`;
      const documentsDir = FileSystem.documentDirectory;
      const savedPath = `${documentsDir}receipts/${fileName}`;

      // Ensure receipts directory exists
      const receiptsDir = `${documentsDir}receipts/`;
      const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });
      }

      // Copy file to documents directory
      await FileSystem.copyAsync({
        from: tempFilePath,
        to: savedPath,
      });

      console.log('💾 Receipt saved to:', savedPath);
    } catch (error) {
      console.error('❌ Failed to save receipt:', error);
      throw error;
    }
  }

  /**
   * Share receipt using native sharing
   */
  private async shareReceipt(filePath: string, receiptNumber: string): Promise<void> {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(filePath, {
          dialogTitle: `Share Receipt ${receiptNumber}`,
          mimeType: filePath.endsWith('.pdf') ? 'application/pdf' : 'text/html',
          UTI: filePath.endsWith('.pdf') ? 'com.adobe.pdf' : 'public.html',
        });
        
        console.log('📤 Receipt shared successfully');
      } else {
        console.warn('⚠️ Sharing not available on this device');
      }
    } catch (error) {
      console.error('❌ Failed to share receipt:', error);
      throw error;
    }
  }

  /**
   * Get all saved receipts
   */
  public async getSavedReceipts(): Promise<string[]> {
    try {
      const documentsDir = FileSystem.documentDirectory;
      const receiptsDir = `${documentsDir}receipts/`;
      
      const dirInfo = await FileSystem.getInfoAsync(receiptsDir);
      if (!dirInfo.exists) {
        return [];
      }

      const files = await FileSystem.readDirectoryAsync(receiptsDir);
      return files.filter(file => file.startsWith('receipt-')).sort().reverse();
    } catch (error) {
      console.error('❌ Failed to get saved receipts:', error);
      return [];
    }
  }

  /**
   * Delete a saved receipt
   */
  public async deleteReceipt(fileName: string): Promise<boolean> {
    try {
      const documentsDir = FileSystem.documentDirectory;
      const filePath = `${documentsDir}receipts/${fileName}`;
      
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath);
        console.log('🗑️ Receipt deleted:', fileName);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to delete receipt:', error);
      return false;
    }
  }
}
