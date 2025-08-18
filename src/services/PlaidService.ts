import {
  LinkSuccess,
  LinkExit,
  LinkOpenProps,
  LinkIOSPresentationStyle,
  LinkLogLevel,
  create,
  open
} from 'react-native-plaid-link-sdk';

// Base URL for the backend API - use local IP for React Native
const API_BASE_URL = 'http://10.0.0.84:3000';

export interface PlaidTransaction {
  account_id: string;
  amount: number;
  iso_currency_code: string;
  unofficial_currency_code: string | null;
  category: string[] | null;
  category_id: string | null;
  date: string;
  datetime: string | null;
  location: PlaidLocation | null;
  merchant_name: string | null;
  name: string;
  payment_channel: string;
  pending: boolean;
  account_owner: string | null;
  transaction_id: string;
  transaction_type: string;
}

export interface PlaidLocation {
  address: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  store_number: string | null;
}

export interface PlaidAccount {
  account_id: string;
  balances: {
    available: number | null;
    current: number | null;
    limit: number | null;
    iso_currency_code: string;
    unofficial_currency_code: string | null;
  };
  mask: string;
  name: string;
  official_name: string | null;
  subtype: string;
  type: string;
}

export class PlaidService {
  private static instance: PlaidService;
  private linkToken: string | null = null;
  private accessToken: string | null = null;

  private constructor() {}

  public static getInstance(): PlaidService {
    if (!PlaidService.instance) {
      PlaidService.instance = new PlaidService();
    }
    return PlaidService.instance;
  }

  /**
   * Create a link token from your backend server
   * This should be called from your backend with Plaid API
   */
  public async createLinkToken(userId: string): Promise<string> {
    try {
      console.log('Creating link token for user:', userId);
      
      const response = await fetch(`${API_BASE_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create link token');
      }
      
      this.linkToken = data.link_token;
      console.log('✅ Link token created successfully');
      return data.link_token;
    } catch (error) {
      console.error('❌ Error creating link token:', error);
      throw error;
    }
  }
  
  /**
   * Create a sandbox link token using a workaround
   */
  private async createSandboxLinkToken(userId: string): Promise<string> {
    try {
      // For real Plaid testing, we need to use their sandbox environment
      // This requires a backend, but for testing we can use a proxy service
      
      // Option 1: Use a CORS proxy (not recommended for production)
      const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
      const plaidUrl = 'https://production.plaid.com/link/token/create';
      
      // Option 2: Use Plaid's test credentials directly
      // NOTE: This exposes your credentials - only for development!
      
      console.log('Using Plaid sandbox environment...');
      
      // For testing, we'll generate a mock link token that would work with Plaid Link
      // In a real app, your backend would make this call
      
      const mockLinkToken = 'link-sandbox-' + Math.random().toString(36).substring(2, 15);
      
      // Wait a bit to simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return mockLinkToken;
    } catch (error) {
      console.error('Error creating sandbox link token:', error);
      throw error;
    }
  }

  /**
   * Open Plaid Link to connect bank account
   */
  public async openPlaidLink(linkToken: string): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log('🔗 Starting Plaid Link process...');
      
      // Check if we're in a compatible environment
      if (typeof create !== 'function' || typeof open !== 'function') {
        console.error('❌ Plaid Link SDK functions not available');
        reject(new Error('Plaid Link SDK not properly configured'));
        return;
      }
      
      // Configuration for create() - only needs token and optional settings
      const linkTokenConfiguration = {
        token: linkToken,
        noLoadingState: false,
      };

      // Configuration for open() - includes callbacks
      const linkOpenConfiguration = {
        onSuccess: (success: LinkSuccess) => {
          console.log('✅ Plaid Link Success:', success);
          this.exchangePublicToken(success.publicToken)
            .then(resolve)
            .catch(reject);
        },
        onExit: (exit: LinkExit) => {
          console.log('⚠️ Plaid Link Exit:', exit);
          if (exit.error) {
            reject(new Error(exit.error.errorMessage || 'Plaid Link error'));
          } else {
            reject(new Error('User cancelled Plaid Link'));
          }
        },
      };

      try {
        console.log('🔗 Creating Plaid Link...');
        create({ token: linkToken });
        
        console.log('🔗 Opening Plaid Link...');
        const openProps = {
          onSuccess: (success: LinkSuccess) => {
            console.log('✅ Plaid Link Success:', success);
            this.exchangePublicToken(success.publicToken)
              .then(resolve)
              .catch(reject);
          },
          onExit: (exit: LinkExit) => {
            console.log('⚠️ Plaid Link Exit:', exit);
            if (exit.error) {
              reject(new Error(exit.error.errorMessage || 'Plaid Link error'));
            } else {
              reject(new Error('User cancelled Plaid Link'));
            }
          },
        };
        
        open(openProps);
        
      } catch (error) {
        console.error('❌ Error in Plaid Link setup:', error);
        reject(error);
      }
    });
  }

  /**
   * Exchange public token for access token
   */
  public async exchangePublicToken(publicToken: string): Promise<string> {
    try {
      console.log('Exchanging public token for access token');
      
      const response = await fetch(`${API_BASE_URL}/api/plaid/exchange-public-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          public_token: publicToken
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange public token');
      }
      
      this.accessToken = data.access_token;
      console.log('✅ Access token received successfully');
      return data.access_token;
    } catch (error) {
      console.error('❌ Error exchanging public token:', error);
      throw error;
    }
  }

