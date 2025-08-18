// Remove/disconnect a Plaid item (bank connection)
import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

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

export default async function handler(req: any, res: any) {
    if (req.method === 'POST') {
        try {
            const { access_token } = req.body;

            if (!access_token) {
                return res.status(400).json({ error: 'access_token is required' });
            }

            // Remove the item from Plaid
            const response = await client.itemRemove({
                access_token: access_token,
            });

            console.log('✅ Plaid item removed successfully:', response.data);

            res.json({
                success: true,
                message: 'Bank account disconnected successfully',
                removed: true
            });
        } catch (error: any) {
            console.error('❌ Plaid item removal error:', error);
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
