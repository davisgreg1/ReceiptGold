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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.revenueCatWebhookHandler = exports.onTeamMemberRemoved = exports.cleanupExpiredInvitations = exports.sendTeamInvitationEmail = exports.initializeTestUser = exports.syncBankConnectionToPlaidItems = exports.directTestPlaidWebhook = exports.testPlaidWebhook = exports.debugWebhook = exports.healthCheck = exports.testStripeConnection = exports.updateSubscriptionAfterPayment = exports.onUserDelete = exports.generateReport = exports.updateBusinessStats = exports.createCheckoutSession = exports.createStripeCustomer = exports.createSubscription = exports.resetMonthlyUsage = exports.monitorBankConnections = exports.createPlaidLinkToken = exports.createPlaidUpdateToken = exports.onConnectionNotificationCreate = exports.testWebhookConfig = exports.initializeNotificationSettings = exports.plaidWebhook = exports.stripeWebhook = exports.onReceiptCreate = exports.onUserCreate = exports.TIER_LIMITS = void 0;
const functions = __importStar(require("firebase-functions"));
const functionsV1 = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const https_1 = require("firebase-functions/v2/https");
const sgMail = require('@sendgrid/mail');
// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();
// Receipt limits configuration from environment variables
const getReceiptLimits = () => {
    return {
        free: parseInt(process.env.FREE_TIER_MAX_RECEIPTS || "10", 10),
        starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
        growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
        professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
        teammate: parseInt(process.env.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
    };
};
// Stripe configuration from environment variables
const getStripeConfig = () => {
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
// Plaid configuration from environment variables  
const getPlaidConfig = () => {
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
// Lazy Stripe initialization - only initialize when needed
let stripeInstance = null;
const getStripe = () => {
    if (!stripeInstance) {
        const { secretKey } = getStripeConfig();
        stripeInstance = new stripe_1.default(secretKey, {
            apiVersion: '2023-10-16',
        });
    }
    return stripeInstance;
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
    free: {
        name: "Free",
        limits: {
            maxReceipts: getReceiptLimits().free,
            maxBusinesses: 1,
            apiCallsPerMonth: 0,
            maxReports: 3,
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
// Helper function to determine tier from Stripe price ID
function getTierFromPriceId(priceId) {
    // Map your Stripe price IDs to tiers
    const priceToTierMap = {
        // TODO: Update these with your actual Stripe Price IDs from the dashboard
        'price_1RpYbuAZ9H3S1Eo7Qd3qk3IV': "starter",
        'price_1RpYbeAZ9H3S1Eo75oTj2nHe': "growth",
        'price_1RpYbJAZ9H3S1Eo78dUvxerL': "professional",
        // Example format - replace with your actual price IDs:
        // 'price_1234567890abcdef': "starter",
        // 'price_0987654321fedcba': "growth",
        // 'price_abcdef1234567890': "professional",
    };
    const tier = priceToTierMap[priceId];
    if (!tier) {
        console.warn(`Unknown price ID: ${priceId}, defaulting to free tier`);
        return "free";
    }
    return tier;
}
// 1. User Creation Trigger (updated for Firebase Functions v6)
exports.onUserCreate = functionsV1.auth.user().onCreate(async (user) => {
    try {
        const userId = user.uid;
        const email = user.email || '';
        const displayName = user.displayName || '';
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
        console.log(`Checking for team invitations for email: ${email} (lowercase: ${email.toLowerCase()})`);
        const teamInvitationsQuery = await db.collection("teamInvitations")
            .where("inviteEmail", "==", email.toLowerCase())
            .where("status", "in", ["pending", "accepted"])
            .limit(1)
            .get();
        const isTeamMember = !teamInvitationsQuery.empty;
        console.log(`Team invitation query result: found ${teamInvitationsQuery.size} pending/accepted invitations`);
        // Debug: Let's also check ALL invitations for this email (regardless of status)
        const allInvitationsQuery = await db.collection("teamInvitations")
            .where("inviteEmail", "==", email.toLowerCase())
            .limit(10)
            .get();
        console.log(`Debug: Found ${allInvitationsQuery.size} total invitations for email ${email.toLowerCase()}`);
        allInvitationsQuery.docs.forEach((doc, index) => {
            const invitation = doc.data();
            console.log(`Debug invitation ${index + 1}:`, {
                id: doc.id,
                inviteEmail: invitation.inviteEmail,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                isExpired: invitation.expiresAt ? new Date() > invitation.expiresAt.toDate() : 'no expiry',
                accountHolderId: invitation.accountHolderId,
                businessName: invitation.businessName,
                createdAt: invitation.createdAt
            });
        });
        if (!teamInvitationsQuery.empty) {
            const invitation = teamInvitationsQuery.docs[0].data();
            console.log(`Found matching team invitation:`, {
                inviteEmail: invitation.inviteEmail,
                status: invitation.status,
                accountHolderId: invitation.accountHolderId,
                businessName: invitation.businessName
            });
        }
        console.log(`isTeamMember determined as: ${isTeamMember}`);
        const now = admin.firestore.Timestamp.now();
        if (isTeamMember) {
            // Team members do NOT get their own subscription documents
            // They inherit subscription from their account holder via SubscriptionContext
            console.log(`Skipping subscription creation for team member ${email} - will inherit from account holder`);
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
            console.log(`✅ User account created successfully for team member: ${email}`);
            return; // Early return for team members - no subscription document needed
        }
        // Only create subscription documents for account holders (non-team members)
        // Create regular user subscription with 3-day trial
        console.log(`Creating trial subscription for new account holder ${email}`);
        const trialExpires = admin.firestore.Timestamp.fromDate(new Date(Date.now() + (3 * 24 * 60 * 60 * 1000)) // 3 days from now
        );
        const subscriptionDoc = {
            userId,
            currentTier: "free",
            status: "active",
            trial: {
                startedAt: now,
                expiresAt: trialExpires,
            },
            billing: {
                customerId: null,
                subscriptionId: null,
                priceId: null,
                currentPeriodStart: now,
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                trialEnd: null,
            },
            limits: subscriptionTiers.free.limits,
            features: subscriptionTiers.free.features,
            history: [
                {
                    tier: "free",
                    startDate: now,
                    endDate: null,
                    reason: "initial_signup",
                },
            ],
            createdAt: now,
            updatedAt: now,
        };
        await db.collection("subscriptions").doc(userId).set(subscriptionDoc);
        // Create usage tracking document
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usageDoc = {
            userId,
            month: currentMonth,
            receiptsUploaded: 0,
            apiCalls: 0,
            reportsGenerated: 0,
            limits: subscriptionTiers.free.limits,
            resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
        };
        await db.collection("usage").doc(`${userId}_${currentMonth}`).set(usageDoc);
        console.log(`User ${userId} initialized successfully`);
    }
    catch (error) {
        console.error("Error creating user documents:", error);
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
            console.log("🚀 ~ newReceiptCount:", newReceiptCount);
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
            console.log("⚠️ LIMIT CHECKING TEMPORARILY DISABLED - App handles limits client-side");
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
        console.error("Error processing receipt creation:", error);
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
        console.error("OCR processing error:", error);
        throw error;
    }
}
// UPDATED Stripe Webhook Handler with proper raw body handling
exports.stripeWebhook = (0, https_1.onRequest)({
    // Explicitly disable body parsing to get raw body
    cors: false,
    // Set memory and timeout if needed
    memory: "1GiB",
    timeoutSeconds: 540,
}, async (req, res) => {
    console.log("🚀 Stripe webhook received");
    console.log("Method:", req.method);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Has Stripe signature:", !!req.headers["stripe-signature"]);
    // Only allow POST requests
    if (req.method !== "POST") {
        console.error("❌ Invalid method:", req.method);
        res.status(405).send("Method not allowed");
        return;
    }
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        console.error("❌ No Stripe signature found in request headers");
        res.status(400).send("No Stripe signature found");
        return;
    }
    // Get webhook secret using environment-aware approach
    let webhookSecret;
    try {
        const config = getStripeConfig();
        webhookSecret = config.webhookSecret;
        console.log("✅ Webhook secret loaded successfully");
    }
    catch (error) {
        console.error("❌ Stripe configuration error:", error);
        res.status(500).send("Stripe configuration error");
        return;
    }
    let event;
    let payload = ""; // Initialize payload to avoid use-before-assignment
    try {
        // Firebase Functions v2 provides rawBody on the request object
        const requestWithRawBody = req;
        if (requestWithRawBody.rawBody) {
            // Use the raw body provided by Firebase
            payload = requestWithRawBody.rawBody;
            console.log("✅ Using rawBody from Firebase Functions");
        }
        else if (typeof req.body === "string") {
            // If body is already a string, use it directly
            payload = req.body;
            console.log("✅ Using string body");
        }
        else if (Buffer.isBuffer(req.body)) {
            // If body is a Buffer, use it directly
            payload = req.body;
            console.log("✅ Using Buffer body");
        }
        else {
            // Last resort: stringify the body (not ideal for signatures)
            payload = JSON.stringify(req.body);
            console.log("⚠️ Using stringified body (may cause signature issues)");
        }
        console.log("Payload type:", typeof payload);
        console.log("Payload length:", payload.length);
        // Construct the Stripe event
        event = getStripe().webhooks.constructEvent(payload, sig, webhookSecret);
        console.log(`✅ Webhook signature verified. Event type: ${event.type}, ID: ${event.id}`);
    }
    catch (err) {
        const error = err;
        // Ensure payload is defined for error logging
        const safePayload = typeof payload !== "undefined" ? payload : "";
        console.error("❌ Webhook signature verification failed:", error.message);
        console.error("Error details:", {
            message: error.message,
            payloadType: typeof safePayload,
            payloadPreview: safePayload === null || safePayload === void 0 ? void 0 : safePayload.toString().substring(0, 100),
            signature: sig.substring(0, 20) + "...",
        });
        res.status(400).send(`Webhook Error: ${error.message}`);
        return;
    }
    try {
        console.log(`🔄 Processing Stripe event: ${event.type}`);
        switch (event.type) {
            case "customer.subscription.created":
                await handleSubscriptionCreated(event.data.object);
                console.log(`✅ Handled ${event.type} for subscription: ${event.data.object.id}`);
                break;
            case "checkout.session.completed":
                const session = event.data.object;
                console.log(`Processing checkout completion: ${session.id}`);
                if (session.subscription) {
                    // Retrieve the full subscription object
                    const subscription = await getStripe().subscriptions.retrieve(session.subscription);
                    await handleSubscriptionCreated(subscription);
                    console.log(`✅ Handled checkout completion for subscription: ${subscription.id}`);
                }
                else {
                    console.log("ℹ️ Checkout session completed but no subscription found");
                }
                break;
            case "payment_intent.succeeded":
                const paymentIntent = event.data.object;
                console.log(`✅ Payment succeeded for PaymentIntent: ${paymentIntent.id}`);
                // Handle one-time payments here if needed
                break;
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object);
                console.log(`✅ Handled ${event.type} for subscription: ${event.data.object.id}`);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object);
                console.log(`✅ Handled ${event.type} for subscription: ${event.data.object.id}`);
                break;
            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(event.data.object);
                console.log(`✅ Handled ${event.type} for invoice: ${event.data.object.id}`);
                break;
            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object);
                console.log(`✅ Handled ${event.type} for invoice: ${event.data.object.id}`);
                break;
            case "customer.subscription.trial_will_end":
                // Handle trial ending warning
                const trialSub = event.data.object;
                console.log(`ℹ️ Trial ending soon for subscription: ${trialSub.id}`);
                // You can add email notifications here
                break;
            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }
        // Always respond with 200 to acknowledge receipt
        res.status(200).json({
            received: true,
            eventType: event.type,
            eventId: event.id,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error("❌ Error processing webhook:", error);
        // Log the full error for debugging
        if (error instanceof Error) {
            console.error("Error name:", error.name);
            console.error("Error message:", error.message);
            console.error("Error stack:", error.stack);
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
});
// Enhanced subscription created handler with better error handling
async function handleSubscriptionCreated(subscription) {
    var _a;
    try {
        const customerId = subscription.customer;
        console.log(`Processing subscription created: ${subscription.id} for customer: ${customerId}`);
        // Retrieve customer with error handling
        let customer;
        try {
            const customerObject = await getStripe().customers.retrieve(customerId);
            if ('deleted' in customerObject && customerObject.deleted) {
                throw new Error(`Customer ${customerId} has been deleted`);
            }
            customer = customerObject;
        }
        catch (error) {
            console.error(`Failed to retrieve customer ${customerId}:`, error);
            throw new Error(`Customer retrieval failed: ${error}`);
        }
        const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            console.error("No userId found in customer metadata for customer:", customerId);
            console.error("Customer metadata:", customer.metadata);
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
        const tier = getTierFromPriceId(priceId);
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
        console.log('Saving subscription data for user:', userId);
        // Save to Firestore with transaction for consistency
        await db.runTransaction(async (transaction) => {
            const subscriptionRef = db.collection("subscriptions").doc(userId);
            const doc = await transaction.get(subscriptionRef);
            if (doc.exists) {
                // Update existing subscription
                transaction.update(subscriptionRef, subscriptionUpdate);
                console.log(`Updated existing subscription for user ${userId}`);
            }
            else {
                // Create new subscription document
                transaction.set(subscriptionRef, {
                    ...subscriptionUpdate,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`Created new subscription for user ${userId}`);
            }
            // Also update the user's usage limits for current month
            const currentMonth = new Date().toISOString().slice(0, 7);
            const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
            transaction.update(usageRef, {
                limits: subscriptionTiers[tier].limits,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        });
        console.log(`✅ Successfully processed subscription creation for user ${userId}`);
    }
    catch (error) {
        console.error('Error in handleSubscriptionCreated:', error);
        // Re-throw to trigger webhook retry if it's a transient error
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
    console.log("🚀 Plaid webhook received");
    console.log("Method:", req.method);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Origin IP:", req.ip);
    // Only allow POST requests
    if (req.method !== "POST") {
        console.error("❌ Invalid method:", req.method);
        res.status(405).send("Method not allowed");
        return;
    }
    // Basic request validation
    if (!((_a = req.headers["content-type"]) === null || _a === void 0 ? void 0 : _a.includes("application/json"))) {
        console.error("❌ Invalid content type:", req.headers["content-type"]);
        res.status(400).send("Invalid content type");
        return;
    }
    // Validate Plaid configuration
    try {
        const config = getPlaidConfig();
        console.log(`✅ Plaid config loaded for ${config.environment} environment`);
    }
    catch (error) {
        console.error("❌ Plaid configuration error:", error);
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
        console.log(`🔄 Processing Plaid webhook: ${webhookData.webhook_type}`);
        switch (webhookData.webhook_type) {
            case "TRANSACTIONS":
                await handlePlaidTransactions(webhookData);
                console.log(`✅ Handled ${webhookData.webhook_type}`);
                break;
            case "ITEM":
                await handlePlaidItem(webhookData);
                console.log(`✅ Handled ${webhookData.webhook_type}`);
                break;
            case "AUTH":
                await handlePlaidAuth(webhookData);
                console.log(`✅ Handled ${webhookData.webhook_type}`);
                break;
            case "ACCOUNTS":
                await handlePlaidAccounts(webhookData);
                console.log(`✅ Handled ${webhookData.webhook_type}`);
                break;
            case "LIABILITIES":
                await handlePlaidLiabilities(webhookData);
                console.log(`✅ Handled ${webhookData.webhook_type}`);
                break;
            default:
                console.log(`ℹ️ Unhandled Plaid webhook type: ${webhookData.webhook_type}`);
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
        console.error("❌ Error processing Plaid webhook:", error);
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
        console.log(`✅ Initialized notification settings for user ${userId}`);
        res.status(200).json({
            success: true,
            message: 'Notification settings initialized',
            userId
        });
    }
    catch (error) {
        console.error('Error initializing notification settings:', error);
        res.status(500).json({ error: 'Failed to initialize settings' });
    }
});
// Test endpoint to verify webhook configuration
exports.testWebhookConfig = (0, https_1.onRequest)(async (req, res) => {
    try {
        const stripeConfig = getStripeConfig();
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
            stripe: {
                webhookConfigured: true,
                hasSecretKey: !!stripeConfig.secretKey,
                hasWebhookSecret: !!stripeConfig.webhookSecret,
            },
            plaid: plaidConfigStatus,
            environment: process.env.NODE_ENV || 'unknown',
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        res.status(500).json({
            webhookConfigured: false,
            error: error.message,
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
    console.log(`📬 New connection notification for user ${userId}: ${title}`);
    try {
        // Get user's push token from Firestore
        const userDoc = await db.collection("users").doc(userId).get();
        const userData = userDoc.data();
        // We no longer need tokens for the local notification approach
        console.log(`📱 Processing notification for user ${userId}`);
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
        console.log(`📱 Creating local notification trigger for user ${userId}`);
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
        console.log(`✅ Local notification trigger created for user ${userId}`);
        // Update the original notification document to mark as processed
        await db.collection("connection_notifications").doc(context.params.notificationId).update({
            pushSent: true,
            pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
            pushMethod: 'local_trigger'
        });
    }
    catch (error) {
        console.error('Error sending push notification:', error);
    }
});
// PLAID WEBHOOK HANDLERS
async function handlePlaidTransactions(webhookData) {
    console.log("🔄 Processing Plaid transactions webhook");
    const { item_id, new_transactions, removed_transactions } = webhookData;
    try {
        // Find user by item_id (note: field name is itemId in our database)
        const plaidItemQuery = db.collection("plaid_items").where("itemId", "==", item_id);
        const plaidItemSnapshot = await plaidItemQuery.get();
        if (plaidItemSnapshot.empty) {
            console.log(`❌ No plaid_items entry found for item_id: ${item_id}`);
            console.log(`ℹ️  This item may not have been synced to Firestore yet. Use syncBankConnectionToPlaidItems to sync existing connections.`);
            return;
        }
        const plaidItemDoc = plaidItemSnapshot.docs[0];
        const userId = plaidItemDoc.data().userId;
        console.log(`Processing transactions for user: ${userId}`);
        await processTransactionsForUser(userId, item_id, new_transactions, removed_transactions);
    }
    catch (error) {
        console.error("Error processing Plaid transactions webhook:", error);
        throw error;
    }
}
// Helper function to process transactions for a user
async function processTransactionsForUser(userId, itemId, new_transactions, removed_transactions) {
    try {
        // Process new transactions
        if (new_transactions && new_transactions > 0) {
            console.log(`📈 ${new_transactions} new transactions available for user ${userId}`);
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
            console.log(`✅ Created transaction update and notification for user ${userId}`);
            // TODO: Trigger transaction sync process
            // This would fetch the actual transactions and analyze them for potential receipts
        }
        // Process removed transactions  
        if (removed_transactions && removed_transactions.length > 0) {
            console.log(`📉 ${removed_transactions.length} transactions removed for user ${userId}`);
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
            console.log(`✅ Processed ${removed_transactions.length} removed transactions for user ${userId}`);
        }
    }
    catch (error) {
        console.error(`❌ Error processing transactions for user ${userId}:`, error);
        throw error;
    }
}
async function handlePlaidItem(webhookData) {
    console.log("🔄 Processing Plaid item webhook");
    const { item_id, webhook_code, error } = webhookData;
    try {
        // Find the Plaid item in our database
        const plaidItemQuery = db.collection("plaid_items").where("itemId", "==", item_id);
        const plaidItemSnapshot = await plaidItemQuery.get();
        if (plaidItemSnapshot.empty) {
            console.log(`❌ No plaid_items entry found for item_id: ${item_id}`);
            console.log(`ℹ️  This item may not have been synced to Firestore yet. Use syncBankConnectionToPlaidItems to sync existing connections.`);
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
        console.log(`✅ Updated item ${item_id} with status: ${updateData.status}`);
        // Create connection notification
        if (notificationType) {
            await createConnectionNotification(userId, item_id, institutionName, notificationType, webhook_code);
            console.log(`✅ Created ${notificationType} notification for user ${userId}`);
        }
        // For self-healing, dismiss any existing reauth notifications
        if (webhook_code === "LOGIN_REPAIRED") {
            await dismissOldNotifications(userId, item_id, ["reauth_required", "pending_expiration"]);
        }
    }
    catch (error) {
        console.error("Error processing Plaid item webhook:", error);
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
        console.log(`✅ Created user notification for ${type} - ${institutionName}`);
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
        console.log(`✅ Dismissed ${batchOperations} old notifications`);
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
    console.log("🔄 Processing Plaid auth webhook");
    // Handle authentication-related webhooks
    // Implementation depends on your specific auth flow
}
async function handlePlaidAccounts(webhookData) {
    console.log("🔄 Processing Plaid accounts webhook");
    // Handle account-related webhooks (new accounts, account updates, etc.)
}
async function handlePlaidLiabilities(webhookData) {
    console.log("🔄 Processing Plaid liabilities webhook");
    try {
        const { item_id, webhook_code } = webhookData;
        if (!item_id) {
            console.error("❌ No item_id in liabilities webhook data");
            return;
        }
        console.log(`📊 Liabilities webhook - Code: ${webhook_code}, Item: ${item_id}`);
        // Find the user's Plaid item
        const itemsRef = db.collection('plaidItems');
        const itemQuery = await itemsRef.where('itemId', '==', item_id).get();
        if (itemQuery.empty) {
            console.error(`❌ No Plaid item found for item_id: ${item_id}`);
            return;
        }
        const itemDoc = itemQuery.docs[0];
        const itemData = itemDoc.data();
        const userId = itemData.userId;
        if (!userId) {
            console.error(`❌ No userId found for item: ${item_id}`);
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
                console.log(`💳 Default liability update for item: ${item_id}`);
                // This indicates that liability data has been updated and should be refetched
                // You might want to trigger a refresh of liability data here
                break;
            case 'LIABILITY_UPDATE':
                console.log(`💳 Liability data updated for item: ${item_id}`);
                // Handle specific liability updates
                break;
            default:
                console.log(`ℹ️ Unhandled liabilities webhook code: ${webhook_code}`);
        }
        console.log(`✅ Successfully processed liabilities webhook for item: ${item_id}`);
    }
    catch (error) {
        console.error("❌ Error processing Plaid liabilities webhook:", error);
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
            console.error('Plaid Link token creation failed:', errorData);
            throw new https_1.HttpsError('internal', `Failed to create update link token: ${errorData.error_message || 'Unknown error'}`);
        }
        const linkTokenData = await linkTokenResponse.json();
        console.log(`✅ Created update mode link token for user ${userId}, item ${itemId}`);
        return {
            link_token: linkTokenData.link_token,
            expiration: linkTokenData.expiration,
        };
    }
    catch (error) {
        console.error('Error creating Plaid update link token:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to create update link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
// Create Plaid Link Token with proper redirect URI/Android package name handling
exports.createPlaidLinkToken = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    var _a, _b;
    console.log('🔍 createPlaidLinkToken called');
    console.log('Request auth:', request.auth ? 'present' : 'missing');
    console.log('Request data:', request.data);
    console.log('Request rawRequest auth header:', ((_b = (_a = request.rawRequest) === null || _a === void 0 ? void 0 : _a.headers) === null || _b === void 0 ? void 0 : _b.authorization) ? 'Has auth header' : 'No auth header');
    console.log('Manual auth token provided:', request.data.auth_token ? 'yes' : 'no');
    let userId;
    if (request.auth) {
        // Standard Firebase auth context is available
        console.log('✅ Using standard Firebase auth context');
        userId = request.auth.uid;
    }
    else if (request.data.auth_token) {
        // Manual token verification for React Native
        console.log('🔑 Manually verifying auth token');
        try {
            const decodedToken = await admin.auth().verifyIdToken(request.data.auth_token);
            userId = decodedToken.uid;
            console.log('✅ Manual token verification successful for user:', userId);
        }
        catch (error) {
            console.error('❌ Manual token verification failed:', error);
            throw new https_1.HttpsError('unauthenticated', 'Invalid authentication token');
        }
    }
    else {
        console.error('❌ No authentication method available');
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    console.log('✅ Authentication verified for user:', userId);
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
            console.log('🤖 Android: Using package name for OAuth redirect');
        }
        else {
            // Default to iOS or when platform is not specified
            requestBody.redirect_uri = 'receiptgold://oauth';
            console.log('🍎 iOS: Using redirect URI for OAuth');
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
            console.error('Plaid Link token creation failed:', errorData);
            throw new https_1.HttpsError('internal', `Failed to create link token: ${errorData.error_message || 'Unknown error'}`);
        }
        const linkTokenData = await linkTokenResponse.json();
        console.log(`✅ Created link token for user ${userId}`);
        return {
            link_token: linkTokenData.link_token,
            expiration: linkTokenData.expiration,
        };
    }
    catch (error) {
        console.error('Error creating Plaid link token:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', `Failed to create link token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});
async function handleSubscriptionUpdated(subscription) {
    var _a;
    const customerId = subscription.customer;
    const customer = await getStripe().customers.retrieve(customerId);
    const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.error("No userId found in customer metadata for customer:", customerId);
        return;
    }
    console.log(`Processing subscription updated for user: ${userId}`);
    const tier = getTierFromPriceId(subscription.items.data[0].price.id);
    await db
        .collection("subscriptions")
        .doc(userId)
        .update({
        currentTier: tier,
        status: subscription.status,
        billing: {
            customerId: customerId,
            subscriptionId: subscription.id,
            priceId: subscription.items.data[0].price.id,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            trialEnd: subscription.trial_end
                ? new Date(subscription.trial_end * 1000)
                : null,
        },
        limits: subscriptionTiers[tier].limits,
        features: subscriptionTiers[tier].features,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function handleSubscriptionDeleted(subscription) {
    var _a;
    const customerId = subscription.customer;
    const customer = await getStripe().customers.retrieve(customerId);
    const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.error("No userId found in customer metadata for customer:", customerId);
        return;
    }
    console.log(`Processing subscription deleted for user: ${userId}`);
    // Downgrade to free tier
    await db.collection("subscriptions").doc(userId).update({
        currentTier: "free",
        status: "canceled",
        limits: subscriptionTiers.free.limits,
        features: subscriptionTiers.free.features,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
async function handlePaymentSucceeded(invoice) {
    var _a, _b;
    console.log("Payment succeeded for invoice:", invoice.id);
    console.log("Full invoice data:", JSON.stringify(invoice, null, 2));
    try {
        const customerId = invoice.customer;
        console.log("Customer ID from invoice:", customerId);
        const customer = await getStripe().customers.retrieve(customerId);
        console.log("Customer data:", JSON.stringify(customer, null, 2));
        const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            console.error("No userId found in customer metadata for customer:", customerId);
            return;
        }
        console.log(`Processing successful payment for user: ${userId}`);
        // Try to get subscription ID from different possible sources
        let subscriptionId = invoice.subscription;
        if (!subscriptionId && ((_b = invoice.lines) === null || _b === void 0 ? void 0 : _b.data)) {
            // Look for subscription in invoice line items
            const subscriptionItem = invoice.lines.data.find(line => line.type === 'subscription');
            if (subscriptionItem) {
                subscriptionId = subscriptionItem.subscription;
                console.log("Found subscription ID in line items:", subscriptionId);
            }
        }
        // If still no subscription, try to find it by customer
        if (!subscriptionId) {
            const subscriptions = await getStripe().subscriptions.list({
                customer: customerId,
                limit: 1,
                status: 'active'
            });
            if (subscriptions.data.length > 0) {
                subscriptionId = subscriptions.data[0].id;
                console.log("Found subscription ID from customer's subscriptions:", subscriptionId);
            }
        }
        console.log("Subscription ID from invoice:", subscriptionId);
        if (subscriptionId) {
            // Get subscription status in Firestore
            const subscriptionRef = db.collection("subscriptions").doc(userId);
            const subscriptionDoc = await subscriptionRef.get();
            const updateData = {
                status: "active",
                "billing.lastPaymentStatus": "succeeded",
                "billing.lastPaymentDate": admin.firestore.Timestamp.fromDate(new Date(invoice.status_transitions.paid_at || Date.now())),
                "billing.lastInvoiceId": invoice.id,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (!subscriptionDoc.exists) {
                console.log(`Creating new subscription document for user ${userId}`);
                // Get the subscription from Stripe to determine the tier
                const stripeSubscription = await getStripe().subscriptions.retrieve(subscriptionId);
                const priceId = stripeSubscription.items.data[0].price.id;
                const tier = getTierFromPriceId(priceId);
                // Create a new subscription document
                await subscriptionRef.set({
                    userId,
                    currentTier: tier,
                    status: "active",
                    billing: {
                        customerId: customerId,
                        subscriptionId: subscriptionId,
                        priceId: priceId,
                        currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(stripeSubscription.current_period_start * 1000)),
                        currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(stripeSubscription.current_period_end * 1000)),
                        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
                        lastPaymentStatus: "succeeded",
                        lastPaymentDate: admin.firestore.Timestamp.fromDate(new Date(invoice.status_transitions.paid_at || Date.now())),
                        lastInvoiceId: invoice.id,
                    },
                    limits: subscriptionTiers[tier].limits,
                    features: subscriptionTiers[tier].features,
                    history: [{
                            tier: tier,
                            startDate: new Date(),
                            endDate: null,
                            reason: "subscription_created"
                        }],
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
            else {
                // Update existing subscription
                await subscriptionRef.update(updateData);
            }
            // Add to billing history collection if you're tracking detailed payment history
            await db.collection("billing_history").add({
                userId,
                invoiceId: invoice.id,
                subscriptionId: subscriptionId,
                amount: invoice.amount_paid,
                currency: invoice.currency,
                status: "succeeded",
                paymentDate: admin.firestore.Timestamp.fromDate(new Date(invoice.status_transitions.paid_at || Date.now())),
                periodStart: admin.firestore.Timestamp.fromDate(new Date(invoice.period_start * 1000)),
                periodEnd: admin.firestore.Timestamp.fromDate(new Date(invoice.period_end * 1000)),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`✅ Successfully updated billing records for user ${userId}`);
        }
        else {
            console.log("Invoice is not associated with a subscription");
        }
    }
    catch (error) {
        console.error("Error processing successful payment:", error);
        throw error; // Rethrow to trigger webhook retry if needed
    }
}
async function handlePaymentFailed(invoice) {
    var _a;
    console.log("Payment failed for invoice:", invoice.id);
    const customerId = invoice.customer;
    const customer = await getStripe().customers.retrieve(customerId);
    const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.error("No userId found in customer metadata for customer:", customerId);
        return;
    }
    // Update subscription status
    await db.collection("subscriptions").doc(userId).update({
        status: "past_due",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
}
// 5. Proactive Bank Connection Health Monitoring
exports.monitorBankConnections = functionsV1.pubsub
    .schedule("0 */6 * * *") // Run every 6 hours
    .onRun(async (context) => {
    console.log("🔍 Starting proactive bank connection health check...");
    try {
        // Get all active Plaid items that haven't been checked recently
        const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const plaidItemsSnapshot = await db.collection("plaid_items")
            .where("active", "==", true)
            .where("status", "in", ["connected", "stale"])
            .get();
        console.log(`📊 Found ${plaidItemsSnapshot.docs.length} active bank connections to check`);
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
                console.log(`🔍 Checking health for ${institutionName} (${itemId})`);
                // Update last health check timestamp
                await itemDoc.ref.update({
                    lastHealthCheck: admin.firestore.FieldValue.serverTimestamp()
                });
                // If connection is stale or showing signs of issues, create notification
                const needsAttention = await checkConnectionNeedsRepair(itemData);
                if (needsAttention) {
                    console.log(`⚠️ Connection needs repair: ${institutionName}`);
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
        console.log("✅ Bank connection health check completed");
    }
    catch (error) {
        console.error("❌ Error in bank connection monitoring:", error);
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
        console.error("Error resetting monthly usage:", error);
    }
});
exports.createSubscription = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
    console.log('createSubscription called with auth:', request.auth);
    console.log('createSubscription request data:', request.data);
    if (!request.auth) {
        console.error('Authentication missing in createSubscription');
        throw new https_1.HttpsError('unauthenticated', 'You must be logged in to create a subscription');
    }
    if (!request.auth.uid) {
        console.error('User ID missing in auth object:', request.auth);
        throw new https_1.HttpsError('unauthenticated', 'Invalid authentication state');
    }
    try {
        const { priceId, customerId } = request.data;
        if (!priceId || !customerId) {
            console.error('Missing required subscription data:', { priceId, customerId });
            throw new https_1.HttpsError('invalid-argument', 'Price ID and customer ID are required');
        }
        console.log(`Creating subscription for user ${request.auth.uid}:`, { priceId, customerId });
        // Validate Stripe configuration first
        const stripeConfig = getStripeConfig();
        if (!stripeConfig.secretKey) {
            console.error("Missing Stripe secret key");
            throw new https_1.HttpsError('failed-precondition', "Stripe configuration is incomplete");
        }
        // Initialize and validate Stripe instance
        const stripe = getStripe();
        if (!stripe) {
            console.error("Failed to initialize Stripe");
            throw new https_1.HttpsError('internal', "Stripe initialization failed");
        }
        // Verify the customer exists and belongs to this user
        const customer = await stripe.customers.retrieve(customerId);
        if (!customer || customer.deleted) {
            console.error('Customer not found:', customerId);
            throw new https_1.HttpsError('not-found', 'Invalid customer ID');
        }
        if (((_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId) !== request.auth.uid) {
            console.error('Customer does not belong to user:', {
                customerId,
                customerUserId: (_b = customer.metadata) === null || _b === void 0 ? void 0 : _b.userId,
                requestUserId: request.auth.uid
            });
            throw new https_1.HttpsError('permission-denied', 'Customer does not belong to this user');
        }
        console.log('Customer verified, creating subscription...');
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
        console.log('Subscription created:', subscription.id);
        // @ts-ignore - Stripe types don't properly capture the expanded fields
        const clientSecret = (_d = (_c = subscription.latest_invoice) === null || _c === void 0 ? void 0 : _c.payment_intent) === null || _d === void 0 ? void 0 : _d.client_secret;
        if (!clientSecret) {
            console.error('No client secret in subscription response:', subscription);
            throw new https_1.HttpsError('internal', 'Failed to create subscription: No client secret returned');
        }
        console.log('Subscription created successfully with client secret');
        return {
            subscriptionId: subscription.id,
            clientSecret: clientSecret,
        };
    }
    catch (error) {
        console.error('Error creating subscription:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        if (error instanceof Error && error.message.includes('auth')) {
            throw new https_1.HttpsError('unauthenticated', error.message);
        }
        throw new https_1.HttpsError('internal', error instanceof Error ? error.message : 'Failed to create subscription');
    }
});
exports.createStripeCustomer = (0, https_1.onCall)(async (request) => {
    console.log('createStripeCustomer called with auth:', request.auth);
    if (!request.auth) {
        console.error('Authentication missing in createStripeCustomer');
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to create a customer");
    }
    if (!request.auth.uid) {
        console.error('User ID missing in auth object:', request.auth);
        throw new https_1.HttpsError("unauthenticated", "Invalid authentication state");
    }
    try {
        const userId = request.auth.uid;
        const { email, name } = request.data;
        if (!email || !name) {
            console.error('Missing required customer data:', { email, name });
            throw new https_1.HttpsError("invalid-argument", "Email and name are required");
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
        const customer = await getStripe().customers.create({
            email: email,
            name: name,
            metadata: {
                userId: userId,
            },
        });
        console.log(`✅ Created Stripe customer ${customer.id} for user ${userId}`);
        return { customerId: customer.id };
    }
    catch (error) {
        console.error("Error creating Stripe customer:", error);
        throw new https_1.HttpsError("internal", error instanceof Error ? error.message : "Failed to create customer");
    }
});
exports.createCheckoutSession = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    try {
        const { priceId, customerId } = request.data;
        // Environment-aware app URL configuration
        const getAppUrl = () => {
            // Check if we're in development
            if (process.env.NODE_ENV === 'development') {
                return 'http://localhost:8081';
            }
            // Use configured app URL or fallback
            return process.env.APP_URL || 'https://yourapp.com';
        };
        const appUrl = getAppUrl();
        console.log(`Creating checkout session for user: ${request.auth.uid}, price: ${priceId}`);
        const session = await getStripe().checkout.sessions.create({
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
        console.log(`✅ Created checkout session ${session.id} for user ${request.auth.uid}`);
        console.log(`📍 Checkout URL: ${session.url}`);
        return {
            sessionId: session.id,
            url: session.url
        };
    }
    catch (error) {
        console.error("Error creating checkout session:", error);
        throw new https_1.HttpsError("internal", "Failed to create checkout session");
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
        console.error("Error updating business stats:", error);
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
        console.log(`✅ Generated report ${reportRef.id} for user ${userId}`);
        return { reportId: reportRef.id, data: reportData.data };
    }
    catch (error) {
        console.error("Error generating report:", error);
        throw new https_1.HttpsError("internal", "Failed to generate report");
    }
});
// 10. User Deletion Cleanup (updated for Firebase Functions v6)
exports.onUserDelete = functionsV1.auth.user().onDelete(async (user) => {
    try {
        const userId = user.uid;
        console.log(`Starting cleanup for deleted user: ${userId}`);
        // Delete user data in batches
        const batch = db.batch();
        // Delete user document
        batch.delete(db.collection("users").doc(userId));
        // Delete subscription
        batch.delete(db.collection("subscriptions").doc(userId));
        // Delete receipts
        const receiptsSnapshot = await db
            .collection("receipts")
            .where("userId", "==", userId)
            .get();
        receiptsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        // Delete businesses
        const businessesSnapshot = await db
            .collection("businesses")
            .where("userId", "==", userId)
            .get();
        businessesSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        // Delete reports
        const reportsSnapshot = await db
            .collection("reports")
            .where("userId", "==", userId)
            .get();
        reportsSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        // Delete usage data
        const usageSnapshot = await db
            .collection("usage")
            .where("userId", "==", userId)
            .get();
        usageSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`✅ User ${userId} data deleted successfully`);
    }
    catch (error) {
        console.error("Error deleting user data:", error);
    }
});
// OPTIMIZATION: Helper function to determine subscription tier from RevenueCat API
async function getRevenueCatSubscriptionTier(revenueCatUserId) {
    var _a;
    try {
        functions.logger.info('🔍 Calling RevenueCat API to determine tier', { revenueCatUserId });
        const revenueCatApiKey = process.env.REVENUECAT_API_KEY;
        if (!revenueCatApiKey) {
            functions.logger.warn('⚠️ RevenueCat API key not configured, falling back to client-provided tier');
            return 'free';
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
            return 'free';
        }
        const subscriberData = await response.json();
        functions.logger.info('📦 RevenueCat subscriber data received', { subscriberData });
        // Determine tier from active entitlements and products
        const entitlements = ((_a = subscriberData.subscriber) === null || _a === void 0 ? void 0 : _a.entitlements) || {};
        const activeEntitlements = Object.values(entitlements).filter((ent) => ent.expires_date === null || new Date(ent.expires_date) > new Date());
        if (activeEntitlements.length === 0) {
            return 'free';
        }
        // Check product IDs to determine tier (same logic as client-side)
        const productIds = activeEntitlements.map((ent) => ent.product_identifier);
        if (productIds.some(id => id === 'rc_professional_monthly' || id === 'rc_professional_annual')) {
            return 'professional';
        }
        else if (productIds.some(id => id === 'rc_growth_monthly' || id === 'rc_growth_annual')) {
            return 'growth';
        }
        else if (productIds.some(id => id === 'rc_starter')) {
            return 'starter';
        }
        return 'free';
    }
    catch (error) {
        functions.logger.error('❌ Error calling RevenueCat API', error);
        return 'free';
    }
}
exports.updateSubscriptionAfterPayment = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    try {
        functions.logger.info('🚀 Starting updateSubscriptionAfterPayment', {
            data: request.data,
            auth: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid
        });
        // Validate authentication
        if (!request.auth) {
            throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
        }
        // Validate that the authenticated user matches the userId in the request
        if (request.auth.uid !== request.data.userId) {
            throw new https_1.HttpsError('permission-denied', 'User can only update their own subscription');
        }
        const { subscriptionId, tierId, userId, revenueCatUserId } = request.data;
        // Validate required fields
        if (!subscriptionId || !userId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required fields: subscriptionId, userId');
        }
        // OPTIMIZATION: Determine tier from RevenueCat API if not provided by client
        let finalTierId;
        if (tierId) {
            // Client provided tier - validate it
            const validTiers = ['free', 'starter', 'growth', 'professional'];
            if (!validTiers.includes(tierId)) {
                throw new https_1.HttpsError('invalid-argument', `Invalid tier: ${tierId}`);
            }
            finalTierId = tierId;
            functions.logger.info('✅ Using client-provided tier', { tierId });
        }
        else {
            // No tier provided - call RevenueCat API to determine it
            const revenueCatUserIdToUse = revenueCatUserId || userId;
            functions.logger.info('🔍 No tier provided, determining from RevenueCat API', { revenueCatUserIdToUse });
            finalTierId = await getRevenueCatSubscriptionTier(revenueCatUserIdToUse);
            functions.logger.info('✅ Tier determined from RevenueCat API', { finalTierId });
        }
        // Validate subscription ID format (basic validation)
        if (typeof subscriptionId !== 'string' || subscriptionId.length < 10) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid subscription ID format');
        }
        functions.logger.info('✅ Validation passed', { userId, finalTierId, subscriptionId });
        // Get current subscription to check if this is a tier change
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const currentSub = await subscriptionRef.get();
        const currentTier = ((_b = currentSub.data()) === null || _b === void 0 ? void 0 : _b.currentTier) || 'free';
        functions.logger.info('📋 Current subscription state', {
            exists: currentSub.exists,
            currentTier,
            newTier: finalTierId
        });
        const now = new Date();
        let receiptsExcludedCount = 0;
        const isTierChange = currentTier !== finalTierId;
        // Start a batch for atomic updates
        const batch = db.batch();
        if (isTierChange) {
            functions.logger.info(`🔄 Tier change detected: ${currentTier} → ${finalTierId}, processing receipt exclusions...`);
            // Get ALL existing receipts for this user
            const receiptsQuery = db.collection('receipts').where('userId', '==', userId);
            const receiptsSnapshot = await receiptsQuery.get();
            receiptsExcludedCount = receiptsSnapshot.docs.length;
            functions.logger.info(`📝 Found ${receiptsExcludedCount} receipts to exclude from new tier count`);
            // Mark ALL existing receipts as excluded from the new tier's count
            receiptsSnapshot.docs.forEach((receiptDoc) => {
                const updateData = {
                    excludeFromMonthlyCount: true,
                    monthlyCountExcludedAt: admin.firestore.FieldValue.serverTimestamp(),
                    previousTier: currentTier,
                    upgradeProcessedAt: now
                };
                batch.update(receiptDoc.ref, updateData);
            });
            functions.logger.info(`✅ Prepared ${receiptsExcludedCount} receipts for exclusion in batch`);
        }
        else {
            functions.logger.info(`📝 No tier change detected: staying on ${currentTier}`);
        }
        // Prepare subscription update data
        const subscriptionUpdateData = {
            currentTier: finalTierId,
            status: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMonthlyCountResetAt: isTierChange ? admin.firestore.FieldValue.serverTimestamp() : (((_c = currentSub.data()) === null || _c === void 0 ? void 0 : _c.lastMonthlyCountResetAt) || admin.firestore.FieldValue.serverTimestamp()),
            billing: {
                subscriptionId: subscriptionId,
                currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastPaymentProcessed: admin.firestore.FieldValue.serverTimestamp()
            },
        };
        // End trial when confirming ANY subscription (if trial is still active)
        const trialData = (_d = currentSub.data()) === null || _d === void 0 ? void 0 : _d.trial;
        const currentTrialActive = (trialData === null || trialData === void 0 ? void 0 : trialData.isActive) !== false && // if isActive is undefined or true
            (trialData === null || trialData === void 0 ? void 0 : trialData.expiresAt) &&
            trialData.expiresAt.toDate() > new Date(); // and not expired
        functions.logger.info('🔍 Trial check', {
            currentTrialActive,
            finalTierId,
            shouldEndTrial: currentTrialActive && finalTierId !== 'free',
            trialData,
            isActiveField: trialData === null || trialData === void 0 ? void 0 : trialData.isActive,
            expiresAt: (_e = trialData === null || trialData === void 0 ? void 0 : trialData.expiresAt) === null || _e === void 0 ? void 0 : _e.toDate(),
            now: new Date()
        });
        if (currentTrialActive && finalTierId !== 'free') {
            functions.logger.info('🏁 Ending trial for user upgrading to paid subscription');
            subscriptionUpdateData.trial = {
                isActive: false,
                startedAt: ((_g = (_f = currentSub.data()) === null || _f === void 0 ? void 0 : _f.trial) === null || _g === void 0 ? void 0 : _g.startedAt) || admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.FieldValue.serverTimestamp(),
                endedEarly: true,
                endReason: 'upgraded_to_paid'
            };
        }
        // Add metadata for tracking
        subscriptionUpdateData.billing = {
            ...subscriptionUpdateData.billing,
            // Add metadata for tracking
            lastUpgrade: isTierChange ? {
                fromTier: currentTier,
                toTier: finalTierId,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                receiptsExcluded: receiptsExcludedCount
            } : (((_j = (_h = currentSub.data()) === null || _h === void 0 ? void 0 : _h.billing) === null || _j === void 0 ? void 0 : _j.lastUpgrade) || null)
        };
        functions.logger.info('📝 Prepared subscription update data', {
            currentTier: finalTierId,
            isTierChange,
            receiptsExcluded: receiptsExcludedCount
        });
        // OPTIMIZATION: Merge onSubscriptionChange logic here to avoid separate trigger
        if (isTierChange) {
            functions.logger.info('🔄 Adding usage limits and history updates to batch for tier change');
            // Update current month's usage limits (previously done in onSubscriptionChange)
            const currentMonth = new Date().toISOString().slice(0, 7);
            const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
            const receiptLimits = getReceiptLimits();
            const tierLimits = {
                maxReceipts: receiptLimits[finalTierId] || receiptLimits.free,
                maxBusinesses: finalTierId === 'professional' ? -1 : 1,
                apiCallsPerMonth: finalTierId === 'professional' ? -1 : finalTierId === 'growth' ? 1000 : 0,
            };
            batch.update(usageRef, {
                limits: tierLimits,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Add subscription history entry (previously done in onSubscriptionChange)
            const newHistoryEntry = {
                tier: finalTierId,
                startDate: now,
                endDate: null,
                reason: "tier_change",
            };
            // Include history in subscription update
            subscriptionUpdateData.history = admin.firestore.FieldValue.arrayUnion(newHistoryEntry);
            // End previous tier in history if exists
            if (currentSub.exists && ((_k = currentSub.data()) === null || _k === void 0 ? void 0 : _k.history) && ((_l = currentSub.data()) === null || _l === void 0 ? void 0 : _l.history.length) > 0) {
                const currentHistory = ((_m = currentSub.data()) === null || _m === void 0 ? void 0 : _m.history) || [];
                const updatedHistory = currentHistory.map((entry, index) => {
                    if (index === currentHistory.length - 1) {
                        return {
                            ...entry,
                            endDate: now,
                        };
                    }
                    return entry;
                });
                subscriptionUpdateData.history = updatedHistory;
                // Then add the new entry
                subscriptionUpdateData.history = admin.firestore.FieldValue.arrayUnion(newHistoryEntry);
            }
        }
        // Add subscription update to batch
        if (currentSub.exists) {
            batch.update(subscriptionRef, subscriptionUpdateData);
        }
        else {
            // Create new subscription document if it doesn't exist
            const createData = {
                ...subscriptionUpdateData,
                userId: userId,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            batch.set(subscriptionRef, createData);
        }
        // Execute all updates atomically (including usage limits and history)
        try {
            await batch.commit();
            functions.logger.info('✅ Optimized batch commit successful', {
                subscriptionUpdated: true,
                usageLimitsUpdated: isTierChange,
                historyUpdated: isTierChange,
                receiptsExcluded: receiptsExcludedCount,
                tierChange: isTierChange
            });
        }
        catch (batchError) {
            functions.logger.error('❌ Batch commit failed', batchError);
            throw new https_1.HttpsError('internal', 'Failed to update subscription, receipts, and usage data');
        }
        // Log successful completion
        functions.logger.info('🎉 Subscription update completed successfully', {
            userId,
            oldTier: currentTier,
            newTier: finalTierId,
            receiptsExcluded: receiptsExcludedCount,
            subscriptionId
        });
        return {
            success: true,
            receiptsExcluded: receiptsExcludedCount,
            tierChange: isTierChange
        };
    }
    catch (error) {
        functions.logger.error('❌ updateSubscriptionAfterPayment failed', error);
        // Re-throw HttpsErrors as-is
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        // Convert other errors to internal HttpsError
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        throw new https_1.HttpsError('internal', `Subscription update failed: ${errorMessage}`);
    }
});
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
// Test Stripe connection
exports.testStripeConnection = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
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
    }
    catch (error) {
        console.error('Stripe connection test failed:', error);
        return {
            success: false,
            message: `Stripe connection failed: ${error.message}`,
        };
    }
}); // Health check endpoint
exports.healthCheck = (0, https_1.onRequest)((req, res) => {
    try {
        const config = getStripeConfig();
        res.status(200).json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'unknown',
            project: process.env.GCLOUD_PROJECT || 'unknown',
            region: process.env.FUNCTION_REGION || 'unknown',
            stripe: {
                hasSecretKey: !!config.secretKey,
                hasWebhookSecret: !!config.webhookSecret,
            }
        });
    }
    catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString(),
        });
    }
});
// Debug webhook (for testing webhook delivery)
exports.debugWebhook = (0, https_1.onRequest)((req, res) => {
    var _a, _b, _c;
    console.log('=== DEBUG WEBHOOK ===');
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body type:', typeof req.body);
    console.log('Body length:', ((_a = req.body) === null || _a === void 0 ? void 0 : _a.length) || 0);
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
        console.log('📤 Sending sandbox webhook request:', {
            webhook_type: webhookType,
            webhook_code: webhookCode,
            user_id: request.auth.uid,
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
            console.error('❌ Plaid sandbox webhook failed:', errorData);
            throw new https_1.HttpsError('internal', `Plaid sandbox webhook failed: ${errorData.error_message || 'Unknown error'}`);
        }
        const responseData = await response.json();
        console.log('✅ Plaid sandbox webhook fired successfully:', responseData);
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
        console.error('❌ Error testing Plaid webhook:', error);
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
        console.log('🧪 Direct Plaid webhook test starting...');
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
        console.log('📤 Firing Plaid sandbox webhook...');
        const response = await fetch(`https://${plaidConfig.environment}.plaid.com/sandbox/item/fire_webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) {
            const errorData = await response.json();
            console.error('❌ Plaid webhook failed:', errorData);
            res.status(500).json({
                success: false,
                error: errorData,
                message: 'Plaid webhook failed'
            });
            return;
        }
        const responseData = await response.json();
        console.log('✅ Plaid webhook fired successfully! Response:', responseData);
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
        console.error('❌ Error in direct webhook test:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Internal server error'
        });
    }
});
// Sync bank connection data to plaid_items for webhook processing
exports.syncBankConnectionToPlaidItems = (0, https_1.onRequest)(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        console.log('🔄 Syncing bank connection to plaid_items...');
        const userId = 'sZY5c4gQa9XVwfy7EbPUHs7Vnrc2';
        const itemId = 'bank_sZY5c4gQa9XVwfy7EbPUHs7Vnrc2_1756666330485';
        const accessToken = 'access-sandbox-6193d89e-9a8a-48a3-af09-88d86d13dbb1';
        // Create plaid_items document for webhook processing
        await db.collection('plaid_items').doc(itemId).set({
            itemId: itemId,
            userId: userId,
            institutionId: 'ins_109511',
            institutionName: 'Tartan Bank',
            accessToken: accessToken,
            accounts: [
                { accountId: 'sample_account_1', name: 'Checking Account', type: 'depository', subtype: 'checking' },
                { accountId: 'sample_account_2', name: 'Savings Account', type: 'depository', subtype: 'savings' }
            ],
            isActive: true,
            status: 'good',
            needsReauth: false,
            connectedAt: new Date('2025-08-31T18:46:51.613Z'),
            lastSyncAt: new Date('2025-08-31T18:46:51.613Z'),
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        console.log('✅ Successfully created plaid_items document');
        res.status(200).json({
            success: true,
            message: 'Bank connection synced to plaid_items',
            itemId: itemId,
            userId: userId,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Error syncing to plaid_items:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to sync bank connection'
        });
    }
});
// Function to manually trigger user initialization (for testing)
exports.initializeTestUser = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const userId = request.auth.uid;
        const { email, displayName } = request.data;
        // Manually trigger user initialization
        const mockUser = {
            uid: userId,
            email: email,
            displayName: displayName,
        };
        // Call the user creation function directly
        await exports.onUserCreate(mockUser);
        return {
            success: true,
            userId: userId,
        };
    }
    catch (error) {
        console.error('Error initializing test user:', error);
        throw new https_1.HttpsError('internal', 'Failed to initialize user');
    }
});
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
            console.error('Account holder not found:', invitation.accountHolderId);
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
        console.log('📧 Team invitation email details:');
        console.log('To:', invitation.inviteEmail);
        console.log('From:', accountHolderEmail);
        console.log('Subject:', subject);
        console.log('Invitation Link:', invitationLink);
        console.log('Expires:', invitation.expiresAt.toDate());
        // Get SendGrid API key from environment
        const sendgridApiKey = process.env.SENDGRID_API_KEY;
        if (!sendgridApiKey) {
            console.error('❌ SENDGRID_API_KEY environment variable not set');
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
        console.log('✅ Team invitation email sent successfully to:', invitation.inviteEmail);
        console.log('📧 SendGrid response status:', response[0].statusCode);
        // Mark invitation as email sent (optional status tracking)
        await snapshot.ref.update({
            emailSent: true,
            emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log('✅ Team invitation email processed for:', invitation.inviteEmail);
    }
    catch (error) {
        console.error('❌ Error sending team invitation email:', error);
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
            console.log('No expired invitations to clean up');
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
        console.log(`✅ Cleaned up ${count} expired team invitations`);
    }
    catch (error) {
        console.error('❌ Error cleaning up expired invitations:', error);
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
            console.log(`🔄 Team member ${userId} (${memberEmail}) was removed/suspended, performing complete account deletion...`);
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
                console.log(`✅ COMPLETE ACCOUNT DELETION: User ${userId} (${memberEmail}) has been permanently removed`);
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
        console.error('❌ Error handling team member removal:', error);
    }
});
// RevenueCat webhook for handling subscription events
exports.revenueCatWebhookHandler = (0, https_1.onRequest)(async (req, res) => {
    console.log('🔔 RevenueCat webhook received');
    if (req.method !== 'POST') {
        console.log('❌ Invalid method:', req.method);
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Verify authorization header for security
        const authHeader = req.headers['authorization'];
        const expectedAuth = process.env.REVENUECAT_WEBHOOK_SECRET;
        if (expectedAuth && authHeader !== `Bearer ${expectedAuth}`) {
            console.log('❌ Invalid authorization header');
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        if (expectedAuth) {
            console.log('🔒 Webhook authorization verified');
        }
        else {
            console.log('⚠️ No webhook secret configured - skipping auth verification');
        }
        const body = req.body;
        const event = body.event; // RevenueCat nests the actual event data
        console.log('📦 RevenueCat event type:', event.type);
        console.log('📦 RevenueCat event data:', JSON.stringify(body, null, 2));
        // Handle different event types
        switch (event.type) {
            case 'INITIAL_PURCHASE':
            case 'RENEWAL':
            case 'PRODUCT_CHANGE':
            case 'CANCELLATION':
            case 'UNCANCELLATION':
            case 'NON_RENEWING_PURCHASE':
                await handleSubscriptionEvent(event);
                break;
            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        console.error('❌ Error processing RevenueCat webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Helper function to handle subscription events
async function handleSubscriptionEvent(event) {
    var _a, _b;
    try {
        const { product_id, new_product_id, event_timestamp_ms, type, original_app_user_id } = event;
        const userId = original_app_user_id;
        // For PRODUCT_CHANGE events, use new_product_id, otherwise use product_id
        const effectiveProductId = (type === 'PRODUCT_CHANGE' && new_product_id) ? new_product_id : product_id;
        console.log(`🔄 Processing subscription event for user: ${userId}`);
        console.log(`📱 Event type: ${type}`);
        console.log(`📱 Original Product ID: ${product_id}`);
        if (new_product_id)
            console.log(`📱 New Product ID: ${new_product_id}`);
        console.log(`📱 Effective Product ID: ${effectiveProductId}`);
        console.log(`⏰ Event timestamp: ${new Date(event_timestamp_ms)}`);
        if (!userId) {
            console.error('❌ No user ID found in webhook event');
            return;
        }
        // Map RevenueCat product ID to subscription tier
        const tier = mapProductIdToTier(effectiveProductId);
        console.log(`🎯 Mapped to tier: ${tier}`);
        // Get user's current subscription document
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const currentSub = await subscriptionRef.get();
        const currentTier = ((_a = currentSub.data()) === null || _a === void 0 ? void 0 : _a.currentTier) || 'free';
        console.log(`📋 Current tier: ${currentTier} → New tier: ${tier}`);
        // Prepare subscription update data
        const subscriptionUpdate = {
            currentTier: tier,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRevenueCatEvent: {
                type: event.type,
                productId: product_id,
                timestamp: new Date(event_timestamp_ms),
                eventData: event
            }
        };
        // Add tier-specific data
        if (tier !== 'free') {
            const tierConfig = subscriptionTiers[tier];
            if (tierConfig) {
                subscriptionUpdate.limits = tierConfig.limits;
                subscriptionUpdate.features = tierConfig.features;
            }
        }
        // Handle tier changes
        if (currentTier !== tier) {
            console.log(`🔄 Tier change detected: ${currentTier} → ${tier}`);
            // Add history entry
            const historyEntry = {
                tier: tier,
                startDate: new Date(event_timestamp_ms),
                endDate: null,
                reason: `revenuecat_${event.type.toLowerCase()}`
            };
            subscriptionUpdate.history = admin.firestore.FieldValue.arrayUnion(historyEntry);
            // Update usage limits if downgrading
            if (shouldUpdateUsageLimits(currentTier, tier)) {
                const currentMonth = new Date().toISOString().slice(0, 7);
                const usageRef = db.collection('usage').doc(`${userId}_${currentMonth}`);
                await usageRef.set({
                    limits: ((_b = subscriptionTiers[tier]) === null || _b === void 0 ? void 0 : _b.limits) || subscriptionTiers.free.limits,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
                console.log(`📊 Updated usage limits for ${currentMonth}`);
            }
        }
        // Update subscription document
        await subscriptionRef.set(subscriptionUpdate, { merge: true });
        console.log(`✅ Subscription updated for user ${userId}`);
    }
    catch (error) {
        console.error('❌ Error handling subscription event:', error);
        throw error;
    }
}
// Map RevenueCat product ID to subscription tier
function mapProductIdToTier(productId) {
    const productToTierMap = {
        'rc_starter': 'starter',
        'rc_growth_monthly': 'growth',
        'rc_growth_annual': 'growth',
        'rc_professional_monthly': 'professional',
        'rc_professional_annual': 'professional'
    };
    return productToTierMap[productId] || 'free';
}
// Check if usage limits should be updated (when downgrading)
function shouldUpdateUsageLimits(currentTier, newTier) {
    const tierPriority = { free: 0, starter: 1, growth: 2, professional: 3 };
    return (tierPriority[newTier] || 0) <
        (tierPriority[currentTier] || 0);
}
//# sourceMappingURL=index.js.map