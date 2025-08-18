// Simple backend API for Plaid integration
// This is a minimal implementation for testing purposes

const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Plaid configuration
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

// Create link token endpoint
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { action, ...body } = req.body;
    
    try {
      switch (action) {
        case 'create_link_token':
          const linkTokenResponse = await client.linkTokenCreate({
            user: {
              client_user_id: body.user_id || 'user-id-' + Date.now(),
            },
            client_name: 'ReceiptGold',
            products: ['transactions'],
            country_codes: ['US'],
            language: 'en',
          });
          
          res.json({ link_token: linkTokenResponse.data.link_token });
          break;
          
        case 'exchange_public_token':
          const exchangeResponse = await client.itemPublicTokenExchange({
            public_token: body.public_token,
          });
          
          res.json({ 
            access_token: exchangeResponse.data.access_token,
            item_id: exchangeResponse.data.item_id,
          });
          break;
          
        case 'get_accounts':
          const accountsResponse = await client.accountsGet({
            access_token: body.access_token,
          });
          
          res.json({ accounts: accountsResponse.data.accounts });
          break;
          
        case 'get_transactions':
          const transactionsResponse = await client.transactionsGet({
            access_token: body.access_token,
            start_date: body.start_date,
            end_date: body.end_date,
          });
          
          res.json({ transactions: transactionsResponse.data.transactions });
          break;
          
        case 'remove_item':
          const removeResponse = await client.itemRemove({
            access_token: body.access_token,
          });
          
          console.log('✅ Plaid item removed successfully:', removeResponse.data);
          
          res.json({
            success: true,
            message: 'Bank account disconnected successfully',
            removed: true,
            request_id: removeResponse.data.request_id,
          });
          break;
          
        default:
          res.status(400).json({ error: 'Invalid action' });
      }
    } catch (error) {
      console.error('Plaid API error:', error);
      res.status(500).json({ 
        error: error.message,
        error_code: error.error_code,
        error_type: error.error_type,
      });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
