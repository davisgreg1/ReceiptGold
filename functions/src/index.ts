// Cloud Functions for ReceiptGold Business Logic
// Updated for Firebase Functions v6 (mixed v1/v2 API)

import * as functions from "firebase-functions";
import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { onCall, HttpsError, CallableRequest, onRequest } from "firebase-functions/v2/https";
import { Request, Response } from "express";

// Initialize Firebase Admin SDK for production
admin.initializeApp();
const db = admin.firestore();

// Environment-aware Stripe configuration
const getStripeConfig = (): { secretKey: string; webhookSecret: string } => {
  // For local development, check environment variables first
  const secretKey = process.env.STRIPE_SECRET_KEY ||
    functions.config().stripe?.secret;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ||
    functions.config().stripe?.webhook_secret;

  if (!secretKey) {
    throw new Error('Stripe secret key not found. Set STRIPE_SECRET_KEY or run: firebase functions:config:set stripe.secret="sk_test_..."');
  }

  if (!webhookSecret) {
    throw new Error('Stripe webhook secret not found. Set STRIPE_WEBHOOK_SECRET or run: firebase functions:config:set stripe.webhook_secret="whsec_..."');
  }

  return { secretKey, webhookSecret };
};

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

// Type definitions (keeping your existing interfaces)
interface SubscriptionTier {
  name: string;
  limits: {
    maxReceipts: number;
    maxBusinesses: number;
    storageLimit: number;
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
  currentTier: 'free' | 'starter' | 'growth' | 'professional';
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
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
  storageUsed: number;
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
  };
  tax: {
    deductible: boolean;
    deductionPercentage: number;
    taxYear: number;
    category: string;
  };
  status: 'uploaded' | 'processing' | 'processed' | 'error' | 'deleted';
  processingErrors: string[];
  createdAt: admin.firestore.FieldValue;
  updatedAt: admin.firestore.FieldValue;
}

