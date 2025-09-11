import { PlaidApi, Configuration, PlaidEnvironments, AccountsGetRequest } from 'plaid';

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
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }

    const request: AccountsGetRequest = {
      access_token: access_token,
    };

    const response = await client.accountsGet(request);

    res.status(200).json({
      accounts: response.data.accounts,
      item: response.data.item,
    });
  } catch (error: any) {
    console.error('❌ Error fetching accounts:', error);
    
    res.status(500).json({
      error: 'Failed to fetch accounts',
      details: error.response?.data || error.message,
    });
  }
}
