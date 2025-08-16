import { PlaidApi, Configuration, PlaidEnvironments, ItemPublicTokenExchangeRequest } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox, // Use sandbox for testing
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.EXPO_PUBLIC_PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.EXPO_PUBLIC_PLAID_SANDBOX,
    },
  },
});

const client = new PlaidApi(configuration);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const request: ItemPublicTokenExchangeRequest = {
      public_token: public_token,
    };

    const response = await client.itemPublicTokenExchange(request);
    const accessToken = response.data.access_token;

    console.log('✅ Access token created successfully');

    res.status(200).json({
      access_token: accessToken,
      item_id: response.data.item_id,
    });
  } catch (error: any) {
    console.error('❌ Error exchanging public token:', error);
    
    res.status(500).json({
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message,
    });
  }
}
