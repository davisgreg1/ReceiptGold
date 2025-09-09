/**
 * Format a number as currency with proper thousands separators
 * Abbreviates amounts over $999,999.99 (e.g., $1M, $1.2M, $1.23B)
 * @param amount - The amount to format
 * @param currency - The currency code (default: 'USD')
 * @returns Formatted currency string
 */
export const formatCurrency = (amount: number | null | undefined, currency: string = 'USD'): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '$0.00';
  }

  // For amounts $1M and above, use abbreviated format
  if (Math.abs(amount) >= 1000000) {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    
    if (absAmount >= 1000000000) {
      // Billions
      const billions = amount / 1000000000;
      return `${sign}$${billions.toFixed(billions >= 10 ? 1 : 2)}B`;
    } else {
      // Millions
      const millions = amount / 1000000;
      return `${sign}$${millions.toFixed(millions >= 10 ? 1 : 2)}M`;
    }
  }

  // For amounts under $1M, use standard formatting
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a number with thousands separators but without currency symbol
 * @param amount - The amount to format
 * @returns Formatted number string
 */
export const formatNumber = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0';
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};
