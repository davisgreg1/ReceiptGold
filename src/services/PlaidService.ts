import {
  LinkSuccess,
  LinkExit,
  LinkOpenProps,
  LinkIOSPresentationStyle,
  LinkLogLevel,
  create,
  open
} from 'react-native-plaid-link-sdk';
import { Platform } from 'react-native';

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

export interface PlaidInstitution {
  institution_id: string;
  name: string;
  products: string[];
  country_codes: string[];
  url: string | null;
  primary_color: string | null;
  logo: string | null;
  routing_numbers: string[];
  oauth: boolean;
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
   * Create a link token from local server
   */
  public async createLinkToken(userId: string): Promise<string> {
    console.log("🚀 Starting link token creation for user:", userId);
    try {
      // Prepare platform-specific configuration
      const requestBody: any = { 
        user_id: userId
      };

      if (Platform.OS === 'android') {
        requestBody.android_package_name = 'com.receiptgold.app';
        console.log('🤖 Android: Using package name for OAuth redirect');
      } else {
        requestBody.redirect_uri = 'receiptgold://oauth';
        console.log('🍎 iOS: Using redirect URI for OAuth redirect');
      }

      const response = await fetch(`${API_BASE_URL}/api/plaid/create-link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create link token');
      }
      
      if (!data.link_token) {
        throw new Error('No link token returned from server');
      }
      
      this.linkToken = data.link_token;
      console.log('✅ Link token created successfully via local server');
      return data.link_token;
    } catch (error: any) {
      console.error('❌ Error creating link token:', error);
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
      

      try {
        console.log('🔗 Creating Plaid Link...');
        
        // Create with proper redirect URI configuration based on platform
        const createConfig: any = { token: linkToken };
        
        if (Platform.OS === 'android') {
          createConfig.android_package_name = 'com.receiptgold.app';
          console.log('🤖 Android: Using package name for OAuth redirect');
        } else {
          createConfig.redirect_uri = 'receiptgold://oauth';
          console.log('🍎 iOS: Using redirect URI for OAuth redirect');
        }
        
        create(createConfig);
        
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
      console.log(`🔍 PlaidService.fetchRecentTransactions called with:`);
      console.log(`  - accessToken: ${accessToken ? 'present (' + accessToken.substring(0, 20) + '...)' : 'MISSING'}`);
      console.log(`  - startDate: ${startDate || 'MISSING'}`);
      console.log(`  - endDate: ${endDate || 'MISSING'}`);
      
      if (!accessToken || !startDate || !endDate) {
        throw new Error(`Missing required parameters: accessToken=${!!accessToken}, startDate=${!!startDate}, endDate=${!!endDate}`);
      }
      
      console.log(`📡 Fetching transactions from ${startDate} to ${endDate}`);
      
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
   * Get institution information using the access token
   */
  public async getInstitution(accessToken: string): Promise<PlaidInstitution | null> {
    try {
      console.log('🏦 Getting institution information...');
      
      const response = await fetch(`${API_BASE_URL}/api/plaid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'get_institution',
          access_token: accessToken,
        }),
      });
      console.log("🚀 ~ PlaidService ~ getInstitution ~ response:", response)

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to get institution info:', errorData.error);
        return null;
      }

      const data = await response.json();
      console.log('✅ Institution info received:', data.institution);
      return data.institution;
    } catch (error) {
      console.error('❌ Error getting institution info:', error);
      return null;
    }
  }

  /**
   * Disconnect a bank account by removing the access token from Plaid
   */
  public async disconnectBankAccount(accessToken: string): Promise<void> {
    try {
      // Check if access token is available
      if (!accessToken) {
        console.log('⚠️ No access token available - skipping Plaid API disconnection (connection was never fully established)');
        return;
      }

      console.log('🔌 Disconnecting bank account from Plaid...');
      
      const response = await fetch(`${API_BASE_URL}/api/plaid`, {
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
        console.error('❌ Plaid API error during disconnect:', errorData);
        
        // If the access token is invalid, log it but don't throw - we still want to clean up locally
        if (errorData.error_code === 'INVALID_ACCESS_TOKEN' || errorData.error_type === 'INVALID_INPUT') {
          console.log('⚠️ Access token was invalid - proceeding with local cleanup');
          return;
        }
        
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
