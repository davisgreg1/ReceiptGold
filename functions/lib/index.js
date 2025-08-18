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
exports.initializeTestUser = exports.debugWebhook = exports.healthCheck = exports.testStripeConnection = exports.updateSubscriptionAfterPayment = exports.onUserDelete = exports.generateReport = exports.updateBusinessStats = exports.createCheckoutSession = exports.createStripeCustomer = exports.createSubscription = exports.resetMonthlyUsage = exports.testWebhookConfig = exports.stripeWebhook = exports.onSubscriptionChange = exports.onReceiptCreate = exports.onUserCreate = exports.TIER_LIMITS = void 0;
const functions = __importStar(require("firebase-functions"));
const functionsV1 = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const https_1 = require("firebase-functions/v2/https");
// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();
// Receipt limits configuration from environment variables
const getReceiptLimits = () => {
    return {
        free: parseInt(process.env.FREE_TIER_MAX_RECEIPTS || "10", 10),
        starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
        growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
        professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10)
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
        maxBusinesses: 3,
        apiCallsPerMonth: 5000,
    },
    professional: {
        maxReceipts: -1,
        maxBusinesses: -1,
        apiCallsPerMonth: -1, // unlimited
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
            maxBusinesses: 3,
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
        // Create subscription document (free tier)
        const subscriptionDoc = {
            userId,
            currentTier: "free",
            status: "active",
            billing: {
                customerId: null,
                subscriptionId: null,
                priceId: null,
                currentPeriodStart: admin.firestore.Timestamp.now(),
                currentPeriodEnd: null,
                cancelAtPeriodEnd: false,
                trialEnd: null,
            },
            limits: subscriptionTiers.free.limits,
            features: subscriptionTiers.free.features,
            history: [
                {
                    tier: "free",
                    startDate: admin.firestore.Timestamp.now(),
                    endDate: null,
                    reason: "initial_signup",
                },
            ],
            createdAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
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
// 3. Subscription Change Trigger (updated for Firebase Functions v6)
exports.onSubscriptionChange = functionsV1.firestore
    .document("subscriptions/{userId}")
    .onWrite(async (change, context) => {
    try {
        const userId = context.params.userId;
        const before = change.before.exists ? change.before.data() : null;
        const after = change.after.exists ? change.after.data() : null;
        // Skip if this is the initial creation
        if (!before || !after)
            return;
        // Check if tier changed
        if (before.currentTier !== after.currentTier) {
            console.log(`User ${userId} tier changed from ${before.currentTier} to ${after.currentTier}`);
            // Update current month's usage limits
            const currentMonth = new Date().toISOString().slice(0, 7);
            const usageRef = db
                .collection("usage")
                .doc(`${userId}_${currentMonth}`);
            await usageRef.update({
                limits: after.limits,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Add to subscription history
            const newHistoryEntry = {
                tier: after.currentTier,
                startDate: new Date(),
                endDate: null,
                reason: "tier_change",
            };
            await change.after.ref.update({
                history: admin.firestore.FieldValue.arrayUnion(newHistoryEntry),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // End previous tier in history
            if (before.history && before.history.length > 0) {
                const updatedHistory = before.history.map((entry, index) => {
                    if (index === before.history.length - 1) {
                        return {
                            ...entry,
                            endDate: admin.firestore.FieldValue.serverTimestamp(),
                        };
                    }
                    return entry;
                });
                await change.after.ref.update({
                    history: updatedHistory,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    }
    catch (error) {
        console.error("Error handling subscription change:", error);
    }
});
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
// Test endpoint to verify webhook configuration
exports.testWebhookConfig = (0, https_1.onRequest)(async (req, res) => {
    try {
        const config = getStripeConfig();
        res.status(200).json({
            webhookConfigured: true,
            hasSecretKey: !!config.secretKey,
            hasWebhookSecret: !!config.webhookSecret,
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
// 5. Monthly Usage Reset (updated for Firebase Functions v6)
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
            var _a;
            // Check if we're in development
            if (process.env.NODE_ENV === 'development') {
                return 'http://localhost:8081';
            }
            // Use configured app URL or fallback
            return ((_a = functions.config().app) === null || _a === void 0 ? void 0 : _a.url) || 'https://yourapp.com';
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
exports.updateSubscriptionAfterPayment = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d;
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
        const { subscriptionId, tierId, userId } = request.data;
        // Validate required fields
        if (!subscriptionId || !tierId || !userId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required fields: subscriptionId, tierId, userId');
        }
        // Validate tier
        const validTiers = ['free', 'starter', 'growth', 'professional'];
        if (!validTiers.includes(tierId)) {
            throw new https_1.HttpsError('invalid-argument', `Invalid tier: ${tierId}`);
        }
        // Validate subscription ID format (basic validation)
        if (typeof subscriptionId !== 'string' || subscriptionId.length < 10) {
            throw new https_1.HttpsError('invalid-argument', 'Invalid subscription ID format');
        }
        functions.logger.info('✅ Validation passed', { userId, tierId, subscriptionId });
        // Get current subscription to check if this is a tier change
        const subscriptionRef = db.collection('subscriptions').doc(userId);
        const currentSub = await subscriptionRef.get();
        const currentTier = ((_b = currentSub.data()) === null || _b === void 0 ? void 0 : _b.currentTier) || 'free';
        functions.logger.info('📋 Current subscription state', {
            exists: currentSub.exists,
            currentTier,
            newTier: tierId
        });
        const now = new Date();
        let receiptsExcludedCount = 0;
        const isTierChange = currentTier !== tierId;
        // Start a batch for atomic updates
        const batch = db.batch();
        if (isTierChange) {
            functions.logger.info(`🔄 Tier change detected: ${currentTier} → ${tierId}, processing receipt exclusions...`);
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
            currentTier: tierId,
            status: 'active',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastMonthlyCountResetAt: isTierChange ? admin.firestore.FieldValue.serverTimestamp() : (_c = currentSub.data()) === null || _c === void 0 ? void 0 : _c.lastMonthlyCountResetAt,
            billing: {
                subscriptionId: subscriptionId,
                currentPeriodStart: admin.firestore.FieldValue.serverTimestamp(),
                currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                lastPaymentProcessed: admin.firestore.FieldValue.serverTimestamp()
            },
            // Add metadata for tracking
            lastUpgrade: isTierChange ? {
                fromTier: currentTier,
                toTier: tierId,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                receiptsExcluded: receiptsExcludedCount
            } : (_d = currentSub.data()) === null || _d === void 0 ? void 0 : _d.lastUpgrade
        };
        functions.logger.info('📝 Prepared subscription update data', {
            currentTier: tierId,
            isTierChange,
            receiptsExcluded: receiptsExcludedCount
        });
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
        // Execute all updates atomically
        try {
            await batch.commit();
            functions.logger.info('✅ Batch commit successful', {
                subscriptionUpdated: true,
                receiptsExcluded: receiptsExcludedCount,
                tierChange: isTierChange
            });
        }
        catch (batchError) {
            functions.logger.error('❌ Batch commit failed', batchError);
            throw new https_1.HttpsError('internal', 'Failed to update subscription and receipts');
        }
        // Log successful completion
        functions.logger.info('🎉 Subscription update completed successfully', {
            userId,
            oldTier: currentTier,
            newTier: tierId,
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
    var _a, _b;
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
                hasSecretKey: !!process.env.STRIPE_SECRET_KEY || !!((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret),
                hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET || !!((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.webhook_secret),
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
//# sourceMappingURL=index.js.map