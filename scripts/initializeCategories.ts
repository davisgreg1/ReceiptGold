// functions/scripts/initializeCategories.ts
// TypeScript script to initialize master categories in Firestore

import * as admin from "firebase-admin";
import * as path from "path";

// Type definitions
interface CategoryDocument {
  categoryId: string;
  name: string;
  description: string;
  taxDeductible: boolean;
  icon: string;
  subcategories: string[];
  keywords: string[];
  isActive: boolean;
  sortOrder: number;
}

// Load service account key
const serviceAccount = require(path.join(
  __dirname,
  "../db/ReceiptGoldAdminReceipt.json"
));

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function initializeMasterCategories(): Promise<void> {

  const categories: CategoryDocument[] = [
    {
      categoryId: "office_supplies",
      name: "Office Supplies",
      description: "General office supplies and equipment",
      taxDeductible: true,
      icon: "📝",
      subcategories: ["software", "hardware", "stationery", "furniture"],
      keywords: ["office", "supplies", "desk", "chair", "computer", "software"],
      isActive: true,
      sortOrder: 1,
    },
    {
      categoryId: "travel",
      name: "Travel",
      description: "Business travel expenses",
      taxDeductible: true,
      icon: "✈️",
      subcategories: ["flights", "hotels", "car_rental", "gas", "parking"],
      keywords: ["travel", "flight", "hotel", "rental", "gas", "parking"],
      isActive: true,
      sortOrder: 2,
    },
    {
      categoryId: "meals",
      name: "Meals & Entertainment",
      description: "Business meals and entertainment expenses",
      taxDeductible: true,
      icon: "🍽️",
      subcategories: ["client_meals", "team_meals", "conferences"],
      keywords: ["meal", "restaurant", "food", "entertainment", "conference"],
      isActive: true,
      sortOrder: 3,
    },
    {
      categoryId: "utilities",
      name: "Utilities",
      description: "Office utilities and services",
      taxDeductible: true,
      icon: "💡",
      subcategories: ["electricity", "internet", "phone", "water"],
      keywords: [
        "utility",
        "electric",
        "internet",
        "phone",
        "water",
        "service",
      ],
      isActive: true,
      sortOrder: 4,
    },
    {
      categoryId: "marketing",
      name: "Marketing & Advertising",
      description: "Marketing and advertising expenses",
      taxDeductible: true,
      icon: "📢",
      subcategories: ["online_ads", "print_ads", "promotional_materials"],
      keywords: ["marketing", "advertising", "promotion", "ads", "campaign"],
      isActive: true,
      sortOrder: 5,
    },
    {
      categoryId: "professional_services",
      name: "Professional Services",
      description: "Legal, accounting, and consulting services",
      taxDeductible: true,
      icon: "⚖️",
      subcategories: ["legal", "accounting", "consulting"],
      keywords: [
        "legal",
        "accounting",
        "consulting",
        "professional",
        "service",
      ],
      isActive: true,
      sortOrder: 6,
    },
    {
      categoryId: "equipment",
      name: "Equipment",
      description: "Business equipment and machinery",
      taxDeductible: true,
      icon: "🔧",
      subcategories: ["computers", "machinery", "tools"],
      keywords: ["equipment", "machinery", "tools", "computer", "hardware"],
      isActive: true,
      sortOrder: 7,
    },
    {
      categoryId: "insurance",
      name: "Insurance",
      description: "Business insurance premiums",
      taxDeductible: true,
      icon: "🛡️",
      subcategories: ["liability", "property", "health"],
      keywords: ["insurance", "premium", "liability", "property", "coverage"],
      isActive: true,
      sortOrder: 8,
    },
    {
      categoryId: "rent",
      name: "Rent, Lease & Mortgage",
      description:
        "Office rent, lease payments, mortgage, and property expenses",
      taxDeductible: true,
      icon: "🏢",
      subcategories: [
        "office_rent",
        "equipment_lease",
        "vehicle_lease",
        "storage",
        "mortgage",
        "property_tax",
      ],
      keywords: [
        "rent",
        "lease",
        "office",
        "property",
        "monthly",
        "space",
        "mortgage",
        "loan",
        "payment",
        "building",
      ],
      isActive: true,
      sortOrder: 9,
    },
    {
      categoryId: "other",
      name: "Other",
      description: "Other business expenses",
      taxDeductible: true,
      icon: "📋",
      subcategories: ["miscellaneous"],
      keywords: ["other", "miscellaneous", "various"],
      isActive: true,
      sortOrder: 99,
    },
  ];

  try {
    const batch = db.batch();

    categories.forEach((category: CategoryDocument) => {
      const ref = db.collection("categories").doc(category.categoryId);
      batch.set(ref, category);
      console.log(`   ✓ Prepared category: ${category.name}`);
    });

    await batch.commit();
    console.log(
      `\n✅ Successfully initialized ${categories.length} master categories!`
    );

    // Verify the categories were created
    const categoriesSnapshot = await db.collection("categories").get();
    console.log(`📊 Total categories in database: ${categoriesSnapshot.size}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing categories:", error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  console.log("🚀 Starting category initialization...");
  initializeMasterCategories();
}

export { initializeMasterCategories };
