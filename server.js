const express = require("express");
const cors = require("cors");
const util = require("util");
require("dotenv").config();
const { PlaidApi, Configuration, PlaidEnvironments } = require("plaid");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// API directory handler - dynamically load API files
app.use('/api', async (req, res, next) => {
  const path = require('path');
  const fs = require('fs');
  
  try {
    // Convert URL path to file path (e.g., /api/sms/send-verification -> api/sms/send-verification.js)
    const apiPath = req.path.replace(/^\//, ''); // Remove leading slash
    const filePath = path.join(__dirname, 'api', `${apiPath}.js`);
    
    // Check if API file exists
    if (fs.existsSync(filePath)) {
      // Clear require cache to allow hot reloading in development
      delete require.cache[require.resolve(filePath)];
      
      // Require and execute the API handler
      const handler = require(filePath).default;
      if (typeof handler === 'function') {
        await handler(req, res);
      } else {
        next(); // Continue to next middleware if no default export
      }
    } else {
      next(); // Continue to existing hardcoded routes
    }
  } catch (error) {
    console.error('API handler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  console.log('🔍 HEALTH CHECK - Code is updated!');
  res.json({ status: 'OK', message: 'Plaid API server is running' });
});

// Initialize Plaid client
console.log('🔍 Debug - Plaid Client ID:', process.env.PLAID_CLIENT_ID ? 'loaded' : 'MISSING');
console.log('🔍 Debug - Plaid Secret:', process.env.PLAID_SANDBOX_SECRET ? 'loaded' : 'MISSING');

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SANDBOX_SECRET,
    },
  },
});

// Create the Plaid client with explicit credentials
const plaidClient = new PlaidApi(configuration);

// Test endpoint
app.post("/api/test", (req, res) => {
  res.json({ message: "Test endpoint works!" });
});