// Subscription tier configurations (keeping your existing setup)
const subscriptionTiers: Record<string, SubscriptionTier> = {
  free: {
    name: "Free",
    limits: {
      maxReceipts: 10,
      maxBusinesses: 1,
      storageLimit: 104857600, // 100 MB
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
      maxReceipts: -1, // unlimited
      maxBusinesses: 1,
      storageLimit: -1, // unlimited
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
      maxReceipts: -1, // unlimited
      maxBusinesses: 3,
      storageLimit: -1, // unlimited
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
      maxReceipts: -1, // unlimited
      maxBusinesses: -1, // unlimited
      storageLimit: -1, // unlimited
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
function getTierFromPriceId(priceId: string): string {
  // Map your Stripe price IDs to tiers
  const priceToTierMap: Record<string, string> = {
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
export const onUserCreate = functionsV1.auth.user().onCreate(async (user: admin.auth.UserRecord) => {
  try {
    const userId: string = user.uid;
    const email: string = user.email || '';
    const displayName: string = user.displayName || '';

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

    // Create subscription document (free tier)
    const subscriptionDoc: SubscriptionDocument = {
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
    const currentMonth: string = new Date().toISOString().slice(0, 7);
    const usageDoc: UsageDocument = {
      userId,
      month: currentMonth,
      receiptsUploaded: 0,
      storageUsed: 0,
      apiCalls: 0,
      reportsGenerated: 0,
      limits: subscriptionTiers.free.limits,
      resetDate: new Date(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        1
      ).toISOString(),
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    };

    await db.collection("usage").doc(`${userId}_${currentMonth}`).set(usageDoc);

    console.log(`User ${userId} initialized successfully`);
  } catch (error) {
    console.error("Error creating user documents:", error);
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

      // Get current usage
      const usageRef = db.collection("usage").doc(`${userId}_${currentMonth}`);
      const usageDoc = await usageRef.get();

      if (!usageDoc.exists) {
        // Create usage document if it doesn't exist
        const newUsageDoc: UsageDocument = {
          userId,
          month: currentMonth,
          receiptsUploaded: 1,
          storageUsed: 0,
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

        // Check if user has reached their limit
        if (
          subscription.limits.maxReceipts !== -1 &&
          newReceiptCount > subscription.limits.maxReceipts
        ) {
          // Delete the receipt and throw error
          await snap.ref.delete();
          throw new Error(
            `Receipt limit exceeded. Current plan allows ${subscription.limits.maxReceipts} receipts per month.`
          );
        }

        // Update usage count
        await usageRef.update({
          receiptsUploaded: newReceiptCount,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Process receipt for OCR
      await processReceiptOCR(snap.ref, receiptData);
    } catch (error) {
      console.error("Error processing receipt creation:", error);

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
    };

    await receiptRef.update({
      status: "processed",
      extractedData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    throw error;
  }
}

// 3. Subscription Change Trigger (updated for Firebase Functions v6)
export const onSubscriptionChange = functionsV1.firestore
  .document("subscriptions/{userId}")
  .onWrite(async (change, context) => {
    try {
      const userId: string = context.params.userId;
      const before = change.before.exists ? change.before.data() as SubscriptionDocument : null;
      const after = change.after.exists ? change.after.data() as SubscriptionDocument : null;

      // Skip if this is the initial creation
      if (!before || !after) return;

      // Check if tier changed
      if (before.currentTier !== after.currentTier) {
        console.log(
          `User ${userId} tier changed from ${before.currentTier} to ${after.currentTier}`
        );

        // Update current month's usage limits
        const currentMonth: string = new Date().toISOString().slice(0, 7);
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
    } catch (error) {
      console.error("Error handling subscription change:", error);
    }
  });

// 4. UPDATED Stripe Webhook Handler with environment-aware configuration
export const stripeWebhook = onRequest(async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;

  if (!sig) {
    console.error("No Stripe signature found in request headers");
    res.status(400).send("No Stripe signature found");
    return;
  }

  // Get webhook secret using environment-aware approach
  let webhookSecret: string;
  try {
    const config = getStripeConfig();
    webhookSecret = config.webhookSecret;
  } catch (error) {
    console.error("Stripe configuration error:", error);
    res.status(500).send("Stripe configuration error");
    return;
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log(`✅ Webhook signature verified. Event type: ${event.type}`);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", (err as Error).message);
    res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    return;
  }

  try {
    console.log(`🔄 Processing Stripe event: ${event.type}`);

    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        console.log(`✅ Handled ${event.type}`);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        console.log(`✅ Handled ${event.type}`);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        console.log(`✅ Handled ${event.type}`);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        console.log(`✅ Handled ${event.type}`);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        console.log(`✅ Handled ${event.type}`);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.status(200).send("Webhook received successfully");
  } catch (error) {
    console.error("❌ Error processing webhook:", error);
    res.status(500).send("Webhook processing failed");
  }
});

// Stripe webhook handlers (keeping your existing implementations)
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  const customerId: string = subscription.customer as string;
  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const userId: string | undefined = customer.metadata?.userId;

  if (!userId) {
    console.error("No userId found in customer metadata for customer:", customerId);
    return;
  }

  console.log(`Processing subscription created for user: ${userId}`);

  // Determine tier from price ID
  const tier: string = getTierFromPriceId(subscription.items.data[0].price.id);

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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  const customerId: string = subscription.customer as string;
  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const userId: string | undefined = customer.metadata?.userId;

  if (!userId) {
    console.error("No userId found in customer metadata for customer:", customerId);
    return;
  }

  console.log(`Processing subscription updated for user: ${userId}`);

  const tier: string = getTierFromPriceId(subscription.items.data[0].price.id);

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

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  const customerId: string = subscription.customer as string;
  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const userId: string | undefined = customer.metadata?.userId;

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

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  console.log("Payment succeeded for invoice:", invoice.id);
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  console.log("Payment failed for invoice:", invoice.id);

  const customerId: string = invoice.customer as string;
  const customer = await getStripe().customers.retrieve(customerId) as Stripe.Customer;
  const userId: string | undefined = customer.metadata?.userId;

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
export const resetMonthlyUsage = functionsV1.pubsub
  .schedule("0 0 1 * *") // First day of every month at midnight
  .onRun(async (context: any) => {
    try {
      const currentMonth: string = new Date().toISOString().slice(0, 7);
      const usageSnapshot = await db.collection("usage").get();

      const batch = db.batch();

      for (const doc of usageSnapshot.docs) {
        const data = doc.data() as UsageDocument;

        // Create new usage document for current month
        const newUsageRef = db
          .collection("usage")
          .doc(`${data.userId}_${currentMonth}`);

        // Get user's current subscription
        const subscriptionDoc = await db
          .collection("subscriptions")
          .doc(data.userId)
          .get();

        if (!subscriptionDoc.exists) continue;

        const subscription = subscriptionDoc.data() as SubscriptionDocument;

        const newUsageDoc: UsageDocument = {
          userId: data.userId,
          month: currentMonth,
          receiptsUploaded: 0,
          storageUsed: 0,
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

        batch.set(newUsageRef, newUsageDoc);
      }

      await batch.commit();
      console.log("Monthly usage reset completed");
    } catch (error) {
      console.error("Error resetting monthly usage:", error);
    }
  });

// 6. Create Stripe Customer (with environment-aware app URL)
interface CreateCustomerData {
  email: string;
  name: string;
}

export const createStripeCustomer = onCall(async (request: CallableRequest<CreateCustomerData>) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  try {
    const userId: string = request.auth.uid;
    const { email, name }: CreateCustomerData = request.data;

    console.log(`Creating Stripe customer for user: ${userId}`);

    // Create Stripe customer
    const customer: Stripe.Customer = await getStripe().customers.create({
      email: email,
      name: name,
      metadata: {
        userId: userId,
      },
    });

    console.log(`✅ Created Stripe customer ${customer.id} for user ${userId}`);
    return { customerId: customer.id };
  } catch (error) {
    console.error("Error creating Stripe customer:", error);
    throw new HttpsError(
      "internal",
      "Failed to create customer"
    );
  }
});

// 7. Create Checkout Session (with environment-aware URLs)
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
        return functions.config().app?.url || 'https://yourapp.com';
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

      console.log(`✅ Created checkout session ${session.id} for user ${request.auth.uid}`);
      return { sessionId: session.id };
    } catch (error) {
      console.error("Error creating checkout session:", error);
      throw new HttpsError(
        "internal",
        "Failed to create checkout session"
      );
    }
  }
);

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
      console.error("Error updating business stats:", error);
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

    console.log(`✅ Generated report ${reportRef.id} for user ${userId}`);
    return { reportId: reportRef.id, data: reportData.data };
  } catch (error) {
    console.error("Error generating report:", error);
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
  } catch (error) {
    console.error("Error deleting user data:", error);
  }
});

// ADDITIONAL FUNCTIONS FOR TESTING AND DEBUGGING

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
          hasSecretKey: !!process.env.STRIPE_SECRET_KEY || !!functions.config().stripe?.secret,
          hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET || !!functions.config().stripe?.webhook_secret,
        }
      };
    } catch (error) {
      console.error('Stripe connection test failed:', error);
      return {
        success: false,
        message: `Stripe connection failed: ${(error as Error).message}`,
      };
    }
  }
);// Health check endpoint
export const healthCheck = onRequest((req, res) => {
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
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Debug webhook (for testing webhook delivery)
export const debugWebhook = onRequest((req, res) => {
  console.log('=== DEBUG WEBHOOK ===');
  console.log('Method:', req.method);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Body type:', typeof req.body);
  console.log('Body length:', req.body?.length || 0);
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

// Function to manually trigger user initialization (for testing)
export const initializeTestUser = onCall(
  async (request: CallableRequest<{ email: string; displayName: string }>) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    try {
      const userId = request.auth.uid;
      const { email, displayName } = request.data;

      // Manually trigger user initialization
      const mockUser = {
        uid: userId,
        email: email,
        displayName: displayName,
      } as admin.auth.UserRecord;

      // Call the user creation function directly
      await exports.onUserCreate(mockUser);

      return {
        success: true,
        userId: userId,
      };
    } catch (error) {
      console.error('Error initializing test user:', error);
      throw new HttpsError('internal', 'Failed to initialize user');
    }
  }
);