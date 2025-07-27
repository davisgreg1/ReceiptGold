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
exports.initializeTestUser = exports.debugWebhook = exports.healthCheck = exports.testStripeConnection = exports.onUserDelete = exports.generateReport = exports.updateBusinessStats = exports.createCheckoutSession = exports.createStripeCustomer = exports.resetMonthlyUsage = exports.stripeWebhook = exports.onSubscriptionChange = exports.onReceiptCreate = exports.onUserCreate = void 0;
const functions = __importStar(require("firebase-functions"));
const functionsV1 = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
const https_1 = require("firebase-functions/v2/https");
// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();
// Environment-aware Stripe configuration
const getStripeConfig = () => {
    var _a, _b;
    // For local development, check environment variables first
    const secretKey = process.env.STRIPE_SECRET_KEY ||
        ((_a = functions.config().stripe) === null || _a === void 0 ? void 0 : _a.secret);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ||
        ((_b = functions.config().stripe) === null || _b === void 0 ? void 0 : _b.webhook_secret);
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
// Subscription tier configurations (keeping your existing setup)
const subscriptionTiers = {
    free: {
        name: "Free",
        limits: {
            maxReceipts: 10,
            maxBusinesses: 1,
            storageLimit: 104857600,
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
            maxReceipts: -1,
            maxBusinesses: 1,
            storageLimit: -1,
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
            maxReceipts: -1,
            maxBusinesses: 3,
            storageLimit: -1,
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
            maxReceipts: -1,
            maxBusinesses: -1,
            storageLimit: -1,
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
        'prod_SkljfzmCw8QCH3': "starter",
        'prod_Skll05sdZm6fHZ': "growth",
        'prod_Skll99mJsu7C3o': "professional",
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
            storageUsed: 0,
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
        // Get current usage
        const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
        const usageDoc = await usageRef.get();
        if (!usageDoc.exists) {
            // Create usage document if it doesn't exist
            const newUsageDoc = {
                userId,
                month: currentMonth,
                receiptsUploaded: 1,
                storageUsed: 0,
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
            // Check if user has reached their limit
            if (subscription.limits.maxReceipts !== -1 &&
                newReceiptCount > subscription.limits.maxReceipts) {
                // Delete the receipt and throw error
                await snap.ref.delete();
                throw new Error(`Receipt limit exceeded. Current plan allows ${subscription.limits.maxReceipts} receipts per month.`);
            }
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
                startDate: admin.firestore.FieldValue.serverTimestamp(),
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
// 4. UPDATED Stripe Webhook Handler with environment-aware configuration
exports.stripeWebhook = (0, https_1.onRequest)(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        console.error("No Stripe signature found in request headers");
        res.status(400).send("No Stripe signature found");
        return;
    }
    // Get webhook secret using environment-aware approach
    let webhookSecret;
    try {
        const config = getStripeConfig();
        webhookSecret = config.webhookSecret;
    }
    catch (error) {
        console.error("Stripe configuration error:", error);
        res.status(500).send("Stripe configuration error");
        return;
    }
    let event;
    try {
        event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
    }
    catch (err) {
        console.error("❌ Webhook signature verification failed:", err.message);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    try {
        console.log(`🔄 Processing Stripe event: ${event.type}`);
        switch (event.type) {
            case "customer.subscription.created":
                await handleSubscriptionCreated(event.data.object);
                console.log(`✅ Handled ${event.type}`);
                break;
            case "customer.subscription.updated":
                await handleSubscriptionUpdated(event.data.object);
                console.log(`✅ Handled ${event.type}`);
                break;
            case "customer.subscription.deleted":
                await handleSubscriptionDeleted(event.data.object);
                console.log(`✅ Handled ${event.type}`);
                break;
            case "invoice.payment_succeeded":
                await handlePaymentSucceeded(event.data.object);
                console.log(`✅ Handled ${event.type}`);
                break;
            case "invoice.payment_failed":
                await handlePaymentFailed(event.data.object);
                console.log(`✅ Handled ${event.type}`);
                break;
            default:
                console.log(`ℹ️ Unhandled event type: ${event.type}`);
        }
        res.status(200).send("Webhook received successfully");
    }
    catch (error) {
        console.error("❌ Error processing webhook:", error);
        res.status(500).send("Webhook processing failed");
    }
});
// Stripe webhook handlers (keeping your existing implementations)
async function handleSubscriptionCreated(subscription) {
    var _a;
    const customerId = subscription.customer;
    const customer = await getStripe().customers.retrieve(customerId);
    const userId = (_a = customer.metadata) === null || _a === void 0 ? void 0 : _a.userId;
    if (!userId) {
        console.error("No userId found in customer metadata for customer:", customerId);
        return;
    }
    console.log(`Processing subscription created for user: ${userId}`);
    // Determine tier from price ID
    const tier = getTierFromPriceId(subscription.items.data[0].price.id);
    await db
        .collection("subscriptions")
        .doc(userId)
        .update({
        currentTier: tier,
        status: "active",
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
    console.log("Payment succeeded for invoice:", invoice.id);
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
    .schedule("0 0 1 * *") // First day of every month at midnight
    .onRun(async (context) => {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const usageSnapshot = await db.collection("usage").get();
        const batch = db.batch();
        for (const doc of usageSnapshot.docs) {
            const data = doc.data();
            // Create new usage document for current month
            const newUsageRef = db
                .collection("usage")
                .doc(`${data.userId}_${currentMonth}`);
            // Get user's current subscription
            const subscriptionDoc = await db
                .collection("subscriptions")
                .doc(data.userId)
                .get();
            if (!subscriptionDoc.exists)
                continue;
            const subscription = subscriptionDoc.data();
            const newUsageDoc = {
                userId: data.userId,
                month: currentMonth,
                receiptsUploaded: 0,
                storageUsed: 0,
                apiCalls: 0,
                reportsGenerated: 0,
                limits: subscription.limits,
                resetDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            batch.set(newUsageRef, newUsageDoc);
        }
        await batch.commit();
        console.log("Monthly usage reset completed");
    }
    catch (error) {
        console.error("Error resetting monthly usage:", error);
    }
});
exports.createStripeCustomer = (0, https_1.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be authenticated");
    }
    try {
        const userId = request.auth.uid;
        const { email, name } = request.data;
        console.log(`Creating Stripe customer for user: ${userId}`);
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
        throw new https_1.HttpsError("internal", "Failed to create customer");
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
        return { sessionId: session.id };
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