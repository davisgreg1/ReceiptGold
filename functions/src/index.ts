// Cloud Functions for ReceiptGold Business Logic
// Updated for Firebase Functions v6 (mixed v1/v2 API)

import * as functions from "firebase-functions";
import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { onCall, HttpsError, CallableRequest, onRequest } from "firebase-functions/v2/https";
import { onCustomEventPublished } from "firebase-functions/v2/eventarc";
import { Request, Response } from "express";
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');

// Structured logging utility for production
class Logger {
  private static isDevelopment = process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true';

  static error(message: string, context?: any, userId?: string) {
    console.error(JSON.stringify({
      level: 'ERROR',
      message,
      timestamp: new Date().toISOString(),
      userId,
      ...context
    }));
  }

  static warn(message: string, context?: any, userId?: string) {
    console.warn(JSON.stringify({
      level: 'WARN',
      message,
      timestamp: new Date().toISOString(),
      userId,
      ...context
    }));
  }

  static info(message: string, context?: any, userId?: string) {
    console.info(JSON.stringify({
      level: 'INFO',
      message,
      timestamp: new Date().toISOString(),
      userId,
      ...context
    }));
  }

  static debug(message: string, context?: any, userId?: string) {
    if (this.isDevelopment) {
      console.log(JSON.stringify({
        level: 'DEBUG',
        message,
        timestamp: new Date().toISOString(),
        userId,
        ...context
      }));
    }
  }
}

// Split-tender interfaces
interface SplitTenderPayment {
  method: 'cash' | 'credit' | 'debit' | 'gift_card' | 'check' | 'other';
  amount: number;
  last4?: string;
  approvalCode?: string;
  cardType?: string;
}

interface SplitTenderInfo {
  isSplitTender: boolean;
  confidence: number;
  payments: SplitTenderPayment[];
  changeGiven?: number;
  totalVerified: boolean;
  detectedPatterns: string[];
}

// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();

// Receipt limits configuration from environment variables
const getReceiptLimits = () => {
  return {
    trial: parseInt(process.env.TRIAL_TIER_MAX_RECEIPTS || "-1", 10),
    starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
    growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
    professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
    teammate: parseInt(process.env.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
  };
};

/* COMMENTED OUT - Using RevenueCat instead of Stripe

// Stripe configuration from environment variables
const getStripeConfig = (): { secretKey: string; webhookSecret: string } => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    throw new Error('Stripe secret key not found. Set STRIPE_SECRET_KEY or run: firebase functions:config:set stripe.secret="sk_test_..."');
  }

  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not found. Set STRIPE_WEBHOOK_SECRET or run: firebase functions:config:set stripe.webhook_secret="whsec_..."');
  }

  return { secretKey, webhookSecret };
};

*/

// Plaid configuration from environment variables  
const getPlaidConfig = (): { clientId: string; secret: string; environment: string } => {
  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const environment = process.env.PLAID_ENVIRONMENT || 'sandbox';

  if (!clientId) {
    throw new Error('Plaid client ID not found. Set PLAID_CLIENT_ID environment variable');
  }

  if (!secret) {
    throw new Error('Plaid secret not found. Set PLAID_SECRET environment variable');
  }

  return { clientId, secret, environment };
};

/* COMMENTED OUT - Using RevenueCat instead of Stripe

// Lazy Stripe initialization - only initialize when needed
let stripeInstance: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripeInstance) {
    const { secretKey } = getStripeConfig();
    stripeInstance = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  return stripeInstance;
};

*/

// Type definitions (keeping your existing interfaces)
interface SubscriptionTier {
  name: string;
  limits: {
    maxReceipts: number; // 50 for starter, 150 for growth, -1 for professional
    maxBusinesses: number;
    apiCallsPerMonth: number;
    maxReports?: number;
  };
  features: {
    advancedReporting: boolean;
    taxPreparation: boolean;
    accountingIntegrations: boolean;
    prioritySupport: boolean;
    multiBusinessManagement: boolean;
    whiteLabel: boolean;
    apiAccess: boolean;
    dedicatedManager: boolean;
  };
}

interface UpdateSubscriptionRequest {
  subscriptionId: string;
  tierId?: 'starter' | 'growth' | 'professional' | 'trial'; // Optional - Cloud Function can determine from RevenueCat
  userId: string;
  revenueCatUserId?: string; // For calling RevenueCat API directly
}

interface UpdateSubscriptionResponse {
  success: boolean;
  error?: string;
  receiptsExcluded?: number;
  tierChange?: boolean;
}

// Subscription tier limits - used in subscription management
export const TIER_LIMITS = {
  starter: {
    maxReceipts: 50,
    maxBusinesses: 1,
    apiCallsPerMonth: 1000,
  },
  growth: {
    maxReceipts: 150,
    maxBusinesses: 1,
    apiCallsPerMonth: 5000,
  },
  professional: {
    maxReceipts: -1, // unlimited
    maxBusinesses: -1, // unlimited
    apiCallsPerMonth: -1, // unlimited
  },
  teammate: {
    maxReceipts: -1, // unlimited receipts for teammates
    maxBusinesses: 1, // limited to account holder's businesses
    apiCallsPerMonth: 0, // no API access for teammates
  }
} as const;

interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  createdAt: any; // Changed from admin.firestore.FieldValue to allow both server timestamp and Date
  lastLoginAt: any; // Changed from admin.firestore.FieldValue to allow both server timestamp and Date
  profile: {
    firstName: string;
    lastName: string;
    businessName: string;
    businessType: string;
    taxId: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };
  settings: {
    theme: 'light' | 'dark' | 'auto';
    notifications: {
      email: boolean;
      push: boolean;
      taxReminders: boolean;
      receiptReminders: boolean;
    };
    defaultCurrency: string;
    taxYear: number;
  };
}

interface SubscriptionDocument {
  userId: string;
  currentTier: 'trial' | 'starter' | 'growth' | 'professional' | 'teammate';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  trial?: {
    startedAt: admin.firestore.Timestamp;
    expiresAt: admin.firestore.Timestamp;
  };
  billing: {
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    currentPeriodStart: admin.firestore.FieldValue | Date;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    trialEnd: Date | null;
  };
  limits: SubscriptionTier['limits'];
  features: SubscriptionTier['features'];
  history: Array<{
    tier: string;
    startDate: admin.firestore.FieldValue | Date;
    endDate: admin.firestore.FieldValue | Date | null;
    reason: string;
  }>;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

interface UsageDocument {
  userId: string;
  month: string;
  receiptsUploaded: number;
  apiCalls: number;
  reportsGenerated: number;
  limits: SubscriptionTier['limits'];
  resetDate: string;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

interface ReceiptData {
  userId: string;
  businessId?: string;
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  description: string;
  category: string;
  subcategory?: string;
  tags: string[];
  images: Array<{
    url: string;
    thumbnail?: string;
    size: number;
    uploadedAt: Date;
  }>;
  extractedData?: {
    vendor?: string;
    amount?: number;
    tax?: number;
    date?: string;
    confidence?: number;
    items?: Array<{
      description: string;
      amount: number;
      quantity: number;
    }>;
    splitTender?: SplitTenderInfo;
  };
  tax: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
  };
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';
  processingErrors: string[];
  splitTender?: SplitTenderInfo;
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

// Subscription tier configurations (keeping your existing setup)
const subscriptionTiers: Record<string, SubscriptionTier> = {
  starter: {
    name: "Starter",
    limits: {
      maxReceipts: getReceiptLimits().starter,
      maxBusinesses: 1,
      apiCallsPerMonth: 0,
      maxReports: 10,
    },
    features: {
      advancedReporting: false,
      taxPreparation: false,
      accountingIntegrations: false,
      prioritySupport: false,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: false,
      dedicatedManager: false,
    },
  },
  growth: {
    name: "Growth",
    limits: {
      maxReceipts: getReceiptLimits().growth,
      maxBusinesses: 1,
      apiCallsPerMonth: 1000,
      maxReports: 50,
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: true,
      whiteLabel: false,
      apiAccess: true,
      dedicatedManager: false,
    },
  },
  professional: {
    name: "Professional",
    limits: {
      maxReceipts: getReceiptLimits().professional,
      maxBusinesses: -1, // unlimited
      apiCallsPerMonth: 10000,
      maxReports: -1, // unlimited
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: true,
      whiteLabel: true,
      apiAccess: true,
      dedicatedManager: true,
    },
  },
  teammate: {
    name: "Teammate",
    limits: {
      maxReceipts: getReceiptLimits().teammate,
      maxBusinesses: 1, // limited to account holder's businesses
      apiCallsPerMonth: 0, // no API access for teammates
      maxReports: 0, // no reports for teammates
    },
    features: {
      advancedReporting: false,
      taxPreparation: false,
      accountingIntegrations: false,
      prioritySupport: false,
      multiBusinessManagement: false,
      whiteLabel: false,
      apiAccess: false,
      dedicatedManager: false,
    },
  },
  trial: {
    name: "Trial",
    limits: {
      maxReceipts: getReceiptLimits().trial, // Full access during trial
      maxBusinesses: -1, // unlimited during trial
      apiCallsPerMonth: 1000,
      maxReports: -1, // unlimited during trial
    },
    features: {
      advancedReporting: true,
      taxPreparation: true,
      accountingIntegrations: true,
      prioritySupport: true,
      multiBusinessManagement: true,
      whiteLabel: true, // No white label during trial
      apiAccess: true,
      dedicatedManager: true, // No dedicated manager during trial
    },
  },
};

// DeviceCheck configuration
const getDeviceCheckConfig = () => {
  const keyId = process.env.APPLE_DEVICE_CHECK_KEY_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const privateKey = process.env.APPLE_DEVICE_CHECK_PRIVATE_KEY;

  if (!keyId || !teamId || !privateKey) {
    throw new Error('DeviceCheck configuration incomplete. Set APPLE_DEVICE_CHECK_KEY_ID, APPLE_TEAM_ID, and APPLE_DEVICE_CHECK_PRIVATE_KEY');
  }

  return { keyId, teamId, privateKey };
};

// Generate JWT for Apple DeviceCheck API
function generateDeviceCheckJWT(): string {
  const config = getDeviceCheckConfig();

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + (60 * 60) // 1 hour expiration
  };

  const header = {
    alg: 'ES256',
    kid: config.keyId
  };

  return jwt.sign(payload, config.privateKey, {
    algorithm: 'ES256',
    header: header
  });
}


// Helper function to check if token is a base64 fallback token
function isBase64FallbackToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed.platform && parsed.deviceId;
  } catch {
    return false;
  }
}

// Fallback device check using Firestore
async function queryFallbackDeviceCheck(deviceToken: string): Promise<{ bit0: boolean; bit1: boolean; last_update_time?: string }> {
  try {
    const deviceDoc = await db.collection('device_tracking').doc(deviceToken).get();

    if (!deviceDoc.exists) {
      return { bit0: false, bit1: false };
    }

    const data = deviceDoc.data();
    return {
      bit0: data?.hasCreatedAccount || false,
      bit1: false,
      last_update_time: data?.lastUpdated || data?.createdAt
    };
  } catch (error) {
    Logger.error('Fallback device check query failed', { error: (error as Error).message });
    return { bit0: false, bit1: false };
  }
}