// Consolidated Plaid endpoint (handles multiple actions)
app.post("/api/plaid", async (req, res) => {
  const { action, ...body } = req.body;
  
  try {
    switch (action) {
      case 'create_link_token':
        const linkTokenResponse = await plaidClient.linkTokenCreate({
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
        const exchangeResponse = await plaidClient.itemPublicTokenExchange({
          public_token: body.public_token,
        });
        
        res.json({ 
          access_token: exchangeResponse.data.access_token,
          item_id: exchangeResponse.data.item_id,
        });
        break;
        
      case 'get_accounts':
        const accountsResponse = await plaidClient.accountsGet({
          access_token: body.access_token,
        });
        
        res.json({ accounts: accountsResponse.data.accounts });
        break;
        
      case 'get_transactions':
        const transactionsResponse = await plaidClient.transactionsGet({
          access_token: body.access_token,
          start_date: body.start_date,
          end_date: body.end_date,
        });
        
        res.json({ transactions: transactionsResponse.data.transactions });
        break;
        
      case 'remove_item':
        console.log('🔍 Remove-item endpoint called with access_token:', body.access_token?.substring(0, 20) + '...');
        
        const removeResponse = await plaidClient.itemRemove({
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
        
      case 'get_institution':
        console.log('🏦 Getting institution info for access_token:', body.access_token?.substring(0, 20) + '...');
        
        // First get the item to get institution_id
        const itemResponse = await plaidClient.itemGet({
          access_token: body.access_token,
        });
        
        const institutionId = itemResponse.data.item.institution_id;
        console.log('🏦 Institution ID:', institutionId);
        
        // Then get the institution details
        const institutionResponse = await plaidClient.institutionsGetById({
          institution_id: institutionId,
          country_codes: ['US'],
        });
        
        console.log('✅ Institution info retrieved:', institutionResponse.data.institution.name);
        
        res.json({
          institution: institutionResponse.data.institution,
        });
        break;
        
      default:
        res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('❌ Plaid API error:', error.response?.data || error);
    res.status(500).json({ 
      error: error.message || 'Unknown error',
      error_code: error.error_code,
      error_type: error.error_type,
      details: error.response?.data || error.message,
    });
  }
});

// Create link token endpoint
app.post("/api/plaid/create-link-token", async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    const request = {
      user: {
        client_user_id: user_id,
      },
      client_name: "ReceiptGold",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    };

    const response = await plaidClient.linkTokenCreate(request);
    const linkToken = response.data.link_token;

    console.log("✅ Link token created successfully for user:", user_id);

    res.json({
      link_token: linkToken,
    });
  } catch (error) {
    console.error("❌ Error creating link token:", error);
    res.status(500).json({
      error: "Failed to create link token",
      details: error.response?.data || error.message,
    });
  }
});

// Exchange public token endpoint
app.post("/api/plaid/exchange-public-token", async (req, res) => {
  try {
    const { public_token } = req.body;

    if (!public_token) {
      return res.status(400).json({ error: "public_token is required" });
    }

    const request = {
      public_token: public_token,
    };

    const response = await plaidClient.itemPublicTokenExchange(request);
    const accessToken = response.data.access_token;

    console.log("✅ Access token created successfully");

    res.json({
      access_token: accessToken,
      item_id: response.data.item_id,
    });
  } catch (error) {
    console.error("❌ Error exchanging public token:", error);
    res.status(500).json({
      error: "Failed to exchange public token",
      details: error.response?.data || error.message,
    });
  }
});

// Get transactions endpoint
app.post("/api/plaid/transactions", async (req, res) => {
  try {
    const { access_token, start_date, end_date } = req.body;

    if (!access_token || !start_date || !end_date) {
      return res.status(400).json({
        error: "access_token, start_date, and end_date are required",
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
    console.error("❌ server Error fetching transactions:", error);
    res.status(500).json({
      error: "Failed to fetch transactions",
      details: error.response?.data || error.message,
    });
  }
});

// Get accounts endpoint
app.post("/api/plaid/accounts", async (req, res) => {
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: "access_token is required" });
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
    console.error("❌ Error fetching accounts:", error);
    res.status(500).json({
      error: "Failed to fetch accounts",
      details: error.response?.data || error.message,
    });
  }
});

// Create update link token endpoint (for repairing existing connections)
app.post("/api/plaid/create-update-link-token", async (req, res) => {
  console.log("🔧 Creating update link token for repair flow");
  
  try {
    const { user_id, access_token, update_mode, android_package_name, ios_bundle_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ error: "user_id is required" });
    }

    if (!access_token) {
      return res.status(400).json({ error: "access_token is required for update mode" });
    }

    const request = {
      user: {
        client_user_id: user_id,
      },
      client_name: "ReceiptGold",
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
      access_token: access_token, // Required for update mode
      update: {
        account_selection_enabled: true, // Allow user to select accounts to update
      },
    };

    // Add platform-specific configuration
    if (android_package_name) {
      request.android_package_name = android_package_name;
    }
    
    if (ios_bundle_id) {
      request.redirect_uri = `${ios_bundle_id}://oauth`;
    }

    const response = await plaidClient.linkTokenCreate(request);
    const linkToken = response.data.link_token;

    console.log("✅ Update link token created successfully for user:", user_id);

    res.json({
      link_token: linkToken,
    });
  } catch (error) {
    console.error("❌ Error creating update link token:", error);
    res.status(500).json({
      error: "Failed to create update link token",
      details: error.response?.data || error.message,
      error_code: error.error_code,
      error_type: error.error_type,
    });
  }
});

// Remove item endpoint
app.post("/api/plaid/remove-item", async (req, res) => {
  console.log('🔍 Remove-item endpoint called with body:', req.body);
  
  try {
    const { access_token } = req.body;

    if (!access_token) {
      return res.status(400).json({ error: "access_token is required" });
    }

    // Based on Plaid documentation, include client_id and secret in the request
    const request = {
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SANDBOX_SECRET,
      access_token: access_token,
    };

    console.log('🔍 Debug - Request payload for Plaid:', {
      access_token: access_token.substring(0, 20) + '...',
      client_id_configured: process.env.PLAID_CLIENT_ID ? 'yes' : 'no',
      secret_configured: process.env.PLAID_SANDBOX_SECRET ? 'yes' : 'no',
    });

    const response = await plaidClient.itemRemove(request);

    console.log("✅ Plaid item removed successfully:", response.data);

    res.json({
      success: true,
      message: "Bank account disconnected successfully",
      removed: true,
      request_id: response.data.request_id,
    });
  } catch (error) {
    console.error("❌ Error removing Plaid item:", error.response?.data || error);
    res.status(500).json({
      error: "Failed to remove Plaid item",
      error_code: error.error_code,
      error_type: error.error_type,
      details: error.response?.data || error.message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", message: "Plaid API server is running" });
});

app.listen(PORT, () => {
  console.log(`🚀 Plaid API server running at http://localhost:${PORT}`);
  console.log("Available endpoints:");
  console.log("  POST /api/plaid (consolidated)");
  console.log("  POST /api/plaid/create-link-token");
  console.log("  POST /api/plaid/create-update-link-token");
  console.log("  POST /api/plaid/exchange-public-token");
  console.log("  POST /api/plaid/transactions");
  console.log("  POST /api/plaid/accounts");
  console.log("  POST /api/plaid/remove-item");
});

module.exports = app;
