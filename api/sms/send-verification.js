// SMS verification endpoint for Twilio integration
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
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    console.log('📱 Sending SMS verification code to:', formattedPhone);

    // Send verification code using Twilio Verify API
    const verification = await twilioClient.verify.v2
      .services(TWILIO_SERVICE_ID)
      .verifications
      .create({ to: formattedPhone, channel: 'sms' });

    console.log('✅ SMS verification code sent, SID:', verification.sid);

    res.json({
      success: true,
      verificationSid: verification.sid,
    });
  } catch (error) {
    console.error('❌ Failed to send SMS verification code:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send verification code',
    });
  }
}

module.exports = { default: handler };