import { OpenAIReceiptService, GeneratedReceipt as AIGeneratedReceipt } from './OpenAIReceiptService';
import HTMLReceiptService, { GeneratedReceipt as HTMLGeneratedReceipt } from './HTMLReceiptService';
import { PlaidTransaction } from './PlaidService';

export type ReceiptServiceType = 'ai' | 'html';

export interface ReceiptService {
  generateReceiptFromTransaction(transaction: PlaidTransaction): Promise<AIGeneratedReceipt | HTMLGeneratedReceipt>;
}

class ReceiptServiceFactory {
  private static aiService: OpenAIReceiptService | null = null;
  private static htmlService: HTMLReceiptService | null = null;

  /**
   * Get the receipt service based on environment configuration
   */
  static getReceiptService(): ReceiptService {
    const serviceType = this.getReceiptServiceType();
    
    switch (serviceType) {
      case 'ai':
        return this.getAIService();
      case 'html':
        return this.getHTMLService();
      default:
        console.warn(`⚠️ Unknown receipt service type: ${serviceType}, falling back to HTML`);
        return this.getHTMLService();
    }
  }

  /**
   * Get the configured receipt service type from environment
   */
  private static getReceiptServiceType(): ReceiptServiceType {
    const envType = process.env.RECEIPT_SERVICE_TYPE || 'html';
    
    if (envType === 'ai' || envType === 'html') {
      return envType;
    }
    
    console.warn(`⚠️ Invalid RECEIPT_SERVICE_TYPE: ${envType}, using 'html'`);
    return 'html';
  }

  /**
   * Get AI receipt service (singleton)
   */
  private static getAIService(): OpenAIReceiptService {
    if (!this.aiService) {
      console.log('🤖 Initializing AI Receipt Service');
      this.aiService = OpenAIReceiptService.getInstance();
    }
    return this.aiService;
  }

  /**
   * Get HTML receipt service (singleton)
   */
  private static getHTMLService(): HTMLReceiptService {
    if (!this.htmlService) {
      console.log('📄 Initializing HTML Receipt Service');
      this.htmlService = HTMLReceiptService.getInstance();
    }
    return this.htmlService;
  }

  /**
   * Force a specific service type (useful for testing)
   */
  static forceServiceType(type: ReceiptServiceType): ReceiptService {
    switch (type) {
      case 'ai':
        return this.getAIService();
      case 'html':
        return this.getHTMLService();
      default:
        throw new Error(`Invalid service type: ${type}`);
    }
  }

  /**
   * Get info about current configuration
   */
  static getServiceInfo() {
    const serviceType = this.getReceiptServiceType();
    const hasOpenAIKey = !!(process.env.OPENAI_API_KEY);
    const hasHTMLServer = !!(process.env.HTML_TO_IMAGE_SERVER_URL);
    
    return {
      currentService: serviceType,
      aiServiceAvailable: hasOpenAIKey,
      htmlServiceAvailable: hasHTMLServer || true, // HTML service has fallback
      recommendation: this.getRecommendation()
    };
  }

  /**
   * Get service recommendation based on available configuration
   */
  private static getRecommendation(): string {
    const hasOpenAIKey = !!(process.env.OPENAI_API_KEY);
    const hasHTMLServer = !!(process.env.HTML_TO_IMAGE_SERVER_URL);
    
    if (hasOpenAIKey && hasHTMLServer) {
      return 'Both services available - choose based on preference';
    } else if (hasOpenAIKey) {
      return 'AI service recommended (OpenAI key available)';
    } else if (hasHTMLServer) {
      return 'HTML service recommended (server available)';
    } else {
      return 'HTML service with fallback (no external dependencies)';
    }
  }
}

export default ReceiptServiceFactory;
