// Receipt limits configuration
export const getReceiptLimits = () => ({
  free: parseInt(process.env.FREE_TIER_MAX_RECEIPTS || "10", 10),
  starter: parseInt(process.env.STARTER_TIER_MAX_RECEIPTS || "50", 10),
  growth: parseInt(process.env.GROWTH_TIER_MAX_RECEIPTS || "150", 10),
  professional: parseInt(process.env.PROFESSIONAL_TIER_MAX_RECEIPTS || "-1", 10)
});
