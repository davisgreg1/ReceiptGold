"use strict";
// Cloud Functions for ReceiptGold Business Logic
// Updated for Firebase Functions v6 (mixed v1/v2 API)
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupDuplicateBusinesses = exports.cleanupOrphanedUserData = exports.cleanupSandboxPlaidConnections = exports.deleteUserAccount = exports.sendContactSupportEmail = exports.onSubscriptionStatusChange = exports.checkAccountHolderSubscription = exports.revenueCatWebhookHandler = exports.onTeamMemberRemoved = exports.cleanupExpiredInvitations = exports.sendTeamInvitationEmail = exports.directTestPlaidWebhook = exports.testPlaidWebhook = exports.testDeviceCheck = exports.saveDeviceToken = exports.markDeviceUsed = exports.debugWebhook = exports.healthCheck = exports.onUserDelete = exports.generateReport = exports.updateBusinessStats = exports.resetMonthlyUsage = exports.monitorBankConnections = exports.createPlaidLinkToken = exports.createPlaidUpdateToken = exports.onConnectionNotificationCreate = exports.testWebhookConfig = exports.initializeNotificationSettings = exports.plaidWebhook = exports.onReceiptCreate = exports.onUserCreate = exports.onRevenueCatTransfer = exports.onRevenueCatProductChange = exports.onRevenueCatBillingIssue = exports.onRevenueCatExpiration = exports.onRevenueCatCancellation = exports.onRevenueCatRenewal = exports.onRevenueCatPurchase = exports.completeAccountCreation = exports.checkDeviceForAccountCreation = exports.TIER_LIMITS = void 0;
// REMOVED: Unused functions import
const functionsV1 = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const eventarc_1 = require("firebase-functions/v2/eventarc");
const sgMail = require('@sendgrid/mail');
const jwt = require('jsonwebtoken');
// Structured logging utility for production
class Logger {
    static error(message, context, userId) {
        console.error(JSON.stringify({
            level: 'ERROR',
            message,
            timestamp: new Date().toISOString(),
            userId,
            ...context
        }));
    }
    static warn(message, context, userId) {
        console.warn(JSON.stringify({
            level: 'WARN',
            message,
            timestamp: new Date().toISOString(),
            userId,
            ...context
        }));
    }
    static info(message, context, userId) {
        console.info(JSON.stringify({
            level: 'INFO',
            message,
            timestamp: new Date().toISOString(),
            userId,
            ...context
        }));
    }
    static debug(message, context, userId) {
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
Logger.isDevelopment = process.env.NODE_ENV === 'development' || process.env.FUNCTIONS_EMULATOR === 'true';
// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();
// Receipt limits configuration from environment variables
const getReceiptLimits = () => {
    return {
        starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
        growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
        professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
        teammate: parseInt(process.env.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
    };
};
// Plaid configuration from environment variables  
const getPlaidConfig = () => {
    const clientId = process.env.PLAID_CLIENT_ID;
    const secret = process.env.PLAID_SECRET;
    const environment = process.env.PLAID_ENVIRONMENT || 'sandbox';
    if (!clientId) {
        throw new Error('Plaid client ID not found. Set PLAID_CLIENT_ID environment variable in .env file');
    }
    if (!secret) {
        throw new Error('Plaid secret not found. Set PLAID_SECRET environment variable in .env file');
    }
    return { clientId, secret, environment };
};
// Subscription tier limits - used in subscription management
exports.TIER_LIMITS = {
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
        maxReceipts: -1,
        maxBusinesses: -1,
        apiCallsPerMonth: -1, // unlimited
    },
    teammate: {
        maxReceipts: -1,
        maxBusinesses: 1,
        apiCallsPerMonth: 0, // no API access for teammates
    }
};
// Subscription tier configurations (keeping your existing setup)
const subscriptionTiers = {
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
            maxBusinesses: -1,
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
            maxBusinesses: 1,
            apiCallsPerMonth: 0,
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
function generateDeviceCheckJWT() {
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
function isBase64FallbackToken(token) {
    try {
        const decoded = Buffer.from(token, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        return parsed.platform && parsed.deviceId;
    }
    catch (_a) {
        return false;
    }
}
// Fallback device check using Firestore
async function queryFallbackDeviceCheck(deviceToken) {
    try {
        const deviceDoc = await db.collection('device_tracking').doc(deviceToken).get();
        if (!deviceDoc.exists) {
            return { bit0: false, bit1: false };
        }
        const data = deviceDoc.data();
        return {
            bit0: (data === null || data === void 0 ? void 0 : data.hasCreatedAccount) || false,
            bit1: false,
            last_update_time: (data === null || data === void 0 ? void 0 : data.lastUpdated) || (data === null || data === void 0 ? void 0 : data.createdAt)
        };
    }
    catch (error) {
        Logger.error('Fallback device check query failed', { error: error.message });
        return { bit0: false, bit1: false };
    }
}
// Update fallback device check in Firestore
async function updateFallbackDeviceCheck(deviceToken, bits) {
    try {
        await db.collection('deviceChecks').doc(deviceToken).set({
            ...bits,
            last_update_time: new Date().toISOString(),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    catch (error) {
        Logger.error('Fallback device check update failed', { error: error.message });
        throw error;
    }
}
// Query DeviceCheck two bits for a device
async function queryDeviceCheck(deviceToken) {
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
    }
    catch (error) {
        Logger.error('DeviceCheck query failed', { error: error.message });
        throw error;
    }
}
// Update DeviceCheck two bits for a device
async function updateDeviceCheck(deviceToken, bits) {
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
    }
    catch (error) {
        Logger.error('DeviceCheck update failed', { error: error.message });
        throw error;
    }
}
// Pre-flight check for user creation with DeviceCheck (HTTP function to avoid auth requirements)
exports.checkDeviceForAccountCreation = (0, https_1.onRequest)({ cors: true, invoker: 'public' }, async (req, res) => {
    var _a;
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
            if (deviceDoc.exists && ((_a = deviceDoc.data()) === null || _a === void 0 ? void 0 : _a.hasCreatedAccount)) {
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
                }
                else {
                    Logger.warn('Device has already created an account', { email, deviceToken: deviceToken.substring(0, 20) + '...' });
                    res.status(400).json({
                        error: {
                            code: 'already-exists',
                            message: 'This device has already been used to create an account. Please sign in with your existing account instead.'
                        }
                    });
                    return;
                }
            }
            else {
                Logger.info('Device token not found in database - allowing account creation');
            }
        }
        catch (error) {
            Logger.error('Error checking device token in database', { error: error.message });
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
        }
        catch (error) {
            // User doesn't exist, which is what we want
            if (error.code !== 'auth/user-not-found') {
                Logger.error('Error checking email existence', { error: error.message });
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
    }
    catch (error) {
        Logger.error('Error checking device for account creation', { error: error.message });
        res.status(500).json({
            error: {
                code: 'internal',
                message: `Failed to check device eligibility: ${error.message}`
            }
        });
    }
});
// Complete account creation after Firebase Auth user is created
exports.completeAccountCreation = (0, https_1.onRequest)({ cors: true, invoker: 'public' }, async (req, res) => {
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
            }
            catch (error) {
                Logger.warn('Failed to update fallback device tracking', { error: error.message });
            }
        }
        else {
            // For real DeviceCheck tokens, use Apple DeviceCheck API
            try {
                await updateDeviceCheck(deviceToken, { bit0: true });
                Logger.info('DeviceCheck updated - device marked as having created account');
            }
            catch (error) {
                Logger.warn('DeviceCheck update failed, but account creation continues', { error: error.message });
                // Don't fail account creation if DeviceCheck update fails
            }
        }
        res.json({
            data: {
                success: true,
                message: 'Account creation completed successfully'
            }
        });
    }
    catch (error) {
        Logger.error('Error completing account creation', { error: error.message });
        res.status(500).json({
            error: {
                message: `Failed to complete account creation: ${error.message}`,
                status: 'INTERNAL'
            }
        });
    }
});
// RevenueCat Event Handlers using Firebase Extensions EventArc
// Handle subscription lifecycle events from RevenueCat
// Handle new purchases and subscription starts
exports.onRevenueCatPurchase = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.purchase", async (event) => {
    try {
        Logger.info('RevenueCat purchase event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in purchase event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'purchase');
        Logger.info('Successfully processed RevenueCat purchase event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat purchase event', { error: error.message });
    }
});
// Handle subscription renewals
exports.onRevenueCatRenewal = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.renewal", async (event) => {
    try {
        Logger.info('RevenueCat renewal event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in renewal event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'renewal');
        Logger.info('Successfully processed RevenueCat renewal event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat renewal event', { error: error.message });
    }
});
// Handle subscription cancellations
exports.onRevenueCatCancellation = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.cancellation", async (event) => {
    try {
        Logger.info('RevenueCat cancellation event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in cancellation event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'cancellation');
        Logger.info('Successfully processed RevenueCat cancellation event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat cancellation event', { error: error.message });
    }
});
// Handle subscription expirations
exports.onRevenueCatExpiration = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.expiration", async (event) => {
    try {
        Logger.info('RevenueCat expiration event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in expiration event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'expiration');
        Logger.info('Successfully processed RevenueCat expiration event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat expiration event', { error: error.message });
    }
});
// Handle billing issues
exports.onRevenueCatBillingIssue = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.billing_issue", async (event) => {
    try {
        Logger.info('RevenueCat billing issue event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in billing issue event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'billing_issue');
        Logger.info('Successfully processed RevenueCat billing issue event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat billing issue event', { error: error.message });
    }
});
// Handle product changes (upgrades/downgrades)
exports.onRevenueCatProductChange = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.product_change", async (event) => {
    try {
        Logger.info('RevenueCat product change event received', { eventId: event.id });
        const eventData = event.data;
        const userId = eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id;
        if (!userId) {
            Logger.error('No app_user_id found in product change event', { eventData });
            return;
        }
        await handleRevenueCatSubscriptionChange(userId, eventData, 'product_change');
        Logger.info('Successfully processed RevenueCat product change event', { userId });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat product change event', { error: error.message });
    }
});
// Handle account transfers (when user creates account with existing subscription)
exports.onRevenueCatTransfer = (0, eventarc_1.onCustomEventPublished)("com.revenuecat.v1.transfer", async (event) => {
    try {
        Logger.info('RevenueCat transfer event received', { eventId: event.id });
        const eventData = event.data;
        const transferredFrom = eventData === null || eventData === void 0 ? void 0 : eventData.transferred_from;
        const transferredTo = eventData === null || eventData === void 0 ? void 0 : eventData.transferred_to;
        if (!transferredFrom || !transferredTo || !Array.isArray(transferredFrom) || !Array.isArray(transferredTo)) {
            Logger.error('Missing or invalid transferred_from/transferred_to arrays in transfer event', {
                transferredFrom,
                transferredTo,
                eventData
            });
            return;
        }
        // Extract Firebase user IDs (skip anonymous RevenueCat IDs)
        const originalUserId = transferredFrom.find(id => id && !id.startsWith('$RCAnonymousID:'));
        const newUserId = transferredTo.find(id => id && !id.startsWith('$RCAnonymousID:'));
        if (!newUserId || !originalUserId) {
            Logger.error('Could not find valid Firebase user IDs in transfer arrays', {
                transferredFrom,
                transferredTo,
                originalUserId,
                newUserId
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
    }
    catch (error) {
        Logger.error('Error processing RevenueCat transfer event', {
            error: error.message,
            stack: error.stack
        });
    }
});
// Helper function to handle all RevenueCat subscription changes
async function handleRevenueCatSubscriptionChange(userId, eventData, eventType) {
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
        const subscriber = eventData === null || eventData === void 0 ? void 0 : eventData.subscriber;
        if (!subscriber) {
            Logger.error('No subscriber data found in event', { eventData });
            return;
        }
        // Get the entitlements to determine the active subscription tier
        const entitlements = subscriber.entitlements || {};
        const subscriptions = subscriber.subscriptions || {};
        // Determine the current tier based on active entitlements
        let currentTier = 'starter'; // Default to starter if no active subscription
        let isActive = false;
        let subscriptionDetails = null;
        // Check for active entitlements (RevenueCat's recommended approach)
        for (const [entitlementId, entitlement] of Object.entries(entitlements)) {
            if (entitlement && entitlement.expires_date) {
                const expiresDate = new Date(entitlement.expires_date);
                if (expiresDate > new Date()) {
                    isActive = true;
                    // Map entitlement to tier (you'll need to configure this based on your RevenueCat setup)
                    const mappedTier = mapEntitlementToTier(entitlementId);
                    if (mappedTier) {
                        currentTier = mappedTier;
                    }
                    else {
                        Logger.warn(`Failed to map entitlement ${entitlementId}, subscription will be inactive`);
                        isActive = false;
                    }
                    break;
                }
            }
        }
        // Get subscription details for billing information
        for (const [, subscription] of Object.entries(subscriptions)) {
            if (subscription && subscription.expires_date) {
                const expiresDate = new Date(subscription.expires_date);
                if (expiresDate > new Date()) {
                    subscriptionDetails = subscription;
                    break;
                }
            }
        }
        // Handle expiration and cancellation events
        if (eventType === 'expiration' || eventType === 'cancellation') {
            currentTier = 'starter';
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
            const newSubscriptionDoc = {
                userId,
                currentTier: currentTier,
                status: isActive ? 'active' : 'canceled',
                billing: {
                    customerId: (eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id) || null,
                    subscriptionId: (subscriptionDetails === null || subscriptionDetails === void 0 ? void 0 : subscriptionDetails.original_purchase_date) || null,
                    priceId: (subscriptionDetails === null || subscriptionDetails === void 0 ? void 0 : subscriptionDetails.product_identifier) || null,
                    currentPeriodStart: (subscriptionDetails === null || subscriptionDetails === void 0 ? void 0 : subscriptionDetails.purchase_date) ? new Date(subscriptionDetails.purchase_date) : new Date(),
                    currentPeriodEnd: (subscriptionDetails === null || subscriptionDetails === void 0 ? void 0 : subscriptionDetails.expires_date) ? new Date(subscriptionDetails.expires_date) : null,
                    cancelAtPeriodEnd: eventType === 'cancellation',
                    trialEnd: (subscriptionDetails === null || subscriptionDetails === void 0 ? void 0 : subscriptionDetails.trial_end) ? new Date(subscriptionDetails.trial_end) : null,
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
        }
        else {
            // Update existing subscription
            const updateData = {
                currentTier: currentTier,
                status: isActive ? 'active' : 'canceled',
                limits: subscriptionTiers[currentTier].limits,
                features: subscriptionTiers[currentTier].features,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Update billing information if available
            if (subscriptionDetails) {
                updateData.billing = {
                    customerId: (eventData === null || eventData === void 0 ? void 0 : eventData.app_user_id) || null,
                    subscriptionId: subscriptionDetails.original_purchase_date || null,
                    priceId: subscriptionDetails.product_identifier || null,
                    currentPeriodStart: subscriptionDetails.purchase_date ? new Date(subscriptionDetails.purchase_date) : new Date(),
                    currentPeriodEnd: subscriptionDetails.expires_date ? new Date(subscriptionDetails.expires_date) : null,
                    cancelAtPeriodEnd: eventType === 'cancellation',
                    trialEnd: subscriptionDetails.trial_end ? new Date(subscriptionDetails.trial_end) : null,
                };
            }
            // Add to history
            const existingData = subscriptionDoc.data();
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
    }
    catch (error) {
        Logger.error('Error handling RevenueCat subscription change', {
            error: error.message,
            userId,
            eventType
        });
        throw error;
    }
}
// Helper function to handle account transfers from RevenueCat
async function handleAccountTransfer(originalUserId, newUserId, eventData) {
    try {
        Logger.info('Starting account transfer process', { originalUserId, newUserId });
        // Use a batch for atomic operations
        const batch = db.batch();
        const transferErrors = [];
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
                const subscriptionData = originalSubscriptionDoc.data();
                // Update the subscription to point to the new user
                const newSubscriptionRef = db.collection('subscriptions').doc(newUserId);
                const transferredSubscription = {
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
        }
        catch (error) {
            transferErrors.push(`Subscription transfer failed: ${error.message}`);
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
        }
        catch (error) {
            transferErrors.push(`Receipts transfer failed: ${error.message}`);
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
        }
        catch (error) {
            transferErrors.push(`Team memberships transfer failed: ${error.message}`);
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
        }
        catch (error) {
            transferErrors.push(`Team members transfer failed: ${error.message}`);
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
        }
        catch (error) {
            transferErrors.push(`Usage data transfer failed: ${error.message}`);
        }
        // 6. Transfer Businesses (with duplicate prevention)
        try {
            const businessesSnapshot = await db.collection('businesses')
                .where('userId', '==', originalUserId)
                .get();
            Logger.info(`Found ${businessesSnapshot.size} businesses to transfer`);
            // Get existing businesses for the new user to prevent duplicates
            const existingBusinessesSnapshot = await db.collection('businesses')
                .where('userId', '==', newUserId)
                .get();
            const existingBusinesses = new Set();
            existingBusinessesSnapshot.forEach(doc => {
                const business = doc.data();
                const key = `${business.name || 'unnamed'}_${business.address || 'no-address'}_${business.ein || 'no-ein'}`;
                existingBusinesses.add(key);
            });
            let businessesTransferred = 0;
            let businessesSkipped = 0;
            for (const businessDoc of businessesSnapshot.docs) {
                const businessData = businessDoc.data();
                const businessKey = `${businessData.name || 'unnamed'}_${businessData.address || 'no-address'}_${businessData.ein || 'no-ein'}`;
                // Skip if business already exists for the new user
                if (existingBusinesses.has(businessKey)) {
                    businessesSkipped++;
                    Logger.info(`Skipping duplicate business: ${businessKey}`);
                    // Still mark original as transferred
                    batch.update(businessDoc.ref, {
                        status: 'transferred',
                        transferredTo: newUserId,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    continue;
                }
                // Transfer the business
                const newBusinessRef = db.collection('businesses').doc(); // New document ID
                batch.set(newBusinessRef, {
                    ...businessData,
                    userId: newUserId,
                    transferredFrom: originalUserId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                // Mark original business as transferred
                batch.update(businessDoc.ref, {
                    status: 'transferred',
                    transferredTo: newUserId,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                businessesTransferred++;
            }
            Logger.info(`Business transfer completed: ${businessesTransferred} transferred, ${businessesSkipped} skipped (duplicates)`);
        }
        catch (error) {
            transferErrors.push(`Businesses transfer failed: ${error.message}`);
        }
        // 7. Transfer Business Stats
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
        }
        catch (error) {
            transferErrors.push(`Business stats transfer failed: ${error.message}`);
        }
        // 8. Transfer Bank Connections
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
        }
        catch (error) {
            transferErrors.push(`Bank connections transfer failed: ${error.message}`);
        }
        // 9. Transfer User Preferences/Settings
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
        }
        catch (error) {
            transferErrors.push(`User preferences transfer failed: ${error.message}`);
        }
        // 10. Transfer Notification Settings
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
        }
        catch (error) {
            transferErrors.push(`Notification settings transfer failed: ${error.message}`);
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
        }
        else {
            Logger.info('Account transfer completed successfully', {
                originalUserId,
                newUserId
            });
        }
        // Send notification to the new user about the successful transfer
        try {
            await db.collection('user_notifications').add({
                userId: newUserId,
                type: 'account_transfer_complete',
                title: 'Account Transfer Complete',
                body: 'Your subscription and data have been successfully transferred to your new account.',
                data: {
                    type: 'account_transfer_complete',
                    originalUserId,
                    transferErrors: transferErrors.length > 0 ? transferErrors : null
                },
                read: false,
                isRead: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'revenuecat_transfer'
            });
        }
        catch (error) {
            Logger.warn('Failed to create transfer notification', { error: error.message });
        }
    }
    catch (error) {
        Logger.error('Critical error during account transfer', {
            error: error.message,
            stack: error.stack,
            originalUserId,
            newUserId
        });
        throw error;
    }
}
// REMOVED: Account recovery function - no longer needed with immediate hard deletion
// REMOVED: RevenueCat subscription recovery function - no longer needed with immediate hard deletion
// Helper function to map RevenueCat entitlements to your app's tiers
function mapEntitlementToTier(entitlementId) {
    // Configure this mapping based on your RevenueCat entitlement setup
    const entitlementToTierMap = {
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
    Logger.warn(`Unknown entitlement ID: ${entitlementId}, unable to determine tier`);
    return null; // Return null for unknown entitlements
}
// REMOVED: Manual recovery function - no longer needed with immediate hard deletion
// REMOVED: Scheduled cleanup function - now using immediate hard deletion
// Helper function to permanently delete user data
async function permanentlyDeleteUserData(userId) {
    try {
        Logger.info(`Starting permanent deletion for user: ${userId}`);
        // Comprehensive list of all possible collections that might contain user data
        const collectionsToDelete = [
            'users', 'subscriptions', 'receipts', 'businesses', 'customCategories',
            'bankConnections', 'bank_connections', 'teamMembers', 'notifications',
            'userSettings', 'userPreferences', 'usage', 'reports', 'budgets',
            'user_notifications', 'connection_notifications', 'teamInvitations',
            'transactionCandidates', 'generatedReceipts', 'candidateStatus',
            'plaid_items', 'businessStats', 'notificationSettings', 'events',
            'supportRequests', 'teamStats', 'oneTimePurchases', 'deviceChecks',
            'device_tracking', 'transaction_updates'
        ];
        // Process in smaller batches to avoid hitting Firestore limits
        const batchSize = 450; // Leave room for other operations
        let totalDeletionCount = 0;
        for (const collectionName of collectionsToDelete) {
            try {
                let currentBatch = db.batch();
                let currentBatchSize = 0;
                Logger.debug(`Processing collection: ${collectionName}`);
                // Primary query: documents where userId field equals the target user
                const userDocsQuery = db.collection(collectionName)
                    .where('userId', '==', userId)
                    .limit(500);
                const userDocsSnapshot = await userDocsQuery.get();
                userDocsSnapshot.forEach((doc) => {
                    if (currentBatchSize >= batchSize) {
                        // Execute current batch and start a new one
                        currentBatch.commit();
                        currentBatch = db.batch();
                        currentBatchSize = 0;
                    }
                    currentBatch.delete(doc.ref);
                    currentBatchSize++;
                    totalDeletionCount++;
                });
                // Secondary query: documents where accountHolderId field equals the target user
                if (['receipts', 'businesses', 'customCategories', 'teamMembers', 'teamInvitations'].includes(collectionName)) {
                    const accountHolderDocsQuery = db.collection(collectionName)
                        .where('accountHolderId', '==', userId)
                        .limit(500);
                    const accountHolderDocsSnapshot = await accountHolderDocsQuery.get();
                    accountHolderDocsSnapshot.forEach((doc) => {
                        if (currentBatchSize >= batchSize) {
                            currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                        currentBatch.delete(doc.ref);
                        currentBatchSize++;
                        totalDeletionCount++;
                    });
                }
                // Special handling for usage documents (document ID pattern)
                if (collectionName === 'usage') {
                    const usageQuery = db.collection(collectionName)
                        .where(admin.firestore.FieldPath.documentId(), '>=', userId)
                        .where(admin.firestore.FieldPath.documentId(), '<', userId + '\uf8ff')
                        .limit(500);
                    const usageSnapshot = await usageQuery.get();
                    usageSnapshot.forEach((doc) => {
                        if (currentBatchSize >= batchSize) {
                            currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                        currentBatch.delete(doc.ref);
                        currentBatchSize++;
                        totalDeletionCount++;
                    });
                }
                // Special handling for teamStats (document ID equals userId)
                if (collectionName === 'teamStats') {
                    const teamStatsDoc = await db.collection(collectionName).doc(userId).get();
                    if (teamStatsDoc.exists) {
                        if (currentBatchSize >= batchSize) {
                            await currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                        currentBatch.delete(teamStatsDoc.ref);
                        currentBatchSize++;
                        totalDeletionCount++;
                    }
                }
                // Special handling for userPreferences (document ID equals userId)
                if (collectionName === 'userPreferences') {
                    const userPrefsDoc = await db.collection(collectionName).doc(userId).get();
                    if (userPrefsDoc.exists) {
                        if (currentBatchSize >= batchSize) {
                            await currentBatch.commit();
                            currentBatch = db.batch();
                            currentBatchSize = 0;
                        }
                        currentBatch.delete(userPrefsDoc.ref);
                        currentBatchSize++;
                        totalDeletionCount++;
                    }
                }
                // Commit any remaining operations for this collection
                if (currentBatchSize > 0) {
                    await currentBatch.commit();
                }
            }
            catch (error) {
                Logger.warn(`Error querying collection ${collectionName} for permanent deletion`, {
                    error: error.message,
                    userId,
                    collectionName
                });
                // Continue with other collections even if one fails
            }
        }
        Logger.info(`Permanently deleted ${totalDeletionCount} documents for user ${userId}`);
    }
    catch (error) {
        Logger.error('Error permanently deleting user data', {
            error: error.message,
            userId
        });
        throw error;
    }
}
// 1. User Creation Trigger (updated for Firebase Functions v6)
exports.onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
    try {
        const userId = user.uid;
        const email = user.email || '';
        const displayName = user.displayName || '';
        Logger.info('New user created', { userId, email });
        // Create user document
        const userDoc = {
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
            const usageDoc = {
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
    }
    catch (error) {
        Logger.error('Error creating user documents', { error: error });
        throw error;
    }
});
// 2. Receipt Upload Trigger (updated for Firebase Functions v6)
exports.onReceiptCreate = functionsV1.firestore
    .document("receipts/{receiptId}")
    .onCreate(async (snap, context) => {
    try {
        const receiptData = snap.data();
        const userId = receiptData.userId;
        const currentMonth = new Date().toISOString().slice(0, 7);
        // Get user's subscription to check limits
        const subscriptionDoc = await db
            .collection("subscriptions")
            .doc(userId)
            .get();
        if (!subscriptionDoc.exists) {
            throw new Error(`Subscription not found for user ${userId}`);
        }
        const subscription = subscriptionDoc.data();
        // Ensure limits are correctly set based on current tier
        const currentTier = subscription.currentTier;
        subscription.limits = subscriptionTiers[currentTier].limits;
        // Get current usage
        const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
        const usageDoc = await usageRef.get();
        if (!usageDoc.exists) {
            // Create usage document if it doesn't exist
            const newUsageDoc = {
                userId,
                month: currentMonth,
                receiptsUploaded: 1,
                apiCalls: 0,
                reportsGenerated: 0,
                limits: subscription.limits,
                resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            await usageRef.set(newUsageDoc);
        }
        else {
            const usage = usageDoc.data();
            const newReceiptCount = usage.receiptsUploaded + 1;
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
    }
    catch (error) {
        Logger.error('Error processing receipt creation', { error: error });
        // Update receipt status to error
        await snap.ref.update({
            status: "error",
            processingErrors: [error.message],
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw error;
    }
});
// Helper function for OCR processing (keeping your existing implementation)
async function processReceiptOCR(receiptRef, receiptData) {
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
            tax: (receiptData.amount || 0) * 0.08,
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
    }
    catch (error) {
        Logger.error('OCR processing error', { error: error });
        throw error;
    }
}
// PLAID WEBHOOK HANDLER
exports.plaidWebhook = (0, https_1.onRequest)({
    cors: false,
    memory: "1GiB",
    timeoutSeconds: 540,
}, async (req, res) => {
    var _a;
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
    if (!((_a = req.headers["content-type"]) === null || _a === void 0 ? void 0 : _a.includes("application/json"))) {
        Logger.error('❌ Invalid content type:', { error: req.headers["content-type"] });
        res.status(400).send("Invalid content type");
        return;
    }
    // Validate Plaid configuration
    try {
        Logger.info('Plaid config loaded for ${config.environment} environment', {});
    }
    catch (error) {
        Logger.error('❌ Plaid configuration error:', { error: error });
        res.status(500).send("Plaid configuration error");
        return;
    }
    let webhookData;
    try {
        // Parse JSON payload
        if (typeof req.body === 'string') {
            webhookData = JSON.parse(req.body);
        }
        else if (typeof req.body === 'object') {
            webhookData = req.body;
        }
        else {
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
    }
    catch (error) {
        Logger.error('❌ Error processing Plaid webhook:', { error: error });
        // Still respond with 200 to prevent Plaid retries for application errors
        res.status(200).json({
            received: true,
            error: "Processing failed",
            timestamp: new Date().toISOString()
        });
    }
});
// Function to initialize user notification settings
exports.initializeNotificationSettings = (0, https_1.onRequest)(async (req, res) => {
    try {
        const userId = req.query.userId;
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
    }
    catch (error) {
        Logger.error('Error initializing notification settings:', { error: error });
        res.status(500).json({ error: 'Failed to initialize settings' });
    }
});
// Test endpoint to verify webhook configuration
exports.testWebhookConfig = (0, https_1.onRequest)(async (req, res) => {
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
            };
        }
        catch (error) {
            plaidConfigStatus.error = error.message;
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
    }
    catch (error) {
        res.status(500).json({
            webhookConfigured: false,
            error: error,
            timestamp: new Date().toISOString(),
        });
    }
});
// LOCAL NOTIFICATION APPROACH
// Using Firestore monitoring + local notifications instead of FCM
// NOTIFICATION HANDLERS
exports.onConnectionNotificationCreate = functionsV1.firestore
    .document("connection_notifications/{notificationId}")
    .onCreate(async (snap, context) => {
    const notification = snap.data();
    if (!notification)
        return;
    const { userId, title, message, type, priority } = notification;
    Logger.info('New connection notification for user ${userId}: ${title}', {});
    try {
        // Get user's push token from Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        // We no longer need tokens for the local notification approach
        Logger.debug('Processing notification for user ${userId}', {});
        // Check if user has notifications enabled
        const notificationSettings = userData === null || userData === void 0 ? void 0 : userData.notificationSettings;
        if (!(notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.notificationsEnabled) || !(notificationSettings === null || notificationSettings === void 0 ? void 0 : notificationSettings.bankConnections)) {
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
    }
    catch (error) {
        Logger.error('Error sending push notification:', { error: error });
    }
});
// PLAID WEBHOOK HANDLERS
async function handlePlaidTransactions(webhookData) {
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
    }
    catch (error) {
        Logger.error('Error processing Plaid transactions webhook:', { error: error });
        throw error;
    }
}
// Helper function to process transactions for a user
async function processTransactionsForUser(userId, itemId, new_transactions, removed_transactions) {
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
    }
    catch (error) {
        console.error(`❌ Error processing transactions for user ${userId}:`, error);
        throw error;
    }
}
async function handlePlaidItem(webhookData) {
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
        const updateData = {
            lastWebhookCode: webhook_code,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        let notificationType = null;
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
                    errorType: (error === null || error === void 0 ? void 0 : error.error_type) || "ITEM_ERROR",
                    errorCode: (error === null || error === void 0 ? void 0 : error.error_code) || "UNKNOWN",
                    displayMessage: (error === null || error === void 0 ? void 0 : error.display_message) || "Connection error occurred",
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
            await createConnectionNotification(userId, item_id, institutionName, notificationType, webhook_code);
            Logger.info('Created ${notificationType} notification for user ${userId}', {});
        }
        // For self-healing, dismiss any existing reauth notifications
        if (webhook_code === "LOGIN_REPAIRED") {
            await dismissOldNotifications(userId, item_id, ["reauth_required", "pending_expiration"]);
        }
    }
    catch (error) {
        Logger.error('Error processing Plaid item webhook:', { error: error });
        throw error;
    }
}
// Helper function to create connection notifications
async function createConnectionNotification(userId, itemId, institutionName, type, webhookCode) {
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
async function dismissOldNotifications(userId, itemId, typesToDismiss) {
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
function getNotificationContent(type, institutionName, webhookCode) {
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
async function handlePlaidAuth(webhookData) {
    Logger.info('Processing Plaid auth webhook', {});
    // Handle authentication-related webhooks
    // Implementation depends on your specific auth flow
}
async function handlePlaidAccounts(webhookData) {
    Logger.info('Processing Plaid accounts webhook', {});
    // Handle account-related webhooks (new accounts, account updates, etc.)
}
async function handlePlaidLiabilities(webhookData) {
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
    }
    catch (error) {
        Logger.error('❌ Error processing Plaid liabilities webhook:', { error: error });
        throw error;
    }
}
// Plaid Update Mode Link Token Creation
exports.createPlaidUpdateToken = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const { itemId, accessToken } = request.data;
        const userId = request.auth.uid;
        if (!itemId) {
            throw new https_1.HttpsError('invalid-argument', 'Item ID is required');
        }
        // Verify the item belongs to the user
        const itemQuery = db.collection('plaid_items')
            .where('itemId', '==', itemId)
            .where('userId', '==', userId);
        const itemSnapshot = await itemQuery.get();
        if (itemSnapshot.empty) {
            throw new https_1.HttpsError('not-found', 'Item not found or access denied');
        }
        const itemData = itemSnapshot.docs[0].data();
        const itemAccessToken = accessToken || itemData.accessToken;
        if (!itemAccessToken) {
            throw new https_1.HttpsError('failed-precondition', 'No access token available for item');
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
                access_token: itemAccessToken,
                update: {
                    account_selection_enabled: true,
                },
                webhook: 'https://us-central1-receiptgold.cloudfunctions.net/plaidWebhook',
            }),
        });
        if (!linkTokenResponse.ok) {
            const errorData = await linkTokenResponse.json();
            Logger.error('Plaid Link token creation failed:', { error: errorData });
            throw new https_1.HttpsError('internal', `Failed to create update link token: ${errorData.error_message || 'Unknown error'}`);
        }
        const linkTokenData = await linkTokenResponse.json();
        Logger.info('Created update mode link token for user ${userId}, item ${itemId}', {});
        return {
            link_token: linkTokenData.link_token,
            expiration: linkTokenData.expiration,
        };
    }
    catch (error) {
        Logger.error('Error creating Plaid update link token:', { error: error });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to create update link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Create Plaid Link Token with proper redirect URI/Android package name handling
exports.createPlaidLinkToken = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    var _a, _b;
    Logger.info('🔍 createPlaidLinkToken called', {});
    Logger.info('Request auth', { value: request.auth ? 'present' : 'missing' });
    Logger.info('Request data', { value: request.data });
    Logger.info('Request rawRequest auth header', { value: ((_b = (_a = request.rawRequest) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b.authorization) ? 'Has auth header' : 'No auth header' });
    Logger.info('Manual auth token provided', { value: request.data.auth_token ? 'yes' : 'no' });
    let userId;
    if (request.auth) {
        // Standard Firebase auth context is available
        Logger.info('✅ Using standard Firebase auth context', {});
        userId = request.auth.uid;
    }
    else if (request.data.auth_token) {
        // Manual token verification for React Native
        Logger.info('🔑 Manually verifying auth token', {});
        try {
            const decodedToken = await admin.auth().verifyIdToken(request.data.auth_token);
            userId = decodedToken.uid;
            Logger.info('✅ Manual token verification successful for user', { value: userId });
        }
        catch (error) {
            Logger.error('❌ Manual token verification failed:', { error: error });
            throw new https_1.HttpsError('unauthenticated', 'Invalid authentication token');
        }
    }
    else {
        Logger.error('❌ No authentication method available', {});
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    Logger.info('✅ Authentication verified for user', { value: userId });
    try {
        const { user_id, platform } = request.data;
        if (!user_id) {
            throw new https_1.HttpsError('invalid-argument', 'User ID is required');
        }
        // Verify the user_id matches the authenticated user
        if (user_id !== userId) {
            throw new https_1.HttpsError('permission-denied', 'User ID must match authenticated user');
        }
        // Get Plaid configuration
        const config = getPlaidConfig();
        // Prepare the request body
        const requestBody = {
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
        }
        else {
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
            throw new https_1.HttpsError('internal', `Failed to create link token: ${errorData.error_message || 'Unknown error'}`);
        }
        const linkTokenData = await linkTokenResponse.json();
        Logger.info('Created link token for user ${userId}', {});
        return {
            link_token: linkTokenData.link_token,
            expiration: linkTokenData.expiration,
        };
    }
    catch (error) {
        Logger.error('Error creating Plaid link token:', { error: error });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to create link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// 5. Proactive Bank Connection Health Monitoring
exports.monitorBankConnections = functionsV1.pubsub
    .schedule("0 */6 * * *") // Run every 6 hours
    .onRun(async (context) => {
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
                    await createConnectionNotification(userId, itemId, institutionName, "reauth_required", "HEALTH_CHECK");
                    console.log(`📢 Created repair notification for ${institutionName}`);
                }
            }
            catch (error) {
                console.error(`❌ Error checking health for ${institutionName}:`, error);
            }
        }
        Logger.info('Bank connection health check completed', {});
    }
    catch (error) {
        Logger.error('❌ Error in bank connection monitoring:', { error: error });
    }
});
// Helper function to determine if a connection needs repair
async function checkConnectionNeedsRepair(itemData) {
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
exports.resetMonthlyUsage = functionsV1.pubsub
    .schedule("0 * * * *") // Run every hour
    .onRun(async (context) => {
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
            const subscription = subscriptionDoc.data();
            const periodStart = subscription.billing.currentPeriodStart;
            if (!periodStart)
                continue;
            // Convert Firestore Timestamp to Date if needed
            let periodStartDate;
            if (periodStart instanceof admin.firestore.Timestamp) {
                periodStartDate = periodStart.toDate();
            }
            else if (periodStart instanceof Date) {
                periodStartDate = periodStart;
            }
            else if (typeof periodStart === 'string' || typeof periodStart === 'number') {
                periodStartDate = new Date(periodStart);
            }
            else {
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
                const newUsageDoc = {
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
        }
        else {
            console.log("No subscriptions needed usage reset at this time");
        }
    }
    catch (error) {
        Logger.error('Error resetting monthly usage:', { error: error });
    }
});
// 8. Business Stats Update Trigger (updated for Firebase Functions v6)
exports.updateBusinessStats = functionsV1.firestore
    .document("receipts/{receiptId}")
    .onWrite(async (change, context) => {
    try {
        const receiptData = change.after.exists ? change.after.data() : null;
        const previousData = change.before.exists ? change.before.data() : null;
        if (!receiptData && !previousData)
            return;
        const businessId = (receiptData === null || receiptData === void 0 ? void 0 : receiptData.businessId) || (previousData === null || previousData === void 0 ? void 0 : previousData.businessId);
        if (!businessId)
            return;
        // Recalculate business stats
        const receiptsSnapshot = await db
            .collection("receipts")
            .where("businessId", "==", businessId)
            .where("status", "!=", "deleted")
            .get();
        let totalReceipts = 0;
        let totalAmount = 0;
        let lastReceiptDate = null;
        receiptsSnapshot.forEach((doc) => {
            const data = doc.data();
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
    }
    catch (error) {
        Logger.error('Error updating business stats:', { error: error });
    }
});
exports.generateReport = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    try {
        const userId = request.auth.uid;
        const { type, businessId, startDate, endDate, title } = request.data;
        console.log(`Generating ${type} report for user: ${userId}`);
        // Check user's report generation limits
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usageDoc = await db
            .collection("usage")
            .doc(`${userId}_${currentMonth}`)
            .get();
        if (!usageDoc.exists) {
            throw new https_1.HttpsError("not-found", "Usage data not found");
        }
        const usage = usageDoc.data();
        if (usage.limits.maxReports &&
            usage.limits.maxReports !== -1 &&
            usage.reportsGenerated >= usage.limits.maxReports) {
            throw new https_1.HttpsError("resource-exhausted", "Report generation limit exceeded for current plan");
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
        let totalExpenses = 0;
        let deductibleExpenses = 0;
        const categories = {};
        receiptsSnapshot.forEach((doc) => {
            var _a, _b;
            const receipt = doc.data();
            totalExpenses += receipt.amount || 0;
            if ((_a = receipt.tax) === null || _a === void 0 ? void 0 : _a.deductible) {
                deductibleExpenses +=
                    (receipt.amount || 0) *
                        ((((_b = receipt.tax) === null || _b === void 0 ? void 0 : _b.deductionPercentage) || 100) / 100);
            }
            const category = receipt.category || "uncategorized";
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
            files: [],
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
    }
    catch (error) {
        Logger.error('Error generating report:', { error: error });
        throw new https_1.HttpsError("internal", "Failed to generate report");
    }
});
// 10. User Deletion Cleanup (updated for Firebase Functions v6)
exports.onUserDelete = functionsV1.auth.user().onDelete(async (user) => {
    try {
        const userId = user.uid;
        Logger.info(`Starting immediate permanent deletion for user: ${userId}`);
        // Immediately and permanently delete all user data
        await permanentlyDeleteUserData(userId);
        // Update device tracking records to mark account as deleted
        await updateDeviceTrackingForDeletedAccount(userId);
        Logger.info(`User ${userId} permanently deleted successfully`);
    }
    catch (error) {
        Logger.error('Error permanently deleting user data:', { error: error });
    }
});
// REMOVED: UpdateSubscriptionRequest/Response interfaces - no longer needed with RevenueCat webhook automation
// REMOVED: Helper types and function for updateSubscriptionAfterPayment - no longer needed with RevenueCat webhook automation
// REMOVED: updateSubscriptionAfterPayment function - replaced by RevenueCat webhook automation
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
*/ // Health check endpoint (Stripe references commented out)
exports.healthCheck = (0, https_1.onRequest)((req, res) => {
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
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error,
            timestamp: new Date().toISOString(),
        });
    }
});
// Debug webhook (for testing webhook delivery)
exports.debugWebhook = (0, https_1.onRequest)((req, res) => {
    var _a, _b, _c;
    Logger.info('=== DEBUG WEBHOOK ===', {});
    Logger.info('Method', { value: req.method });
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    Logger.info('Body type', { value: typeof req.body });
    Logger.info('Body length', { value: ((_a = req.body) === null || _a === void 0 ? void 0 : _a.length) || 0 });
    console.log('Raw body preview:', (_b = req.body) === null || _b === void 0 ? void 0 : _b.toString().substring(0, 200));
    res.status(200).json({
        message: 'Debug webhook received',
        method: req.method,
        contentType: req.headers['content-type'],
        hasSignature: !!req.headers['stripe-signature'],
        bodyLength: ((_c = req.body) === null || _c === void 0 ? void 0 : _c.length) || 0,
        timestamp: new Date().toISOString(),
    });
});
// Test DeviceCheck functionality
// Test endpoint to mark a device as used (for testing blocking logic)
exports.markDeviceUsed = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
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
    }
    catch (error) {
        Logger.error('Error marking device as used', { error: error.message });
        res.status(500).json({ error: 'Failed to mark device as used' });
    }
});
// Simple endpoint to save device token for testing
exports.saveDeviceToken = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    try {
        const deviceToken = req.query.token;
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
    }
    catch (error) {
        Logger.error('Error saving device token', { error: error.message });
        res.status(500).json({ error: 'Failed to save device token' });
    }
});
exports.testDeviceCheck = (0, https_1.onRequest)(async (req, res) => {
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
        }
        else if (action === 'update') {
            const { bit0, bit1 } = req.body;
            await updateDeviceCheck(deviceToken, { bit0, bit1 });
            res.status(200).json({
                success: true,
                action: 'update',
                message: 'DeviceCheck bits updated successfully'
            });
        }
        else {
            res.status(400).json({ error: 'action must be "query" or "update"' });
        }
    }
    catch (error) {
        Logger.error('DeviceCheck test failed', { error: error.message });
        res.status(500).json({
            error: `DeviceCheck test failed: ${error.message}`
        });
    }
});
// Function to test Plaid webhooks using sandbox fire_webhook endpoint
exports.testPlaidWebhook = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { webhookType, webhookCode, accessToken } = request.data;
    if (!webhookType || !accessToken) {
        throw new https_1.HttpsError('invalid-argument', 'webhookType and accessToken are required');
    }
    try {
        const plaidConfig = getPlaidConfig();
        console.log(`🧪 Testing Plaid webhook: ${webhookType} for user: ${request.auth.uid}`);
        // Prepare the request body for Plaid sandbox webhook
        const requestBody = {
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
            throw new https_1.HttpsError('internal', `Plaid sandbox webhook failed: ${errorData.error_message || 'Unknown error'}`);
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
    }
    catch (error) {
        Logger.error('❌ Error testing Plaid webhook:', { error: error });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to test webhook: ${error.message}`);
    }
});
// Direct webhook test function (no auth required for testing)
exports.directTestPlaidWebhook = (0, https_1.onRequest)(async (req, res) => {
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
    }
    catch (error) {
        Logger.error('❌ Error in direct webhook test:', { error: error });
        res.status(500).json({
            success: false,
            error: error,
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
exports.sendTeamInvitationEmail = functionsV1.firestore
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
        const accountHolder = accountHolderDoc.data();
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
            from: 'noreply@receiptgold.com',
            replyTo: accountHolderEmail,
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
    }
    catch (error) {
        Logger.error('❌ Error sending team invitation email:', { error: error });
        // Update invitation with error status
        await snapshot.ref.update({
            emailError: error.message,
            emailSent: false,
        });
    }
});
/**
 * Clean up expired team invitations
 * Runs daily to remove expired invitations
 */
exports.cleanupExpiredInvitations = functionsV1.pubsub
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
    }
    catch (error) {
        Logger.error('❌ Error cleaning up expired invitations:', { error: error });
    }
});
/**
 * Handle team member removal
 * Clean up data when a team member is removed
 */
exports.onTeamMemberRemoved = functionsV1.firestore
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
            }
            catch (deleteError) {
                console.error(`❌ Error during complete account deletion for user ${userId}:`, deleteError);
                // Still update the removal timestamp even if deletion fails
                await change.after.ref.update({
                    removedAt: admin.firestore.FieldValue.serverTimestamp(),
                    deletionError: deleteError instanceof Error ? deleteError.message : String(deleteError),
                });
                throw deleteError; // Re-throw to trigger function retry
            }
        }
    }
    catch (error) {
        Logger.error('❌ Error handling team member removal:', { error: error });
    }
});
// RevenueCat webhook for handling subscription events
exports.revenueCatWebhookHandler = (0, https_1.onRequest)(async (req, res) => {
    var _a, _b, _c, _d;
    Logger.info('RevenueCat webhook received', {});
    if (req.method !== 'POST') {
        Logger.error('Invalid method for RevenueCat webhook', { method: req.method });
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Verify authorization header for security
        const authHeader = req.headers['authorization'];
        const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;
        if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
            Logger.info('❌ Invalid authorization header', {});
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (expectedAuth) {
            Logger.info('🔒 Webhook authorization verified', {});
        }
        else {
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
            case 'TRANSFER':
                await handleRevenueCatTransferDirect(event);
                break;
            default:
                Logger.info('Unhandled RevenueCat event type: ${event.type}', {});
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        Logger.error('Error processing RevenueCat webhook', { error: error });
        res.status(500).json({ error: 'Internal server error', eventType: (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.event) === null || _b === void 0 ? void 0 : _b.type, eventId: (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.event) === null || _d === void 0 ? void 0 : _d.id });
    }
});
// Helper function to get the correct user ID from RevenueCat event
function getFirebaseUserIdFromRevenueCatEvent(event) {
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
async function handleRevenueCatSubscriptionCreated(event) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
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
        const tier = mapProductIdToTier(product_id);
        if (!subscriptionTiers[tier]) {
            console.error(`Invalid tier determined: ${tier} for product ID: ${product_id}`);
            throw new Error(`Invalid subscription tier: ${tier}`);
        }
        console.log(`Determined subscription tier: ${tier}`);
        // Extract expiration date from RevenueCat webhook data
        const subscriber = event.subscriber || {};
        const subscriptions = subscriber.subscriptions || {};
        const subscriptionData = subscriptions[product_id];
        const expiresDate = (subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.expires_date) ? new Date(subscriptionData.expires_date) : null;
        // Get comprehensive customer info from RevenueCat API
        Logger.info('Fetching comprehensive customer info from RevenueCat API', { userId });
        const customerInfo = await getRevenueCatCustomerInfo(userId);
        // Fetch user data from Firestore to send as attributes to RevenueCat
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                // Prepare attributes to send to RevenueCat
                const attributesToSend = {
                    // User profile info
                    firebase_user_id: { value: userId },
                    email: { value: (userData === null || userData === void 0 ? void 0 : userData.email) || '' },
                    display_name: { value: (userData === null || userData === void 0 ? void 0 : userData.displayName) || '' },
                    created_at: { value: ((_b = (_a = userData === null || userData === void 0 ? void 0 : userData.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) === null || _b === void 0 ? void 0 : _b.toISOString()) || new Date().toISOString() },
                    // Business profile info
                    business_name: { value: ((_c = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _c === void 0 ? void 0 : _c.businessName) || '' },
                    business_type: { value: ((_d = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _d === void 0 ? void 0 : _d.businessType) || 'Sole Proprietorship' },
                    first_name: { value: ((_e = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _e === void 0 ? void 0 : _e.firstName) || '' },
                    last_name: { value: ((_f = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _f === void 0 ? void 0 : _f.lastName) || '' },
                    phone: { value: ((_g = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _g === void 0 ? void 0 : _g.phone) || '' },
                    // Location info
                    city: { value: ((_j = (_h = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _h === void 0 ? void 0 : _h.address) === null || _j === void 0 ? void 0 : _j.city) || '' },
                    state: { value: ((_l = (_k = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _k === void 0 ? void 0 : _k.address) === null || _l === void 0 ? void 0 : _l.state) || '' },
                    country: { value: ((_o = (_m = userData === null || userData === void 0 ? void 0 : userData.profile) === null || _m === void 0 ? void 0 : _m.address) === null || _o === void 0 ? void 0 : _o.country) || 'US' },
                    // App settings
                    theme: { value: ((_p = userData === null || userData === void 0 ? void 0 : userData.settings) === null || _p === void 0 ? void 0 : _p.theme) || 'light' },
                    default_currency: { value: ((_q = userData === null || userData === void 0 ? void 0 : userData.settings) === null || _q === void 0 ? void 0 : _q.defaultCurrency) || 'USD' },
                    tax_year: { value: ((_s = (_r = userData === null || userData === void 0 ? void 0 : userData.settings) === null || _r === void 0 ? void 0 : _r.taxYear) === null || _s === void 0 ? void 0 : _s.toString()) || new Date().getFullYear().toString() },
                    // Subscription context
                    subscription_tier: { value: tier },
                    product_id: { value: product_id }
                };
                // Send attributes to RevenueCat
                Logger.info('Sending user attributes to RevenueCat', { userId, attributeCount: Object.keys(attributesToSend).length });
                await sendRevenueCatUserAttributes(userId, attributesToSend);
            }
            else {
                Logger.warn('User document not found, skipping RevenueCat attribute sync', { userId });
            }
        }
        catch (error) {
            Logger.error('Error fetching user data for RevenueCat attributes', {
                error: error.message,
                userId
            });
            // Don't fail subscription creation if attribute sync fails
        }
        // Prepare subscription update (ported from Stripe logic)
        const subscriptionUpdate = {
            userId,
            currentTier: tier,
            status: 'active',
            billing: {
                revenueCatUserId: userId,
                productId: product_id,
                originalPurchaseDate: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.originalPurchaseDate) || new Date(event_timestamp_ms),
                latestPurchaseDate: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.latestPurchaseDate) || new Date(event_timestamp_ms),
                expiresDate: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.expiresAt) || expiresDate,
                currentPeriodEnd: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.expiresAt) || expiresDate,
                isActive: (_t = customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.isActive) !== null && _t !== void 0 ? _t : true,
                willRenew: (_u = customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.willRenew) !== null && _u !== void 0 ? _u : true,
                unsubscribeDetectedAt: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.unsubscribeDetectedAt) || null,
                billingIssueDetectedAt: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.billingIssueDetectedAt) || null,
                // Store info
                store: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.store) || 'UNKNOWN',
                storeUserId: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.storeUserId) || null,
                isSandbox: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.isSandbox) || false,
                periodType: (customerInfo === null || customerInfo === void 0 ? void 0 : customerInfo.periodType) || 'NORMAL',
            },
            // RevenueCat customer attributes
            revenueCatCustomer: customerInfo ? {
                originalAppUserId: customerInfo.originalAppUserId,
                originalApplicationVersion: customerInfo.originalApplicationVersion,
                firstSeen: customerInfo.firstSeen,
                lastSeen: customerInfo.lastSeen,
                managementUrl: customerInfo.managementUrl,
                entitlements: customerInfo.entitlements,
            } : null,
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
            var _a;
            const subscriptionRef = db.collection("subscriptions").doc(userId);
            const doc = await transaction.get(subscriptionRef);
            let finalSubscriptionUpdate = { ...subscriptionUpdate };
            if (doc.exists) {
                const currentData = doc.data();
                console.log("🚀 ~ handleRevenueCatSubscriptionCreated ~ currentData:", currentData);
                // End trial when confirming subscription (if trial is still active)
                const trialData = currentData === null || currentData === void 0 ? void 0 : currentData.trial;
                const currentTrialActive = (trialData === null || trialData === void 0 ? void 0 : trialData.isActive) !== false && // if isActive is undefined or true
                    (trialData === null || trialData === void 0 ? void 0 : trialData.expiresAt) &&
                    trialData.expiresAt.toDate() > new Date(); // and not expired
                if (currentTrialActive) {
                    console.log(`🏁 Ending trial for user upgrading to paid subscription: ${tier}`);
                    finalSubscriptionUpdate.trial = {
                        isActive: false,
                        startedAt: ((_a = currentData === null || currentData === void 0 ? void 0 : currentData.trial) === null || _a === void 0 ? void 0 : _a.startedAt) || admin.firestore.FieldValue.serverTimestamp(),
                        expiresAt: admin.firestore.FieldValue.serverTimestamp(),
                        endedEarly: true,
                        endReason: 'upgraded_to_paid'
                    };
                }
                // Update existing subscription
                transaction.update(subscriptionRef, finalSubscriptionUpdate);
                console.log(`Updated existing subscription for user ${userId}`);
            }
            else {
                // Create new subscription document
                transaction.set(subscriptionRef, {
                    ...finalSubscriptionUpdate,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Created new subscription for user ${userId}`);
            }
            // CRITICAL: Also update the user document with currentTier for app compatibility
            const userRef = db.collection("users").doc(userId);
            transaction.update(userRef, {
                currentTier: tier,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Updated user document currentTier to ${tier} for user ${userId}`);
            // Also create/update the user's usage document for current month
            const currentMonth = new Date().toISOString().slice(0, 7);
            const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
            // Use set with merge to create document if it doesn't exist
            transaction.set(usageRef, {
                userId,
                month: currentMonth,
                receiptsUploaded: 0,
                apiCalls: 0,
                reportsGenerated: 0,
                limits: subscriptionTiers[tier].limits,
                resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        Logger.info('Successfully processed RevenueCat subscription creation for user ${userId}', {});
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatSubscriptionCreated:', { error: error });
        // Re-throw to trigger webhook retry if it's a transient error
        throw error;
    }
}
// RevenueCat handler for PRODUCT_CHANGE (equivalent to Stripe subscription.updated)
async function handleRevenueCatSubscriptionUpdated(event) {
    var _a, _b;
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
        const tier = mapProductIdToTier(effectiveProductId);
        // Extract expiration date from RevenueCat webhook data
        const subscriber = event.subscriber || {};
        const subscriptions = subscriber.subscriptions || {};
        const subscriptionData = subscriptions[effectiveProductId];
        const expiresDate = (subscriptionData === null || subscriptionData === void 0 ? void 0 : subscriptionData.expires_date) ? new Date(subscriptionData.expires_date) : null;
        // Get current tier for comparison
        const subscriptionRef = db.collection("subscriptions").doc(userId);
        const currentSub = await subscriptionRef.get();
        const currentTier = ((_a = currentSub.data()) === null || _a === void 0 ? void 0 : _a.currentTier) || 'starter';
        // Prepare subscription update data
        const subscriptionUpdateData = {
            currentTier: tier,
            status: 'active',
            billing: {
                revenueCatUserId: userId,
                productId: effectiveProductId,
                latestPurchaseDate: new Date(event_timestamp_ms),
                expiresDate: expiresDate,
                currentPeriodEnd: expiresDate,
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
        // End trial when confirming subscription (if trial is still active)
        const currentData = currentSub.data();
        const trialData = currentData === null || currentData === void 0 ? void 0 : currentData.trial;
        const currentTrialActive = (trialData === null || trialData === void 0 ? void 0 : trialData.isActive) !== false && // if isActive is undefined or true
            (trialData === null || trialData === void 0 ? void 0 : trialData.expiresAt) &&
            trialData.expiresAt.toDate() > new Date(); // and not expired
        if (currentTrialActive) {
            console.log(`🏁 Ending trial for user upgrading to paid subscription: ${tier}`);
            subscriptionUpdateData.trial = {
                isActive: false,
                startedAt: ((_b = currentData === null || currentData === void 0 ? void 0 : currentData.trial) === null || _b === void 0 ? void 0 : _b.startedAt) || admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.FieldValue.serverTimestamp(),
                endedEarly: true,
                endReason: 'upgraded_to_paid'
            };
        }
        // Use transaction for atomic updates
        await db.runTransaction(async (transaction) => {
            var _a;
            // Update subscription document
            transaction.update(subscriptionRef, subscriptionUpdateData);
            // CRITICAL: Also update the user document with currentTier for app compatibility
            const userRef = db.collection("users").doc(userId);
            transaction.update(userRef, {
                currentTier: tier,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Update usage limits if downgrading
            if (shouldUpdateUsageLimits(currentTier, tier)) {
                const currentMonth = new Date().toISOString().slice(0, 7);
                const usageRef = db.collection('usage').doc(`${userId}_${currentMonth}`);
                transaction.set(usageRef, {
                    limits: ((_a = subscriptionTiers[tier]) === null || _a === void 0 ? void 0 : _a.limits) || subscriptionTiers.starter.limits,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                Logger.info(`Updated usage limits for ${currentMonth} due to tier change`, {});
            }
        });
        console.log(`Updated user document currentTier to ${tier} for user ${userId}`);
        Logger.info(`Successfully processed RevenueCat subscription update for user ${userId}`, {});
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatSubscriptionUpdated:', { error: error });
        throw error;
    }
}
// Helper function to send notifications for subscription events
async function sendSubscriptionEventNotification(userId, eventType) {
    try {
        let notificationData;
        switch (eventType) {
            case 'CANCELLATION':
                notificationData = {
                    title: "Thank you for trying ReceiptGold! 💝",
                    body: "We hope to see you again soon. Your receipts will be saved if you decide to return.",
                    data: {
                        type: "subscription_cancellation"
                    }
                };
                break;
            case 'EXPIRATION':
                notificationData = {
                    title: "Your ReceiptGold subscription has expired",
                    body: "Upgrade to continue accessing premium features.",
                    data: {
                        type: "subscription_expiration"
                    }
                };
                break;
            default:
                Logger.warn(`No notification configured for event type: ${eventType}`);
                return;
        }
        // Create notification document that the app monitors
        await db.collection("user_notifications").add({
            userId: userId,
            title: notificationData.title,
            body: notificationData.body,
            data: notificationData.data,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            read: false,
            source: 'revenuecat_webhook',
            sourceId: `${eventType}_${Date.now()}`
        });
        Logger.info(`Sent ${eventType} notification to user ${userId}`);
    }
    catch (error) {
        Logger.error(`Error sending ${eventType} notification:`, { error: error, userId });
    }
}
// RevenueCat handler for CANCELLATION/EXPIRATION (equivalent to Stripe subscription.deleted)
async function handleRevenueCatSubscriptionDeleted(event) {
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
            const updateData = {
                currentTier: "starter",
                status: event.type === 'CANCELLATION' ? "canceled" : "expired",
                billing: {
                    isActive: false,
                    willRenew: false,
                    unsubscribeDetectedAt: new Date(event_timestamp_ms),
                },
                limits: subscriptionTiers.starter.limits,
                features: subscriptionTiers.starter.features,
                history: admin.firestore.FieldValue.arrayUnion({
                    tier: "starter",
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
            }
            else {
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
        // Send appropriate notification based on event type
        await sendSubscriptionEventNotification(userId, event.type);
        Logger.info('Successfully processed RevenueCat subscription deletion for user ${userId}', {});
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatSubscriptionDeleted:', { error: error });
        throw error;
    }
}
// RevenueCat handler for RENEWAL (equivalent to Stripe invoice.payment_succeeded)
async function handleRevenueCatPaymentSucceeded(event) {
    try {
        const { event_timestamp_ms, product_id, expiration_at_ms } = event;
        const userId = getFirebaseUserIdFromRevenueCatEvent(event);
        Logger.info('RevenueCat payment succeeded for user', { value: userId });
        if (!userId) {
            Logger.error('No userId found in RevenueCat event', { eventType: event.type });
            return;
        }
        console.log(`Processing successful RevenueCat renewal for user: ${userId}`);
        // Extract expiration date from renewal event
        const expiresDate = expiration_at_ms ? new Date(expiration_at_ms) : null;
        // Get subscription status in Firestore (ported from Stripe logic)
        const subscriptionRef = db.collection("subscriptions").doc(userId);
        // Determine tier from product ID with validation
        const tier = mapProductIdToTier(product_id);
        const updateData = {
            status: "active",
            billing: {
                lastPaymentStatus: "succeeded",
                lastPaymentDate: admin.firestore.Timestamp.fromDate(new Date(event_timestamp_ms)),
                latestPurchaseDate: new Date(event_timestamp_ms),
                expiresDate: expiresDate,
                currentPeriodEnd: expiresDate,
                isActive: true,
                willRenew: true,
                billingIssueDetectedAt: null,
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
            var _a, _b;
            const doc = await transaction.get(subscriptionRef);
            if (doc.exists) {
                // Update existing subscription
                transaction.update(subscriptionRef, updateData);
                console.log(`Updated existing subscription for user ${userId}`);
            }
            else {
                // Create new subscription document with defaults
                const createData = {
                    ...updateData,
                    userId: userId,
                    currentTier: tier,
                    limits: ((_a = subscriptionTiers[tier]) === null || _a === void 0 ? void 0 : _a.limits) || subscriptionTiers.starter.limits,
                    features: ((_b = subscriptionTiers[tier]) === null || _b === void 0 ? void 0 : _b.features) || subscriptionTiers.starter.features,
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
            // CRITICAL: Also update the user document with currentTier for app compatibility
            const userRef = db.collection("users").doc(userId);
            transaction.update(userRef, {
                currentTier: tier,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`Updated user document currentTier to ${tier} for user ${userId}`);
        });
        Logger.info('Successfully processed RevenueCat payment success for user ${userId}', {});
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatPaymentSucceeded:', { error: error });
        throw error;
    }
}
// RevenueCat handler for BILLING_ISSUE (equivalent to Stripe invoice.payment_failed)
async function handleRevenueCatPaymentFailed(event) {
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
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatPaymentFailed:', { error: error });
        throw error;
    }
}
// RevenueCat handler for UNCANCELLATION
async function handleRevenueCatSubscriptionReactivated(event) {
    try {
        const { product_id, event_timestamp_ms } = event;
        const userId = getFirebaseUserIdFromRevenueCatEvent(event);
        if (!userId) {
            Logger.error('No userId found in RevenueCat event', { eventType: event.type });
            return;
        }
        console.log(`Processing RevenueCat subscription reactivation for user: ${userId}`);
        const tier = mapProductIdToTier(product_id);
        const subscriptionRef = db.collection("subscriptions").doc(userId);
        // Use transaction to handle creating document if it doesn't exist
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(subscriptionRef);
            const updateData = {
                currentTier: tier,
                status: 'active',
                billing: {
                    isActive: true,
                    willRenew: true,
                    unsubscribeDetectedAt: null,
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
            }
            else {
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
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatSubscriptionReactivated:', { error: error });
        throw error;
    }
}
// RevenueCat handler for SUBSCRIBER_ALIAS (when user accounts are merged)
async function handleRevenueCatSubscriberAlias(event) {
    Logger.info('Processing RevenueCat subscriber alias event', { event });
    try {
        const { original_app_user_id, new_app_user_id } = event;
        Logger.info('RevenueCat subscriber alias event', {
            originalUserId: original_app_user_id,
            newUserId: new_app_user_id
        });
        // This event indicates user account merge - typically handled by RevenueCat automatically
        // Log for debugging purposes but usually no action needed
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatSubscriberAlias:', { error: error });
        throw error;
    }
}
// Helper function to map RevenueCat product IDs to our subscription tiers
function mapRevenueCatProductToTier(productId) {
    if (!productId)
        return 'none';
    const productLower = productId.toLowerCase();
    if (productLower.includes('professional') || productLower.includes('pro')) {
        return 'professional';
    }
    else if (productLower.includes('growth')) {
        return 'growth';
    }
    else if (productLower.includes('starter')) {
        return 'starter';
    }
    else if (productLower.includes('teammate')) {
        return 'teammate';
    }
    // Default to 'none' for unknown products
    Logger.warn('Unknown RevenueCat product ID, defaulting to none tier', { productId });
    return 'none';
}
// Helper function to get comprehensive customer info from RevenueCat API
async function getRevenueCatCustomerInfo(revenueCatUserId) {
    try {
        Logger.info('Calling RevenueCat API to get subscriber info', { revenueCatUserId });
        const revenueCatApiKey = process.env.REVENUECAT_API_KEY;
        if (!revenueCatApiKey) {
            Logger.warn('RevenueCat API key not configured');
            return null;
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
            Logger.error('RevenueCat API call failed', {
                status: response.status,
                statusText: response.statusText,
            });
            return null;
        }
        const subscriberData = await response.json();
        Logger.info('RevenueCat subscriber data received', { subscriberData });
        const subscriber = subscriberData.subscriber;
        if (!subscriber) {
            Logger.warn('No subscriber data found in RevenueCat response', { revenueCatUserId });
            return null;
        }
        // Extract customer attributes
        const originalAppUserId = subscriber.original_app_user_id || revenueCatUserId;
        const originalApplicationVersion = subscriber.original_application_version || null;
        const firstSeen = subscriber.first_seen ? new Date(subscriber.first_seen) : null;
        const lastSeen = subscriber.last_seen ? new Date(subscriber.last_seen) : null;
        const managementUrl = subscriber.management_url || null;
        // Get active subscriptions
        const subscriptions = subscriber.subscriptions || {};
        const entitlements = subscriber.entitlements || {};
        // Find the most recent active subscription
        let mostRecentSubscription = null;
        let mostRecentDate = new Date(0);
        for (const [productId, subscription] of Object.entries(subscriptions)) {
            const sub = subscription;
            const expiresDate = sub.expires_date ? new Date(sub.expires_date) : null;
            const purchaseDate = sub.purchase_date ? new Date(sub.purchase_date) : new Date(0);
            const originalPurchaseDate = sub.original_purchase_date ? new Date(sub.original_purchase_date) : null;
            // Check if subscription is active (not expired or null expiry date for non-consumables)
            const isActive = !expiresDate || expiresDate > new Date();
            if (isActive && purchaseDate > mostRecentDate) {
                mostRecentDate = purchaseDate;
                mostRecentSubscription = {
                    productId,
                    expiresAt: expiresDate,
                    purchaseDate,
                    originalPurchaseDate,
                    periodType: sub.period_type || 'NORMAL',
                    store: sub.store || 'UNKNOWN',
                    unsubscribeDetectedAt: sub.unsubscribe_detected_at ? new Date(sub.unsubscribe_detected_at) : null,
                    billingIssueDetectedAt: sub.billing_issue_detected_at ? new Date(sub.billing_issue_detected_at) : null,
                    willRenew: sub.will_renew !== false,
                    isSandbox: sub.is_sandbox === true,
                    storeUserId: sub.store_user_id || null
                };
            }
        }
        if (!mostRecentSubscription) {
            Logger.info('No active subscription found for user', { revenueCatUserId });
            return null;
        }
        const tier = mapRevenueCatProductToTier(mostRecentSubscription.productId);
        // Extract active entitlement names
        const activeEntitlements = Object.keys(entitlements).filter(entitlementId => {
            const entitlement = entitlements[entitlementId];
            const expiresDate = entitlement.expires_date ? new Date(entitlement.expires_date) : null;
            return !expiresDate || expiresDate > new Date();
        });
        return {
            // Subscription info
            tier,
            expiresAt: mostRecentSubscription.expiresAt,
            productId: mostRecentSubscription.productId,
            periodType: mostRecentSubscription.periodType,
            store: mostRecentSubscription.store,
            // Customer attributes
            originalAppUserId,
            originalApplicationVersion,
            firstSeen,
            lastSeen,
            managementUrl,
            // Subscription details
            originalPurchaseDate: mostRecentSubscription.originalPurchaseDate,
            latestPurchaseDate: mostRecentSubscription.purchaseDate,
            billingIssueDetectedAt: mostRecentSubscription.billingIssueDetectedAt,
            unsubscribeDetectedAt: mostRecentSubscription.unsubscribeDetectedAt,
            willRenew: mostRecentSubscription.willRenew,
            isActive: true,
            isSandbox: mostRecentSubscription.isSandbox,
            // Store info
            storeUserId: mostRecentSubscription.storeUserId,
            entitlements: activeEntitlements
        };
    }
    catch (error) {
        Logger.error('Error calling RevenueCat API', { error: error.message, revenueCatUserId });
        return null;
    }
}
// Helper function to send user attributes to RevenueCat API
async function sendRevenueCatUserAttributes(revenueCatUserId, attributes) {
    try {
        Logger.info('Sending user attributes to RevenueCat API', { revenueCatUserId, attributes });
        const revenueCatApiKey = process.env.REVENUECAT_API_KEY;
        if (!revenueCatApiKey) {
            Logger.warn('RevenueCat API key not configured, skipping attribute update');
            return false;
        }
        // Call RevenueCat REST API to update subscriber attributes
        const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${revenueCatUserId}/attributes`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${revenueCatApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attributes
            }),
        });
        if (!response.ok) {
            Logger.error('RevenueCat attributes API call failed', {
                status: response.status,
                statusText: response.statusText,
                revenueCatUserId
            });
            return false;
        }
        const result = await response.json();
        Logger.info('Successfully sent user attributes to RevenueCat', { revenueCatUserId, result });
        return true;
    }
    catch (error) {
        Logger.error('Error sending attributes to RevenueCat API', {
            error: error.message,
            revenueCatUserId,
            attributes
        });
        return false;
    }
}
// Helper function to create subscription for new user from RevenueCat data
async function createSubscriptionFromRevenueCat(userId, subscriptionData, revenueCatEvent) {
    try {
        // Get tier limits and features using existing functions
        const tierKey = subscriptionData.tier;
        const limits = subscriptionTiers[tierKey] || subscriptionTiers.none;
        // Create basic features object based on tier
        const features = {
            receiptProcessing: subscriptionData.tier !== 'none',
            businessInsights: ['growth', 'professional'].includes(subscriptionData.tier),
            bankConnection: ['growth', 'professional'].includes(subscriptionData.tier),
            teamAccess: subscriptionData.tier === 'professional',
            apiAccess: subscriptionData.tier === 'professional',
            advancedReporting: ['growth', 'professional'].includes(subscriptionData.tier),
            customCategories: subscriptionData.tier !== 'none',
            exportData: subscriptionData.tier !== 'none',
            prioritySupport: ['growth', 'professional'].includes(subscriptionData.tier),
            unlimitedReceipts: subscriptionData.tier === 'professional'
        };
        const subscriptionDoc = {
            userId,
            currentTier: subscriptionData.tier,
            isActive: true,
            expiresAt: subscriptionData.expiresAt,
            limits,
            features,
            revenueCatCustomerId: userId,
            lastRevenueCatEvent: {
                type: 'TRANSFER',
                eventData: revenueCatEvent,
                processedAt: new Date()
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            history: [{
                    tier: subscriptionData.tier,
                    startDate: new Date(),
                    endDate: null,
                    reason: 'transfer_from_deleted_account'
                }]
        };
        await db.collection('subscriptions').doc(userId).set(subscriptionDoc);
        Logger.info('Successfully created subscription from RevenueCat transfer data', {
            userId,
            tier: subscriptionData.tier,
            productId: subscriptionData.productId,
            expiresAt: subscriptionData.expiresAt
        });
    }
    catch (error) {
        Logger.error('Error creating subscription from RevenueCat data', {
            error: error.message,
            userId,
            subscriptionData
        });
        throw error;
    }
}
// RevenueCat handler for TRANSFER events (direct webhook format)
async function handleRevenueCatTransferDirect(event) {
    try {
        Logger.info('RevenueCat direct transfer event received', { event });
        const { transferred_from, transferred_to } = event;
        if (!transferred_from || !transferred_to || !Array.isArray(transferred_from) || !Array.isArray(transferred_to)) {
            Logger.error('Missing or invalid transferred_from/transferred_to arrays in direct transfer event', {
                transferred_from,
                transferred_to,
                event
            });
            return;
        }
        // Extract Firebase user IDs (skip anonymous RevenueCat IDs)
        const originalUserId = transferred_from.find((id) => id && !id.startsWith('$RCAnonymousID:'));
        const newUserId = transferred_to.find((id) => id && !id.startsWith('$RCAnonymousID:'));
        if (!newUserId || !originalUserId) {
            Logger.error('Could not find valid Firebase user IDs in direct transfer arrays', {
                transferred_from,
                transferred_to,
                originalUserId,
                newUserId
            });
            return;
        }
        Logger.info('Processing direct account transfer', {
            from: originalUserId,
            to: newUserId,
            transferred_from,
            transferred_to
        });
        // Check if original user data still exists (account might have been deleted)
        const originalUserDoc = await db.collection('users').doc(originalUserId).get();
        if (!originalUserDoc.exists) {
            Logger.warn('Original user data not found - account may have been deleted', {
                originalUserId,
                newUserId
            });
            // Still log the transfer attempt for auditing
            await db.collection('events').add({
                type: 'account_transfer_failed',
                reason: 'original_user_deleted',
                originalUserId,
                newUserId,
                eventData: event,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                source: 'revenuecat_direct_webhook'
            });
            // Get subscription info from RevenueCat API for the original user
            const subscriptionData = await getRevenueCatCustomerInfo(originalUserId);
            Logger.info('Retrieved subscription data from RevenueCat API for deleted account transfer', { subscriptionData, newUserId, originalUserId });
            if (subscriptionData) {
                try {
                    // Create subscription for new user based on RevenueCat data
                    await createSubscriptionFromRevenueCat(newUserId, subscriptionData, event);
                    // Create success notification for the new user
                    await db.collection('user_notifications').add({
                        userId: newUserId,
                        title: 'Subscription Transferred',
                        body: `Your ${subscriptionData.tier} subscription has been successfully transferred to your new account.`,
                        data: {
                            type: 'account_transfer_success',
                            tier: subscriptionData.tier,
                            reason: 'original_user_deleted'
                        },
                        read: false,
                        isRead: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        source: 'revenuecat_transfer'
                    });
                    Logger.info('Successfully created subscription and notification for new user from deleted account transfer', {
                        newUserId,
                        tier: subscriptionData.tier,
                        productId: subscriptionData.productId,
                        expiresAt: subscriptionData.expiresAt
                    });
                }
                catch (error) {
                    Logger.error('Failed to create subscription for new user from deleted account transfer', {
                        error: error.message,
                        newUserId,
                        subscriptionData
                    });
                    // Create failure notification
                    await db.collection('user_notifications').add({
                        userId: newUserId,
                        title: 'Account Transfer Notice',
                        body: 'Your subscription transfer encountered an issue. Please contact support.',
                        data: {
                            type: 'account_transfer_failed',
                            reason: 'subscription_creation_failed'
                        },
                        read: false,
                        isRead: false,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        source: 'revenuecat_transfer'
                    });
                }
            }
            else {
                Logger.warn('Could not retrieve subscription data from RevenueCat API for deleted account transfer', {
                    originalUserId,
                    newUserId
                });
                // Create notification about failed data extraction
                await db.collection('user_notifications').add({
                    userId: newUserId,
                    title: 'Account Transfer Notice',
                    body: 'Your subscription has been transferred, but the original account data was not available for transfer.',
                    data: {
                        type: 'account_transfer_failed',
                        reason: 'original_user_deleted'
                    },
                    read: false,
                    isRead: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    source: 'revenuecat_transfer'
                });
                Logger.info('Created notification for new user about failed transfer', { newUserId });
            }
            return; // Exit early
        }
        // Proceed with full account transfer
        await handleAccountTransfer(originalUserId, newUserId, event);
        Logger.info('Successfully processed direct RevenueCat transfer event', {
            originalUserId,
            newUserId
        });
    }
    catch (error) {
        Logger.error('Error processing direct RevenueCat transfer event', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}
// RevenueCat handler for NON_RENEWING_PURCHASE (one-time purchases)
async function handleRevenueCatOneTimePurchase(event) {
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
    }
    catch (error) {
        Logger.error('Error in handleRevenueCatOneTimePurchase:', { error: error });
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
function mapProductIdToTier(productId) {
    const productToTierMap = {
        'rg_starter': 'starter',
        'rg_growth_monthly': 'growth',
        'rg_growth_annual': 'growth',
        'rg_professional_monthly': 'professional',
        'rg_professional_annual': 'professional'
    };
    return productToTierMap[productId] || 'starter';
}
// Check if usage limits should be updated (when downgrading)
function shouldUpdateUsageLimits(currentTier, newTier) {
    const tierPriority = { trial: 0, starter: 1, growth: 2, professional: 3 };
    return (tierPriority[newTier] || 0) <
        (tierPriority[currentTier] || 0);
}
// Check account holder subscription status for teammate sign-in
exports.checkAccountHolderSubscription = (0, https_1.onCall)(async (request) => {
    var _a, _b;
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
        const subscription = userData === null || userData === void 0 ? void 0 : userData.subscription;
        if (!subscription) {
            Logger.info('No subscription found for account holder', { accountHolderId });
            return { hasActiveSubscription: false };
        }
        // Check if subscription is active AND includes team management features
        const isActive = subscription.status === 'active' &&
            subscription.tier !== 'trial' &&
            new Date(((_b = (_a = subscription.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || subscription.expiresAt) > new Date();
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
    }
    catch (error) {
        Logger.error('Error checking account holder subscription', { error: error.message });
        // Return false to block access when there's an error, for security
        return { hasActiveSubscription: false };
    }
});
// Automatically manage teammate access when account holder subscription changes
exports.onSubscriptionStatusChange = functionsV1.firestore
    .document('subscriptions/{userId}')
    .onUpdate(async (change, context) => {
    try {
        const userId = context.params.userId;
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const beforeSubscription = beforeData;
        const afterSubscription = afterData;
        // Check if subscription status changed from active to inactive
        const wasActive = (beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.status) === 'active';
        const isNowInactive = (afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.status) !== 'active';
        if (wasActive && isNowInactive) {
            Logger.info('Account holder subscription became inactive, revoking teammate access', {
                accountHolderId: userId,
                previousStatus: beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.status,
                newStatus: afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.status,
                previousTier: beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.currentTier,
                newTier: afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.currentTier
            });
            await revokeTeammateAccess(userId);
            return; // Exit early to avoid duplicate processing
        }
        // Check if account holder lost professional tier (but subscription is still active)
        const hadProfessionalTier = (beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.currentTier) === 'professional';
        const lostProfessionalTier = hadProfessionalTier && (afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.currentTier) !== 'professional';
        if (lostProfessionalTier && (afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.status) === 'active') {
            Logger.info('Account holder lost professional tier, suspending teammates', {
                accountHolderId: userId,
                previousTier: beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.currentTier,
                newTier: afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.currentTier
            });
            await suspendTeammatesForProfessionalTierLoss(userId);
        }
        // Check if account holder regained professional tier
        const didNotHaveProfessionalTier = (beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.currentTier) !== 'professional';
        const regainedProfessionalTier = didNotHaveProfessionalTier && (afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.currentTier) === 'professional';
        if (regainedProfessionalTier && (afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.status) === 'active') {
            Logger.info('Account holder regained professional tier, reactivating suspended teammates', {
                accountHolderId: userId,
                previousTier: beforeSubscription === null || beforeSubscription === void 0 ? void 0 : beforeSubscription.currentTier,
                newTier: afterSubscription === null || afterSubscription === void 0 ? void 0 : afterSubscription.currentTier
            });
            await reactivateTeammatesForProfessionalTier(userId);
        }
    }
    catch (error) {
        Logger.error('Error handling subscription status change', {
            userId: context.params.userId,
            error: error.message
        });
    }
});
// Update device tracking records when an account is deleted
async function updateDeviceTrackingForDeletedAccount(userId) {
    var _a, _b;
    try {
        const db = admin.firestore();
        // Get user's subscription status before deletion
        const userDoc = await db.collection('users').doc(userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const subscription = userData === null || userData === void 0 ? void 0 : userData.subscription;
        // Determine subscription status
        const hadActiveSubscription = (subscription === null || subscription === void 0 ? void 0 : subscription.status) === 'active' &&
            (subscription === null || subscription === void 0 ? void 0 : subscription.tier) !== 'trial' &&
            new Date(((_b = (_a = subscription === null || subscription === void 0 ? void 0 : subscription.expiresAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || (subscription === null || subscription === void 0 ? void 0 : subscription.expiresAt)) > new Date();
        const subscriptionStatus = (subscription === null || subscription === void 0 ? void 0 : subscription.status) || 'none';
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
            }
            catch (updateError) {
                Logger.error('Failed to update device tracking record', {
                    deviceId: doc.id.substring(0, 20) + '...',
                    error: updateError.message
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
    }
    catch (error) {
        Logger.error('Error updating device tracking for deleted account', {
            userId: userId.substring(0, 8) + '...',
            error: error.message
        });
        // Don't throw error - this shouldn't block account deletion
    }
}
// Check if device blocking should be bypassed for deleted accounts with unsubscribed status
async function checkDeletedAccountException(deviceData, _newEmail) {
    var _a, _b, _c;
    try {
        // Check if we have stored information about the previous account
        if (!deviceData.createdAt || !deviceData.note) {
            Logger.info('No previous account information available for exception check');
            return false;
        }
        // Look for deleted account markers in the device data
        if (deviceData.accountDeleted === true || ((_a = deviceData.note) === null || _a === void 0 ? void 0 : _a.includes('Account deleted'))) {
            Logger.info('Previous account was deleted, checking if it had active subscription/trial');
            // Block recreation if previous account had active subscription or trial
            if (deviceData.hadActiveSubscription === true ||
                deviceData.subscriptionStatus === 'active' ||
                deviceData.subscriptionStatus === 'trialing' ||
                ((_b = deviceData.note) === null || _b === void 0 ? void 0 : _b.includes('had active subscription'))) {
                Logger.info('Previous deleted account had active subscription/trial - blocking recreation to prevent abuse');
                return false;
            }
            // Allow recreation if previous account had no active subscription/trial
            Logger.info('Previous deleted account had no active subscription/trial - allowing recreation');
            return true;
        }
        // Additional check: if enough time has passed (e.g., 30 days) since account creation,
        // we can be more lenient and allow new account creation
        const accountCreatedAt = ((_c = deviceData.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) ? deviceData.createdAt.toDate() : new Date(deviceData.createdAt);
        const daysSinceCreation = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreation > 30) {
            Logger.info('Previous account is older than 30 days - allowing exception', { daysSinceCreation });
            return true;
        }
        Logger.info('No exception criteria met for device blocking bypass');
        return false;
    }
    catch (error) {
        Logger.error('Error checking deleted account exception', { error: error.message });
        // On error, don't allow exception to maintain security
        return false;
    }
}
// Helper function to revoke access for all teammates of an account holder
async function revokeTeammateAccess(accountHolderId) {
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
            }
            catch (error) {
                Logger.error('Failed to revoke access for teammate', {
                    accountHolderId,
                    teammateUserId,
                    error: error.message
                });
            }
        });
        await Promise.all(revocationPromises);
        Logger.info('Completed revoking access for all teammates', { accountHolderId });
    }
    catch (error) {
        Logger.error('Error revoking teammate access', {
            accountHolderId,
            error: error.message
        });
        throw error;
    }
}
// Suspend teammates when account holder loses professional tier
async function suspendTeammatesForProfessionalTierLoss(accountHolderId) {
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
            }
            catch (error) {
                Logger.error('Failed to delete team member', {
                    accountHolderId,
                    teammateUserId: teamMember.userId,
                    error: error.message
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
            }
            catch (error) {
                Logger.error('Failed to delete team invitation', {
                    accountHolderId,
                    inviteEmail: invitation.inviteEmail,
                    error: error.message
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
                    error: error.message
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
    }
    catch (error) {
        Logger.error('Error clearing team data for professional tier loss', {
            accountHolderId,
            error: error.message
        });
        throw error;
    }
}
// Reactivate teammates when account holder regains professional tier
async function reactivateTeammatesForProfessionalTier(accountHolderId) {
    try {
        // Since we now delete all team data when professional tier is lost,
        // there are no suspended teammates to reactivate.
        // The account holder will need to re-invite teammates if they upgrade back to professional.
        Logger.info('Professional tier regained - no teammates to reactivate (all team data was cleared on downgrade)', {
            accountHolderId
        });
    }
    catch (error) {
        Logger.error('Error in reactivateTeammatesForProfessionalTier', {
            accountHolderId,
            error: error.message
        });
        throw error;
    }
}
// Send Contact Support Email
exports.sendContactSupportEmail = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    const { category, subject, message, userEmail, userId } = request.data;
    const authUserId = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
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
        if (!(subject === null || subject === void 0 ? void 0 : subject.trim()) || !(message === null || message === void 0 ? void 0 : message.trim())) {
            throw new https_1.HttpsError('invalid-argument', 'Subject and message are required');
        }
        if (!category || !['billing', 'technical', 'general'].includes(category)) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid support category');
        }
        // Get user information if authenticated (optional)
        let userInfo = {};
        if (authUserId) {
            try {
                const userDoc = await db.collection('users').doc(authUserId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    userInfo = {
                        userId: authUserId,
                        email: (userData === null || userData === void 0 ? void 0 : userData.email) || userEmail,
                        displayName: userData === null || userData === void 0 ? void 0 : userData.displayName,
                        createdAt: userData === null || userData === void 0 ? void 0 : userData.createdAt,
                        subscription: userData === null || userData === void 0 ? void 0 : userData.subscription
                    };
                }
            }
            catch (error) {
                Logger.warn('Could not fetch user data for support email', {
                    userId: authUserId,
                    error: error.message
                });
                userInfo = {
                    userId: authUserId,
                    email: userEmail
                };
            }
        }
        else {
            // Handle unauthenticated users
            userInfo = {
                email: userEmail || 'No email provided',
                userId: 'unauthenticated',
                note: 'User not authenticated - sent via support form'
            };
        }
        // Get device and app information from request headers
        const deviceInfo = {
            userAgent: ((_b = request.rawRequest) === null || _b === void 0 ? void 0 : _b.headers['user-agent']) || 'Unknown',
            platform: ((_c = request.rawRequest) === null || _c === void 0 ? void 0 : _c.headers['x-platform']) || 'Unknown',
            appVersion: ((_d = request.rawRequest) === null || _d === void 0 ? void 0 : _d.headers['x-app-version']) || 'Unknown',
            timestamp: new Date().toISOString()
        };
        // Get SendGrid API key from environment
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        if (!sendgridApiKey) {
            Logger.error('❌ SENDGRID_API_KEY environment variable not set');
            throw new https_1.HttpsError('internal', 'Email service not configured');
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
${categoryEmoji[category]} SUPPORT REQUEST - ${category.toUpperCase()}

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
        }
        catch (logError) {
            Logger.warn('Failed to log support request to Firestore', {
                error: logError.message
            });
        }
        return {
            success: true,
            message: 'Support request sent successfully'
        };
    }
    catch (error) {
        Logger.error('❌ Failed to send contact support email', {
            error: error.message,
            category,
            subject,
            userEmail
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to send support request. Please try again.');
    }
});
// Account deletion Cloud Function
exports.deleteUserAccount = (0, https_1.onCall)({
    region: 'us-central1',
    invoker: 'private' // Only allow authenticated users
}, async (request) => {
    var _a, _b;
    Logger.info('🗑️ Account deletion request received', {
        hasAuth: !!request.auth,
        authUid: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
        authToken: !!((_b = request.auth) === null || _b === void 0 ? void 0 : _b.token)
    });
    if (!request.auth) {
        Logger.error('❌ Authentication missing in deleteUserAccount request', {});
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated to delete account");
    }
    const userId = request.auth.uid;
    const { password } = request.data;
    if (!password) {
        throw new https_1.HttpsError("invalid-argument", "Password is required for account deletion");
    }
    try {
        Logger.info('🗑️ Starting immediate permanent account deletion', { userId });
        // Get the user record
        const userRecord = await admin.auth().getUser(userId);
        if (!userRecord.email) {
            throw new https_1.HttpsError('internal', 'User email not found');
        }
        // Immediately and permanently delete all user data
        await permanentlyDeleteUserData(userId);
        // Update device tracking records
        await updateDeviceTrackingForDeletedAccount(userId);
        // Finally, delete the Firebase Auth user
        await admin.auth().deleteUser(userId);
        Logger.info('✅ Successfully permanently deleted user account', {
            userId,
            email: userRecord.email
        });
        return {
            success: true,
            message: 'Account permanently deleted successfully. All data has been removed.',
            deletedDocuments: 'all'
        };
    }
    catch (error) {
        Logger.error('❌ Error deleting user account', {
            error: error.message,
            userId
        });
        // Handle specific Firebase Auth errors
        if (error instanceof Error) {
            if (error.message.includes('auth/user-not-found')) {
                throw new https_1.HttpsError('not-found', 'User account not found');
            }
            else if (error.message.includes('auth/requires-recent-login')) {
                throw new https_1.HttpsError('failed-precondition', 'Please sign out and sign back in, then try deleting your account again');
            }
        }
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', 'Failed to delete account. Please try again.');
    }
});
// Clean up sandbox Plaid connections when switching to production
exports.cleanupSandboxPlaidConnections = (0, https_1.onCall)({
    cors: true
}, async (request) => {
    var _a;
    try {
        // Verify the user is authenticated (optional - you might want to require admin access)
        if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to clean up connections');
        }
        const userId = request.data.userId || request.auth.uid;
        Logger.info(`🧹 Starting cleanup of sandbox Plaid connections for user: ${userId}`);
        // Query all bank connections for the user
        const bankConnectionsQuery = db.collection('bank_connections').where('userId', '==', userId);
        const bankConnectionsSnapshot = await bankConnectionsQuery.get();
        let connectionsRemoved = 0;
        // Delete each bank connection document
        const batch = db.batch();
        bankConnectionsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            connectionsRemoved++;
            Logger.info(`📄 Queued for deletion: bank_connection ${doc.id}`);
        });
        // Also clean up plaid_items collection if it exists
        const plaidItemsQuery = db.collection('plaid_items').where('userId', '==', userId);
        const plaidItemsSnapshot = await plaidItemsQuery.get();
        plaidItemsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            Logger.info(`📄 Queued for deletion: plaid_item ${doc.id}`);
        });
        // Execute the batch delete
        await batch.commit();
        Logger.info(`✅ Successfully cleaned up ${connectionsRemoved} sandbox Plaid connections for user ${userId}`);
        return {
            success: true,
            message: `Successfully removed ${connectionsRemoved} sandbox bank connections. You can now connect your real bank accounts.`,
            connectionsRemoved
        };
    }
    catch (error) {
        Logger.error('❌ Error cleaning up sandbox Plaid connections:', { error: error });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to cleanup connections: ${error.message}`);
    }
});
// Manual cleanup function for orphaned user data (when account deletion didn't work properly)
exports.cleanupOrphanedUserData = (0, https_1.onCall)({
    cors: true
}, async (request) => {
    var _a, _b;
    try {
        if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        const { userId, confirmDelete = false } = request.data;
        if (!userId) {
            throw new https_1.HttpsError('invalid-argument', 'userId is required');
        }
        Logger.info(`🧹 Starting orphaned data cleanup for user: ${userId}`, { confirmDelete });
        // Check if user still exists in Firebase Auth (they shouldn't if account was deleted)
        let userExists = false;
        try {
            await admin.auth().getUser(userId);
            userExists = true;
        }
        catch (error) {
            // User doesn't exist in Auth, which is expected for deleted accounts
            userExists = false;
        }
        if (userExists && !confirmDelete) {
            throw new https_1.HttpsError('failed-precondition', 'User still exists in Firebase Auth. Use confirmDelete=true if you really want to delete their data.');
        }
        // Comprehensive list of all possible collections that might contain user data
        const allCollections = [
            'users', 'subscriptions', 'receipts', 'businesses', 'customCategories',
            'bankConnections', 'bank_connections', 'teamMembers', 'notifications',
            'userSettings', 'userPreferences', 'usage', 'reports', 'budgets',
            'user_notifications', 'connection_notifications', 'teamInvitations',
            'transactionCandidates', 'generatedReceipts', 'candidateStatus',
            'plaid_items', 'businessStats', 'notificationSettings', 'events',
            'supportRequests', 'teamStats', 'oneTimePurchases', 'deviceChecks',
            'device_tracking', 'transaction_updates'
        ];
        let totalDocumentsFound = 0;
        let totalDocumentsDeleted = 0;
        const collectionsWithData = [];
        if (confirmDelete) {
            Logger.info(`🗑️ CONFIRMED DELETION: Permanently deleting all data for user ${userId}`);
        }
        else {
            Logger.info(`🔍 DRY RUN: Scanning for orphaned data for user ${userId}`);
        }
        // Process in batches to avoid hitting Firestore limits
        const batchSize = 450; // Leave room for other operations in the batch
        let currentBatch = db.batch();
        let currentBatchSize = 0;
        for (const collectionName of allCollections) {
            try {
                Logger.info(`Checking collection: ${collectionName}`);
                // Primary query: documents where userId field equals the target user
                const userDocsQuery = db.collection(collectionName)
                    .where('userId', '==', userId)
                    .limit(500);
                const userDocsSnapshot = await userDocsQuery.get();
                if (!userDocsSnapshot.empty) {
                    collectionsWithData.push(`${collectionName} (userId)`);
                    totalDocumentsFound += userDocsSnapshot.size;
                    Logger.info(`Found ${userDocsSnapshot.size} documents in ${collectionName} with userId=${userId}`);
                    if (confirmDelete) {
                        userDocsSnapshot.forEach((doc) => {
                            if (currentBatchSize >= batchSize) {
                                // Execute current batch and start a new one
                                currentBatch.commit();
                                currentBatch = db.batch();
                                currentBatchSize = 0;
                            }
                            currentBatch.delete(doc.ref);
                            currentBatchSize++;
                            totalDocumentsDeleted++;
                        });
                    }
                }
                // Secondary query: documents where accountHolderId field equals the target user
                if (['receipts', 'businesses', 'customCategories', 'teamMembers', 'teamInvitations'].includes(collectionName)) {
                    const accountHolderDocsQuery = db.collection(collectionName)
                        .where('accountHolderId', '==', userId)
                        .limit(500);
                    const accountHolderDocsSnapshot = await accountHolderDocsQuery.get();
                    if (!accountHolderDocsSnapshot.empty) {
                        collectionsWithData.push(`${collectionName} (accountHolderId)`);
                        totalDocumentsFound += accountHolderDocsSnapshot.size;
                        Logger.info(`Found ${accountHolderDocsSnapshot.size} documents in ${collectionName} with accountHolderId=${userId}`);
                        if (confirmDelete) {
                            accountHolderDocsSnapshot.forEach((doc) => {
                                if (currentBatchSize >= batchSize) {
                                    currentBatch.commit();
                                    currentBatch = db.batch();
                                    currentBatchSize = 0;
                                }
                                currentBatch.delete(doc.ref);
                                currentBatchSize++;
                                totalDocumentsDeleted++;
                            });
                        }
                    }
                }
                // Special handling for usage documents (document ID pattern)
                if (collectionName === 'usage') {
                    const usageQuery = db.collection(collectionName)
                        .where(admin.firestore.FieldPath.documentId(), '>=', userId)
                        .where(admin.firestore.FieldPath.documentId(), '<', userId + '\uf8ff')
                        .limit(500);
                    const usageSnapshot = await usageQuery.get();
                    if (!usageSnapshot.empty) {
                        collectionsWithData.push(`${collectionName} (docId pattern)`);
                        totalDocumentsFound += usageSnapshot.size;
                        Logger.info(`Found ${usageSnapshot.size} usage documents with ID pattern matching ${userId}`);
                        if (confirmDelete) {
                            usageSnapshot.forEach((doc) => {
                                if (currentBatchSize >= batchSize) {
                                    currentBatch.commit();
                                    currentBatch = db.batch();
                                    currentBatchSize = 0;
                                }
                                currentBatch.delete(doc.ref);
                                currentBatchSize++;
                                totalDocumentsDeleted++;
                            });
                        }
                    }
                }
                // Special handling for teamStats (document ID equals userId)
                if (collectionName === 'teamStats') {
                    const teamStatsDoc = await db.collection(collectionName).doc(userId).get();
                    if (teamStatsDoc.exists) {
                        collectionsWithData.push(`${collectionName} (direct doc)`);
                        totalDocumentsFound += 1;
                        Logger.info(`Found teamStats document with ID ${userId}`);
                        if (confirmDelete) {
                            if (currentBatchSize >= batchSize) {
                                await currentBatch.commit();
                                currentBatch = db.batch();
                                currentBatchSize = 0;
                            }
                            currentBatch.delete(teamStatsDoc.ref);
                            currentBatchSize++;
                            totalDocumentsDeleted++;
                        }
                    }
                }
            }
            catch (error) {
                Logger.warn(`Error checking collection ${collectionName}:`, {
                    error: error.message,
                    userId
                });
            }
        }
        // Commit any remaining batch operations
        if (confirmDelete && currentBatchSize > 0) {
            await currentBatch.commit();
        }
        const resultMessage = confirmDelete
            ? `Successfully deleted ${totalDocumentsDeleted} orphaned documents for user ${userId}`
            : `Found ${totalDocumentsFound} orphaned documents for user ${userId}. Use confirmDelete=true to delete them.`;
        Logger.info(resultMessage, {
            userId,
            documentsFound: totalDocumentsFound,
            documentsDeleted: totalDocumentsDeleted,
            collectionsWithData
        });
        return {
            success: true,
            message: resultMessage,
            documentsFound: totalDocumentsFound,
            documentsDeleted: totalDocumentsDeleted,
            collectionsSearched: allCollections
        };
    }
    catch (error) {
        Logger.error('❌ Error cleaning up orphaned user data:', {
            error: error.message,
            userId: (_b = request.data) === null || _b === void 0 ? void 0 : _b.userId
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to cleanup orphaned data: ${error.message}`);
    }
});
// Clean up duplicate businesses from multiple transfers
exports.cleanupDuplicateBusinesses = (0, https_1.onCall)({
    cors: true,
    region: 'us-central1'
}, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        // Enhanced authentication debugging
        Logger.info('cleanupDuplicateBusinesses called', {
            hasAuth: !!request.auth,
            authUid: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
            authToken: ((_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) ? 'token present' : 'no token',
            rawAuth: request.auth,
            requestData: request.data
        });
        if (!((_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid)) {
            Logger.error('Authentication failed in cleanupDuplicateBusinesses', {
                request: {
                    auth: request.auth,
                    data: request.data,
                    rawAuth: JSON.stringify(request.auth)
                }
            });
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated to clean up businesses');
        }
        const userId = ((_d = request.data) === null || _d === void 0 ? void 0 : _d.userId) || request.auth.uid;
        const confirmDelete = ((_e = request.data) === null || _e === void 0 ? void 0 : _e.confirmDelete) === true;
        Logger.info('Starting duplicate business cleanup', { userId, confirmDelete });
        // Get all businesses for the user
        const businessesSnapshot = await db.collection('businesses')
            .where('userId', '==', userId)
            .get();
        if (businessesSnapshot.empty) {
            return {
                success: true,
                message: 'No businesses found for this user',
                duplicatesFound: 0,
                duplicatesDeleted: 0,
                duplicateGroups: 0
            };
        }
        // Group businesses by name and other identifying characteristics
        const businessGroups = new Map();
        businessesSnapshot.forEach(doc => {
            const businessData = doc.data();
            const business = { id: doc.id, ...businessData };
            const key = `${businessData.name || 'unnamed'}_${businessData.address || 'no-address'}_${businessData.ein || 'no-ein'}`;
            if (!businessGroups.has(key)) {
                businessGroups.set(key, []);
            }
            businessGroups.get(key).push(business);
        });
        // Find duplicates (groups with more than 1 business)
        const duplicateGroups = Array.from(businessGroups.entries())
            .filter(([, businesses]) => businesses.length > 1);
        let totalDuplicatesFound = 0;
        let totalDuplicatesDeleted = 0;
        if (duplicateGroups.length === 0) {
            return {
                success: true,
                message: 'No duplicate businesses found',
                duplicatesFound: 0,
                duplicatesDeleted: 0,
                duplicateGroups: 0
            };
        }
        Logger.info(`Found ${duplicateGroups.length} groups with duplicates`);
        const batch = db.batch();
        let batchSize = 0;
        for (const [groupKey, businesses] of duplicateGroups) {
            // Keep the most recent business (by createdAt or updatedAt)
            businesses.sort((a, b) => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const aTime = ((_b = (_a = a.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || ((_d = (_c = a.createdAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || new Date(0);
                const bTime = ((_f = (_e = b.updatedAt) === null || _e === void 0 ? void 0 : _e.toDate) === null || _f === void 0 ? void 0 : _f.call(_e)) || ((_h = (_g = b.createdAt) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) || new Date(0);
                return bTime.getTime() - aTime.getTime();
            });
            const [keepBusiness, ...duplicatesToDelete] = businesses;
            totalDuplicatesFound += duplicatesToDelete.length;
            Logger.info(`Group ${groupKey}: keeping ${keepBusiness.id}, deleting ${duplicatesToDelete.length} duplicates`);
            if (confirmDelete) {
                for (const duplicate of duplicatesToDelete) {
                    if (batchSize >= 500) {
                        await batch.commit();
                        batchSize = 0;
                    }
                    batch.delete(db.collection('businesses').doc(duplicate.id));
                    batchSize++;
                    totalDuplicatesDeleted++;
                }
            }
        }
        if (confirmDelete && batchSize > 0) {
            await batch.commit();
        }
        const resultMessage = confirmDelete
            ? `Successfully deleted ${totalDuplicatesDeleted} duplicate businesses for user ${userId}`
            : `Found ${totalDuplicatesFound} duplicate businesses for user ${userId}. Use confirmDelete=true to delete them.`;
        Logger.info(resultMessage, {
            userId,
            duplicatesFound: totalDuplicatesFound,
            duplicatesDeleted: totalDuplicatesDeleted,
            duplicateGroups: duplicateGroups.length
        });
        return {
            success: true,
            message: resultMessage,
            duplicatesFound: totalDuplicatesFound,
            duplicatesDeleted: totalDuplicatesDeleted,
            duplicateGroups: duplicateGroups.length
        };
    }
    catch (error) {
        Logger.error('❌ Error cleaning up duplicate businesses:', {
            error: error.message,
            userId: (_f = request.data) === null || _f === void 0 ? void 0 : _f.userId
        });
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to cleanup duplicate businesses: ${error.message}`);
    }
});
//# sourceMappingURL=index.js.map