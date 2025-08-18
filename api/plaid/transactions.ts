import { PlaidApi, Configuration, PlaidEnvironments, TransactionsGetRequest } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Use sandbox for testing
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.EXPO_PUBLIC_PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.EXPO_PUBLIC_PLAID_SANDBOX_SECRET,
    },
  },
});

const client = new PlaidApi(configuration);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { access_token, start_date, end_date, count = 100 } = req.body;

    if (!access_token || !start_date || !end_date) {
      return res.status(400).json({ 
        error: 'access_token, start_date, and end_date are required' 
      });
    }

    const request: TransactionsGetRequest = {
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
    };

    const response = await client.transactionsGet(request);
    
    console.log(`✅ Fetched ${response.data.transactions.length} transactions`);

    res.status(200).json({
      transactions: response.data.transactions,
      total_transactions: response.data.total_transactions,
      accounts: response.data.accounts,
    });
  } catch (error: any) {
    console.error('❌ Error fetching transactions:', error);
    
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.response?.data || error.message,
    });
  }
}
