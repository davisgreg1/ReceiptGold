import { CreateBusinessRequest } from '../types/business';


export class BusinessService {
  /**
   * Validate business data
   */
  static validateBusinessData(businessData: CreateBusinessRequest): string[] {
    const errors: string[] = [];

    if (!businessData.name?.trim()) {
      errors.push('Business name is required');
    }

    if (businessData.name && businessData.name.trim().length < 2) {
      errors.push('Business name must be at least 2 characters');
    }

    if (businessData.name && businessData.name.trim().length > 100) {
      errors.push('Business name cannot exceed 100 characters');
    }

    if (!businessData.type) {
      errors.push('Business type is required');
    }

    if (businessData.taxId && businessData.taxId.trim().length > 0) {
      // Basic EIN format validation (XX-XXXXXXX)
      const einRegex = /^\d{2}-\d{7}$/;
      const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
      
      if (!einRegex.test(businessData.taxId) && !ssnRegex.test(businessData.taxId)) {
        errors.push('Tax ID must be in format XX-XXXXXXX (EIN) or XXX-XX-XXXX (SSN)');
      }
    }

    if (businessData.address) {
      const { street, city, state, zipCode } = businessData.address;
      
      if (street && street.trim().length > 0 && street.trim().length < 5) {
        errors.push('Street address must be at least 5 characters if provided');
      }
      
      if (city && city.trim().length > 0 && city.trim().length < 2) {
        errors.push('City must be at least 2 characters if provided');
      }
      
      if (state && state.trim().length > 0 && state.trim().length !== 2) {
        errors.push('State must be 2 characters (e.g., CA, NY)');
      }
      
      if (zipCode && zipCode.trim().length > 0) {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        if (!zipRegex.test(zipCode)) {
          errors.push('ZIP code must be in format XXXXX or XXXXX-XXXX');
        }
      }
    }

    return errors;
  }

  /**
   * Get business types for dropdown
   */
  static getBusinessTypes(): Array<{ value: string; label: string; description: string }> {
    return [
      {
        value: 'LLC',
        label: 'LLC',
        description: 'Limited Liability Company - Most common for small businesses'
      },
      {
        value: 'Corporation',
        label: 'Corporation',
        description: 'C-Corp or S-Corp - More formal structure'
      },
      {
        value: 'Sole Proprietorship',
        label: 'Sole Proprietorship',
        description: 'Single owner business - Simplest structure'
      },
      {
        value: 'Partnership',
        label: 'Partnership',
        description: 'Multiple owners sharing profits and losses'
      },
      {
        value: 'Other',
        label: 'Other',
        description: 'Non-profit, trust, or other business structure'
      }
    ];
  }

  /**
   * Get industry options for dropdown
   */
  static getIndustryOptions(): string[] {
    return [
      'Consulting',
      'Technology',
      'Healthcare',
      'Real Estate',
      'Retail',
      'Restaurant/Food Service',
      'Construction',
      'Manufacturing',
      'Professional Services',
      'Education',
      'Transportation',
      'Entertainment',
      'Finance',
      'Marketing/Advertising',
      'Non-profit',
      'Other'
    ];
  }
}