  /**
   * Fetch recent transactions from connected accounts
   */
  public async fetchRecentTransactions(
    accessToken: string,
    startDate: string,
    endDate: string
  ): Promise<PlaidTransaction[]> {
    try {
      console.log(`Fetching transactions from ${startDate} to ${endDate}`);
      
      const response = await fetch(`${API_BASE_URL}/api/plaid/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      console.log(`✅ Fetched ${data.transactions.length} transactions from Plaid`);
      return data.transactions;
    } catch (error) {
      console.error('❌ PlaidService Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Get account information
   */
  public async getAccounts(accessToken: string): Promise<PlaidAccount[]> {
    try {
      console.log('Fetching accounts...');
      
      const response = await fetch(`${API_BASE_URL}/api/plaid/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch accounts');
      }
      
      console.log(`✅ Fetched ${data.accounts.length} accounts from Plaid`);
      return data.accounts;
    } catch (error) {
      console.error('❌ Error fetching accounts:', error);
      throw error;
    }
  }

  /**
   * Filter transactions that could be receipt candidates
   */
  public filterReceiptCandidates(transactions: PlaidTransaction[]): PlaidTransaction[] {
    return transactions.filter(transaction => {
      // Filter for purchases (negative amounts for spending)
      if (transaction.amount <= 0) return false;
      
      // Filter out transfers, deposits, etc.
      if (transaction.transaction_type !== 'place') return false;
      
      // Filter by categories that typically generate receipts
      const receiptCategories = [
        'Food and Drink',
        'General Merchandise',
        'Shops',
        'Recreation',
        'Service',
        'Healthcare',
        'Transportation',
        'Travel',
        'Professional Services',
        'Mortgage',
        'Rent'
      ];
      
      if (transaction.category) {
        const hasReceiptCategory = transaction.category.some(cat => 
          receiptCategories.some(receiptCat => cat.includes(receiptCat))
        );
        if (!hasReceiptCategory) return false;
      }
      
      // Filter out very small amounts (likely fees, tips, etc.)
  // Relaxed filter: accept all transactions
  return true;
    });
  }

  /**
   * Disconnect a bank account by removing the access token from Plaid
   */
  public async disconnectBankAccount(accessToken: string): Promise<void> {
    try {
      console.log('🔌 Disconnecting bank account from Plaid again...');
      
      const response = await fetch(`${API_BASE_URL}/api/plaid/remove_item`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remove_item',
          access_token: accessToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to disconnect bank account');
      }

      const result = await response.json();
      console.log('✅ Bank account disconnected from Plaid successfully:', result);
    } catch (error) {
      console.error('❌ Plaid Service Error disconnecting bank account:', error);
      throw error;
    }
  }
}

export default PlaidService;
