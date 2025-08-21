import { PlaidApi, Configuration, PlaidEnvironments, LinkTokenCreateRequest, CountryCode, Products } from 'plaid';

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
    const { user_id, android_package_name, redirect_uri } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const request: LinkTokenCreateRequest = {
      user: {
        client_user_id: user_id,
      },
      client_name: 'ReceiptGold',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    // For Android: use android_package_name (no redirect_uri)
    if (android_package_name) {
      request.android_package_name = android_package_name;
      console.log('🤖 Creating Android link token with package name:', android_package_name);
    } 
    // For iOS/Web: use redirect_uri (no android_package_name)
    else if (redirect_uri) {
      request.redirect_uri = redirect_uri;
      console.log('🍎 Creating iOS/Web link token with redirect URI:', redirect_uri);
    }

    const response = await client.linkTokenCreate(request);
    const linkToken = response.data.link_token;

    console.log('✅ Link token created successfully for user:', user_id);

    res.status(200).json({
      link_token: linkToken,
    });
  } catch (error: any) {
    console.error('❌ Error creating link token:', error);
    
    res.status(500).json({
      error: 'Failed to create link token',
      details: error.response?.data || error.message,
    });
  }
}
