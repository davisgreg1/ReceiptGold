// SMS code verification endpoint for Twilio integration
const twilio = require('twilio');

// Determine which credentials to use - prioritize API keys if available
let twilioClient;

if (process.env.TWILIO_API_KEY_SID && process.env.TWILIO_API_KEY_SECRET && process.env.TWILIO_ACCOUNT_SID) {
  // Use API Keys (preferred for production)
  console.log('🔧 Using Twilio API Keys');
  twilioClient = twilio(
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { accountSid: process.env.TWILIO_ACCOUNT_SID }
  );
} else if (process.env.TWILIO_TEST_ACCOUNT_SID && process.env.TWILIO_TEST_AUTH_TOKEN) {
  // Fallback to test credentials
  console.log('🔧 Using Twilio test credentials');
  twilioClient = twilio(
    process.env.TWILIO_TEST_ACCOUNT_SID,
    process.env.TWILIO_TEST_AUTH_TOKEN
  );
} else {
  console.error('❌ No Twilio credentials found');
}

const TWILIO_SERVICE_ID = process.env.TWILIO_SERVICE_ID;

async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { phoneNumber, code } = req.body;

    if (!phoneNumber || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone number and verification code are required'
      });
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    console.log('📱 Verifying SMS code for phone:', formattedPhone);

    // Verify the code using Twilio Verify API
    const verificationCheck = await twilioClient.verify.v2
      .services(TWILIO_SERVICE_ID)
      .verificationChecks
      .create({ to: formattedPhone, code });

    if (verificationCheck.status === 'approved') {
      console.log('✅ SMS verification successful');
      res.json({
        success: true,
        verificationSid: verificationCheck.sid,
      });
    } else {
      console.error('❌ SMS verification failed:', verificationCheck.status);
      res.status(400).json({
        success: false,
        error: `Verification failed: ${verificationCheck.status}`,
      });
    }
  } catch (error) {
    console.error('❌ SMS verification error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Verification failed',
    });
  }
}

module.exports = { default: handler };