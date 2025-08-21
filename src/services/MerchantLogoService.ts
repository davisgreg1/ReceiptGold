import { PlaidTransaction } from './PlaidService';

export interface MerchantInfo {
  name: string;
  logoUrl: string | null;
  category: string;
  source: 'plaid' | 'clearbit' | 'generic';
}

export class MerchantLogoService {
  private static instance: MerchantLogoService;
  private logoCache = new Map<string, MerchantInfo>();

  private constructor() {}

  public static getInstance(): MerchantLogoService {
    if (!MerchantLogoService.instance) {
      MerchantLogoService.instance = new MerchantLogoService();
    }
    return MerchantLogoService.instance;
  }

  /**
   * Get merchant information including logo for a transaction
   */
  public async getMerchantInfo(transaction: PlaidTransaction): Promise<MerchantInfo> {
    const merchantName = transaction.merchant_name || transaction.name || 'Unknown Merchant';
    const cacheKey = merchantName.toLowerCase().trim();

    // Check cache first
    if (this.logoCache.has(cacheKey)) {
      return this.logoCache.get(cacheKey)!;
    }

    console.log('🏪 Fetching merchant info for:', merchantName);

    // Try to get merchant info from Plaid first
    let merchantInfo = await this.getPlaidMerchantInfo(transaction);

    // If Plaid doesn't have it, try Clearbit
    if (!merchantInfo.logoUrl) {
      merchantInfo = await this.getClearbitLogo(merchantInfo);
    }

    // Cache the result
    this.logoCache.set(cacheKey, merchantInfo);
    return merchantInfo;
  }

  /**
   * Get merchant info from Plaid (placeholder - would need actual Plaid merchant API)
   */
  private async getPlaidMerchantInfo(transaction: PlaidTransaction): Promise<MerchantInfo> {
    const merchantName = transaction.merchant_name || transaction.name || 'Unknown Merchant';
    const category = transaction.category?.[0] || 'General';

    // TODO: Implement actual Plaid merchant API call
    // For now, we'll use some known merchants as examples
    const knownMerchants = this.getKnownMerchantLogos();
    const normalizedName = merchantName.toLowerCase();

    // Check known merchants
    let foundMerchant = null;
    knownMerchants.forEach((logoUrl, pattern) => {
      if (normalizedName.includes(pattern)) {
        console.log('✅ Found Plaid merchant logo for:', merchantName);
        foundMerchant = {
          name: merchantName,
          logoUrl,
          category,
          source: 'plaid'
        };
      }
    });

    if (foundMerchant) {
      return foundMerchant as MerchantInfo;
    }

    return {
      name: merchantName,
      logoUrl: null,
      category,
      source: 'plaid'
    };
  }

  /**
   * Get merchant logo from Clearbit Logo API
   */
  private async getClearbitLogo(merchantInfo: MerchantInfo): Promise<MerchantInfo> {
    try {
      // Extract domain from merchant name or use merchant name
      const domain = this.extractDomainFromMerchant(merchantInfo.name);
      
      if (domain) {
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        
        // Test if the logo exists
        const response = await fetch(clearbitUrl, { method: 'HEAD' });
        
        if (response.ok) {
          console.log('✅ Found Clearbit logo for:', merchantInfo.name);
          return {
            ...merchantInfo,
            logoUrl: clearbitUrl,
            source: 'clearbit'
          };
        }
      }
    } catch (error) {
      console.log('❌ Clearbit logo not found for:', merchantInfo.name);
    }

    // Return with generic logo
    return {
      ...merchantInfo,
      logoUrl: this.getGenericLogo(merchantInfo.category),
      source: 'generic'
    };
  }

  /**
   * Extract domain from merchant name
   */
  private extractDomainFromMerchant(merchantName: string): string | null {
    const normalizedName = merchantName.toLowerCase();
    
    // Common domain mappings
    const domainMappings: { [key: string]: string } = {
      'starbucks': 'starbucks.com',
      'mcdonalds': 'mcdonalds.com',
      'walmart': 'walmart.com',
      'target': 'target.com',
      'amazon': 'amazon.com',
      'apple': 'apple.com',
      'google': 'google.com',
      'microsoft': 'microsoft.com',
      'uber': 'uber.com',
      'lyft': 'lyft.com',
      'airbnb': 'airbnb.com',
      'netflix': 'netflix.com',
      'spotify': 'spotify.com',
      'chipotle': 'chipotle.com',
      'subway': 'subway.com',
      'shell': 'shell.com',
      'exxon': 'exxonmobil.com',
      'bp': 'bp.com',
      'chevron': 'chevron.com'
    };

    for (const [merchant, domain] of Object.entries(domainMappings)) {
      if (normalizedName.includes(merchant)) {
        return domain;
      }
    }

    return null;
  }

  /**
   * Get known merchant logos (simulating Plaid merchant data)
   */
  private getKnownMerchantLogos(): Map<string, string> {
    return new Map([
      ['starbucks', 'https://logo.clearbit.com/starbucks.com'],
      ['mcdonalds', 'https://logo.clearbit.com/mcdonalds.com'],
      ['walmart', 'https://logo.clearbit.com/walmart.com'],
      ['target', 'https://logo.clearbit.com/target.com'],
      ['amazon', 'https://logo.clearbit.com/amazon.com'],
      ['apple', 'https://logo.clearbit.com/apple.com'],
      ['google', 'https://logo.clearbit.com/google.com'],
      ['uber', 'https://logo.clearbit.com/uber.com'],
      ['lyft', 'https://logo.clearbit.com/lyft.com'],
      ['chipotle', 'https://logo.clearbit.com/chipotle.com'],
      ['subway', 'https://logo.clearbit.com/subway.com']
    ]);
  }

  /**
   * Get generic logo based on category
   */
  private getGenericLogo(category: string): string {
    const categoryLogos: { [key: string]: string } = {
      'Food and Drink': '🍽️',
      'Shops': '🛍️',
      'Gas Stations': '⛽',
      'Transportation': '🚗',
      'Healthcare': '🏥',
      'Entertainment': '🎬',
      'Travel': '✈️',
      'Bank': '🏦',
      'General': '🏪'
    };

    // For now, return emoji as placeholder
    // In a real app, you'd use actual generic icons
    return categoryLogos[category] || categoryLogos['General'];
  }

  /**
   * Clear the logo cache
   */
  public clearCache(): void {
    this.logoCache.clear();
  }
}
