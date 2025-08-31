import { ReceiptData } from './ReceiptOCRService';

export interface TaxDeductibleAnalysis {
  isDeductible: boolean;
  confidence: number;
  reasoning: string;
  category: string;
  suggestedPercentage: number;
}

class TaxDeductibleService {
  /**
   * Determines if a receipt is tax deductible based on OCR data and merchant information
   */
  async determineTaxDeductibility(ocrData: ReceiptData, category?: string): Promise<TaxDeductibleAnalysis> {
    try {
      // Use OpenAI to analyze tax deductibility
      const analysis = await this.analyzeWithAI(ocrData, category);
      return analysis;
    } catch (error) {
      console.error('Error determining tax deductibility:', error);
      // Fallback to rule-based analysis
      return this.fallbackAnalysis(ocrData, category);
    }
  }

  private async analyzeWithAI(ocrData: ReceiptData, category?: string): Promise<TaxDeductibleAnalysis> {
    const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `Analyze this receipt for tax deductibility:

Merchant: ${ocrData.merchantName || 'Unknown'}
Total Amount: $${ocrData.total || 0}
Category: ${category || 'Unknown'}
Date: ${ocrData.transactionDate || 'Unknown'}
Items: ${ocrData.items?.map(item => `${item.description} - $${item.price}`).join(', ') || 'No items found'}

Determine if this receipt is likely tax deductible for business purposes. Consider:
1. Is this a legitimate business expense?
2. What percentage would typically be deductible?
3. What type of business category does this fall under?

Common deductible categories include:
- Office supplies, equipment, software
- Business meals (50% deductible)
- Travel expenses
- Professional services
- Marketing and advertising
- Business insurance
- Vehicle expenses (business use)
- Training and education

Non-deductible items typically include:
- Personal meals and entertainment
- Personal clothing
- Personal transportation
- Personal groceries
- Personal healthcare

Respond in JSON format:
{
  "isDeductible": boolean,
  "confidence": number (0-100),
  "reasoning": "Brief explanation",
  "category": "business_category",
  "suggestedPercentage": number (0-100)
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a tax expert analyzing receipts for business deductibility. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const analysis = JSON.parse(content);
      
      // Validate the response
      return {
        isDeductible: Boolean(analysis.isDeductible),
        confidence: Math.min(Math.max(Number(analysis.confidence) || 0, 0), 100),
        reasoning: String(analysis.reasoning || 'AI analysis completed'),
        category: String(analysis.category || 'general'),
        suggestedPercentage: Math.min(Math.max(Number(analysis.suggestedPercentage) || 0, 0), 100),
      };
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Invalid AI response format');
    }
  }

  private fallbackAnalysis(ocrData: ReceiptData, category?: string): TaxDeductibleAnalysis {
    // Rule-based fallback analysis
    const merchantName = (ocrData.merchantName || '').toLowerCase();
    const amount = ocrData.total || 0;
    
    // Define business-likely merchants
    const businessKeywords = [
      'office', 'supply', 'depot', 'staples', 'computer', 'software',
      'hotel', 'airline', 'uber', 'lyft', 'gas', 'fuel', 'parking',
      'restaurant', 'cafe', 'coffee', 'lunch', 'dinner',
      'amazon', 'best buy', 'microsoft', 'apple', 'google',
      'fedex', 'ups', 'shipping', 'print', 'copy',
      'insurance', 'legal', 'consulting', 'professional'
    ];

    // Personal/non-deductible keywords
    const personalKeywords = [
      'grocery', 'supermarket', 'pharmacy', 'cvs', 'walgreens',
      'target', 'walmart', 'clothing', 'fashion', 'beauty',
      'medical', 'doctor', 'hospital', 'personal'
    ];

    let isDeductible = false;
    let confidence = 30; // Low confidence for rule-based
    let reasoning = 'Rule-based analysis';
    let suggestedPercentage = 0;

    // Check for business keywords
    const hasBusinessKeywords = businessKeywords.some(keyword => 
      merchantName.includes(keyword)
    );
    
    const hasPersonalKeywords = personalKeywords.some(keyword => 
      merchantName.includes(keyword)
    );

    if (hasBusinessKeywords && !hasPersonalKeywords) {
      isDeductible = true;
      confidence = 60;
      reasoning = 'Merchant appears to be business-related';
      suggestedPercentage = merchantName.includes('restaurant') || merchantName.includes('cafe') ? 50 : 100;
    } else if (category) {
      // Use category to determine deductibility
      const businessCategories = [
        'office_supplies', 'software', 'professional_services',
        'travel', 'transportation', 'business_meals', 'equipment'
      ];
      
      if (businessCategories.includes(category)) {
        isDeductible = true;
        confidence = 50;
        reasoning = 'Category suggests business expense';
        suggestedPercentage = category === 'business_meals' ? 50 : 100;
      }
    }

    // Very high amounts might be less likely to be personal
    if (amount > 500) {
      confidence = Math.min(confidence + 20, 80);
    }

    return {
      isDeductible,
      confidence,
      reasoning,
      category: category || 'general',
      suggestedPercentage,
    };
  }

}

export const taxDeductibleService = new TaxDeductibleService();