// Update fallback device check in Firestore
async function updateFallbackDeviceCheck(deviceToken: string, bits: { bit0?: boolean; bit1?: boolean }): Promise<void> {
  try {
    await db.collection('deviceChecks').doc(deviceToken).set({
      ...bits,
      last_update_time: new Date().toISOString(),
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    Logger.error('Fallback device check update failed', { error: (error as Error).message });
    throw error;
  }
}

// Query DeviceCheck two bits for a device
async function queryDeviceCheck(deviceToken: string): Promise<{ bit0: boolean; bit1: boolean; last_update_time?: string }> {
  try {
    // Check if this is a fallback token (base64 encoded JSON from our React Native service)
    const isFallbackToken = isBase64FallbackToken(deviceToken);

    if (isFallbackToken) {
      Logger.info('Using fallback device check (Firestore-based)');
      return await queryFallbackDeviceCheck(deviceToken);
    }

    Logger.info('Using Apple DeviceCheck API');
    const jwtToken = generateDeviceCheckJWT();

    const response = await fetch('https://api.devicecheck.apple.com/v1/query_two_bits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_token: deviceToken,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeviceCheck query failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return {
      bit0: data.bit0 || false,
      bit1: data.bit1 || false,
      last_update_time: data.last_update_time
    };
  } catch (error) {
    Logger.error('DeviceCheck query failed', { error: (error as Error).message });
    throw error;
  }
}

// Update DeviceCheck two bits for a device
async function updateDeviceCheck(deviceToken: string, bits: { bit0?: boolean; bit1?: boolean }): Promise<void> {
  try {
    // Check if this is a fallback token (base64 encoded JSON from our React Native service)
    const isFallbackToken = isBase64FallbackToken(deviceToken);

    if (isFallbackToken) {
      Logger.info('Using fallback device check update (Firestore-based)');
      await updateFallbackDeviceCheck(deviceToken, bits);
      return;
    }

    Logger.info('Using Apple DeviceCheck API for update');
    const jwtToken = generateDeviceCheckJWT();

    const response = await fetch('https://api.devicecheck.apple.com/v1/update_two_bits', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        device_token: deviceToken,
        timestamp: Date.now(),
        bit0: bits.bit0,
        bit1: bits.bit1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DeviceCheck update failed: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    Logger.error('DeviceCheck update failed', { error: (error as Error).message });
    throw error;
  }
}

// Pre-flight check for user creation with DeviceCheck (HTTP function to avoid auth requirements)
export const checkDeviceForAccountCreation = onRequest({ cors: true, invoker: 'public' }, async (req, res) => {
  try {
    // Check if DeviceCheck feature is enabled
    const enableDeviceCheck = process.env.ENABLE_DEVICE_CHECK === 'true';
    if (!enableDeviceCheck) {
      Logger.info('DeviceCheck feature disabled - allowing account creation');
      res.status(200).json({
        data: {
          canCreateAccount: true,
          message: 'Device check disabled - proceeding with account creation'
        }
      });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const { deviceToken, email } = req.body.data || req.body;

    if (!deviceToken || !email) {
      res.status(400).json({
        error: {
          code: 'invalid-argument',
          message: 'deviceToken and email are required'
        }
      });
      return;
    }

    Logger.info('Checking device for account creation', { email });

    // Check if this device token already exists in our database
    try {
      const db = admin.firestore();
      const deviceDoc = await db.collection('device_tracking').doc(deviceToken).get();

      if (deviceDoc.exists && deviceDoc.data()?.hasCreatedAccount) {
        const deviceData = deviceDoc.data();

        // Check if there's an exception for deleted accounts with unsubscribed status
        if (await checkDeletedAccountException(deviceData, email)) {
          Logger.info('Device blocking exception: Previous account was deleted and unsubscribed - allowing new account creation', {
            email,
            deviceToken: deviceToken.substring(0, 20) + '...'
          });

          // Update device record to reflect the new account creation attempt
          await deviceDoc.ref.update({
            previousAccountDeleted: true,
            allowedNewAccountAt: admin.firestore.FieldValue.serverTimestamp(),
            newAccountEmail: email,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        } else {
          Logger.warn('Device has already created an account', { email, deviceToken: deviceToken.substring(0, 20) + '...' });
          res.status(400).json({
            error: {
              code: 'already-exists',
              message: 'This device has already been used to create an account. Please sign in with your existing account instead.'
            }
          });
          return;
        }
      } else {
        Logger.info('Device token not found in database - allowing account creation');
      }
    } catch (error) {
      Logger.error('Error checking device token in database', { error: (error as Error).message });
      // Don't block account creation if database check fails - allow as fallback
    }

    // Check if email already exists
    try {
      await admin.auth().getUserByEmail(email);
      res.status(400).json({
        error: {
          code: 'already-exists',
          message: 'An account with this email already exists'
        }
      });
      return;
    } catch (error) {
      // User doesn't exist, which is what we want
      if ((error as any).code !== 'auth/user-not-found') {
        Logger.error('Error checking email existence', { error: (error as Error).message });
        res.status(500).json({
          error: {
            code: 'internal',
            message: 'Failed to verify email availability'
          }
        });
        return;
      }
    }

    Logger.info('Device and email are eligible for account creation', { email });

    res.status(200).json({
      data: {
        success: true,
        canCreateAccount: true,
        message: 'Device is eligible for account creation'
      }
    });

  } catch (error) {
    Logger.error('Error checking device for account creation', { error: (error as Error).message });
    res.status(500).json({
      error: {
        code: 'internal',
        message: `Failed to check device eligibility: ${(error as Error).message}`
      }
    });
  }
});

// Complete account creation after Firebase Auth user is created
export const completeAccountCreation = onRequest({ cors: true, invoker: 'public' }, async (req: Request, res: Response) => {
  try {
    // Check if DeviceCheck feature is enabled
    const enableDeviceCheck = process.env.ENABLE_DEVICE_CHECK === 'true';
    if (!enableDeviceCheck) {
      Logger.info('DeviceCheck feature disabled - skipping device marking');
      res.status(200).json({
        data: {
          success: true,
          message: 'Device check disabled - account creation completed without device marking'
        }
      });
      return;
    }

    Logger.info('Complete account creation request received', {
      body: req.body,
      bodyData: req.body.data,
      method: req.method,
      headers: req.headers['content-type']
    });

    const requestBody = req.body.data || req.body;
    const { deviceToken } = requestBody;

    Logger.info('Extracting deviceToken', { requestBody, deviceToken });

    if (!deviceToken) {
      Logger.error('deviceToken is missing from request body', { body: req.body });
      res.status(400).json({ error: { message: 'deviceToken is required', status: 'INVALID_ARGUMENT' } });
      return;
    }

    Logger.info('Completing account creation with DeviceCheck');

    // Check if this is a fallback token (base64 encoded device info)
    const isFallbackToken = isBase64FallbackToken(deviceToken);

    if (isFallbackToken) {
      // For fallback tokens, mark device as used in Firestore
      try {
        const db = admin.firestore();
        const deviceRef = db.collection('device_tracking').doc(deviceToken);
        await deviceRef.set({
          hasCreatedAccount: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        });
        Logger.info('Fallback device marked as having created account');
      } catch (error) {
        Logger.warn('Failed to update fallback device tracking', { error: (error as Error).message });
      }
    } else {
      // For real DeviceCheck tokens, use Apple DeviceCheck API
      try {
        await updateDeviceCheck(deviceToken, { bit0: true });
        Logger.info('DeviceCheck updated - device marked as having created account');
      } catch (error) {
        Logger.warn('DeviceCheck update failed, but account creation continues', { error: (error as Error).message });
        // Don't fail account creation if DeviceCheck update fails
      }
    }

    res.json({
      data: {
        success: true,
        message: 'Account creation completed successfully'
      }
    });

  } catch (error) {
    Logger.error('Error completing account creation', { error: (error as Error).message });
    res.status(500).json({
      error: {
        message: `Failed to complete account creation: ${(error as Error).message}`,
        status: 'INTERNAL'
      }
    });
  }
});

// RevenueCat Event Handlers using Firebase Extensions EventArc
// Handle subscription lifecycle events from RevenueCat

// Handle new purchases and subscription starts
export const onRevenueCatPurchase = onCustomEventPublished(
  "com.revenuecat.v1.purchase",
  async (event) => {
    try {
      Logger.info('RevenueCat purchase event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in purchase event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'purchase');
      Logger.info('Successfully processed RevenueCat purchase event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat purchase event', { error: (error as Error).message });
    }
  }
);

// Handle subscription renewals
export const onRevenueCatRenewal = onCustomEventPublished(
  "com.revenuecat.v1.renewal",
  async (event) => {
    try {
      Logger.info('RevenueCat renewal event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in renewal event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'renewal');
      Logger.info('Successfully processed RevenueCat renewal event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat renewal event', { error: (error as Error).message });
    }
  }
);

// Handle subscription cancellations
export const onRevenueCatCancellation = onCustomEventPublished(
  "com.revenuecat.v1.cancellation",
  async (event) => {
    try {
      Logger.info('RevenueCat cancellation event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in cancellation event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'cancellation');
      Logger.info('Successfully processed RevenueCat cancellation event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat cancellation event', { error: (error as Error).message });
    }
  }
);

// Handle subscription expirations
export const onRevenueCatExpiration = onCustomEventPublished(
  "com.revenuecat.v1.expiration",
  async (event) => {
    try {
      Logger.info('RevenueCat expiration event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in expiration event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'expiration');
      Logger.info('Successfully processed RevenueCat expiration event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat expiration event', { error: (error as Error).message });
    }
  }
);

// Handle billing issues
export const onRevenueCatBillingIssue = onCustomEventPublished(
  "com.revenuecat.v1.billing_issue",
  async (event) => {
    try {
      Logger.info('RevenueCat billing issue event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in billing issue event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'billing_issue');
      Logger.info('Successfully processed RevenueCat billing issue event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat billing issue event', { error: (error as Error).message });
    }
  }
);

// Handle product changes (upgrades/downgrades)
export const onRevenueCatProductChange = onCustomEventPublished(
  "com.revenuecat.v1.product_change",
  async (event) => {
    try {
      Logger.info('RevenueCat product change event received', { eventId: event.id });
      
      const eventData = event.data;
      const userId = eventData?.app_user_id;
      
      if (!userId) {
        Logger.error('No app_user_id found in product change event', { eventData });
        return;
      }

      await handleRevenueCatSubscriptionChange(userId, eventData, 'product_change');
      Logger.info('Successfully processed RevenueCat product change event', { userId });
    } catch (error) {
      Logger.error('Error processing RevenueCat product change event', { error: (error as Error).message });
    }
  }
);

// Handle account transfers (when user creates account with existing subscription)
export const onRevenueCatTransfer = onCustomEventPublished(
  "com.revenuecat.v1.transfer",
  async (event) => {
    try {
      Logger.info('RevenueCat transfer event received', { eventId: event.id });
      
      const eventData = event.data;
      const newUserId = eventData?.app_user_id;
      const originalUserId = eventData?.origin_app_user_id;
      const transferredFrom = eventData?.transferred_from;
      const transferredTo = eventData?.transferred_to;
      
      if (!newUserId || !originalUserId) {
        Logger.error('Missing required user IDs in transfer event', { 
          newUserId, 
          originalUserId, 
          eventData 
        });
        return;
      }

      Logger.info('Processing account transfer', {
        from: originalUserId,
        to: newUserId,
        transferredFrom,
        transferredTo
      });

      await handleAccountTransfer(originalUserId, newUserId, eventData);
      Logger.info('Successfully processed RevenueCat transfer event', { 
        originalUserId, 
        newUserId 
      });
    } catch (error) {
      Logger.error('Error processing RevenueCat transfer event', { 
        error: (error as Error).message,
        stack: (error as Error).stack
      });
    }
  }
);

// Helper function to handle all RevenueCat subscription changes
async function handleRevenueCatSubscriptionChange(
  userId: string, 
  eventData: any, 
  eventType: string
): Promise<void> {
  try {
    Logger.info('Processing RevenueCat subscription change', { userId, eventType });

    // Log the event to the events collection for debugging and auditing
    await db.collection('events').add({
      type: 'revenuecat_webhook',
      subtype: eventType,
      userId,
      eventData,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'firebase_extension'
    });

    // Extract subscription information from the event
    const subscriber = eventData?.subscriber;
    if (!subscriber) {
      Logger.error('No subscriber data found in event', { eventData });
      return;
    }

    // Get the entitlements to determine the active subscription tier
    const entitlements = subscriber.entitlements || {};
    const subscriptions = subscriber.subscriptions || {};

    // Determine the current tier based on active entitlements
    let currentTier = 'trial'; // Default to trial if no active subscription
    let isActive = false;
    let subscriptionDetails: any = null;

    // Check for active entitlements (RevenueCat's recommended approach)
    for (const [entitlementId, entitlement] of Object.entries(entitlements)) {
      if (entitlement && (entitlement as any).expires_date) {
        const expiresDate = new Date((entitlement as any).expires_date);
        if (expiresDate > new Date()) {
          isActive = true;
          // Map entitlement to tier (you'll need to configure this based on your RevenueCat setup)
          currentTier = mapEntitlementToTier(entitlementId);
          break;
        }
      }
    }

    // Get subscription details for billing information
    for (const [, subscription] of Object.entries(subscriptions)) {
      if (subscription && (subscription as any).expires_date) {
        const expiresDate = new Date((subscription as any).expires_date);
        if (expiresDate > new Date()) {
          subscriptionDetails = subscription;
          break;
        }
      }
    }

    // Handle expiration and cancellation events
    if (eventType === 'expiration' || eventType === 'cancellation') {
      currentTier = 'trial';
      isActive = false;
    }

    // Handle billing issues
    if (eventType === 'billing_issue') {
      // Don't change the tier immediately, but mark the subscription as having billing issues
      Logger.warn('Billing issue detected for user', { userId });
      // You might want to send notifications or take other actions here
    }

    // Update the user's subscription document
    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();

    if (!subscriptionDoc.exists) {
      Logger.error('Subscription document not found for user', { userId });
      // Create a new subscription document
      const newSubscriptionDoc: SubscriptionDocument = {
        userId,
        currentTier: currentTier as any,
        status: isActive ? 'active' : 'canceled',
        billing: {
          customerId: eventData?.app_user_id || null,
          subscriptionId: subscriptionDetails?.original_purchase_date || null,
          priceId: subscriptionDetails?.product_identifier || null,
          currentPeriodStart: subscriptionDetails?.purchase_date ? new Date(subscriptionDetails.purchase_date) : new Date(),
          currentPeriodEnd: subscriptionDetails?.expires_date ? new Date(subscriptionDetails.expires_date) : null,
          cancelAtPeriodEnd: eventType === 'cancellation',
          trialEnd: subscriptionDetails?.trial_end ? new Date(subscriptionDetails.trial_end) : null,
        },
        limits: subscriptionTiers[currentTier].limits,
        features: subscriptionTiers[currentTier].features,
        history: [{
          tier: currentTier,
          startDate: new Date(),
          endDate: null,
          reason: `revenuecat_${eventType}`,
        }],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await subscriptionRef.set(newSubscriptionDoc);
    } else {
      // Update existing subscription
      const updateData: Partial<SubscriptionDocument> = {
        currentTier: currentTier as any,
        status: isActive ? 'active' : 'canceled',
        limits: subscriptionTiers[currentTier].limits,
        features: subscriptionTiers[currentTier].features,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Update billing information if available
      if (subscriptionDetails) {
        updateData.billing = {
          customerId: eventData?.app_user_id || null,
          subscriptionId: subscriptionDetails.original_purchase_date || null,
          priceId: subscriptionDetails.product_identifier || null,
          currentPeriodStart: subscriptionDetails.purchase_date ? new Date(subscriptionDetails.purchase_date) : new Date(),
          currentPeriodEnd: subscriptionDetails.expires_date ? new Date(subscriptionDetails.expires_date) : null,
          cancelAtPeriodEnd: eventType === 'cancellation',
          trialEnd: subscriptionDetails.trial_end ? new Date(subscriptionDetails.trial_end) : null,
        };
      }

      // Add to history
      const existingData = subscriptionDoc.data() as SubscriptionDocument;
      const updatedHistory = [...(existingData.history || []), {
        tier: currentTier,
        startDate: new Date(),
        endDate: eventType === 'expiration' || eventType === 'cancellation' ? new Date() : null,
        reason: `revenuecat_${eventType}`,
      }];
      updateData.history = updatedHistory;

      await subscriptionRef.update(updateData);
    }

    // Update user's usage limits for the current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageRef = db.collection('usage').doc(`${userId}_${currentMonth}`);
    
    await usageRef.set({
      limits: subscriptionTiers[currentTier].limits,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    Logger.info('Successfully updated subscription from RevenueCat event', { 
      userId, 
      eventType, 
      currentTier, 
      isActive 
    });

  } catch (error) {
    Logger.error('Error handling RevenueCat subscription change', { 
      error: (error as Error).message, 
      userId, 
      eventType 
    });
    throw error;
  }
}

// Helper function to handle account transfers from RevenueCat
async function handleAccountTransfer(
  originalUserId: string, 
  newUserId: string, 
  eventData: any
): Promise<void> {
  try {
    Logger.info('Starting account transfer process', { originalUserId, newUserId });

    // Use a batch for atomic operations
    const batch = db.batch();
    const transferErrors: string[] = [];

    // Log the transfer event for auditing
    await db.collection('events').add({
      type: 'account_transfer',
      originalUserId,
      newUserId,
      eventData,
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: 'revenuecat_transfer'
    });

    // 1. Transfer Subscription Data
    try {
      const originalSubscriptionRef = db.collection('subscriptions').doc(originalUserId);
      const originalSubscriptionDoc = await originalSubscriptionRef.get();
      
      if (originalSubscriptionDoc.exists) {
        const subscriptionData = originalSubscriptionDoc.data() as SubscriptionDocument;
        
        // Update the subscription to point to the new user
        const newSubscriptionRef = db.collection('subscriptions').doc(newUserId);
        const transferredSubscription: SubscriptionDocument = {
          ...subscriptionData,
          userId: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          history: [
            ...(subscriptionData.history || []),
            {
              tier: subscriptionData.currentTier,
              startDate: new Date(),
              endDate: null,
              reason: 'account_transfer'
            }
          ]
        };

        batch.set(newSubscriptionRef, transferredSubscription);
        
        // Archive the original subscription
        batch.update(originalSubscriptionRef, {
          status: 'transferred',
          transferredTo: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        Logger.info('Subscription transfer prepared', { originalUserId, newUserId });
      }
    } catch (error) {
      transferErrors.push(`Subscription transfer failed: ${(error as Error).message}`);
    }

    // 2. Transfer All Receipts
    try {
      const receiptsSnapshot = await db.collection('receipts')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${receiptsSnapshot.size} receipts to transfer`);
      
      for (const receiptDoc of receiptsSnapshot.docs) {
        const receiptData = receiptDoc.data();
        const newReceiptRef = db.collection('receipts').doc(); // New document ID
        
        batch.set(newReceiptRef, {
          ...receiptData,
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Mark original receipt as transferred
        batch.update(receiptDoc.ref, {
          status: 'transferred',
          transferredTo: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Receipts transfer failed: ${(error as Error).message}`);
    }

    // 3. Transfer Team Memberships (as team owner)
    try {
      const teamMembershipsSnapshot = await db.collection('teamMemberships')
        .where('ownerId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${teamMembershipsSnapshot.size} team memberships to transfer`);
      
      for (const membershipDoc of teamMembershipsSnapshot.docs) {
        batch.update(membershipDoc.ref, {
          ownerId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Team memberships transfer failed: ${(error as Error).message}`);
    }

    // 4. Transfer Team Members (where user is a member)
    try {
      const teamMembersSnapshot = await db.collection('teamMembers')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${teamMembersSnapshot.size} team member records to transfer`);
      
      for (const memberDoc of teamMembersSnapshot.docs) {
        batch.update(memberDoc.ref, {
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Team members transfer failed: ${(error as Error).message}`);
    }

    // 5. Transfer Usage Data
    try {
      const usageSnapshot = await db.collection('usage')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${usageSnapshot.size} usage records to transfer`);
      
      for (const usageDoc of usageSnapshot.docs) {
        const usageData = usageDoc.data();
        // Create new usage document with updated userId pattern
        const newUsageId = usageDoc.id.replace(originalUserId, newUserId);
        const newUsageRef = db.collection('usage').doc(newUsageId);
        
        batch.set(newUsageRef, {
          ...usageData,
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Mark original as transferred
        batch.update(usageDoc.ref, {
          status: 'transferred',
          transferredTo: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Usage data transfer failed: ${(error as Error).message}`);
    }

    // 6. Transfer Business Stats
    try {
      const businessStatsSnapshot = await db.collection('businessStats')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${businessStatsSnapshot.size} business stats records to transfer`);
      
      for (const statsDoc of businessStatsSnapshot.docs) {
        const statsData = statsDoc.data();
        const newStatsRef = db.collection('businessStats').doc();
        
        batch.set(newStatsRef, {
          ...statsData,
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Mark original as transferred
        batch.update(statsDoc.ref, {
          status: 'transferred',
          transferredTo: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Business stats transfer failed: ${(error as Error).message}`);
    }

    // 7. Transfer Bank Connections
    try {
      const bankConnectionsSnapshot = await db.collection('bankConnections')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${bankConnectionsSnapshot.size} bank connections to transfer`);
      
      for (const connectionDoc of bankConnectionsSnapshot.docs) {
        batch.update(connectionDoc.ref, {
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Bank connections transfer failed: ${(error as Error).message}`);
    }

    // 8. Transfer User Preferences/Settings
    try {
      const userPrefsSnapshot = await db.collection('userPreferences')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${userPrefsSnapshot.size} user preference records to transfer`);
      
      for (const prefsDoc of userPrefsSnapshot.docs) {
        const prefsData = prefsDoc.data();
        const newPrefsRef = db.collection('userPreferences').doc(newUserId);
        
        batch.set(newPrefsRef, {
          ...prefsData,
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        // Mark original as transferred
        batch.update(prefsDoc.ref, {
          status: 'transferred',
          transferredTo: newUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`User preferences transfer failed: ${(error as Error).message}`);
    }

    // 9. Transfer Notification Settings
    try {
      const notificationSettingsSnapshot = await db.collection('notificationSettings')
        .where('userId', '==', originalUserId)
        .get();
      
      Logger.info(`Found ${notificationSettingsSnapshot.size} notification settings to transfer`);
      
      for (const settingsDoc of notificationSettingsSnapshot.docs) {
        batch.update(settingsDoc.ref, {
          userId: newUserId,
          transferredFrom: originalUserId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (error) {
      transferErrors.push(`Notification settings transfer failed: ${(error as Error).message}`);
    }

    // Commit all the batch operations
    await batch.commit();
    
    // Log the completion
    if (transferErrors.length > 0) {
      Logger.warn('Account transfer completed with some errors', {
        originalUserId,
        newUserId,
        errors: transferErrors
      });
    } else {
      Logger.info('Account transfer completed successfully', {
        originalUserId,
        newUserId
      });
    }

    // Send notification to the new user about the successful transfer
    try {
      await db.collection('notifications').add({
        userId: newUserId,
        type: 'account_transfer_complete',
        title: 'Account Transfer Complete',
        message: 'Your subscription and data have been successfully transferred to your new account.',
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error) {
      Logger.warn('Failed to create transfer notification', { error: (error as Error).message });
    }

  } catch (error) {
    Logger.error('Critical error during account transfer', {
      error: (error as Error).message,
      stack: (error as Error).stack,
      originalUserId,
      newUserId
    });
    throw error;
  }
}

// Helper function to recover soft deleted account data
async function recoverSoftDeletedAccount(
  originalUserId: string,
  newUserId: string,
  email: string
): Promise<void> {
  try {
    Logger.info('Starting account recovery process', { originalUserId, newUserId, email });

    const batch = db.batch();

    // 1. Recover user document
    const originalUserRef = db.collection('users').doc(originalUserId);
    const originalUserDoc = await originalUserRef.get();
    
    if (originalUserDoc.exists) {
      const userData = originalUserDoc.data();
      if (userData?.originalData) {
        // Restore original user data with new userId
        const newUserRef = db.collection('users').doc(newUserId);
        batch.set(newUserRef, {
          ...userData.originalData,
          userId: newUserId,
          email: email,
          status: 'active',
          recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          recoveredFrom: originalUserId
        });
      }
    }

    // 2. Recover subscription
    const originalSubscriptionRef = db.collection('subscriptions').doc(originalUserId);
    const originalSubscriptionDoc = await originalSubscriptionRef.get();
    
    if (originalSubscriptionDoc.exists) {
      const subscriptionData = originalSubscriptionDoc.data();
      if (subscriptionData?.originalData) {
        const newSubscriptionRef = db.collection('subscriptions').doc(newUserId);
        batch.set(newSubscriptionRef, {
          ...subscriptionData.originalData,
          userId: newUserId,
          status: 'active',
          recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          recoveredFrom: originalUserId
        });
      }
    }

    // 3. Recover receipts
    const receiptsSnapshot = await db.collection('receipts')
      .where('userId', '==', originalUserId)
      .where('status', '==', 'soft_deleted')
      .get();

    receiptsSnapshot.forEach((doc) => {
      batch.update(doc.ref, {
        userId: newUserId,
        status: 'active',
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        recoveredFrom: originalUserId
      });
    });

    // 4. Recover other collections
    const collectionsToRecover = [
      'businesses', 'reports', 'usage', 'teamMembers', 
      'bankConnections', 'customCategories', 'budgets'
    ];

    for (const collectionName of collectionsToRecover) {
      const snapshot = await db.collection(collectionName)
        .where('userId', '==', originalUserId)
        .where('status', '==', 'soft_deleted')
        .get();

      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          userId: newUserId,
          status: 'active',
          recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          recoveredFrom: originalUserId
        });
      });
    }

    await batch.commit();
    Logger.info('Successfully recovered account data', { originalUserId, newUserId });

  } catch (error) {
    Logger.error('Error recovering soft deleted account', {
      error: (error as Error).message,
      originalUserId,
      newUserId
    });
    throw error;
  }
}

// Helper function to check and restore RevenueCat subscription
async function checkAndRestoreRevenueCatSubscription(
  userId: string,
  email: string
): Promise<void> {
  try {
    Logger.info('Checking for RevenueCat subscription recovery', { userId, email });

    const revenueCatApiKey = process.env.REVENUECAT_API_KEY;
    if (!revenueCatApiKey) {
      Logger.warn('RevenueCat API key not configured, skipping subscription check');
      return;
    }

    // Try to find user by email in RevenueCat
    // Note: RevenueCat doesn't have a direct email lookup, so we'll need to use other methods
    // This is a simplified approach - in production you might want to:
    // 1. Store email -> RevenueCat user ID mapping
    // 2. Use RevenueCat's subscriber attributes to search
    // 3. Use your own database to track this relationship

    // For now, we'll check if there's a subscription record in our deleted accounts
    const deletedAccountsSnapshot = await db.collection('deletedAccounts')
      .where('email', '==', email.toLowerCase())
      .where('hasActiveSubscription', '==', true)
      .orderBy('deletedAt', 'desc')
      .limit(1)
      .get();

    if (!deletedAccountsSnapshot.empty) {
      const deletedAccount = deletedAccountsSnapshot.docs[0];
      const deletedAccountData = deletedAccount.data();

      if (deletedAccountData.subscriptionInfo) {
        Logger.info('Found previous subscription info, restoring', { userId });

        // Create subscription document for new user
        await db.collection('subscriptions').doc(userId).set({
          userId,
          currentTier: deletedAccountData.subscriptionInfo.currentTier || 'trial',
          status: 'active', // We'll let RevenueCat webhooks update this if needed
          billing: deletedAccountData.subscriptionInfo.billing || null,
          limits: deletedAccountData.subscriptionInfo.limits || subscriptionTiers['trial'].limits,
          features: deletedAccountData.subscriptionInfo.features || subscriptionTiers['trial'].features,
          history: [{
            tier: deletedAccountData.subscriptionInfo.currentTier || 'trial',
            startDate: new Date(),
            endDate: null,
            reason: 'account_recovery'
          }],
          recoveredFrom: deletedAccountData.userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Mark the deleted account as recovered
        await deletedAccount.ref.update({
          status: 'recovered',
          recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
          newUserId: userId,
          recoverable: false,
          recoveryType: 'subscription_only'
        });

        Logger.info('Successfully restored subscription from previous account', { 
          userId, 
          tier: deletedAccountData.subscriptionInfo.currentTier 
        });
      }
    }

  } catch (error) {
    Logger.error('Error checking RevenueCat subscription recovery', {
      error: (error as Error).message,
      userId,
      email
    });
    // Don't throw - this is not critical for user creation
  }
}

// Helper function to map RevenueCat entitlements to your app's tiers
function mapEntitlementToTier(entitlementId: string): string {
  // Configure this mapping based on your RevenueCat entitlement setup
  const entitlementToTierMap: Record<string, string> = {
    'starter': 'starter',
    'growth': 'growth', 
    'professional': 'professional',
    'pro': 'professional',
    'premium': 'professional',
    // Add your specific entitlement identifiers here
  };

  const tier = entitlementToTierMap[entitlementId.toLowerCase()];
  if (tier) {
    return tier;
  }

  Logger.warn(`Unknown entitlement ID: ${entitlementId}, defaulting to trial tier`);
  return 'trial'; // Default to trial if unknown
}

// Helper function to manually mark recovered accounts (useful for fixing existing data)
export const markRecoveredAccounts = onCall(
  {
    region: 'us-central1',
    invoker: 'private'
  },
  async (request: CallableRequest<{ email: string; newUserId: string }>) => {
    try {
      const { email, newUserId } = request.data;
      
      if (!email || !newUserId) {
        throw new Error('Email and newUserId are required');
      }

      Logger.info('Manually marking deleted account as recovered', { email, newUserId });

      // Find the deleted account for this email
      const deletedAccountQuery = await db.collection('deletedAccounts')
        .where('email', '==', email.toLowerCase())
        .where('status', '==', 'soft_deleted')
        .limit(1)
        .get();

      if (deletedAccountQuery.empty) {
        throw new Error(`No soft-deleted account found for email: ${email}`);
      }

      const deletedAccount = deletedAccountQuery.docs[0];
      
      // Update the deleted account record
      await deletedAccount.ref.update({
        status: 'recovered',
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        newUserId: newUserId,
        recoverable: false,
        recoveryType: 'manual_update'
      });

      Logger.info('Successfully marked account as recovered', { email, newUserId });
      
      return {
        success: true,
        message: `Account for ${email} marked as recovered`,
        deletedAccountId: deletedAccount.id
      };

    } catch (error) {
      Logger.error('Error marking account as recovered', { 
        error: (error as Error).message 
      });
      throw new Error(`Failed to mark account as recovered: ${(error as Error).message}`);
    }
  }
);

// Scheduled function to permanently delete accounts after 30-day recovery period
export const cleanupExpiredSoftDeletedAccounts = functionsV1.pubsub
  .schedule('every 24 hours')
  .timeZone('UTC')
  .onRun(async (context) => {
    try {
      Logger.info('Starting cleanup of expired soft deleted accounts');

      const now = admin.firestore.Timestamp.now();
      
      // Find accounts that have passed their permanent deletion date
      const expiredAccountsSnapshot = await db.collection('deletedAccounts')
        .where('status', '==', 'soft_deleted')
        .where('permanentDeletionDate', '<=', now)
        .limit(100) // Process in batches
        .get();

      if (expiredAccountsSnapshot.empty) {
        Logger.info('No expired accounts to cleanup');
        return null;
      }

      Logger.info(`Found ${expiredAccountsSnapshot.size} expired accounts to permanently delete`);

      for (const deletedAccountDoc of expiredAccountsSnapshot.docs) {
        const deletedAccountData = deletedAccountDoc.data();
        const userId = deletedAccountData.userId;

        try {
          await permanentlyDeleteUserData(userId);
          
          // Update the deleted account record
          await deletedAccountDoc.ref.update({
            status: 'permanently_deleted',
            permanentlyDeletedAt: admin.firestore.FieldValue.serverTimestamp()
          });

          Logger.info(`Successfully permanently deleted account: ${userId}`);
        } catch (error) {
          Logger.error(`Failed to permanently delete account: ${userId}`, {
            error: (error as Error).message
          });
        }
      }

      Logger.info('Cleanup of expired soft deleted accounts completed');
      return null;
    } catch (error) {
      Logger.error('Error in cleanup function', { error: (error as Error).message });
      throw error;
    }
  });

// Helper function to permanently delete user data
async function permanentlyDeleteUserData(userId: string): Promise<void> {
  try {
    Logger.info(`Starting permanent deletion for user: ${userId}`);

    const collectionsToDelete = [
      'users', 'receipts', 'businesses', 'subscriptions', 'customCategories',
      'bankConnections', 'teamMembers', 'notifications', 'userSettings',
      'usage', 'reports', 'budgets', 'user_notifications', 'connection_notifications',
      'teamInvitations', 'transactionCandidates', 'generatedReceipts',
      'candidateStatus', 'plaid_items'
    ];

    const batch = db.batch();
    let deletionCount = 0;

    for (const collectionName of collectionsToDelete) {
      try {
        // Query for documents where userId matches
        const userDocsQuery = db.collection(collectionName)
          .where('userId', '==', userId)
          .limit(500);

        const userDocsSnapshot = await userDocsQuery.get();

        userDocsSnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          deletionCount++;
        });

        // Also check for accountHolderId field (for team-related data)
        if (['receipts', 'businesses', 'customCategories', 'teamMembers'].includes(collectionName)) {
          const accountHolderDocsQuery = db.collection(collectionName)
            .where('accountHolderId', '==', userId)
            .limit(500);

          const accountHolderDocsSnapshot = await accountHolderDocsQuery.get();

          accountHolderDocsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletionCount++;
          });
        }

        // Handle documents with specific patterns (like usage documents)
        if (collectionName === 'usage') {
          const usageQuery = db.collection(collectionName)
            .where(admin.firestore.FieldPath.documentId(), '>=', userId)
            .where(admin.firestore.FieldPath.documentId(), '<', userId + '\uf8ff')
            .limit(500);

          const usageSnapshot = await usageQuery.get();

          usageSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            deletionCount++;
          });
        }

      } catch (error) {
        Logger.warn(`Error querying collection ${collectionName} for permanent deletion`, {
          error: (error as Error).message,
          userId
        });
      }
    }

    if (deletionCount > 0) {
      await batch.commit();
      Logger.info(`Permanently deleted ${deletionCount} documents for user ${userId}`);
    }

  } catch (error) {
    Logger.error('Error permanently deleting user data', {
      error: (error as Error).message,
      userId
    });
    throw error;
  }
}

// 1. User Creation Trigger (updated for Firebase Functions v6)
export const onUserCreate = functionsV1.auth.user().onCreate(async (user: admin.auth.UserRecord) => {
  try {
    const userId: string = user.uid;
    const email: string = user.email || '';
    const displayName: string = user.displayName || '';

    Logger.info('New user created, checking for account recovery', { userId, email });

    // Check if this email has a soft-deleted account that can be recovered
    const deletedAccountQuery = await db.collection("deletedAccounts")
      .where("email", "==", email.toLowerCase())
      .where("status", "==", "soft_deleted")
      .where("recoverable", "==", true)
      .where("permanentDeletionDate", ">", admin.firestore.Timestamp.now())
      .limit(1)
      .get();

    if (!deletedAccountQuery.empty) {
      const deletedAccount = deletedAccountQuery.docs[0];
      const deletedAccountData = deletedAccount.data();
      const originalUserId = deletedAccountData.userId;

      Logger.info('Found recoverable deleted account, initiating recovery', { 
        originalUserId, 
        newUserId: userId, 
        email 
      });

      await recoverSoftDeletedAccount(originalUserId, userId, email);
      
      // Mark the deleted account record as recovered
      await deletedAccount.ref.update({
        status: 'recovered',
        recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
        newUserId: userId,
        recoverable: false
      });

      Logger.info('Account recovery completed successfully', { originalUserId, newUserId: userId });
      return; // Exit early since we've recovered the account
    }

    // Check for active RevenueCat subscription for this email
    await checkAndRestoreRevenueCatSubscription(userId, email);

    // Create user document
    const userDoc: UserProfile = {
      userId,
      email,
      displayName,
      createdAt: admin.firestore.Timestamp.now(),
      lastLoginAt: admin.firestore.Timestamp.now(),
      profile: {
        firstName: displayName.split(" ")[0] || "",
        lastName: displayName.split(" ").slice(1).join(" ") || "",
        businessName: "",
        businessType: "Sole Proprietorship",
        taxId: "",
        phone: "",
        address: {
          street: "",
          city: "",
          state: "",
          zipCode: "",
          country: "US",
        },
      },
      settings: {
        theme: "light",
        notifications: {
          email: true,
          push: true,
          taxReminders: true,
          receiptReminders: true,
        },
        defaultCurrency: "USD",
        taxYear: new Date().getFullYear(),
      },
    };

    await db.collection("users").doc(userId).set(userDoc);

    // Check if this user has a team invitation (pending OR recently accepted)
    Logger.debug('Checking for team invitations for email', { email, emailLowercase: email.toLowerCase() }, userId);

    const teamInvitationsQuery = await db.collection("teamInvitations")
      .where("inviteEmail", "==", email.toLowerCase())
      .where("status", "in", ["pending", "accepted"])
      .limit(1)
      .get();

    const isTeamMember = !teamInvitationsQuery.empty;

    Logger.debug('Team invitation query result', { foundInvitations: teamInvitationsQuery.size }, userId);

    // Debug: Let's also check ALL invitations for this email (regardless of status)
    const allInvitationsQuery = await db.collection("teamInvitations")
      .where("inviteEmail", "==", email.toLowerCase())
      .limit(10)
      .get();

    Logger.debug('Found total invitations for email', { totalInvitations: allInvitationsQuery.size, email: email.toLowerCase() }, userId);
    allInvitationsQuery.docs.forEach((doc, index) => {
      const invitation = doc.data();
      Logger.debug(`Debug invitation ${index + 1}`, {
        id: doc.id,
        inviteEmail: invitation.inviteEmail,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        isExpired: invitation.expiresAt ? new Date() > invitation.expiresAt.toDate() : 'no expiry',
        accountHolderId: invitation.accountHolderId,
        businessName: invitation.businessName,
        createdAt: invitation.createdAt
      }, userId);
    });

    if (!teamInvitationsQuery.empty) {
      const invitation = teamInvitationsQuery.docs[0].data();
      Logger.info('Found matching team invitation', {
        inviteEmail: invitation.inviteEmail,
        status: invitation.status,
        accountHolderId: invitation.accountHolderId,
        businessName: invitation.businessName
      }, userId);
    }
    Logger.debug('isTeamMember determined', { isTeamMember }, userId);
    const now = admin.firestore.Timestamp.now();

    if (isTeamMember) {
      // Team members do NOT get their own subscription documents
      // They inherit subscription from their account holder via SubscriptionContext
      Logger.info('Skipping subscription creation for team member - will inherit from account holder', { email }, userId);

      // Create usage document for tracking purposes
      const usageDoc: UsageDocument = {
        userId,
        month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        receiptsUploaded: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: subscriptionTiers.teammate.limits,
        resetDate: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
        createdAt: now,
        updatedAt: now,
      };
      await db.collection("usage").doc(`${userId}_${usageDoc.month}`).set(usageDoc);

      Logger.info('User account created successfully for team member', { email }, userId);
      return; // Early return for team members - no subscription document needed
    }

    // Only create subscription documents for account holders (non-team members)
    // No trial subscription - user will start trial via App Store
    Logger.info('Account holder created - subscription will be created via RevenueCat webhook', { email }, userId);

    // Note: No subscription document or usage document created here
    // These will be created when user starts trial via RevenueCat webhook

    Logger.info('User account created successfully', { email }, userId);
  } catch (error) {
    Logger.error('Error creating user documents', { error: (error as Error) });
    throw error;
  }
});

// 2. Receipt Upload Trigger (updated for Firebase Functions v6)
export const onReceiptCreate = functionsV1.firestore
  .document("receipts/{receiptId}")
  .onCreate(async (snap, context) => {
    try {
      const receiptData = snap.data() as ReceiptData;
      const userId: string = receiptData.userId;
      const currentMonth: string = new Date().toISOString().slice(0, 7);

      // Get user's subscription to check limits
      const subscriptionDoc = await db
        .collection("subscriptions")
        .doc(userId)
        .get();

      if (!subscriptionDoc.exists) {
        throw new Error(`Subscription not found for user ${userId}`);
      }

      const subscription = subscriptionDoc.data() as SubscriptionDocument;

      // Ensure limits are correctly set based on current tier
      const currentTier = subscription.currentTier;
      subscription.limits = subscriptionTiers[currentTier].limits;

      // Get current usage
      const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
      const usageDoc = await usageRef.get();

      if (!usageDoc.exists) {
        // Create usage document if it doesn't exist
        const newUsageDoc: UsageDocument = {
          userId,
          month: currentMonth,
          receiptsUploaded: 1,
          apiCalls: 0,
          reportsGenerated: 0,
          limits: subscription.limits,
          resetDate: new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            1
          ).toISOString(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await usageRef.set(newUsageDoc);
      } else {
        const usage = usageDoc.data() as UsageDocument;
        const newReceiptCount: number = usage.receiptsUploaded + 1;
        Logger.debug('New receipt count', { newReceiptCount }, userId);

        // TEMPORARILY DISABLED - Fix counting logic inconsistency
        // The app and Cloud Function use different counting methods
        // Check if user has reached their limit
        // console.log("🚀 ~ newReceiptCount subscription.limits.maxReceipts:", subscription.limits.maxReceipts)
        // if (
        //   subscription.limits.maxReceipts !== -1 &&
        //   newReceiptCount > subscription.limits.maxReceipts
        // ) {
        //   // Delete the receipt and throw error
        //   await snap.ref.delete();
        //   throw new Error(
        //     `Receipt limit exceeded. Current plan allows ${subscription.limits.maxReceipts} receipts per month.`
        //   );
        // }

        Logger.warn('Limit checking temporarily disabled - App handles limits client-side', {}, userId);

        // Update usage count
        await usageRef.update({
          receiptsUploaded: newReceiptCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Process receipt for OCR
      await processReceiptOCR(snap.ref, receiptData);
    } catch (error) {
      Logger.error('Error processing receipt creation', { error: (error as Error) });

      // Update receipt status to error
      await snap.ref.update({
        status: "error",
        processingErrors: [(error as Error).message],
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      throw error;
    }
  });

// Helper function for OCR processing (keeping your existing implementation)
async function processReceiptOCR(
  receiptRef: admin.firestore.DocumentReference,
  receiptData: ReceiptData
): Promise<void> {
  try {
    // Update status to processing
    await receiptRef.update({
      status: "processing",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Here you would integrate with your OCR service
    // For now, we'll simulate processing

    // Simulate OCR processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Update with processed data
    const extractedData = {
      vendor: receiptData.vendor || "Unknown",
      amount: receiptData.amount || 0,
      tax: (receiptData.amount || 0) * 0.08, // Estimate 8% tax
      date: receiptData.date || new Date().toISOString().split("T")[0],
      confidence: 0.95,
      items: [
        {
          description: receiptData.description || "Item",
          amount: receiptData.amount || 0,
          quantity: 1,
        },
      ],
      splitTender: receiptData.splitTender || null, // Include split-tender data if available
    };

    await receiptRef.update({
      status: "processed",
      extractedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    Logger.error('OCR processing error', { error: (error as Error) });
    throw error;
  }
}

// OPTIMIZATION: onSubscriptionChange trigger removed - logic merged into updateSubscriptionAfterPayment
// This eliminates the redundant Cloud Function trigger and improves performance by ~100ms

/* COMMENTED OUT - Using RevenueCat instead of Stripe

// Interface to handle Firebase Functions v2 rawBody
interface RequestWithRawBody extends Request {
  rawBody: Buffer;
}

// UPDATED Stripe Webhook Handler with proper raw body handling
export const stripeWebhook = onRequest(
  {
    // Explicitly disable body parsing to get raw body
    cors: false,
    // Set memory and timeout if needed
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (req: Request, res: Response) => {
    Logger.info('Stripe webhook received');
    Logger.debug('Stripe webhook request details', {
      method: req.method,
      contentType: req.headers["content-type"],
      hasStripeSignature: !!req.headers["stripe-signature"]
    });

    // Only allow POST requests
    if (req.method !== "POST") {
      Logger.error('Invalid method for Stripe webhook', { method: req.method });
      res.status(405).send("Method not allowed");
      return;
    }

    const sig = req.headers["stripe-signature"] as string;

    if (!sig) {
      Logger.error('No Stripe signature found in request headers', {});
      res.status(400).send("No Stripe signature found");
      return;
    }

    // Get webhook secret using environment-aware approach
    let webhookSecret: string;
    try {
      const config = getStripeConfig();
      webhookSecret = config.webhookSecret;
      Logger.debug('Webhook secret loaded successfully', {});
    } catch (error) {
      Logger.error('Stripe configuration error', { error: (error as Error) });
      res.status(500).send("Stripe configuration error");
      return;
    }

    let event: Stripe.Event;
    let payload: string | Buffer = ""; // Initialize payload to avoid use-before-assignment

    try {
      // Firebase Functions v2 provides rawBody on the request object
      const requestWithRawBody = req as RequestWithRawBody;

      if (requestWithRawBody.rawBody) {
        // Use the raw body provided by Firebase
        payload = requestWithRawBody.rawBody;
        Logger.debug('Using rawBody from Firebase Functions', {});
      } else if (typeof req.body === "string") {
        // If body is already a string, use it directly
        payload = req.body;
        Logger.debug('Using string body', {});
      } else if (Buffer.isBuffer(req.body)) {
        // If body is a Buffer, use it directly
        payload = req.body;
        Logger.debug('Using Buffer body', {});
      } else {
        // Last resort: stringify the body (not ideal for signatures)
        payload = JSON.stringify(req.body);
        Logger.warn('Using stringified body (may cause signature issues)', {});
      }

      Logger.debug('Payload details', { payloadType: typeof payload, payloadLength: payload.length });

      // Construct the Stripe event
      event = getStripe().webhooks.constructEvent(payload, sig, webhookSecret);
      Logger.info('Webhook signature verified', { eventType: event.type, eventId: event.id });
    } catch (err) {
      const error = err as Error;
      // Ensure payload is defined for error logging
      const safePayload = typeof payload !== "undefined" ? payload : "";
      Logger.error('Webhook signature verification failed', { error: (error as Error) });
      Logger.error('Webhook error details', {
        message: error.message,
        payloadType: typeof safePayload,
        payloadPreview: safePayload?.toString().substring(0, 100),
        signature: sig.substring(0, 20) + "...",
      });
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    try {
      Logger.info('Processing Stripe event', { eventType: event.type });

      switch (event.type) {
        case "customer.subscription.created":
          await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
          Logger.info('Handled subscription event', { eventType: event.type, subscriptionId: (event.data.object as Stripe.Subscription).id });
          break;

        case "checkout.session.completed":
          const session = event.data.object as Stripe.Checkout.Session;
          Logger.info('Processing checkout completion', { sessionId: session.id });

          if (session.subscription) {
            // Retrieve the full subscription object
            const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
            await handleSubscriptionCreated(subscription);
            Logger.info('Handled checkout completion', { subscriptionId: subscription.id });
          } else {
            Logger.info('Checkout session completed but no subscription found', {});
          }
          break;

        case "payment_intent.succeeded":

          Logger.info('Payment succeeded for PaymentIntent: ${paymentIntent.id}', {});
          // Handle one-time payments here if needed
          break;

        case "customer.subscription.updated":
          await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
          Logger.info('Handled subscription event', { eventType: event.type, subscriptionId: (event.data.object as Stripe.Subscription).id });
          break;

        case "customer.subscription.deleted":
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          Logger.info('Handled subscription event', { eventType: event.type, subscriptionId: (event.data.object as Stripe.Subscription).id });
          break;

        case "invoice.payment_succeeded":
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          Logger.info('Handled ${event.type} for invoice: ${(event.data.object as Stripe.Invoice).id}', {});
          break;

        case "invoice.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          Logger.info('Handled ${event.type} for invoice: ${(event.data.object as Stripe.Invoice).id}', {});
          break;

        case "customer.subscription.trial_will_end":
          // Handle trial ending warning

          Logger.info('Trial ending soon for subscription: ${trialSub.id}', {});
          // You can add email notifications here
          break;

        default:
          Logger.info('Unhandled event type: ${event.type}', {});
      }

      // Always respond with 200 to acknowledge receipt
      res.status(200).json({
        received: true,
        eventType: event.type,
        eventId: event.id,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      Logger.error('❌ Error processing webhook:', { error: (error as Error) });

      // Log the full error for debugging
      if (error instanceof Error) {
        Logger.error('Error details', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
      }

      // Still respond with 200 to prevent Stripe retries for application errors
      // unless it's a critical error that should be retried
      res.status(200).json({
        received: true,
        error: "Processing failed",
        eventType: event.type,
        eventId: event.id,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Enhanced subscription created handler with better error handling
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  try {
    const customerId: string = subscription.customer as string;
    console.log(`Processing subscription created: ${subscription.id} for customer: ${customerId}`);

    // Retrieve customer with error handling
    let customer: Stripe.Customer;
    try {
      const customerObject = await getStripe().customers.retrieve(customerId);
      if ('deleted' in customerObject && customerObject.deleted) {
        throw new Error(`Customer ${customerId} has been deleted`);
      }
      customer = customerObject as Stripe.Customer;
    } catch (error) {
      console.error(`Failed to retrieve customer ${customerId}:`, error);
      throw new Error(`Customer retrieval failed: ${error}`);
    }

    const userId: string | undefined = customer.metadata?.userId;

    if (!userId) {
      Logger.error('No userId found in customer metadata for customer:', { error: customerId });
      Logger.error('Customer metadata:', { error: customer.metadata.message });
      throw new Error(`No userId in customer metadata for ${customerId}`);
    }

    console.log(`Processing subscription for user: ${userId}`);

    // Validate subscription has items
    if (!subscription.items || !subscription.items.data || subscription.items.data.length === 0) {
      throw new Error(`Subscription ${subscription.id} has no items`);
    }

    // Get the price ID
    const priceId = subscription.items.data[0].price.id;
    console.log(`Subscription price ID: ${priceId}`);

    // Determine tier from price ID with validation
    const tier: string = getTierFromPriceId(priceId);

    if (!subscriptionTiers[tier]) {
      console.error(`Invalid tier determined: ${tier} for price ID: ${priceId}`);
      throw new Error(`Invalid subscription tier: ${tier}`);
    }

    console.log(`Determined subscription tier: ${tier}`);

    // Prepare subscription update
    const subscriptionUpdate = {
      userId,
      currentTier: tier,
      status: subscription.status,
      billing: {
        customerId: customerId,
        subscriptionId: subscription.id,
        priceId: priceId,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        trialEnd: subscription.trial_end
          ? new Date(subscription.trial_end * 1000)
          : null,
      },
      limits: subscriptionTiers[tier].limits,
      features: subscriptionTiers[tier].features,
      history: admin.firestore.FieldValue.arrayUnion({
        tier: tier,
        startDate: new Date(),
        endDate: null,
        reason: "subscription_created"
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    Logger.info('Saving subscription data for user', { value: userId });

    // Save to Firestore with transaction for consistency
    await db.runTransaction(async (transaction) => {
      const subscriptionRef = db.collection("subscriptions").doc(userId);
      const doc = await transaction.get(subscriptionRef);

      if (doc.exists) {
        // Update existing subscription
        transaction.update(subscriptionRef, subscriptionUpdate);
        console.log(`Updated existing subscription for user ${userId}`);
      } else {
        // Create new subscription document
        transaction.set(subscriptionRef, {
          ...subscriptionUpdate,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Created new subscription for user ${userId}`);
      }

      // Also create/update the user's usage document for current month
      const currentMonth: string = new Date().toISOString().slice(0, 7);
      const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);

      // Use set with merge to create document if it doesn't exist
      transaction.set(usageRef, {
        userId,
        month: currentMonth,
        receiptsUploaded: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: subscriptionTiers[tier].limits,
        resetDate: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1
        ).toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    Logger.info('Successfully processed subscription creation for user ${userId}', {});

  } catch (error) {
    Logger.error('Error in handleSubscriptionCreated:', { error: (error as Error) });
    // Re-throw to trigger webhook retry if it's a transient error
    throw error;
  }
}

*/

// PLAID WEBHOOK HANDLER
export const plaidWebhook = onRequest(
  {
    cors: false,
    memory: "1GiB",
    timeoutSeconds: 540,
  },
  async (req: Request, res: Response) => {
    Logger.info('Plaid webhook received', {});
    Logger.info('Method', { value: req.method });
    Logger.info('Content-Type', { value: req.headers["content-type"] });
    Logger.info('Origin IP', { value: req.ip });

    // Only allow POST requests
    if (req.method !== "POST") {
      Logger.error('Invalid method for Stripe webhook', { method: req.method });
      res.status(405).send("Method not allowed");
      return;
    }

    // Basic request validation
    if (!req.headers["content-type"]?.includes("application/json")) {
      Logger.error('❌ Invalid content type:', { error: req.headers["content-type"] });
      res.status(400).send("Invalid content type");
      return;
    }

    // Validate Plaid configuration
    try {

      Logger.info('Plaid config loaded for ${config.environment} environment', {});
    } catch (error) {
      Logger.error('❌ Plaid configuration error:', { error: (error as Error) });
      res.status(500).send("Plaid configuration error");
      return;
    }

    let webhookData: any;
    try {
      // Parse JSON payload
      if (typeof req.body === 'string') {
        webhookData = JSON.parse(req.body);
      } else if (typeof req.body === 'object') {
        webhookData = req.body;
      } else {
        throw new Error('Invalid request body format');
      }

      Logger.info('Processing Plaid webhook: ${webhookData.webhook_type}', {});

      switch (webhookData.webhook_type) {
        case "TRANSACTIONS":
          await handlePlaidTransactions(webhookData);
          Logger.info('Handled ${webhookData.webhook_type}', {});
          break;

        case "ITEM":
          await handlePlaidItem(webhookData);
          Logger.info('Handled ${webhookData.webhook_type}', {});
          break;

        case "AUTH":
          await handlePlaidAuth(webhookData);
          Logger.info('Handled ${webhookData.webhook_type}', {});
          break;

        case "ACCOUNTS":
          await handlePlaidAccounts(webhookData);
          Logger.info('Handled ${webhookData.webhook_type}', {});
          break;

        case "LIABILITIES":
          await handlePlaidLiabilities(webhookData);
          Logger.info('Handled ${webhookData.webhook_type}', {});
          break;

        default:
          Logger.info('Unhandled Plaid webhook type: ${webhookData.webhook_type}', {});
      }

      // Always respond with 200 to acknowledge receipt
      res.status(200).json({
        received: true,
        webhookType: webhookData.webhook_type,
        webhookCode: webhookData.webhook_code,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      Logger.error('❌ Error processing Plaid webhook:', { error: (error as Error) });

      // Still respond with 200 to prevent Plaid retries for application errors
      res.status(200).json({
        received: true,
        error: "Processing failed",
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Function to initialize user notification settings
export const initializeNotificationSettings = onRequest(async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      res.status(400).json({ error: 'userId parameter required' });
      return;
    }

    const userRef = db.collection('users').doc(userId);

    // Set default notification settings
    await userRef.update({
      notificationSettings: {
        notificationsEnabled: true,
        bankConnections: true,
        push: true,
        receipts: true,
        security: true,
        frequency: 'all',
        quietHours: {
          enabled: false,
          startTime: '22:00',
          endTime: '07:00'
        }
      }
    });

    Logger.info('Initialized notification settings for user ${userId}', {});

    res.status(200).json({
      success: true,
      message: 'Notification settings initialized',
      userId
    });
  } catch (error) {
    Logger.error('Error initializing notification settings:', { error: (error as Error) });
    res.status(500).json({ error: 'Failed to initialize settings' });
  }
});

// Test endpoint to verify webhook configuration
export const testWebhookConfig = onRequest(async (req: Request, res: Response) => {
  try {
    // const stripeConfig = getStripeConfig(); // COMMENTED OUT - Using RevenueCat instead of Stripe
    let plaidConfigStatus = { configured: false, error: '' };

    try {
      const plaidConfig = getPlaidConfig();
      plaidConfigStatus = {
        configured: true,
        hasClientId: !!plaidConfig.clientId,
        hasSecret: !!plaidConfig.secret,
        environment: plaidConfig.environment,
        note: "Plaid uses IP allowlisting instead of webhook secrets"
      } as any;
    } catch (error) {
      plaidConfigStatus.error = (error as Error).message;
    }

    res.status(200).json({
      // stripe: { // COMMENTED OUT - Using RevenueCat instead of Stripe
      //   webhookConfigured: true,
      //   hasSecretKey: !!stripeConfig.secretKey,
      //   hasWebhookSecret: !!stripeConfig.webhookSecret,
      // },
      plaid: plaidConfigStatus,
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      webhookConfigured: false,
      error: (error as Error),
      timestamp: new Date().toISOString(),
    });
  }
});

// LOCAL NOTIFICATION APPROACH
// Using Firestore monitoring + local notifications instead of FCM


// NOTIFICATION HANDLERS
export const onConnectionNotificationCreate = functionsV1.firestore
  .document("connection_notifications/{notificationId}")
  .onCreate(async (snap, context) => {
    const notification = snap.data();
    if (!notification) return;

    const { userId, title, message, type, priority } = notification;

    Logger.info('New connection notification for user ${userId}: ${title}', {});

    try {
      // Get user's push token from Firestore
      const userDoc = await db.collection("users").doc(userId).get();
      const userData = userDoc.data();

      // We no longer need tokens for the local notification approach
      Logger.debug('Processing notification for user ${userId}', {});

      // Check if user has notifications enabled
      const notificationSettings = userData?.notificationSettings;
      if (!notificationSettings?.notificationsEnabled || !notificationSettings?.bankConnections) {
        console.log(`📵 User ${userId} has disabled bank connection notifications`);
        return;
      }

      // Prepare notification data
      const notificationData = {
        type,
        priority: priority || 'medium',
        userId,
        notificationId: context.params.notificationId,
        createdAt: new Date().toISOString()
      };

      // Simple approach: Create a local notification trigger document that the app monitors
      // This avoids all FCM complexity and uses the same approach as your working test notifications

      Logger.debug('Creating local notification trigger for user ${userId}', {});

      // Create a document in user_notifications collection that the app monitors
      await db.collection("user_notifications").add({
        userId: userId,
        title: title,
        body: message,
        data: notificationData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        source: 'webhook',
        sourceId: context.params.notificationId
      });

      Logger.info('Local notification trigger created for user ${userId}', {});

      // Update the original notification document to mark as processed
      await db.collection("connection_notifications").doc(context.params.notificationId).update({
        pushSent: true,
        pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
        pushMethod: 'local_trigger'
      });

    } catch (error) {
      Logger.error('Error sending push notification:', { error: (error as Error) });
    }
  });

// PLAID WEBHOOK HANDLERS
async function handlePlaidTransactions(webhookData: any): Promise<void> {
  Logger.info('Processing Plaid transactions webhook', {});

  const { item_id, new_transactions, removed_transactions } = webhookData;

  try {
    // Find user by item_id (note: field name is itemId in our database)
    const plaidItemQuery = db.collection("plaid_items").where("itemId", "==", item_id);
    const plaidItemSnapshot = await plaidItemQuery.get();

    if (plaidItemSnapshot.empty) {
      Logger.error('No plaid_items entry found for item_id: ${item_id}', {});
      Logger.info(' This item may not have been synced to Firestore yet. Use syncBankConnectionToPlaidItems to sync existing connections.', {});
      return;
    }

    const plaidItemDoc = plaidItemSnapshot.docs[0];
    const userId = plaidItemDoc.data().userId;

    console.log(`Processing transactions for user: ${userId}`);
    await processTransactionsForUser(userId, item_id, new_transactions, removed_transactions);

  } catch (error) {
    Logger.error('Error processing Plaid transactions webhook:', { error: (error as Error) });
    throw error;
  }
}

// Helper function to process transactions for a user
async function processTransactionsForUser(userId: string, itemId: string, new_transactions: number, removed_transactions: string[]): Promise<void> {
  try {
    // Process new transactions
    if (new_transactions && new_transactions > 0) {
      Logger.info('${new_transactions} new transactions available for user ${userId}', {});

      // Store transaction update notification in transaction_updates collection
      await db.collection("transaction_updates").add({
        userId,
        itemId: itemId,
        type: "new_transactions",
        count: new_transactions,
        processed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Create a user notification about new transactions
      await db.collection("connection_notifications").add({
        userId,
        itemId: itemId,
        institutionName: itemId.includes('Tartan') ? 'Tartan Bank' : 'Your Bank',
        type: 'new_transactions',
        title: '💳 New Transactions Available',
        message: `${new_transactions} new transaction${new_transactions > 1 ? 's' : ''} detected and ready for review.`,
        actionRequired: true,
        priority: 'medium',
        dismissed: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      Logger.info('Created transaction update and notification for user ${userId}', {});

      // TODO: Trigger transaction sync process
      // This would fetch the actual transactions and analyze them for potential receipts
    }

    // Process removed transactions  
    if (removed_transactions && removed_transactions.length > 0) {
      Logger.info('${removed_transactions.length} transactions removed for user ${userId}', {});

      for (const transactionId of removed_transactions) {
        // Mark any generated receipts from these transactions as invalid
        await db.collection("receipts")
          .where("sourceTransactionId", "==", transactionId)
          .get()
          .then(snapshot => {
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
              batch.update(doc.ref, {
                status: "cancelled",
                cancelReason: "source_transaction_removed",
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
              });
            });
            return batch.commit();
          });
      }

      Logger.info('Processed ${removed_transactions.length} removed transactions for user ${userId}', {});
    }
  } catch (error) {
    console.error(`❌ Error processing transactions for user ${userId}:`, error);
    throw error;
  }
}

async function handlePlaidItem(webhookData: any): Promise<void> {
  Logger.info('Processing Plaid item webhook', {});

  const { item_id, webhook_code, error } = webhookData;

  try {
    // Find the Plaid item in our database
    const plaidItemQuery = db.collection("plaid_items").where("itemId", "==", item_id);
    const plaidItemSnapshot = await plaidItemQuery.get();

    if (plaidItemSnapshot.empty) {
      Logger.error('No plaid_items entry found for item_id: ${item_id}', {});
      Logger.info(' This item may not have been synced to Firestore yet. Use syncBankConnectionToPlaidItems to sync existing connections.', {});
      return;
    }

    const plaidItemDoc = plaidItemSnapshot.docs[0];
    const plaidItemData = plaidItemDoc.data();
    const userId = plaidItemData.userId;
    const institutionName = plaidItemData.institutionName || 'Your Bank';

    console.log(`Processing item update for user: ${userId}, code: ${webhook_code}`);

    const updateData: any = {
      lastWebhookCode: webhook_code,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    let notificationType: string | null = null;

    switch (webhook_code) {
      case "PENDING_EXPIRATION":
        updateData.status = "pending_expiration";
        updateData.needsReauth = true;
        notificationType = "pending_expiration";
        break;

      case "PENDING_DISCONNECT":
        updateData.status = "pending_disconnect";
        updateData.needsReauth = true;
        notificationType = "pending_expiration";
        break;

      case "USER_PERMISSION_REVOKED":
        updateData.status = "permission_revoked";
        updateData.active = false;
        updateData.needsReauth = true;
        notificationType = "permission_revoked";
        break;

      case "ERROR":
        updateData.status = "error";
        updateData.error = {
          errorType: error?.error_type || "ITEM_ERROR",
          errorCode: error?.error_code || "UNKNOWN",
          displayMessage: error?.display_message || "Connection error occurred",
          suggestedAction: "REAUTH"
        };
        updateData.active = false;
        updateData.needsReauth = true;
        notificationType = "reauth_required";
        break;

      case "NEW_ACCOUNTS_AVAILABLE":
        updateData.hasNewAccounts = true;
        notificationType = "new_accounts_available";
        break;

      case "LOGIN_REPAIRED":
        // Self-healing notification - item was fixed automatically
        updateData.status = "connected";
        updateData.active = true;
        updateData.needsReauth = false;
        updateData.error = null;
        notificationType = "login_repaired";
        break;

      default:
        console.log(`Unhandled item webhook code: ${webhook_code}`);
    }

    // Update the item
    await plaidItemDoc.ref.update(updateData);
    Logger.info('Updated item ${item_id} with status: ${updateData.status}', {});

    // Create connection notification
    if (notificationType) {
      await createConnectionNotification(
        userId,
        item_id,
        institutionName,
        notificationType,
        webhook_code
      );
      Logger.info('Created ${notificationType} notification for user ${userId}', {});
    }

    // For self-healing, dismiss any existing reauth notifications
    if (webhook_code === "LOGIN_REPAIRED") {
      await dismissOldNotifications(userId, item_id, ["reauth_required", "pending_expiration"]);
    }
  } catch (error) {
    Logger.error('Error processing Plaid item webhook:', { error: (error as Error) });
    throw error;
  }
}

// Helper function to create connection notifications
async function createConnectionNotification(
  userId: string,
  itemId: string,
  institutionName: string,
  type: string,
  webhookCode: string
): Promise<void> {
  const notificationContent = getNotificationContent(type, institutionName, webhookCode);

  // Save notification to Firestore
  await db.collection("connection_notifications").add({
    userId,
    itemId,
    institutionName,
    type,
    ...notificationContent,
    dismissed: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: type === "login_repaired" ?
      admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) :
      null,
  });

  // Also create user notification for push notification delivery
  if (type === "reauth_required" || type === "pending_expiration") {
    await db.collection("user_notifications").add({
      userId,
      title: notificationContent.title,
      body: notificationContent.message,
      data: {
        type: "bank_connection",
        connectionType: type,
        institutionName,
        itemId,
        webhookCode,
        actionRequired: notificationContent.actionRequired,
        navigationScreen: "Settings"
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
      priority: notificationContent.priority || "normal"
    });

    Logger.info('Created user notification for ${type} - ${institutionName}', {});
  }
}

// Helper function to dismiss old notifications
async function dismissOldNotifications(
  userId: string,
  itemId: string,
  typesToDismiss: string[]
): Promise<void> {
  const notificationsQuery = db.collection("connection_notifications")
    .where("userId", "==", userId)
    .where("itemId", "==", itemId)
    .where("dismissed", "==", false);

  const snapshot = await notificationsQuery.get();
  const batch = db.batch();
  let batchOperations = 0;

  snapshot.docs.forEach(doc => {
    if (typesToDismiss.includes(doc.data().type)) {
      batch.update(doc.ref, {
        dismissed: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      batchOperations++;
    }
  });

  if (batchOperations > 0) {
    await batch.commit();
    Logger.info('Dismissed ${batchOperations} old notifications', {});
  }
}


// Enhanced notification content helper
function getNotificationContent(
  type: string,
  institutionName: string,
  webhookCode: string
): {
  title: string;
  message: string;
  actionRequired: boolean;
  priority: 'high' | 'medium' | 'low';
} {
  switch (type) {
    case "reauth_required":
      return {
        title: "🔴 Bank Connection Issue",
        message: `${institutionName} connection stopped working. Tap to reconnect and restore receipt tracking.`,
        actionRequired: true,
        priority: "high"
      };

    case "pending_expiration":
      return {
        title: "⚠️ Connection Expiring Soon",
        message: `${institutionName} connection expires in 7 days. Reconnect now to avoid interruption.`,
        actionRequired: true,
        priority: "medium"
      };

    case "permission_revoked":
      return {
        title: "🚫 Bank Permissions Revoked",
        message: `${institutionName} access was revoked. Reconnect to restore automatic receipt tracking.`,
        actionRequired: true,
        priority: "high"
      };

    case "login_repaired":
      return {
        title: "✅ Connection Restored",
        message: `Great news! Your ${institutionName} connection is working again. No action needed.`,
        actionRequired: false,
        priority: "low"
      };

    case "new_accounts_available":
      return {
        title: "🆕 New Accounts Found",
        message: `${institutionName} has new accounts available. Connect them to track more receipts.`,
        actionRequired: false,
        priority: "medium"
      };

    default:
      return {
        title: "🏦 Bank Connection Update",
        message: `${institutionName} connection needs attention. Check the app for details.`,
        actionRequired: true,
        priority: "medium"
      };
  }
}

async function handlePlaidAuth(webhookData: any): Promise<void> {
  Logger.info('Processing Plaid auth webhook', {});
  // Handle authentication-related webhooks
  // Implementation depends on your specific auth flow
}

async function handlePlaidAccounts(webhookData: any): Promise<void> {
  Logger.info('Processing Plaid accounts webhook', {});
  // Handle account-related webhooks (new accounts, account updates, etc.)
}

async function handlePlaidLiabilities(webhookData: any): Promise<void> {
  Logger.info('Processing Plaid liabilities webhook', {});

  try {
    const { item_id, webhook_code } = webhookData;

    if (!item_id) {
      Logger.error('No item_id in liabilities webhook data', {});
      return;
    }

    Logger.info('Liabilities webhook - Code: ${webhook_code}, Item: ${item_id}', {});

    // Find the user's Plaid item
    const itemsRef = db.collection('plaidItems');
    const itemQuery = await itemsRef.where('itemId', '==', item_id).get();

    if (itemQuery.empty) {
      Logger.error('No Plaid item found for item_id: ${item_id}', {});
      return;
    }

    const itemDoc = itemQuery.docs[0];
    const itemData = itemDoc.data();
    const userId = itemData.userId;

    if (!userId) {
      Logger.error('No userId found for item: ${item_id}', {});
      return;
    }

    // Update the item's last updated timestamp
    await itemDoc.ref.update({
      lastWebhookReceived: admin.firestore.FieldValue.serverTimestamp(),
      lastLiabilitiesUpdate: admin.firestore.FieldValue.serverTimestamp()
    });

    // Handle different liability webhook codes
    switch (webhook_code) {
      case 'DEFAULT_UPDATE':
        Logger.info('Default liability update for item: ${item_id}', {});
        // This indicates that liability data has been updated and should be refetched
        // You might want to trigger a refresh of liability data here
        break;

      case 'LIABILITY_UPDATE':
        Logger.info('Liability data updated for item: ${item_id}', {});
        // Handle specific liability updates
        break;

      default:
        Logger.info('Unhandled liabilities webhook code: ${webhook_code}', {});
    }

    Logger.info('Successfully processed liabilities webhook for item: ${item_id}', {});

  } catch (error) {
    Logger.error('❌ Error processing Plaid liabilities webhook:', { error: (error as Error) });
    throw error;
  }
}

// Plaid Update Mode Link Token Creation
export const createPlaidUpdateToken = onCall(
  async (request: CallableRequest<{ itemId: string; accessToken?: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const { itemId, accessToken } = request.data;
      const userId = request.auth.uid;

      if (!itemId) {
        throw new HttpsError('invalid-argument', 'Item ID is required');
      }

      // Verify the item belongs to the user
      const itemQuery = db.collection('plaid_items')
        .where('itemId', '==', itemId)
        .where('userId', '==', userId);

      const itemSnapshot = await itemQuery.get();

      if (itemSnapshot.empty) {
        throw new HttpsError('not-found', 'Item not found or access denied');
      }

      const itemData = itemSnapshot.docs[0].data();
      const itemAccessToken = accessToken || itemData.accessToken;

      if (!itemAccessToken) {
        throw new HttpsError('failed-precondition', 'No access token available for item');
      }

      // Get Plaid configuration
      const config = getPlaidConfig();

      // Create update mode link token
      const linkTokenResponse = await fetch('https://production.plaid.com/link/token/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          secret: config.secret,
          client_name: 'ReceiptGold',
          country_codes: ['US'],
          language: 'en',
          user: {
            client_user_id: userId,
          },
          access_token: itemAccessToken, // This makes it update mode
          update: {
            account_selection_enabled: true,
          },
          webhook: 'https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook',
        }),
      });

      if (!linkTokenResponse.ok) {
        const errorData = await linkTokenResponse.json();
        Logger.error('Plaid Link token creation failed:', { error: errorData });
        throw new HttpsError('internal', `Failed to create update link token: ${errorData.error_message || 'Unknown error'}`);
      }

      const linkTokenData = await linkTokenResponse.json();

      Logger.info('Created update mode link token for user ${userId}, item ${itemId}', {});

      return {
        link_token: linkTokenData.link_token,
        expiration: linkTokenData.expiration,
      };

    } catch (error) {
      Logger.error('Error creating Plaid update link token:', { error: (error as Error) });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Failed to create update link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// Create Plaid Link Token with proper redirect URI/Android package name handling
export const createPlaidLinkToken = onCall(
  { region: 'us-central1' },
  async (request: CallableRequest<{
    user_id: string;
    platform?: 'ios' | 'android';
    auth_token?: string;
  }>) => {
    Logger.info('🔍 createPlaidLinkToken called', {});
    Logger.info('Request auth', { value: request.auth ? 'present' : 'missing' });
    Logger.info('Request data', { value: request.data });
    Logger.info('Request rawRequest auth header', { value: request.rawRequest?.headers?.authorization ? 'Has auth header' : 'No auth header' });
    Logger.info('Manual auth token provided', { value: request.data.auth_token ? 'yes' : 'no' });

    let userId: string;

    if (request.auth) {
      // Standard Firebase auth context is available
      Logger.info('✅ Using standard Firebase auth context', {});
      userId = request.auth.uid;
    } else if (request.data.auth_token) {
      // Manual token verification for React Native
      Logger.info('🔑 Manually verifying auth token', {});
      try {
        const decodedToken = await admin.auth().verifyIdToken(request.data.auth_token);
        userId = decodedToken.uid;
        Logger.info('✅ Manual token verification successful for user', { value: userId });
      } catch (error) {
        Logger.error('❌ Manual token verification failed:', { error: (error as Error) });
        throw new HttpsError('unauthenticated', 'Invalid authentication token');
      }
    } else {
      Logger.error('❌ No authentication method available', {});
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    Logger.info('✅ Authentication verified for user', { value: userId });

    try {
      const { user_id, platform } = request.data;

      if (!user_id) {
        throw new HttpsError('invalid-argument', 'User ID is required');
      }

      // Verify the user_id matches the authenticated user
      if (user_id !== userId) {
        throw new HttpsError('permission-denied', 'User ID must match authenticated user');
      }

      // Get Plaid configuration
      const config = getPlaidConfig();

      // Prepare the request body
      const requestBody: any = {
        client_id: config.clientId,
        secret: config.secret,
        client_name: 'ReceiptGold',
        country_codes: ['US'],
        language: 'en',
        user: {
          client_user_id: userId,
        },
        products: ['transactions'],
        webhook: 'https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook',
      };

      // Add platform-specific configuration
      if (platform === 'android') {
        requestBody.android_package_name = 'com.receiptgold.app';
        Logger.info('🤖 Android: Using package name for OAuth redirect', {});
      } else {
        // Default to iOS or when platform is not specified
        requestBody.redirect_uri = 'receiptgold://oauth';
        Logger.info('🍎 iOS: Using redirect URI for OAuth', {});
      }

      console.log(`🔗 Creating link token for user ${userId} on ${platform || 'iOS'} platform`);

      // Create link token via Plaid API - use environment-specific endpoint
      const plaidEndpoint = config.environment === 'production'
        ? 'https://production.plaid.com/link/token/create'
        : 'https://sandbox.plaid.com/link/token/create';

      console.log(`🌍 Using Plaid environment: ${config.environment} (${plaidEndpoint})`);

      const linkTokenResponse = await fetch(plaidEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!linkTokenResponse.ok) {
        const errorData = await linkTokenResponse.json();
        Logger.error('Plaid Link token creation failed:', { error: errorData });
        throw new HttpsError('internal', `Failed to create link token: ${errorData.error_message || 'Unknown error'}`);
      }

      const linkTokenData = await linkTokenResponse.json();

      Logger.info('Created link token for user ${userId}', {});

      return {
        link_token: linkTokenData.link_token,
        expiration: linkTokenData.expiration,
      };

    } catch (error) {
      Logger.error('Error creating Plaid link token:', { error: (error as Error) });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Failed to create link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

// 5. Proactive Bank Connection Health Monitoring
export const monitorBankConnections = functionsV1.pubsub
  .schedule("0 */6 * * *") // Run every 6 hours
  .onRun(async (context: any) => {
    Logger.debug('Starting proactive bank connection health check...', {});

    try {
      // Get all active Plaid items that haven't been checked recently
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const plaidItemsSnapshot = await db.collection("plaid_items")
        .where("active", "==", true)
        .where("status", "in", ["connected", "stale"])
        .get();

      Logger.info('Found ${plaidItemsSnapshot.docs.length} active bank connections to check', {});

      for (const itemDoc of plaidItemsSnapshot.docs) {
        const itemData = itemDoc.data();
        const { itemId, userId, institutionName, lastHealthCheck } = itemData;

        // Skip if checked recently (within last 6 hours)
        if (lastHealthCheck && lastHealthCheck.toDate() > sixHoursAgo) {
          continue;
        }

        try {
          // Simulate a health check by attempting to get accounts
          // In production, this would use Plaid API
          Logger.debug('Checking health for ${institutionName} (${itemId})', {});

          // Update last health check timestamp
          await itemDoc.ref.update({
            lastHealthCheck: admin.firestore.FieldValue.serverTimestamp()
          });

          // If connection is stale or showing signs of issues, create notification
          const needsAttention = await checkConnectionNeedsRepair(itemData);

          if (needsAttention) {
            Logger.warn('Connection needs repair: ${institutionName}', {});

            // Update item status to indicate it needs repair
            await itemDoc.ref.update({
              status: "error",
              needsReauth: true,
              error: {
                errorType: "CONNECTION_HEALTH_CHECK",
                errorCode: "HEALTH_CHECK_FAILED",
                displayMessage: "Connection may need attention. Please reconnect to ensure continued service.",
                suggestedAction: "REAUTH"
              }
            });

            // Create notification
            await createConnectionNotification(
              userId,
              itemId,
              institutionName,
              "reauth_required",
              "HEALTH_CHECK"
            );

            console.log(`📢 Created repair notification for ${institutionName}`);
          }

        } catch (error) {
          console.error(`❌ Error checking health for ${institutionName}:`, error);
        }
      }

      Logger.info('Bank connection health check completed', {});
    } catch (error) {
      Logger.error('❌ Error in bank connection monitoring:', { error: (error as Error) });
    }
  });

// Helper function to determine if a connection needs repair
async function checkConnectionNeedsRepair(itemData: any): Promise<boolean> {
  const { status, lastSyncAt, accessToken, error } = itemData;

  // Connection already marked as needing repair
  if (status === "error" || !accessToken) {
    return true;
  }

  // Connection hasn't synced in over 48 hours
  if (lastSyncAt) {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const lastSync = lastSyncAt.toDate ? lastSyncAt.toDate() : new Date(lastSyncAt);
    if (lastSync < twoDaysAgo) {
      return true;
    }
  }

  // Has existing error
  if (error && error.errorType) {
    return true;
  }

  return false;
}

// 6. Monthly Usage Reset (updated for Firebase Functions v6)
export const resetMonthlyUsage = functionsV1.pubsub
  .schedule("0 * * * *") // Run every hour
  .onRun(async (context: any) => {
    try {
      console.log("Checking for subscriptions that need usage reset...");
      const now = new Date();

      // Get all subscriptions
      const subscriptionsSnapshot = await db.collection("subscriptions")
        .where("status", "==", "active")
        .get();

      const batch = db.batch();
      let resetCount = 0;

      for (const subscriptionDoc of subscriptionsSnapshot.docs) {
        const subscription = subscriptionDoc.data() as SubscriptionDocument;
        const periodStart = subscription.billing.currentPeriodStart;

        if (!periodStart) continue;

        // Convert Firestore Timestamp to Date if needed
        let periodStartDate: Date;
        if (periodStart instanceof admin.firestore.Timestamp) {
          periodStartDate = periodStart.toDate();
        } else if (periodStart instanceof Date) {
          periodStartDate = periodStart;
        } else if (typeof periodStart === 'string' || typeof periodStart === 'number') {
          periodStartDate = new Date(periodStart);
        } else {
          console.log(`Skipping user ${subscription.userId} - invalid period start date`);
          continue;
        }

        // Check if we need to reset (if current time >= next period start)
        const nextResetDate = new Date(periodStartDate);
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);

        if (now >= nextResetDate) {
          console.log(`Resetting usage for user ${subscription.userId}`);
          resetCount++;

          // Create new usage document
          const newUsageRef = db
            .collection("usage")
            .doc(`${subscription.userId}_${now.toISOString().slice(0, 7)}`);

          const newUsageDoc: UsageDocument = {
            userId: subscription.userId,
            month: now.toISOString().slice(0, 7),
            receiptsUploaded: 0,
            apiCalls: 0,
            reportsGenerated: 0,
            limits: subscription.limits,
            resetDate: nextResetDate.toISOString(),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          batch.set(newUsageRef, newUsageDoc);

          // Update subscription with next reset date
          const nextMonthReset = new Date(nextResetDate);
          nextMonthReset.setMonth(nextMonthReset.getMonth() + 1);

          batch.update(subscriptionDoc.ref, {
            "billing.lastMonthlyReset": admin.firestore.FieldValue.serverTimestamp(),
            "billing.nextMonthlyReset": nextMonthReset,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      if (resetCount > 0) {
        await batch.commit();
        console.log(`Monthly usage reset completed for ${resetCount} users`);
      } else {
        console.log("No subscriptions needed usage reset at this time");
      }
    } catch (error) {
      Logger.error('Error resetting monthly usage:', { error: (error as Error) });
    }
  });

// 6. Create Subscription for Mobile App
// COMMENTED OUT - Using RevenueCat instead of Stripe
/*
interface CreateSubscriptionData {
  priceId: string;
  customerId: string;
}
export const createSubscription = onCall(async (request: CallableRequest<CreateSubscriptionData>) => {
  Logger.info('createSubscription called with auth', { value: request.auth });
  Logger.info('createSubscription request data', { value: request.data });

  if (!request.auth) {
    Logger.error('Authentication missing in createSubscription', {});
    throw new HttpsError('unauthenticated', 'You must be logged in to create a subscription');
  }

  if (!request.auth.uid) {
    Logger.error('User ID missing in auth object:', { error: request.auth });
    throw new HttpsError('unauthenticated', 'Invalid authentication state');
  }

  try {
    const { priceId, customerId } = request.data;

    if (!priceId || !customerId) {
      Logger.error('Missing required subscription data:', { error: { priceId, customerId } });
      throw new HttpsError('invalid-argument', 'Price ID and customer ID are required');
    }

    console.log(`Creating subscription for user ${request.auth.uid}:`, { priceId, customerId });

    // Validate Stripe configuration first
    const stripeConfig = getStripeConfig();
    if (!stripeConfig.secretKey) {
      console.error("Missing Stripe secret key");
      throw new HttpsError('failed-precondition', "Stripe configuration is incomplete");
    }

    // Initialize and validate Stripe instance
    const stripe = getStripe();
    if (!stripe) {
      console.error("Failed to initialize Stripe");
      throw new HttpsError('internal', "Stripe initialization failed");
    }

    // Verify the customer exists and belongs to this user
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || customer.deleted) {
      Logger.error('Customer not found:', { error: customerId });
      throw new HttpsError('not-found', 'Invalid customer ID');
    }

    if (customer.metadata?.userId !== request.auth.uid) {
      Logger.error('Customer does not belong to user:', {
        error: {
          customerId,
          customerUserId: customer.metadata?.userId,
          requestUserId: request.auth.uid
        }
      });
      throw new HttpsError('permission-denied', 'Customer does not belong to this user');
    }

    Logger.info('Customer verified, creating subscription...', {});

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
        payment_method_types: ['card']
      },
      metadata: {
        userId: request.auth.uid
      },
      expand: ['latest_invoice.payment_intent', 'latest_invoice']
    });

    console.log('Created subscription:', JSON.stringify(subscription, null, 2));

    Logger.info('Subscription created', { value: subscription.id });

    // @ts-ignore - Stripe types don't properly capture the expanded fields
    const clientSecret = subscription.latest_invoice?.payment_intent?.client_secret;

    if (!clientSecret) {
      Logger.error('No client secret in subscription response:', { error: subscription });
      throw new HttpsError('internal', 'Failed to create subscription: No client secret returned');
    }

    Logger.info('Subscription created successfully with client secret', {});

    return {
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
    };
  } catch (error) {
    Logger.error('Error creating subscription:', { error: (error as Error) });

    if (error instanceof HttpsError) {
      throw error;
    }

    if (error instanceof Error && error.message.includes('auth')) {
      throw new HttpsError('unauthenticated', error.message);
    }

    throw new HttpsError(
      'internal',
      error instanceof Error ? error.message : 'Failed to create subscription'
    );
  }
});
*/

// Create Stripe Customer (with environment-aware app URL)
// COMMENTED OUT - Using RevenueCat instead of Stripe
/*
interface CreateCustomerData {
  email: string;
  name: string;
}
export const createStripeCustomer = onCall(async (request: CallableRequest<CreateCustomerData>) => {
  Logger.info('createStripeCustomer called with auth', { value: request.auth });

  if (!request.auth) {
    Logger.error('Authentication missing in createStripeCustomer', {});
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to create a customer"
    );
  }

  if (!request.auth.uid) {
    Logger.error('User ID missing in auth object:', { error: request.auth });
    throw new HttpsError(
      "unauthenticated",
      "Invalid authentication state"
    );
  }

  try {
    const userId: string = request.auth.uid;
    const { email, name }: CreateCustomerData = request.data;

    if (!email || !name) {
      Logger.error('Missing required customer data:', { error: { email, name } });
      throw new HttpsError(
        "invalid-argument",
        "Email and name are required"
      );
    }

    console.log(`Creating Stripe customer for user: ${userId}`, { email, name });

    // Validate Stripe configuration
    const stripeConfig = getStripeConfig();
    if (!stripeConfig.secretKey) {
      console.error("Missing Stripe secret key");
      throw new Error("Stripe configuration is incomplete");
    }

    // Initialize and validate Stripe instance
    const stripe = getStripe();
    if (!stripe) {
      console.error("Failed to initialize Stripe");
      throw new Error("Stripe initialization failed");
    }

    // Create Stripe customer
    const customer: Stripe.Customer = await getStripe().customers.create({
      email: email,
      name: name,
      metadata: {
        userId: userId,
      },
    });

    Logger.info('Created Stripe customer ${customer.id} for user ${userId}', {});
    return { customerId: customer.id };
  } catch (error) {
    Logger.error('Error creating Stripe customer:', { error: (error as Error) });
    throw new HttpsError(
      "internal",
      error instanceof Error ? error.message : "Failed to create customer"
    );
  }
});
*/

// 7. Create Checkout Session (with environment-aware URLs)
// COMMENTED OUT - Using RevenueCat instead of Stripe
/*
interface CreateCheckoutSessionData {
  priceId: string;
  customerId: string;
}
export const createCheckoutSession = onCall(
  async (request: CallableRequest<CreateCheckoutSessionData>) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    try {
      const { priceId, customerId }: CreateCheckoutSessionData = request.data;

      // Environment-aware app URL configuration
      const getAppUrl = (): string => {
        // Check if we're in development
        if (process.env.NODE_ENV === 'development') {
          return 'http://localhost:8081';
        }

        // Use configured app URL or fallback
        return process.env.APP_URL || 'https://yourapp.com';
      };

      const appUrl = getAppUrl();

      console.log(`Creating checkout session for user: ${request.auth.uid}, price: ${priceId}`);

      const session: Stripe.Checkout.Session = await getStripe().checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${appUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/subscription/cancel`,
        metadata: {
          userId: request.auth.uid,
        },
      });

      Logger.info('Created checkout session ${session.id} for user ${request.auth.uid}', {});
      Logger.info('Checkout URL: ${session.url}', {});

      return {
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      Logger.error('Error creating checkout session:', { error: (error as Error) });
      throw new HttpsError(
        "internal",
        "Failed to create checkout session"
      );
    }
  }
);
*/

// 8. Business Stats Update Trigger (updated for Firebase Functions v6)
export const updateBusinessStats = functionsV1.firestore
  .document("receipts/{receiptId}")
  .onWrite(async (change, context) => {
    try {
      const receiptData = change.after.exists ? change.after.data() as ReceiptData : null;
      const previousData = change.before.exists ? change.before.data() as ReceiptData : null;

      if (!receiptData && !previousData) return;

      const businessId: string | undefined = receiptData?.businessId || previousData?.businessId;
      if (!businessId) return;

      // Recalculate business stats
      const receiptsSnapshot = await db
        .collection("receipts")
        .where("businessId", "==", businessId)
        .where("status", "!=", "deleted")
        .get();

      let totalReceipts: number = 0;
      let totalAmount: number = 0;
      let lastReceiptDate: string | null = null;

      receiptsSnapshot.forEach((doc) => {
        const data = doc.data() as ReceiptData;
        totalReceipts++;
        totalAmount += data.amount || 0;

        if (!lastReceiptDate || data.date > lastReceiptDate) {
          lastReceiptDate = data.date;
        }
      });

      // Update business stats
      await db.collection("businesses").doc(businessId).update({
        "stats.totalReceipts": totalReceipts,
        "stats.totalAmount": totalAmount,
        "stats.lastReceiptDate": lastReceiptDate,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      Logger.error('Error updating business stats:', { error: (error as Error) });
    }
  });

// 9. Generate Report (keeping your existing implementation)
interface GenerateReportData {
  type: 'tax_summary' | 'expense_report' | 'category_breakdown';
  businessId?: string;
  startDate: string;
  endDate: string;
  title: string;
}

export const generateReport = onCall(async (request: CallableRequest<GenerateReportData>) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  try {
    const userId: string = request.auth.uid;
    const { type, businessId, startDate, endDate, title }: GenerateReportData = request.data;

    console.log(`Generating ${type} report for user: ${userId}`);

    // Check user's report generation limits
    const currentMonth: string = new Date().toISOString().slice(0, 7);
    const usageDoc = await db
      .collection("usage")
      .doc(`${userId}_${currentMonth}`)
      .get();

    if (!usageDoc.exists) {
      throw new HttpsError(
        "not-found",
        "Usage data not found"
      );
    }

    const usage = usageDoc.data() as UsageDocument;

    if (
      usage.limits.maxReports &&
      usage.limits.maxReports !== -1 &&
      usage.reportsGenerated >= usage.limits.maxReports
    ) {
      throw new HttpsError(
        "resource-exhausted",
        "Report generation limit exceeded for current plan"
      );
    }

    // Query receipts for the report
    let query = db
      .collection("receipts")
      .where("userId", "==", userId)
      .where("date", ">=", startDate)
      .where("date", "<=", endDate)
      .where("status", "==", "processed");

    if (businessId) {
      query = query.where("businessId", "==", businessId);
    }

    const receiptsSnapshot = await query.get();

    // Calculate report data
    let totalExpenses: number = 0;
    let deductibleExpenses: number = 0;
    const categories: Record<string, number> = {};

    receiptsSnapshot.forEach((doc) => {
      const receipt = doc.data() as ReceiptData;
      totalExpenses += receipt.amount || 0;

      if (receipt.tax?.deductible) {
        deductibleExpenses +=
          (receipt.amount || 0) *
          ((receipt.tax?.deductionPercentage || 100) / 100);
      }

      const category: string = receipt.category || "uncategorized";
      categories[category] =
        (categories[category] || 0) + (receipt.amount || 0);
    });

    // Create report document
    const reportData = {
      userId,
      businessId: businessId || null,
      type,
      title,
      period: {
        startDate,
        endDate,
      },
      data: {
        totalExpenses,
        deductibleExpenses,
        categories,
        receiptCount: receiptsSnapshot.size,
      },
      files: [], // Would be populated after PDF generation
      status: "completed",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const reportRef = await db.collection("reports").add(reportData);

    // Update usage count
    await db
      .collection("usage")
      .doc(`${userId}_${currentMonth}`)
      .update({
        reportsGenerated: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    Logger.info('Generated report ${reportRef.id} for user ${userId}', {});
    return { reportId: reportRef.id, data: reportData.data };
  } catch (error) {
    Logger.error('Error generating report:', { error: (error as Error) });
    throw new HttpsError(
      "internal",
      "Failed to generate report"
    );
  }
});

// 10. User Deletion Cleanup (updated for Firebase Functions v6)
export const onUserDelete = functionsV1.auth.user().onDelete(async (user: admin.auth.UserRecord) => {
  try {
    const userId: string = user.uid;

    console.log(`Starting soft deletion for user: ${userId}`);

    // Instead of hard delete, mark user as soft deleted
    const deletionDate = new Date();
    const permanentDeletionDate = new Date(deletionDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Create soft deletion record
    await db.collection("deletedAccounts").doc(userId).set({
      userId,
      email: user.email || '',
      deletedAt: admin.firestore.FieldValue.serverTimestamp(),
      permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
      deletionType: 'auth_triggered',
      status: 'soft_deleted',
      recoverable: true
    });

    // Mark user document as deleted instead of removing it
    const userDocRef = db.collection("users").doc(userId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      await userDocRef.update({
        status: 'soft_deleted',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
        originalData: userDoc.data() // Backup original data for recovery
      });
    }

    // Mark subscription as soft deleted
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    
    if (subscriptionDoc.exists) {
      await subscriptionRef.update({
        status: 'soft_deleted',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
        originalData: subscriptionDoc.data()
      });
    }

    // Mark all receipts as soft deleted (batch operation)
    const receiptsSnapshot = await db
      .collection("receipts")
      .where("userId", "==", userId)
      .get();

    const batch = db.batch();
    receiptsSnapshot.forEach((doc) => {
      batch.update(doc.ref, {
        status: 'soft_deleted',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate)
      });
    });

    // Mark other user data as soft deleted
    const collections = ['businesses', 'reports', 'usage', 'teamMembers', 'bankConnections'];
    
    for (const collectionName of collections) {
      const snapshot = await db
        .collection(collectionName)
        .where("userId", "==", userId)
        .get();

      snapshot.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'soft_deleted',
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate)
        });
      });
    }

    await batch.commit();

    // Update device tracking records to mark account as soft deleted
    await updateDeviceTrackingForDeletedAccount(userId);

    Logger.info(`User ${userId} soft deleted successfully. Recovery available until ${permanentDeletionDate.toISOString()}`, {});
  } catch (error) {
    Logger.error('Error soft deleting user data:', { error: (error as Error) });
  }
});

interface UpdateSubscriptionRequest {
  subscriptionId: string;
  tierId?: 'starter' | 'growth' | 'professional' | 'trial'; // Optional - Cloud Function can determine from RevenueCat
  userId: string;
  revenueCatUserId?: string; // For calling RevenueCat API directly
}

interface UpdateSubscriptionResponse {
  success: boolean;
  error?: string;
  receiptsExcluded?: number;
  tierChange?: boolean;
}

// Type for Firestore batch update operations
type FirestoreUpdateData = admin.firestore.UpdateData<admin.firestore.DocumentData>;
type FirestoreDocumentData = admin.firestore.DocumentData;

// OPTIMIZATION: Helper function to determine subscription tier from RevenueCat API
async function getRevenueCatSubscriptionTier(revenueCatUserId: string): Promise<'starter' | 'growth' | 'professional' | 'trial'> {
  try {
    functions.logger.info('🔍 Calling RevenueCat API to determine tier', { revenueCatUserId });

    const revenueCatApiKey = process.env.REVENUECAT_API_KEY;
    if (!revenueCatApiKey) {
      functions.logger.warn('⚠️ RevenueCat API key not configured, falling back to client-provided tier');
      return 'trial'; // Default to trial if no API key
    }

    // Call RevenueCat REST API to get subscriber info
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${revenueCatUserId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${revenueCatApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      functions.logger.error('❌ RevenueCat API call failed', {
        status: response.status,
        statusText: response.statusText,
      });
      return 'trial'; // Default to trial on error
    }

    const subscriberData = await response.json();
    functions.logger.info('📦 RevenueCat subscriber data received', { subscriberData });

    // Determine tier from active entitlements and products
    const entitlements = subscriberData.subscriber?.entitlements || {};
    const activeEntitlements = Object.values(entitlements).filter((ent: any) =>
      ent.expires_date === null || new Date(ent.expires_date) > new Date()
    );

    if (activeEntitlements.length === 0) {
      return 'trial'; // No active entitlements
    }

    // Check product IDs to determine tier (same logic as client-side)
    const productIds = activeEntitlements.map((ent: any) => ent.product_identifier);
    Logger.info("Active RevenueCat product IDs:", { productIds });

    if (productIds.some(id => id === 'rg_professional_monthly' || id === 'rg_professional_annual')) {
      return 'professional';
    } else if (productIds.some(id => id === 'rg_growth_monthly' || id === 'rg_growth_annual')) {
      return 'growth';
    } else if (productIds.some(id => id === 'rg_starter')) {
      return 'starter';
    }

    return 'trial';
  } catch (error) {
    functions.logger.error('❌ Error calling RevenueCat API', error);
    return 'trial';
  }
}

export const updateSubscriptionAfterPayment = onCall(
  async (request: CallableRequest<UpdateSubscriptionRequest>): Promise<UpdateSubscriptionResponse> => {
    try {
      functions.logger.info('🚀 Starting updateSubscriptionAfterPayment', {
        data: request.data,
        auth: request.auth?.uid
      });

      // Validate authentication
      if (!request.auth) {
        throw new HttpsError('unauthenticated', 'User must be authenticated');
      }

      // Validate that the authenticated user matches the userId in the request
      if (request.auth.uid !== request.data.userId) {
        throw new HttpsError('permission-denied', 'User can only update their own subscription');
      }

      const { subscriptionId, tierId, userId, revenueCatUserId }: UpdateSubscriptionRequest = request.data;

      Logger.info('Request data from updateSubscriptionAfterPayment:', request.data);
      // Validate required fields
      if (!subscriptionId || !userId) {
        throw new HttpsError('invalid-argument', 'Missing required fields: subscriptionId, userId');
      }

      // OPTIMIZATION: Determine tier from RevenueCat API if not provided by client
      let finalTierId: 'starter' | 'growth' | 'professional' | 'trial';

      if (tierId) {
        // Client provided tier - validate it
        const validTiers: Array<'starter' | 'growth' | 'professional' | 'trial'> = ['starter', 'growth', 'professional', 'trial'];
        if (!validTiers.includes(tierId)) {
          throw new HttpsError('invalid-argument', `Invalid tier: ${tierId}`);
        }
        finalTierId = tierId;
        functions.logger.info('✅ Using client-provided tier', { tierId });
      } else {
        // No tier provided - call RevenueCat API to determine it
        const revenueCatUserIdToUse = revenueCatUserId || userId;
        functions.logger.info('🔍 No tier provided, determining from RevenueCat API', { revenueCatUserIdToUse });
        finalTierId = await getRevenueCatSubscriptionTier(revenueCatUserIdToUse);
        functions.logger.info('✅ Tier determined from RevenueCat API', { finalTierId });
      }

      // Validate subscription ID format (basic validation)
      if (typeof subscriptionId !== 'string' || subscriptionId.length < 10) {
        throw new HttpsError('invalid-argument', 'Invalid subscription ID format');
      }

      functions.logger.info('✅ Validation passed', { userId, finalTierId, subscriptionId });

      // Get current subscription for billing update
      const subscriptionRef = db.collection('subscriptions').doc(userId);
      const currentSub = await subscriptionRef.get();

      functions.logger.info('📋 Updating subscription billing after payment', {
        exists: currentSub.exists,
        userId
      });

      // Note: Tier changes are handled by RevenueCat webhook via new_product_id
      // This function only updates billing information and subscription status

      // Prepare subscription update data (no tier changes - webhook handles those)
      const subscriptionUpdateData: any = {
        status: 'active',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        billing: {
          subscriptionId: subscriptionId,
          currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          lastPaymentProcessed: admin.firestore.FieldValue.serverTimestamp()
        },
      };

      // End trial when confirming ANY subscription (if trial is still active)
      const trialData = currentSub.data()?.trial;
      const currentTrialActive = trialData?.isActive !== false && // if isActive is undefined or true
        trialData?.expiresAt &&
        trialData.expiresAt.toDate() > new Date(); // and not expired

      functions.logger.info('🔍 Trial check', {
        currentTrialActive,
        finalTierId,
        shouldEndTrial: currentTrialActive && finalTierId !== 'trial',
        trialData,
        isActiveField: trialData?.isActive,
        expiresAt: trialData?.expiresAt?.toDate(),
        now: new Date()
      });

      if (currentTrialActive && finalTierId !== 'trial') {
        functions.logger.info('🏁 Ending trial for user upgrading to paid subscription');
        subscriptionUpdateData.trial = {
          isActive: false,
          startedAt: currentSub.data()?.trial?.startedAt || admin.firestore.FieldValue.serverTimestamp(),
          expiresAt: admin.firestore.FieldValue.serverTimestamp(), // End trial immediately
          endedEarly: true,
          endReason: 'upgraded_to_paid'
        };
      }

      // Note: No tier change tracking needed since RevenueCat webhook handles this via lastRevenueCatEvent

      functions.logger.info('📝 Prepared subscription update data for billing');

      // Update subscription document (tier changes handled by RevenueCat webhook)
      try {
        if (currentSub.exists) {
          await subscriptionRef.update(subscriptionUpdateData as FirestoreUpdateData);
        } else {
          // Create new subscription document if it doesn't exist
          const createData: FirestoreDocumentData = {
            ...subscriptionUpdateData,
            userId: userId,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          };
          await subscriptionRef.set(createData);
        }

        functions.logger.info('✅ Subscription billing updated successfully', {
          subscriptionUpdated: true,
          userId,
          subscriptionId
        });
      } catch (updateError) {
        functions.logger.error('❌ Subscription update failed', updateError);
        throw new HttpsError('internal', 'Failed to update subscription');
      }

      // Log successful completion
      functions.logger.info('🎉 Subscription billing update completed successfully', {
        userId,
        subscriptionId
      });

      return {
        success: true,
        receiptsExcluded: 0,
        tierChange: false
      };

    } catch (error: unknown) {
      functions.logger.error('❌ updateSubscriptionAfterPayment failed', error);

      // Re-throw HttpsErrors as-is
      if (error instanceof HttpsError) {
        throw error;
      }

      // Convert other errors to internal HttpsError
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new HttpsError('internal', `Subscription update failed: ${errorMessage}`);
    }
  }
);

// Optional: Helper function to validate Stripe subscription (if you want to add Stripe verification)
/*
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const validateStripeSubscription = async (subscriptionId: string): Promise<boolean> => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    return subscription.status === 'active' || subscription.status === 'trialing';
  } catch (error) {
    logger.error('Failed to validate Stripe subscription', { subscriptionId, error });
    return false;
  }
};
*/

// ADDITIONAL FUNCTIONS FOR TESTING AND DEBUGGING

// COMMENTED OUT - Using RevenueCat instead of Stripe
/*
// Test Stripe connection
export const testStripeConnection = onCall(
  async (request: CallableRequest<any>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      // Test Stripe connection by listing products
      const products = await getStripe().products.list({ limit: 1 });

      return {
        success: true,
        message: `Stripe connection successful. Found ${products.data.length} products.`,
        config: {
          hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
          hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        }
      };
    } catch (error) {
      Logger.error('Stripe connection test failed:', { error: (error as Error) });
      return {
        success: false,
        message: `Stripe connection failed: ${(error as Error).message}`,
      };
    }
  }
);
*/// Health check endpoint (Stripe references commented out)
export const healthCheck = onRequest((req, res) => {
  try {
    // const config = getStripeConfig(); // COMMENTED OUT - Using RevenueCat instead of Stripe

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'unknown',
      project: process.env.GCLOUD_PROJECT || 'unknown',
      region: process.env.FUNCTION_REGION || 'unknown',
      // stripe: { // COMMENTED OUT - Using RevenueCat instead of Stripe
      //   hasSecretKey: !!config.secretKey,
      //   hasWebhookSecret: !!config.webhookSecret,
      // }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: (error as Error),
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug webhook (for testing webhook delivery)
export const debugWebhook = onRequest((req, res) => {
  Logger.info('=== DEBUG WEBHOOK ===', {});
  Logger.info('Method', { value: req.method });
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  Logger.info('Body type', { value: typeof req.body });
  Logger.info('Body length', { value: req.body?.length || 0 });
  console.log('Raw body preview:', req.body?.toString().substring(0, 200));

  res.status(200).json({
    message: 'Debug webhook received',
    method: req.method,
    contentType: req.headers['content-type'],
    hasSignature: !!req.headers['stripe-signature'],
    bodyLength: req.body?.length || 0,
    timestamp: new Date().toISOString(),
  });
});

// Test DeviceCheck functionality
// Test endpoint to mark a device as used (for testing blocking logic)
export const markDeviceUsed = onRequest({ cors: true }, async (req: Request, res: Response) => {
  try {
    const { deviceToken } = req.body.data || req.body;

    if (!deviceToken) {
      res.status(400).json({ error: 'deviceToken is required' });
      return;
    }

    const db = admin.firestore();
    await db.collection('device_tracking').doc(deviceToken).set({
      hasCreatedAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      testDevice: true
    });

    res.json({ success: true, message: 'Device marked as used', deviceToken });
  } catch (error) {
    Logger.error('Error marking device as used', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to mark device as used' });
  }
});

// Simple endpoint to save device token for testing
export const saveDeviceToken = onRequest({ cors: true }, async (req: Request, res: Response) => {
  try {
    const deviceToken = req.query.token as string;

    if (!deviceToken) {
      res.status(400).json({ error: 'token parameter is required' });
      return;
    }

    const db = admin.firestore();
    await db.collection('device_tracking').doc(deviceToken).set({
      hasCreatedAccount: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      testDevice: true
    });

    res.json({
      success: true,
      message: 'Device token saved',
      deviceToken: deviceToken.substring(0, 20) + '...'
    });
  } catch (error) {
    Logger.error('Error saving device token', { error: (error as Error).message });
    res.status(500).json({ error: 'Failed to save device token' });
  }
});

export const testDeviceCheck = onRequest(async (req: Request, res: Response) => {
  try {
    const { deviceToken, action } = req.body;

    if (!deviceToken) {
      res.status(400).json({ error: 'deviceToken is required' });
      return;
    }

    if (action === 'query') {
      const result = await queryDeviceCheck(deviceToken);
      res.status(200).json({
        success: true,
        action: 'query',
        result: result
      });
    } else if (action === 'update') {
      const { bit0, bit1 } = req.body;
      await updateDeviceCheck(deviceToken, { bit0, bit1 });
      res.status(200).json({
        success: true,
        action: 'update',
        message: 'DeviceCheck bits updated successfully'
      });
    } else {
      res.status(400).json({ error: 'action must be "query" or "update"' });
    }

  } catch (error) {
    Logger.error('DeviceCheck test failed', { error: (error as Error).message });
    res.status(500).json({
      error: `DeviceCheck test failed: ${(error as Error).message}`
    });
  }
});

// Function to test Plaid webhooks using sandbox fire_webhook endpoint
export const testPlaidWebhook = onCall(
  async (request: CallableRequest<{
    webhookType: 'DEFAULT_UPDATE' | 'NEW_ACCOUNTS_AVAILABLE' | 'SMS_MICRODEPOSITS_VERIFICATION' | 'LOGIN_REPAIRED';
    webhookCode?: string;
    accessToken: string;
  }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    const { webhookType, webhookCode, accessToken } = request.data;

    if (!webhookType || !accessToken) {
      throw new HttpsError('invalid-argument', 'webhookType and accessToken are required');
    }

    try {
      const plaidConfig = getPlaidConfig();
      console.log(`🧪 Testing Plaid webhook: ${webhookType} for user: ${request.auth.uid}`);

      // Prepare the request body for Plaid sandbox webhook
      const requestBody: any = {
        client_id: plaidConfig.clientId,
        secret: plaidConfig.secret,
        access_token: accessToken,
        webhook_type: webhookType,
      };

      // Add webhook-specific parameters
      if (webhookType === 'DEFAULT_UPDATE' && webhookCode) {
        // For DEFAULT_UPDATE, you can specify product types like AUTH, TRANSACTIONS, etc.
        requestBody.webhook_code = webhookCode;
      }

      Logger.info('📤 Sending sandbox webhook request', {
        value: {
          webhook_type: webhookType,
          webhook_code: webhookCode,
          user_id: request.auth.uid,
        }
      });

      const response = await fetch(`https://${plaidConfig.environment}.plaid.com/sandbox/item/fire_webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();
        Logger.error('❌ Plaid sandbox webhook failed:', { error: errorData });
        throw new HttpsError('internal', `Plaid sandbox webhook failed: ${errorData.error_message || 'Unknown error'}`);
      }

      const responseData = await response.json();
      Logger.info('✅ Plaid sandbox webhook fired successfully', { value: responseData });

      return {
        success: true,
        message: `Successfully triggered ${webhookType} webhook`,
        webhookType: webhookType,
        webhookCode: webhookCode,
        timestamp: new Date().toISOString(),
        response: responseData
      };

    } catch (error) {
      Logger.error('❌ Error testing Plaid webhook:', { error: (error as Error) });

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', `Failed to test webhook: ${(error as Error).message}`);
    }
  }
);

// Direct webhook test function (no auth required for testing)
export const directTestPlaidWebhook = onRequest(async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    Logger.info('🧪 Direct Plaid webhook test starting...', {});

    const accessToken = 'access-sandbox-6193d89e-9a8a-48a3-af09-88d86d13dbb1';
    const webhookType = 'DEFAULT_UPDATE';
    const webhookCode = 'TRANSACTIONS';

    const plaidConfig = getPlaidConfig();
    console.log(`🧪 Testing webhook: ${webhookType} with code: ${webhookCode}`);

    // Prepare the request body for Plaid sandbox webhook
    const requestBody = {
      client_id: plaidConfig.clientId,
      secret: plaidConfig.secret,
      access_token: accessToken,
      webhook_type: webhookType,
      webhook_code: webhookCode,
    };

    Logger.info('📤 Firing Plaid sandbox webhook...', {});

    const response = await fetch(`https://${plaidConfig.environment}.plaid.com/sandbox/item/fire_webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json();
      Logger.error('❌ Plaid webhook failed:', { error: errorData });
      res.status(500).json({
        success: false,
        error: errorData,
        message: 'Plaid webhook failed'
      });
      return;
    }

    const responseData = await response.json();
    Logger.info('✅ Plaid webhook fired successfully! Response', { value: responseData });

    res.status(200).json({
      success: true,
      message: 'Webhook fired successfully!',
      webhookType,
      webhookCode,
      plaidResponse: responseData,
      timestamp: new Date().toISOString(),
      instructions: 'Check Firebase Functions logs for webhook processing details'
    });

  } catch (error) {
    Logger.error('❌ Error in direct webhook test:', { error: (error as Error) });
    res.status(500).json({
      success: false,
      error: (error as Error),
      message: 'Internal server error'
    });
  }
});

// Sync bank connection data to plaid_items for webhook processing
// export const syncBankConnectionToPlaidItems = onRequest(async (req: Request, res: Response) => {
//   if (req.method !== 'POST') {
//     res.status(405).json({ error: 'Method not allowed' });
//     return;
//   }

//   try {
//     Logger.info('🔄 Syncing bank connection to plaid_items...', {});

//     const { userId, itemId, accessToken } = req.body;

//     if (!userId || !itemId || !accessToken) {
//       res.status(400).json({
//         error: 'Missing required fields: userId, itemId, and accessToken are required'
//       });
//       return;
//     }

//     // Create plaid_items document for webhook processing
//     await db.collection('plaid_items').doc(itemId).set({
//       itemId: itemId,
//       userId: userId,
//       institutionId: 'ins_109511',
//       institutionName: 'Tartan Bank',
//       accessToken: accessToken,
//       accounts: [
//         { accountId: 'sample_account_1', name: 'Checking Account', type: 'depository', subtype: 'checking' },
//         { accountId: 'sample_account_2', name: 'Savings Account', type: 'depository', subtype: 'savings' }
//       ],
//       isActive: true,
//       status: 'good',
//       needsReauth: false,
//       connectedAt: new Date('2025-08-31T18:46:51.613Z'),
//       lastSyncAt: new Date('2025-08-31T18:46:51.613Z'),
//       createdAt: admin.firestore.FieldValue.serverTimestamp(),
//       updatedAt: admin.firestore.FieldValue.serverTimestamp(),
//     }, { merge: true });

//     Logger.info('✅ Successfully created plaid_items document', {});

//     res.status(200).json({
//       success: true,
//       message: 'Bank connection synced to plaid_items',
//       itemId: itemId,
//       userId: userId,
//       timestamp: new Date().toISOString()
//     });

//   } catch (error) {
//     Logger.error('❌ Error syncing to plaid_items:', { error: (error as Error) });
//     res.status(500).json({
//       success: false,
//       error: (error as Error),
//       message: 'Failed to sync bank connection'
//     });
//   }
// });

// Function to manually trigger user initialization (for testing)
// export const initializeTestUser = onCall(
//   async (request: CallableRequest<{ email: string; displayName: string }>) => {
//     if (!request.auth) {
//       throw new HttpsError('unauthenticated', 'User must be authenticated');
//     }

//     try {
//       const userId = request.auth.uid;
//       const { email, displayName } = request.data;

//       // Manually trigger user initialization
//       const mockUser = {
//         uid: userId,
//         email: email,
//         displayName: displayName,
//       } as admin.auth.UserRecord;

//       // Call the user creation function directly
//       await exports.onUserCreate(mockUser);

//       return {
//         success: true,
//         userId: userId,
//       };
//     } catch (error) {
//       Logger.error('Error initializing test user:', { error: (error as Error) });
//       throw new HttpsError('internal', 'Failed to initialize user');
//     }
//   }
// );

// =====================================================
// TEAM MANAGEMENT FUNCTIONS
// =====================================================

/**
 * Cloud Function to send team invitation emails
 * Triggered when a team invitation is created
 */
export const sendTeamInvitationEmail = functionsV1.firestore
  .document('teamInvitations/{invitationId}')
  .onCreate(async (snapshot, context) => {
    try {
      const invitation = snapshot.data();
      // const invitationId = context.params.invitationId;

      // Get account holder information
      const accountHolderDoc = await db.collection('users').doc(invitation.accountHolderId).get();
      if (!accountHolderDoc.exists) {
        Logger.error('Account holder not found:', { error: invitation.accountHolderId.message });
        return;
      }

      const accountHolder = accountHolderDoc.data()!;
      const accountHolderEmail = accountHolder.email;
      const accountHolderName = accountHolder.displayName || accountHolderEmail;

      // Update invitation with account holder email
      await snapshot.ref.update({
        accountHolderEmail: accountHolderEmail,
      });

      // Create invitation link
      const invitationLink = `https://receiptgold.com/team/accept?token=${invitation.token}`;

      // Email content
      const subject = `${accountHolderName} invited you to join their ReceiptGold team`;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Team Invitation - ReceiptGold</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #DAA520;">ReceiptGold</h1>
          </div>
          
          <h2 style="color: #DAA520; text-align: center;">You've been invited to join a team!</h2>
          
          <p>Hello,</p>
          
          <p><strong>${accountHolderName}</strong> (${accountHolderEmail}) has invited you to join their team on ReceiptGold.</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #DAA520;">What is ReceiptGold?</h3>
            <p>ReceiptGold is a professional receipt management and expense tracking platform that helps businesses organize, categorize, and track their receipts for tax preparation and financial reporting.</p>
          </div>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #2E5BBA;">As a team member, you'll be able to:</h3>
            <ul>
              <li>Add receipts to ${accountHolderName}'s account</li>
              <li>Edit and manage your own receipts</li>
              <li>Help organize business expenses</li>
              <li>Access the ReceiptGold mobile and web apps</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${invitationLink}" style="background-color: #DAA520; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accept Invitation</a>
          </div>
          
          <p><small>This invitation will expire on ${new Date(invitation.expiresAt.toDate()).toLocaleDateString()}.</small></p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #666; text-align: center;">
            If you didn't expect this invitation, you can safely ignore this email.<br>
            This invitation was sent to ${invitation.inviteEmail}.
          </p>
        </body>
        </html>
      `;

      // Send email using SendGrid
      Logger.info('📧 Team invitation email details:', {});
      Logger.info('To', { value: invitation.inviteEmail });
      Logger.info('From', { value: accountHolderEmail });
      Logger.info('Subject', { value: subject });
      Logger.info('Invitation Link', { value: invitationLink });
      console.log('Expires:', invitation.expiresAt.toDate());

      // Get SendGrid API key from environment
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      if (!sendgridApiKey) {
        Logger.error('❌ SENDGRID_API_KEY environment variable not set', {});
        throw new Error('SendGrid API key not configured');
      }

      // Configure SendGrid
      sgMail.setApiKey(sendgridApiKey);

      const msg = {
        to: invitation.inviteEmail,
        from: 'noreply@receiptgold.com', // Use verified SendGrid sender
        replyTo: accountHolderEmail, // Reply to account holder
        subject: subject,
        html: htmlContent,
        text: `${accountHolderName} invited you to join their ReceiptGold team\n\nAccept your invitation: ${invitationLink}\n\nThis invitation will expire on ${new Date(invitation.expiresAt.toDate()).toLocaleDateString()}.`
      };

      // Send the email
      const response = await sgMail.send(msg);
      Logger.info('✅ Team invitation email sent successfully to', { value: invitation.inviteEmail });
      Logger.info('📧 SendGrid response status', { value: response[0].statusCode });

      // Mark invitation as email sent (optional status tracking)
      await snapshot.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      Logger.info('✅ Team invitation email processed for', { value: invitation.inviteEmail });

    } catch (error) {
      Logger.error('❌ Error sending team invitation email:', { error: (error as Error) });

      // Update invitation with error status
      await snapshot.ref.update({
        emailError: (error as Error).message,
        emailSent: false,
      });
    }
  });

/**
 * Clean up expired team invitations
 * Runs daily to remove expired invitations
 */
export const cleanupExpiredInvitations = functionsV1.pubsub
  .schedule('every 24 hours')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      const expiredInvitationsQuery = db.collection('teamInvitations')
        .where('expiresAt', '<', now)
        .where('status', '==', 'pending');

      const expiredInvitations = await expiredInvitationsQuery.get();

      if (expiredInvitations.empty) {
        Logger.info('No expired invitations to clean up', {});
        return;
      }

      const batch = db.batch();
      let count = 0;

      expiredInvitations.forEach((doc) => {
        batch.update(doc.ref, {
          status: 'expired',
          expiredAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
      });

      await batch.commit();
      Logger.info(`Cleaned up ${count} expired team invitations`, {});

    } catch (error) {
      Logger.error('❌ Error cleaning up expired invitations:', { error: (error as Error) });
    }
  });

/**
 * Handle team member removal
 * Clean up data when a team member is removed
 */
export const onTeamMemberRemoved = functionsV1.firestore
  .document('teamMembers/{memberId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();

      // Check if member status changed to suspended
      if (before.status === 'active' && after.status === 'suspended') {
        const memberId = context.params.memberId;
        const userId = after.userId;
        const memberEmail = after.email;

        Logger.info(`Team member ${userId} (${memberEmail}) was removed/suspended, performing complete account deletion...`, {});

        try {
          // 1. Delete the Firebase Auth user account completely
          await admin.auth().deleteUser(userId);
          console.log(`🔥 Deleted Firebase Auth account for user ${userId}`);

          // 2. Delete user's Firestore document
          await db.collection('users').doc(userId).delete();
          console.log(`📄 Deleted user document for ${userId}`);

          // 3. Delete all user's receipts
          const receiptsQuery = db.collection('receipts').where('userId', '==', userId);
          const receiptsSnapshot = await receiptsQuery.get();
          const receiptBatch = db.batch();

          receiptsSnapshot.docs.forEach(doc => {
            receiptBatch.delete(doc.ref);
          });

          if (!receiptsSnapshot.empty) {
            await receiptBatch.commit();
            console.log(`🧾 Deleted ${receiptsSnapshot.size} receipts for user ${userId}`);
          }

          // 4. Delete all user's budgets
          const budgetsQuery = db.collection('budgets').where('userId', '==', userId);
          const budgetsSnapshot = await budgetsQuery.get();
          const budgetBatch = db.batch();

          budgetsSnapshot.docs.forEach(doc => {
            budgetBatch.delete(doc.ref);
          });

          if (!budgetsSnapshot.empty) {
            await budgetBatch.commit();
            console.log(`💰 Deleted ${budgetsSnapshot.size} budgets for user ${userId}`);
          }

          // 5. Finally delete the team member document
          await change.after.ref.delete();
          console.log(`👥 Deleted team member document ${memberId}`);

          Logger.info('COMPLETE ACCOUNT DELETION: User ${userId} (${memberEmail}) has been permanently removed', {});

        } catch (deleteError) {
          console.error(`❌ Error during complete account deletion for user ${userId}:`, deleteError);

          // Still update the removal timestamp even if deletion fails
          await change.after.ref.update({
            removedAt: admin.firestore.FieldValue.serverTimestamp(),
            deletionError: deleteError instanceof Error ? deleteError.message : String(deleteError),
          });

          throw deleteError; // Re-throw to trigger function retry
        }
      }

    } catch (error) {
      Logger.error('❌ Error handling team member removal:', { error: (error as Error) });
    }
  });

// RevenueCat webhook for handling subscription events
export const revenueCatWebhookHandler = onRequest(async (req: Request, res: Response) => {
  Logger.info('RevenueCat webhook received', {});

  if (req.method !== 'POST') {
    Logger.error('Invalid method for RevenueCat webhook', { method: req.method });
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verify authorization header for security
    const authHeader = req.headers['authorization'] as string;
    const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
      Logger.info('❌ Invalid authorization header', {});
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (expectedAuth) {
      Logger.info('🔒 Webhook authorization verified', {});
    } else {
      Logger.info('⚠️ No webhook secret configured - skipping auth verification', {});
    }

    const body = req.body;
    const event = body.event; // RevenueCat nests the actual event data
    Logger.info('RevenueCat event received', { eventType: event.type, eventData: body });

    // Handle different event types with full business logic
    switch (event.type) {
      case 'INITIAL_PURCHASE':
        await handleRevenueCatSubscriptionCreated(event);
        break;

      case 'RENEWAL':
        await handleRevenueCatPaymentSucceeded(event);
        break;

      case 'PRODUCT_CHANGE':
        await handleRevenueCatSubscriptionUpdated(event);
        break;

      case 'CANCELLATION':
      case 'EXPIRATION':
        await handleRevenueCatSubscriptionDeleted(event);
        break;

      case 'UNCANCELLATION':
        await handleRevenueCatSubscriptionReactivated(event);
        break;

      case 'BILLING_ISSUE':
        await handleRevenueCatPaymentFailed(event);
        break;

      case 'SUBSCRIBER_ALIAS':
        await handleRevenueCatSubscriberAlias(event);
        break;

      case 'NON_RENEWING_PURCHASE':
        await handleRevenueCatOneTimePurchase(event);
        break;

      default:
        Logger.info('Unhandled RevenueCat event type: ${event.type}', {});
    }

    res.status(200).json({ received: true });
  } catch (error) {
    Logger.error('Error processing RevenueCat webhook', { error: (error as Error) });
    res.status(500).json({ error: 'Internal server error', eventType: req.body?.event?.type, eventId: req.body?.event?.id });
  }
});

// Helper function to get the correct user ID from RevenueCat event
function getFirebaseUserIdFromRevenueCatEvent(event: any): string | null {
  Logger.info('Extracting Firebase user ID from RevenueCat event', { event });

  const { original_app_user_id, app_user_id, aliases } = event;

  // Check aliases for Firebase Auth user ID (not anonymous ID)
  if (aliases && Array.isArray(aliases)) {
    for (const alias of aliases) {
      if (alias && !alias.startsWith('$RCAnonymousID:')) {
        console.log(`Using Firebase Auth user ID from aliases: ${alias}`);
        return alias;
      }
    }
  }

  // Fall back to app_user_id if it's not anonymous
  if (app_user_id && !app_user_id.startsWith('$RCAnonymousID:')) {
    console.log(`Using app_user_id: ${app_user_id}`);
    return app_user_id;
  }

  // Last resort: use original_app_user_id
  console.log(`Using original_app_user_id: ${original_app_user_id}`);
  return original_app_user_id;
}

// RevenueCat handler for INITIAL_PURCHASE (equivalent to Stripe subscription.created)
async function handleRevenueCatSubscriptionCreated(event: any): Promise<void> {
  try {
    const { product_id, event_timestamp_ms } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);
    Logger.info('Handling RevenueCat subscription creation and contrived userID', { event, userId });

    console.log(`Processing RevenueCat subscription created for user: ${userId}`);

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      throw new Error('No userId in RevenueCat event');
    }

    console.log(`Processing subscription for user: ${userId}`);

    // Validate product ID exists
    if (!product_id) {
      throw new Error(`No product_id found in RevenueCat event`);
    }

    console.log(`RevenueCat Product ID: ${product_id}`);

    // Determine tier from product ID with validation
    const tier: string = mapProductIdToTier(product_id);

    if (!subscriptionTiers[tier]) {
      console.error(`Invalid tier determined: ${tier} for product ID: ${product_id}`);
      throw new Error(`Invalid subscription tier: ${tier}`);
    }

    console.log(`Determined subscription tier: ${tier}`);

    // Prepare subscription update (ported from Stripe logic)
    const subscriptionUpdate: any = {
      userId,
      currentTier: tier,
      status: 'active', // RevenueCat subscriptions are active when purchased
      billing: {
        revenueCatUserId: userId,
        productId: product_id,
        originalPurchaseDate: new Date(event_timestamp_ms),
        latestPurchaseDate: new Date(event_timestamp_ms),
        expiresDate: null, // RevenueCat doesn't provide this in webhook
        isActive: true,
        willRenew: true,
        unsubscribeDetectedAt: null,
        billingIssueDetectedAt: null,
      },
      limits: subscriptionTiers[tier].limits,
      features: subscriptionTiers[tier].features,
      history: admin.firestore.FieldValue.arrayUnion({
        tier: tier,
        startDate: new Date(event_timestamp_ms),
        endDate: null,
        reason: "initial_purchase"
      }),
      lastRevenueCatEvent: {
        type: event.type,
        productId: product_id,
        timestamp: new Date(event_timestamp_ms),
        eventData: event
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    Logger.info('Saving RevenueCat subscription data for user', { value: userId });

    // Save to Firestore with transaction for consistency (ported from Stripe)
    await db.runTransaction(async (transaction) => {
      const subscriptionRef = db.collection("subscriptions").doc(userId);
      const doc = await transaction.get(subscriptionRef);

      let finalSubscriptionUpdate = { ...subscriptionUpdate };

      if (doc.exists) {
        const currentData = doc.data();
        console.log("🚀 ~ handleRevenueCatSubscriptionCreated ~ currentData:", currentData)

        // End trial when confirming subscription (if trial is still active)
        const trialData = currentData?.trial;
        const currentTrialActive = trialData?.isActive !== false && // if isActive is undefined or true
          trialData?.expiresAt &&
          trialData.expiresAt.toDate() > new Date(); // and not expired

        if (currentTrialActive) {
          console.log(`🏁 Ending trial for user upgrading to paid subscription: ${tier}`);
          finalSubscriptionUpdate.trial = {
            isActive: false,
            startedAt: currentData?.trial?.startedAt || admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: admin.firestore.FieldValue.serverTimestamp(), // End trial immediately
            endedEarly: true,
            endReason: 'upgraded_to_paid'
          };
        }

        // Update existing subscription
        transaction.update(subscriptionRef, finalSubscriptionUpdate);
        console.log(`Updated existing subscription for user ${userId}`);
      } else {
        // Create new subscription document
        transaction.set(subscriptionRef, {
          ...finalSubscriptionUpdate,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Created new subscription for user ${userId}`);
      }

      // Also create/update the user's usage document for current month
      const currentMonth: string = new Date().toISOString().slice(0, 7);
      const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);

      // Use set with merge to create document if it doesn't exist
      transaction.set(usageRef, {
        userId,
        month: currentMonth,
        receiptsUploaded: 0,
        apiCalls: 0,
        reportsGenerated: 0,
        limits: subscriptionTiers[tier].limits,
        resetDate: new Date(
          new Date().getFullYear(),
          new Date().getMonth() + 1,
          1
        ).toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    Logger.info('Successfully processed RevenueCat subscription creation for user ${userId}', {});

  } catch (error) {
    Logger.error('Error in handleRevenueCatSubscriptionCreated:', { error: (error as Error) });
    // Re-throw to trigger webhook retry if it's a transient error
    throw error;
  }
}

// RevenueCat handler for PRODUCT_CHANGE (equivalent to Stripe subscription.updated)
async function handleRevenueCatSubscriptionUpdated(event: any): Promise<void> {
  try {
    const { product_id, new_product_id, event_timestamp_ms } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    console.log(`Processing RevenueCat subscription updated for user: ${userId}`);

    // Use new_product_id for product changes
    const effectiveProductId = new_product_id || product_id;
    const tier: string = mapProductIdToTier(effectiveProductId);

    // Get current tier for comparison
    const subscriptionRef = db.collection("subscriptions").doc(userId);
    const currentSub = await subscriptionRef.get();
    const currentTier = currentSub.data()?.currentTier || 'trial';

    // Prepare subscription update data
    const subscriptionUpdateData: any = {
      currentTier: tier,
      status: 'active',
      billing: {
        revenueCatUserId: userId,
        productId: effectiveProductId,
        latestPurchaseDate: new Date(event_timestamp_ms),
        isActive: true,
        willRenew: true,
      },
      limits: subscriptionTiers[tier].limits,
      features: subscriptionTiers[tier].features,
      history: admin.firestore.FieldValue.arrayUnion({
        tier: tier,
        startDate: new Date(event_timestamp_ms),
        endDate: null,
        reason: "product_change"
      }),
      lastRevenueCatEvent: {
        type: event.type,
        productId: effectiveProductId,
        timestamp: new Date(event_timestamp_ms),
        eventData: event
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // End trial when confirming subscription (if trial is still active) and tier is not trial
    const currentData = currentSub.data();
    const trialData = currentData?.trial;
    const currentTrialActive = trialData?.isActive !== false && // if isActive is undefined or true
      trialData?.expiresAt &&
      trialData.expiresAt.toDate() > new Date(); // and not expired

    if (currentTrialActive && tier !== 'trial') {
      console.log(`🏁 Ending trial for user upgrading to paid subscription: ${tier}`);
      subscriptionUpdateData.trial = {
        isActive: false,
        startedAt: currentData?.trial?.startedAt || admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.FieldValue.serverTimestamp(), // End trial immediately
        endedEarly: true,
        endReason: 'upgraded_to_paid'
      };
    }

    // Update subscription document (ported from Stripe logic)
    await subscriptionRef.update(subscriptionUpdateData);

    // Update usage limits if downgrading (ported from Stripe logic)
    if (shouldUpdateUsageLimits(currentTier, tier)) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const usageRef = db.collection('usage').doc(`${userId}_${currentMonth}`);

      await usageRef.set({
        limits: subscriptionTiers[tier]?.limits || subscriptionTiers.trial.limits,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      Logger.info('Updated usage limits for ${currentMonth} due to tier change', {});
    }

    Logger.info('Successfully processed RevenueCat subscription update for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatSubscriptionUpdated:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for CANCELLATION/EXPIRATION (equivalent to Stripe subscription.deleted)
async function handleRevenueCatSubscriptionDeleted(event: any): Promise<void> {
  try {
    const { event_timestamp_ms } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);

    Logger.info('RevenueCat subscription deleted for user and the event', { value: userId, event });

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    console.log(`Processing RevenueCat subscription deleted for user: ${userId}`);

    // Downgrade to trial tier (ported from Stripe logic)
    const subscriptionRef = db.collection("subscriptions").doc(userId);

    // Use transaction to handle creating document if it doesn't exist
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(subscriptionRef);

      const updateData: any = {
        currentTier: "trial",
        status: event.type === 'CANCELLATION' ? "canceled" : "expired",
        billing: {
          isActive: false,
          willRenew: false,
          unsubscribeDetectedAt: new Date(event_timestamp_ms),
        },
        limits: subscriptionTiers.trial.limits,
        features: subscriptionTiers.trial.features,
        history: admin.firestore.FieldValue.arrayUnion({
          tier: "trial",
          startDate: new Date(event_timestamp_ms),
          endDate: null,
          reason: event.type === 'CANCELLATION' ? "cancellation" : "expiration"
        }),
        lastRevenueCatEvent: {
          type: event.type,
          timestamp: new Date(event_timestamp_ms),
          eventData: event
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (doc.exists) {
        // Update existing subscription
        transaction.update(subscriptionRef, updateData);
        console.log(`Updated subscription to trial tier for user ${userId}`);
      } else {
        // Create new subscription document with trial tier
        const createData = {
          ...updateData,
          userId: userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        transaction.set(subscriptionRef, createData);
        console.log(`Created new trial tier subscription for user ${userId}`);
      }
    });

    Logger.info('Successfully processed RevenueCat subscription deletion for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatSubscriptionDeleted:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for RENEWAL (equivalent to Stripe invoice.payment_succeeded)
async function handleRevenueCatPaymentSucceeded(event: any): Promise<void> {
  try {
    const { event_timestamp_ms, product_id } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);

    Logger.info('RevenueCat payment succeeded for user', { value: userId });

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    console.log(`Processing successful RevenueCat renewal for user: ${userId}`);

    // Get subscription status in Firestore (ported from Stripe logic)
    const subscriptionRef = db.collection("subscriptions").doc(userId);

    // Determine tier from product ID with validation
    const tier: string = mapProductIdToTier(product_id);

    const updateData: any = {
      status: "active", // Ensure status is active since payment succeeded
      billing: {
        lastPaymentStatus: "succeeded",
        lastPaymentDate: admin.firestore.Timestamp.fromDate(new Date(event_timestamp_ms)),
        latestPurchaseDate: new Date(event_timestamp_ms),
        isActive: true,
        willRenew: true,
        billingIssueDetectedAt: null, // Clear any previous billing issues
        revenueCatUserId: userId,
        productId: product_id,
      },
      lastRevenueCatEvent: {
        type: event.type,
        productId: product_id,
        timestamp: new Date(event_timestamp_ms),
        eventData: event
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Use transaction to handle creating document if it doesn't exist
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(subscriptionRef);

      if (doc.exists) {
        // Update existing subscription
        transaction.update(subscriptionRef, updateData);
        console.log(`Updated existing subscription for user ${userId}`);
      } else {
        // Create new subscription document with defaults
        const createData = {
          ...updateData,
          userId: userId,
          currentTier: tier,
          limits: subscriptionTiers[tier]?.limits || subscriptionTiers.trial.limits,
          features: subscriptionTiers[tier]?.features || subscriptionTiers.trial.features,
          history: [{
            tier: tier,
            startDate: new Date(event_timestamp_ms),
            endDate: null,
            reason: "payment_succeeded"
          }],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        transaction.set(subscriptionRef, createData);
        console.log(`Created new subscription for user ${userId} with tier ${tier}`);
      }
    });

    Logger.info('Successfully processed RevenueCat payment success for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatPaymentSucceeded:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for BILLING_ISSUE (equivalent to Stripe invoice.payment_failed)
async function handleRevenueCatPaymentFailed(event: any): Promise<void> {
  try {
    const { event_timestamp_ms } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);

    Logger.info('RevenueCat payment failed for user', { value: userId });

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    // Update subscription status (ported from Stripe logic)
    await db.collection("subscriptions").doc(userId).update({
      status: "past_due",
      "billing.lastPaymentStatus": "failed",
      "billing.billingIssueDetectedAt": new Date(event_timestamp_ms),
      "billing.willRenew": false,
      lastRevenueCatEvent: {
        type: event.type,
        timestamp: new Date(event_timestamp_ms),
        eventData: event
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    Logger.info('Successfully processed RevenueCat payment failure for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatPaymentFailed:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for UNCANCELLATION
async function handleRevenueCatSubscriptionReactivated(event: any): Promise<void> {
  try {
    const { product_id, event_timestamp_ms } = event;
    const userId = getFirebaseUserIdFromRevenueCatEvent(event);

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    console.log(`Processing RevenueCat subscription reactivation for user: ${userId}`);

    const tier: string = mapProductIdToTier(product_id);

    const subscriptionRef = db.collection("subscriptions").doc(userId);

    // Use transaction to handle creating document if it doesn't exist
    await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(subscriptionRef);

      const updateData: any = {
        currentTier: tier,
        status: 'active',
        billing: {
          isActive: true,
          willRenew: true,
          unsubscribeDetectedAt: null, // Clear cancellation
          billingIssueDetectedAt: null,
          revenueCatUserId: userId,
          productId: product_id,
        },
        limits: subscriptionTiers[tier].limits,
        features: subscriptionTiers[tier].features,
        history: admin.firestore.FieldValue.arrayUnion({
          tier: tier,
          startDate: new Date(event_timestamp_ms),
          endDate: null,
          reason: "uncancellation"
        }),
        lastRevenueCatEvent: {
          type: event.type,
          productId: product_id,
          timestamp: new Date(event_timestamp_ms),
          eventData: event
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (doc.exists) {
        // Update existing subscription
        transaction.update(subscriptionRef, updateData);
        console.log(`Reactivated subscription for user ${userId}`);
      } else {
        // Create new subscription document
        const createData = {
          ...updateData,
          userId: userId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        transaction.set(subscriptionRef, createData);
        console.log(`Created new subscription for reactivated user ${userId}`);
      }
    });

    Logger.info('Successfully processed RevenueCat subscription reactivation for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatSubscriptionReactivated:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for SUBSCRIBER_ALIAS (when user accounts are merged)
async function handleRevenueCatSubscriberAlias(event: any): Promise<void> {
  Logger.info('Processing RevenueCat subscriber alias event', { event });
  try {
    const { original_app_user_id, new_app_user_id } = event;

    Logger.info('RevenueCat subscriber alias event', {
      originalUserId: original_app_user_id,
      newUserId: new_app_user_id
    });

    // This event indicates user account merge - typically handled by RevenueCat automatically
    // Log for debugging purposes but usually no action needed

  } catch (error) {
    Logger.error('Error in handleRevenueCatSubscriberAlias:', { error: (error as Error) });
    throw error;
  }
}

// RevenueCat handler for NON_RENEWING_PURCHASE (one-time purchases)
async function handleRevenueCatOneTimePurchase(event: any): Promise<void> {
  try {
    const { product_id, original_app_user_id } = event;
    const userId = original_app_user_id;

    Logger.info('RevenueCat one-time purchase for user', {
      userId: userId,
      productId: product_id
    });

    if (!userId) {
      Logger.error('No userId found in RevenueCat event', { eventType: event.type });
      return;
    }

    // Handle one-time purchases (e.g., credits, premium features)
    // This depends on your specific business logic for non-subscription products

    // TODO: Future implementation for one-time purchases
    /*
    // Map product IDs to one-time purchase types
    const oneTimePurchaseTypes = {
      // Receipt processing credits
      'credits_10': { type: 'receipt_credits', amount: 10, description: '10 Receipt Processing Credits' },
      'credits_25': { type: 'receipt_credits', amount: 25, description: '25 Receipt Processing Credits' },
      'credits_50': { type: 'receipt_credits', amount: 50, description: '50 Receipt Processing Credits' },

      // Premium features
      'advanced_reports': { type: 'feature_unlock', feature: 'advanced_reports', description: 'Advanced Reports Feature' },
      'bulk_export': { type: 'feature_unlock', feature: 'bulk_export', description: 'Bulk Export Feature' },

      // Storage upgrades
      'storage_1gb': { type: 'storage_upgrade', amount: 1024, description: '1GB Extra Storage' },
      'storage_5gb': { type: 'storage_upgrade', amount: 5120, description: '5GB Extra Storage' },
    };
    */

    Logger.info('Successfully processed RevenueCat one-time purchase for user ${userId}', {});
  } catch (error) {
    Logger.error('Error in handleRevenueCatOneTimePurchase:', { error: (error as Error) });
    throw error;
  }
}

/* TODO: Future implementation - One-time purchase helper functions

// Grant receipt processing credits to user
async function grantReceiptCredits(userId: string, credits: number, timestamp: number, productId: string): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      receiptCredits: admin.firestore.FieldValue.increment(credits),
      creditsPurchaseHistory: admin.firestore.FieldValue.arrayUnion({
        amount: credits,
        productId: productId,
        purchaseDate: new Date(timestamp),
        source: 'one_time_purchase'
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    Logger.info('Granted ${credits} receipt credits to user ${userId}', {});
  } catch (error) {
    Logger.error('Error granting receipt credits:', { error: (error as Error) });
    throw error;
  }
}

// Unlock premium feature for user
async function unlockPremiumFeature(userId: string, feature: string, timestamp: number, productId: string): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      [`premiumFeatures.${feature}`]: true,
      featurePurchaseHistory: admin.firestore.FieldValue.arrayUnion({
        feature: feature,
        productId: productId,
        purchaseDate: new Date(timestamp),
        source: 'one_time_purchase'
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    Logger.info('Unlocked premium feature ${feature} for user ${userId}', {});
  } catch (error) {
    Logger.error('Error unlocking premium feature:', { error: (error as Error) });
    throw error;
  }
}

// Grant storage upgrade to user
async function grantStorageUpgrade(userId: string, storageAmount: number, timestamp: number, productId: string): Promise<void> {
  try {
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      extraStorageMB: admin.firestore.FieldValue.increment(storageAmount),
      storagePurchaseHistory: admin.firestore.FieldValue.arrayUnion({
        amount: storageAmount,
        productId: productId,
        purchaseDate: new Date(timestamp),
        source: 'one_time_purchase'
      }),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    Logger.info('Granted ${storageAmount}MB storage to user ${userId}', {});
  } catch (error) {
    Logger.error('Error granting storage upgrade:', { error: (error as Error) });
    throw error;
  }
}

// Record one-time purchase in purchase history
async function recordOneTimePurchase(userId: string, purchaseData: any): Promise<void> {
  try {
    const purchaseRef = db.collection('oneTimePurchases').doc();

    await purchaseRef.set({
      userId: userId,
      ...purchaseData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    Logger.info('Recorded one-time purchase in history for user ${userId}', {});
  } catch (error) {
    Logger.error('Error recording one-time purchase:', { error: (error as Error) });
    throw error;
  }
}

*/

// Map RevenueCat product ID to subscription tier
function mapProductIdToTier(productId: string): string {
  const productToTierMap: { [key: string]: string } = {
    'rg_starter': 'starter',
    'rg_growth_monthly': 'growth',
    'rg_growth_annual': 'growth',
    'rg_professional_monthly': 'professional',
    'rg_professional_annual': 'professional'
  };

  return productToTierMap[productId] || 'trial';
}

// Check if usage limits should be updated (when downgrading)
function shouldUpdateUsageLimits(currentTier: string, newTier: string): boolean {
  const tierPriority = { trial: 0, starter: 1, growth: 2, professional: 3 };
  return (tierPriority[newTier as keyof typeof tierPriority] || 0) <
    (tierPriority[currentTier as keyof typeof tierPriority] || 0);
}

// Check account holder subscription status for teammate sign-in
export const checkAccountHolderSubscription = onCall(async (request) => {
  try {
    const { accountHolderId } = request.data;

    if (!accountHolderId) {
      throw new Error('accountHolderId is required');
    }

    Logger.info('Checking account holder subscription status', { accountHolderId });

    // Get account holder's user document to find their subscription
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(accountHolderId).get();

    if (!userDoc.exists) {
      Logger.warn('Account holder not found', { accountHolderId });
      return { hasActiveSubscription: false };
    }

    const userData = userDoc.data();
    const subscription = userData?.subscription;

    if (!subscription) {
      Logger.info('No subscription found for account holder', { accountHolderId });
      return { hasActiveSubscription: false };
    }

    // Check if subscription is active AND includes team management features
    const isActive = subscription.status === 'active' &&
      subscription.tier !== 'trial' &&
      new Date(subscription.expiresAt?.toDate?.() || subscription.expiresAt) > new Date();

    // Check if the tier includes team management features
    // Only growth, professional, and teammate tiers support team management
    const hasTeamManagement = ['growth', 'professional', 'teammate'].includes(subscription.tier);

    const canAccessTeamFeatures = isActive && hasTeamManagement;

    Logger.info('Account holder subscription check result', {
      accountHolderId,
      hasActiveSubscription: isActive,
      hasTeamManagement,
      canAccessTeamFeatures,
      tier: subscription.tier,
      status: subscription.status
    });

    return { hasActiveSubscription: canAccessTeamFeatures };
  } catch (error) {
    Logger.error('Error checking account holder subscription', { error: (error as Error).message });
    // Return false to block access when there's an error, for security
    return { hasActiveSubscription: false };
  }
});


// Automatically manage teammate access when account holder subscription changes
export const onSubscriptionStatusChange = functionsV1.firestore
  .document('subscriptions/{userId}')
  .onUpdate(async (change, context) => {
    try {
      const userId = context.params.userId;
      const beforeData = change.before.data();
      const afterData = change.after.data();

      const beforeSubscription = beforeData;
      const afterSubscription = afterData;

      // Check if subscription status changed from active to inactive
      const wasActive = beforeSubscription?.status === 'active' &&
        beforeSubscription?.currentTier !== 'trial';
      const isNowInactive = afterSubscription?.status !== 'active' ||
        afterSubscription?.currentTier === 'trial';

      if (wasActive && isNowInactive) {
        Logger.info('Account holder subscription became inactive, revoking teammate access', {
          accountHolderId: userId,
          previousStatus: beforeSubscription?.status,
          newStatus: afterSubscription?.status,
          previousTier: beforeSubscription?.currentTier,
          newTier: afterSubscription?.currentTier
        });

        await revokeTeammateAccess(userId);
        return; // Exit early to avoid duplicate processing
      }

      // Check if account holder lost professional tier (but subscription is still active)
      const hadProfessionalTier = beforeSubscription?.currentTier === 'professional';
      const lostProfessionalTier = hadProfessionalTier && afterSubscription?.currentTier !== 'professional';

      if (lostProfessionalTier && afterSubscription?.status === 'active') {
        Logger.info('Account holder lost professional tier, suspending teammates', {
          accountHolderId: userId,
          previousTier: beforeSubscription?.currentTier,
          newTier: afterSubscription?.currentTier
        });

        await suspendTeammatesForProfessionalTierLoss(userId);
      }

      // Check if account holder regained professional tier
      const didNotHaveProfessionalTier = beforeSubscription?.currentTier !== 'professional';
      const regainedProfessionalTier = didNotHaveProfessionalTier && afterSubscription?.currentTier === 'professional';

      if (regainedProfessionalTier && afterSubscription?.status === 'active') {
        Logger.info('Account holder regained professional tier, reactivating suspended teammates', {
          accountHolderId: userId,
          previousTier: beforeSubscription?.currentTier,
          newTier: afterSubscription?.currentTier
        });

        await reactivateTeammatesForProfessionalTier(userId);
      }
    } catch (error) {
      Logger.error('Error handling subscription status change', {
        userId: context.params.userId,
        error: (error as Error).message
      });
    }
  });

// Update device tracking records when an account is deleted
async function updateDeviceTrackingForDeletedAccount(userId: string): Promise<void> {
  try {
    const db = admin.firestore();

    // Get user's subscription status before deletion
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.exists ? userDoc.data() : null;
    const subscription = userData?.subscription;

    // Determine subscription status
    const hadActiveSubscription = subscription?.status === 'active' &&
      subscription?.tier !== 'trial' &&
      new Date(subscription?.expiresAt?.toDate?.() || subscription?.expiresAt) > new Date();

    const subscriptionStatus = subscription?.status || 'none';

    // Find device tracking records directly by userId (much more reliable!)
    const deviceQuery = db.collection('device_tracking')
      .where('userId', '==', userId)
      .where('hasCreatedAccount', '==', true);

    const deviceSnapshot = await deviceQuery.get();

    if (deviceSnapshot.empty) {
      Logger.info('No device tracking records found for deleted user', {
        userId: userId.substring(0, 8) + '...'
      });
      return;
    }

    Logger.info('Found device tracking records for deleted user', {
      userId: userId.substring(0, 8) + '...',
      recordCount: deviceSnapshot.size
    });

    // Update all device records for this user
    const updatePromises = deviceSnapshot.docs.map(async (doc) => {
      try {
        await doc.ref.update({
          accountDeleted: true,
          accountDeletedAt: admin.firestore.FieldValue.serverTimestamp(),
          hadActiveSubscription,
          subscriptionStatus,
          note: `Account deleted - ${hadActiveSubscription ? 'had active subscription' : 'no active subscription'}`
        });

        Logger.info('Updated device tracking record for deleted account', {
          deviceId: doc.id.substring(0, 20) + '...',
          hadActiveSubscription,
          subscriptionStatus
        });
      } catch (updateError) {
        Logger.error('Failed to update device tracking record', {
          deviceId: doc.id.substring(0, 20) + '...',
          error: (updateError as Error).message
        });
      }
    });

    await Promise.all(updatePromises);

    Logger.info('Completed device tracking updates for deleted account', {
      userId: userId.substring(0, 8) + '...',
      recordsUpdated: deviceSnapshot.size,
      hadActiveSubscription,
      subscriptionStatus
    });

  } catch (error) {
    Logger.error('Error updating device tracking for deleted account', {
      userId: userId.substring(0, 8) + '...',
      error: (error as Error).message
    });
    // Don't throw error - this shouldn't block account deletion
  }
}

// Check if device blocking should be bypassed for deleted accounts with unsubscribed status
async function checkDeletedAccountException(deviceData: any, _newEmail: string): Promise<boolean> {
  try {
    // Check if we have stored information about the previous account
    if (!deviceData.createdAt || !deviceData.note) {
      Logger.info('No previous account information available for exception check');
      return false;
    }

    // Look for deleted account markers in the device data
    if (deviceData.accountDeleted === true || deviceData.note?.includes('Account deleted')) {
      Logger.info('Previous account was deleted, checking if it had active subscription/trial');

      // Block recreation if previous account had active subscription or trial
      if (deviceData.hadActiveSubscription === true ||
        deviceData.subscriptionStatus === 'active' ||
        deviceData.subscriptionStatus === 'trialing' ||
        deviceData.note?.includes('had active subscription')) {
        Logger.info('Previous deleted account had active subscription/trial - blocking recreation to prevent abuse');
        return false;
      }

      // Allow recreation if previous account had no active subscription/trial
      Logger.info('Previous deleted account had no active subscription/trial - allowing recreation');
      return true;
    }

    // Additional check: if enough time has passed (e.g., 30 days) since account creation,
    // we can be more lenient and allow new account creation
    const accountCreatedAt = deviceData.createdAt?.toDate ? deviceData.createdAt.toDate() : new Date(deviceData.createdAt);
    const daysSinceCreation = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation > 30) {
      Logger.info('Previous account is older than 30 days - allowing exception', { daysSinceCreation });
      return true;
    }

    Logger.info('No exception criteria met for device blocking bypass');
    return false;
  } catch (error) {
    Logger.error('Error checking deleted account exception', { error: (error as Error).message });
    // On error, don't allow exception to maintain security
    return false;
  }
}

// Helper function to revoke access for all teammates of an account holder
async function revokeTeammateAccess(accountHolderId: string): Promise<void> {
  try {
    const db = admin.firestore();

    // Get all active team members for this account holder
    const teamMembersQuery = db.collection('teamMembers')
      .where('accountHolderId', '==', accountHolderId)
      .where('status', '==', 'active');

    const teamMembersSnapshot = await teamMembersQuery.get();

    if (teamMembersSnapshot.empty) {
      Logger.info('No active team members found for account holder', { accountHolderId });
      return;
    }

    Logger.info('Found team members to revoke access for', {
      accountHolderId,
      count: teamMembersSnapshot.size
    });

    // Revoke refresh tokens for all teammates (this forces them to re-authenticate)
    const revocationPromises = teamMembersSnapshot.docs.map(async (doc) => {
      const teamMember = doc.data();
      const teammateUserId = teamMember.userId;

      try {
        // Revoke all refresh tokens for this user (forces re-authentication)
        await admin.auth().revokeRefreshTokens(teammateUserId);

        // Update the team member record to indicate access was revoked
        await doc.ref.update({
          accessRevokedAt: admin.firestore.FieldValue.serverTimestamp(),
          accessRevokedReason: 'Account holder subscription inactive',
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp()
        });

        Logger.info('Revoked access for teammate', {
          accountHolderId,
          teammateUserId,
          teammateEmail: teamMember.email
        });
      } catch (error) {
        Logger.error('Failed to revoke access for teammate', {
          accountHolderId,
          teammateUserId,
          error: (error as Error).message
        });
      }
    });

    await Promise.all(revocationPromises);
    Logger.info('Completed revoking access for all teammates', { accountHolderId });

  } catch (error) {
    Logger.error('Error revoking teammate access', {
      accountHolderId,
      error: (error as Error).message
    });
    throw error;
  }
}

// Suspend teammates when account holder loses professional tier
async function suspendTeammatesForProfessionalTierLoss(accountHolderId: string): Promise<void> {
  try {
    const db = admin.firestore();

    Logger.info('Professional tier downgrade detected - clearing all team data', { accountHolderId });

    // Get all team members for this account holder (active or suspended)
    const teamMembersQuery = db.collection('teamMembers')
      .where('accountHolderId', '==', accountHolderId);

    const teamMembersSnapshot = await teamMembersQuery.get();

    // Get all team invitations for this account holder
    const teamInvitationsQuery = db.collection('teamInvitations')
      .where('accountHolderId', '==', accountHolderId);

    const teamInvitationsSnapshot = await teamInvitationsQuery.get();

    // Get team stats document
    const teamStatsDoc = await db.collection('teamStats').doc(accountHolderId).get();

    const totalItems = teamMembersSnapshot.size + teamInvitationsSnapshot.size + (teamStatsDoc.exists ? 1 : 0);

    if (totalItems === 0) {
      Logger.info('No team data found for account holder', { accountHolderId });
      return;
    }

    Logger.info('Found team data to clear due to professional tier loss', {
      accountHolderId,
      teamMembers: teamMembersSnapshot.size,
      teamInvitations: teamInvitationsSnapshot.size,
      hasTeamStats: teamStatsDoc.exists
    });

    // Delete all team members
    const deleteMemberPromises = teamMembersSnapshot.docs.map(async (doc) => {
      const teamMember = doc.data();
      try {
        await doc.ref.delete();
        Logger.info('Deleted team member due to professional tier loss', {
          accountHolderId,
          teammateUserId: teamMember.userId,
          teammateEmail: teamMember.email
        });
      } catch (error) {
        Logger.error('Failed to delete team member', {
          accountHolderId,
          teammateUserId: teamMember.userId,
          error: (error as Error).message
        });
      }
    });

    // Delete all team invitations
    const deleteInvitationPromises = teamInvitationsSnapshot.docs.map(async (doc) => {
      const invitation = doc.data();
      try {
        await doc.ref.delete();
        Logger.info('Deleted team invitation due to professional tier loss', {
          accountHolderId,
          inviteEmail: invitation.inviteEmail
        });
      } catch (error) {
        Logger.error('Failed to delete team invitation', {
          accountHolderId,
          inviteEmail: invitation.inviteEmail,
          error: (error as Error).message
        });
      }
    });

    // Delete team stats if exists
    let deleteStatsPromise = Promise.resolve();
    if (teamStatsDoc.exists) {
      deleteStatsPromise = teamStatsDoc.ref.delete().then(() => {
        Logger.info('Deleted team stats due to professional tier loss', { accountHolderId });
      }).catch((error) => {
        Logger.error('Failed to delete team stats', {
          accountHolderId,
          error: (error as Error).message
        });
      });
    }

    // Execute all deletions in parallel
    await Promise.all([
      ...deleteMemberPromises,
      ...deleteInvitationPromises,
      deleteStatsPromise
    ]);

    Logger.info('Completed clearing all team data due to professional tier loss', {
      accountHolderId,
      deletedMembers: teamMembersSnapshot.size,
      deletedInvitations: teamInvitationsSnapshot.size,
      deletedStats: teamStatsDoc.exists
    });

  } catch (error) {
    Logger.error('Error clearing team data for professional tier loss', {
      accountHolderId,
      error: (error as Error).message
    });
    throw error;
  }
}

// Reactivate teammates when account holder regains professional tier
async function reactivateTeammatesForProfessionalTier(accountHolderId: string): Promise<void> {
  try {
    // Since we now delete all team data when professional tier is lost,
    // there are no suspended teammates to reactivate.
    // The account holder will need to re-invite teammates if they upgrade back to professional.
    Logger.info('Professional tier regained - no teammates to reactivate (all team data was cleared on downgrade)', {
      accountHolderId
    });
  } catch (error) {
    Logger.error('Error in reactivateTeammatesForProfessionalTier', {
      accountHolderId,
      error: (error as Error).message
    });
    throw error;
  }
}

// Send Contact Support Email
export const sendContactSupportEmail = onCall<{
  category: string;
  subject: string;
  message: string;
  userEmail?: string;
  userId?: string;
}>(async (request: CallableRequest<{
  category: string;
  subject: string;
  message: string;
  userEmail?: string;
  userId?: string;
}>) => {
  const { category, subject, message, userEmail, userId } = request.data;
  const authUserId = request.auth?.uid;

  Logger.info('📧 Processing contact support email', {
    category,
    subject: subject.substring(0, 50) + '...',
    userEmail,
    userId: authUserId || userId,
    isAuthenticated: !!authUserId,
    requestAuth: !!request.auth
  });

  try {
    // Validate input
    if (!subject?.trim() || !message?.trim()) {
      throw new HttpsError('invalid-argument', 'Subject and message are required');
    }

    if (!category || !['billing', 'technical', 'general'].includes(category)) {
      throw new HttpsError('invalid-argument', 'Invalid support category');
    }

    // Get user information if authenticated (optional)
    let userInfo: any = {};
    if (authUserId) {
      try {
        const userDoc = await db.collection('users').doc(authUserId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          userInfo = {
            userId: authUserId,
            email: userData?.email || userEmail,
            displayName: userData?.displayName,
            createdAt: userData?.createdAt,
            subscription: userData?.subscription
          };
        }
      } catch (error) {
        Logger.warn('Could not fetch user data for support email', {
          userId: authUserId,
          error: (error as Error).message
        });
        userInfo = {
          userId: authUserId,
          email: userEmail
        };
      }
    } else {
      // Handle unauthenticated users
      userInfo = {
        email: userEmail || 'No email provided',
        userId: 'unauthenticated',
        note: 'User not authenticated - sent via support form'
      };
    }

    // Get device and app information from request headers
    const deviceInfo = {
      userAgent: request.rawRequest?.headers['user-agent'] || 'Unknown',
      platform: request.rawRequest?.headers['x-platform'] || 'Unknown',
      appVersion: request.rawRequest?.headers['x-app-version'] || 'Unknown',
      timestamp: new Date().toISOString()
    };

    // Get SendGrid API key from environment
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    if (!sendgridApiKey) {
      Logger.error('❌ SENDGRID_API_KEY environment variable not set');
      throw new HttpsError('internal', 'Email service not configured');
    }

    // Configure SendGrid
    sgMail.setApiKey(sendgridApiKey);

    // Create comprehensive email content
    const categoryEmoji = {
      billing: '💳',
      technical: '🔧',
      general: '💬'
    };

    const emailBody = `
${categoryEmoji[category as keyof typeof categoryEmoji]} SUPPORT REQUEST - ${category.toUpperCase()}

📧 USER MESSAGE:
${message}

👤 USER INFORMATION:
• Email: ${userInfo.email || 'Not provided'}
• User ID: ${userInfo.userId || 'Not authenticated'}
• Display Name: ${userInfo.displayName || 'Not provided'}
• Account Created: ${userInfo.createdAt ? new Date(userInfo.createdAt.toDate()).toLocaleString() : 'Unknown'}
• Subscription: ${userInfo.subscription || 'Unknown'}

📱 DEVICE & APP INFORMATION:
• Platform: ${deviceInfo.platform}
• App Version: ${deviceInfo.appVersion}
• User Agent: ${deviceInfo.userAgent}
• Timestamp: ${deviceInfo.timestamp}

🔗 QUICK ACTIONS:
${userInfo.userId ? `• View User: https://console.firebase.google.com/project/receiptgold/firestore/data/users/${userInfo.userId}` : '• User not authenticated'}
${userInfo.email ? `• Reply to: ${userInfo.email}` : ''}

---
This email was sent automatically from the ReceiptGold mobile app.
    `.trim();

    const msg = {
      to: 'support@receiptgold.com',
      from: {
        email: 'noreply@receiptgold.com',
        name: 'ReceiptGold Support System'
      },
      replyTo: userInfo.email || undefined,
      subject: `[${category.toUpperCase()}] ${subject}`,
      text: emailBody,
      html: emailBody.replace(/\n/g, '<br>').replace(/• /g, '&bull; ')
    };

    // Send the email
    const response = await sgMail.send(msg);

    Logger.info('✅ Contact support email sent successfully', {
      to: 'support@receiptgold.com',
      from: userInfo.email,
      category,
      subject,
      statusCode: response[0].statusCode
    });

    // Log support request for analytics
    try {
      await db.collection('supportRequests').add({
        category,
        subject,
        userEmail: userInfo.email,
        userId: userInfo.userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        deviceInfo,
        status: 'sent'
      });
    } catch (logError) {
      Logger.warn('Failed to log support request to Firestore', {
        error: (logError as Error).message
      });
    }

    return {
      success: true,
      message: 'Support request sent successfully'
    };

  } catch (error) {
    Logger.error('❌ Failed to send contact support email', {
      error: (error as Error).message,
      category,
      subject,
      userEmail
    });

    if (error instanceof HttpsError) {
      throw error;
    }

    throw new HttpsError('internal', 'Failed to send support request. Please try again.');
  }
});

// Account deletion interface
interface DeleteAccountData {
  password: string;
}

// Account deletion Cloud Function
export const deleteUserAccount = onCall(
  {
    region: 'us-central1',
    invoker: 'private'  // Only allow authenticated users
  },
  async (request: CallableRequest<DeleteAccountData>) => {
    Logger.info('🗑️ Account deletion request received', {
      hasAuth: !!request.auth,
      authUid: request.auth?.uid,
      authToken: !!request.auth?.token
    });

    if (!request.auth) {
      Logger.error('❌ Authentication missing in deleteUserAccount request', {});
      throw new HttpsError(
        "unauthenticated",
        "User must be authenticated to delete account"
      );
    }

    const userId = request.auth.uid;
    const { password } = request.data;

    if (!password) {
      throw new HttpsError(
        "invalid-argument",
        "Password is required for account deletion"
      );
    }

    try {
      Logger.info('🗑️ Starting account soft deletion process', { userId });

      // Get the user record
      const userRecord = await admin.auth().getUser(userId);

      if (!userRecord.email) {
        throw new HttpsError('internal', 'User email not found');
      }

      // Check if user has active RevenueCat subscription
      let hasActiveSubscription = false;
      let subscriptionInfo = null;
      
      try {
        const subscriptionDoc = await db.collection('subscriptions').doc(userId).get();
        if (subscriptionDoc.exists) {
          const subData = subscriptionDoc.data();
          hasActiveSubscription = subData?.status === 'active' && 
                                subData?.currentTier !== 'trial';
          subscriptionInfo = subData;
        }
      } catch (error) {
        Logger.warn('Could not check subscription status', { error: (error as Error).message });
      }

      // Calculate deletion dates
      const deletionDate = new Date();
      const permanentDeletionDate = new Date(deletionDate.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      // Create soft deletion record with detailed info
      await db.collection("deletedAccounts").doc(userId).set({
        userId,
        email: userRecord.email,
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
        deletionType: 'user_requested',
        status: 'soft_deleted',
        recoverable: true,
        hasActiveSubscription,
        subscriptionInfo: hasActiveSubscription ? subscriptionInfo : null,
        userAgent: request.rawRequest?.headers?.['user-agent'] || 'unknown',
        ipAddress: request.rawRequest?.ip || 'unknown'
      });

      // Soft delete user data from all Firestore collections
      const collectionsToSoftDelete = [
        'receipts',
        'businesses',
        'subscriptions',
        'customCategories',
        'bankConnections',
        'teamMembers',
        'notifications',
        'userSettings',
        'usage',
        'reports',
        'budgets',
        'user_notifications',
        'connection_notifications',
        'teamInvitations',
        'device_tracking',
        'transactionCandidates',
        'generatedReceipts',
        'candidateStatus',
        'plaid_items'
      ];

      // Use batched operations for efficiency
      const batch = admin.firestore().batch();
      let softDeletionCount = 0;

      // Process each collection
      for (const collectionName of collectionsToSoftDelete) {
        try {
          // Query for documents where userId matches
          const userDocsQuery = admin.firestore()
            .collection(collectionName)
            .where('userId', '==', userId)
            .limit(500); // Firestore batch limit

          const userDocsSnapshot = await userDocsQuery.get();

          userDocsSnapshot.forEach((doc) => {
            const originalData = doc.data();
            batch.update(doc.ref, {
              status: 'soft_deleted',
              deletedAt: admin.firestore.FieldValue.serverTimestamp(),
              permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
              originalData: originalData // Backup for recovery
            });
            softDeletionCount++;
          });

          // Also check for accountHolderId field (for team-related data)
          if (['receipts', 'businesses', 'customCategories', 'teamMembers'].includes(collectionName)) {
            const accountHolderDocsQuery = admin.firestore()
              .collection(collectionName)
              .where('accountHolderId', '==', userId)
              .limit(500);

            const accountHolderDocsSnapshot = await accountHolderDocsQuery.get();

            accountHolderDocsSnapshot.forEach((doc) => {
              const originalData = doc.data();
              batch.update(doc.ref, {
                status: 'soft_deleted',
                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
                originalData: originalData
              });
              softDeletionCount++;
            });
          }

          // Handle documents with specific patterns (like usage documents)
          if (collectionName === 'usage') {
            const usageQuery = admin.firestore()
              .collection(collectionName)
              .where(admin.firestore.FieldPath.documentId(), '>=', userId)
              .where(admin.firestore.FieldPath.documentId(), '<', userId + '\uf8ff')
              .limit(500);

            const usageSnapshot = await usageQuery.get();

            usageSnapshot.forEach((doc) => {
              const originalData = doc.data();
              batch.update(doc.ref, {
                status: 'soft_deleted',
                deletedAt: admin.firestore.FieldValue.serverTimestamp(),
                permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
                originalData: originalData
              });
              softDeletionCount++;
            });
          }

        } catch (error) {
          Logger.warn(`Error soft deleting collection ${collectionName}`, {
            error: (error as Error).message,
            userId
          });
          // Continue with other collections even if one fails
        }
      }

      // Soft delete user profile document
      const userDocRef = admin.firestore().collection('users').doc(userId);
      const userDoc = await userDocRef.get();
      
      if (userDoc.exists) {
        const originalData = userDoc.data();
        batch.update(userDocRef, {
          status: 'soft_deleted',
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          permanentDeletionDate: admin.firestore.Timestamp.fromDate(permanentDeletionDate),
          originalData: originalData
        });
        softDeletionCount++;
      }

      // Commit all soft deletions
      if (softDeletionCount > 0) {
        await batch.commit();
        Logger.info('✅ Successfully soft deleted user data from Firestore', {
          softDeletionCount,
          userId,
          recoveryAvailableUntil: permanentDeletionDate.toISOString()
        });
      }

      // Update device tracking records
      await updateDeviceTrackingForDeletedAccount(userId);

      // Finally, delete the Firebase Auth user
      await admin.auth().deleteUser(userId);

      Logger.info('✅ Successfully deleted user account', {
        userId,
        email: userRecord.email,
        deletionCount: softDeletionCount
      });

      return {
        success: true,
        message: 'Account deleted successfully. You have 30 days to recover your data by signing up with the same email.',
        deletedDocuments: softDeletionCount
      };

    } catch (error) {
      Logger.error('❌ Error deleting user account', {
        error: (error as Error).message,
        userId
      });

      // Handle specific Firebase Auth errors
      if (error instanceof Error) {
        if (error.message.includes('auth/user-not-found')) {
          throw new HttpsError('not-found', 'User account not found');
        } else if (error.message.includes('auth/requires-recent-login')) {
          throw new HttpsError('failed-precondition', 'Please sign out and sign back in, then try deleting your account again');
        }
      }

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError('internal', 'Failed to delete account. Please try again.');
    }
  }
);


