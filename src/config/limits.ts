// Receipt limits configuration
export const getReceiptLimits = () => ({
  starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
  growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
  professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10),
  teammate: parseInt(process.env.TEAMMATE_TIER_MAX_RECEIPTS || "-1", 10)
});
