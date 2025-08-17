const express = require('express');
const cors = require('cors');
const util = require('util');
require('dotenv').config();
const { PlaidApi, Configuration, PlaidEnvironments } = require('plaid');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.EXPO_PUBLIC_PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.EXPO_PUBLIC_PLAID_SANDBOX,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Create link token endpoint
app.post('/api/plaid/create-link-token', async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const request = {
      user: {
        client_user_id: user_id,
      },
      client_name: 'ReceiptGold',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    };

    const response = await plaidClient.linkTokenCreate(request);
    const linkToken = response.data.link_token;

    console.log('✅ Link token created successfully for user:', user_id);

    res.json({
      link_token: linkToken,
    });
  } catch (error) {
    console.error('❌ Error creating link token:', error);
    res.status(500).json({
      error: 'Failed to create link token',
      details: error.response?.data || error.message,
    });
  }
});

// Exchange public token endpoint
app.post('/api/plaid/exchange-public-token', async (req, res) => {
  try {
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: 'public_token is required' });
    }

    const request = {
      public_token: public_token,
    };

    const response = await plaidClient.itemPublicTokenExchange(request);
    const accessToken = response.data.access_token;

    console.log('✅ Access token created successfully');

    res.json({
      access_token: accessToken,
      item_id: response.data.item_id,
    });
  } catch (error) {
    console.error('❌ Error exchanging public token:', error);
    res.status(500).json({
      error: 'Failed to exchange public token',
      details: error.response?.data || error.message,
    });
  }
});

// Get transactions endpoint
app.post('/api/plaid/transactions', async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;

    if (!access_token || !start_date || !end_date) {
      return res.status(400).json({ 
        error: 'access_token, start_date, and end_date are required' 
      });
    }

    const request = {
      access_token: access_token,
      start_date: start_date,
      end_date: end_date,
    };

    const response = await plaidClient.transactionsGet(request);
    console.log(util.inspect(response.data, { depth: null, colors: true }));
    
    console.log(`✅ Fetched ${response.data.transactions.length} transactions`);

    res.json({
      transactions: response.data.transactions,
      total_transactions: response.data.total_transactions,
      accounts: response.data.accounts,
    });
  } catch (error) {
    console.error('❌ Error fetching transactions:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
      details: error.response?.data || error.message,
    });
  }
});

// Get accounts endpoint
app.post('/api/plaid/accounts', async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: 'access_token is required' });
    }

    const request = {
      access_token: access_token,
    };

    const response = await plaidClient.accountsGet(request);
    
    console.log(`✅ Fetched ${response.data.accounts.length} accounts`);

    res.json({
      accounts: response.data.accounts,
      item: response.data.item,
    });
  } catch (error) {
    console.error('❌ Error fetching accounts:', error);
    res.status(500).json({
      error: 'Failed to fetch accounts',
      details: error.response?.data || error.message,
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Plaid API server is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Plaid API server running at http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  POST /api/plaid/create-link-token');
  console.log('  POST /api/plaid/exchange-public-token');
  console.log('  POST /api/plaid/transactions');
  console.log('  POST /api/plaid/accounts');
});

module.exports = app;
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'ReceiptGold Backend API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 ReceiptGold Backend API server running on http://localhost:${PORT}`);
  console.log(`📊 Plaid endpoint available at http://localhost:${PORT}/api/plaid`);
});
