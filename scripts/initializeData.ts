const admin = require("firebase-admin");
const serviceAccount = require("../db/ReceiptGoldAdminReceipt.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

async function initializeMasterCategories() {
  const categories = [
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
      description: "Office rent, lease payments, mortgage, and property expenses",
      taxDeductible: true,
      icon: "🏢",
      subcategories: ["office_rent", "equipment_lease", "vehicle_lease", "storage", "mortgage", "property_tax"],
      keywords: ["rent", "lease", "office", "property", "monthly", "space", "mortgage", "loan", "payment", "building"],
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

  const batch = db.batch();

  categories.forEach((category) => {
    const ref = db.collection("categories").doc(category.categoryId);
    batch.set(ref, category);
  });

  await batch.commit();
  console.log("Master categories initialized");
}

initializeMasterCategories().catch(console.error);
