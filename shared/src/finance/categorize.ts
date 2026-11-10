import type { CategoryId } from '../categories';

/**
 * Deterministic keyword rules. They categorize instantly and offline, and are
 * the fallback whenever the AI suggestion service is unavailable. The AI only
 * improves on these; it never overrides what the user picked.
 */
const RULES: readonly { categoryId: CategoryId; pattern: RegExp }[] = [
  { categoryId: 'housing', pattern: /\b(rent|mortgage|landlord|hoa)\b|إيجار|ايجار/i },
  {
    categoryId: 'utilities',
    pattern:
      /\b(electric|electricity|water|gas bill|internet|wifi|fiber|edl|dewa|telecom|mobile bill|phone bill|alfa|touch|etisalat|du)\b|كهرباء|مياه|انترنت/i,
  },
  {
    categoryId: 'groceries',
    pattern:
      /\b(grocery|groceries|supermarket|carrefour|spinneys|lulu|aldi|lidl|tesco|walmart|whole foods|costco|market)\b|سوبرماركت|بقالة/i,
  },
  {
    categoryId: 'transport',
    pattern:
      /\b(uber|careem|bolt|lyft|taxi|fuel|petrol|gasoline|shell|total|parking|metro|bus|train|toll)\b|بنزين|تاكسي|مواصلات/i,
  },
  {
    categoryId: 'health',
    pattern: /\b(pharmacy|clinic|hospital|doctor|dental|dentist|medical|lab)\b|صيدلية|مستشفى|طبيب/i,
  },
  { categoryId: 'insurance', pattern: /\b(insurance|insurer|axa|allianz|metlife)\b|تأمين/i },
  {
    categoryId: 'education',
    pattern: /\b(tuition|school|university|course|udemy|coursera|books?)\b|جامعة|مدرسة/i,
  },
  {
    categoryId: 'debt',
    pattern: /\b(loan|repayment|installment|credit card payment|card payment)\b|قرض|قسط/i,
  },
  {
    categoryId: 'subscriptions',
    pattern:
      /\b(netflix|spotify|disney|hulu|youtube premium|apple music|icloud|google one|prime video|shahid|osn|anghami|chatgpt|adobe|microsoft 365|gym membership)\b/i,
  },
  {
    categoryId: 'dining',
    pattern:
      /\b(restaurant|cafe|coffee|starbucks|mcdonald|kfc|burger|pizza|talabat|deliveroo|toters|zomato|bakery|bar)\b|مطعم|قهوة/i,
  },
  {
    categoryId: 'shopping',
    pattern: /\b(amazon|noon|ikea|zara|h&m|mall|store|shop|shein|aliexpress|electronics)\b|تسوق/i,
  },
  {
    categoryId: 'entertainment',
    pattern: /\b(cinema|movie|vox|concert|steam|playstation|xbox|game|tickets?)\b|سينما/i,
  },
  {
    categoryId: 'travel',
    pattern:
      /\b(airline|airways|flight|hotel|airbnb|booking\.com|expedia|emirates|mea)\b|فندق|طيران/i,
  },
  {
    categoryId: 'personal',
    pattern: /\b(salon|barber|spa|gym|fitness|cosmetics|sephora)\b|صالون/i,
  },
  { categoryId: 'gifts', pattern: /\b(gift|donation|charity|flowers)\b|هدية|تبرع/i },
  { categoryId: 'savings', pattern: /\b(savings|transfer to savings|deposit to savings)\b|ادخار/i },
];

const INCOME =
  /\b(salary|payroll|wage|bonus|freelance|invoice|refund|dividend|interest earned)\b|راتب|معاش/i;

export interface CategorySuggestion {
  categoryId: CategoryId;
  confidence: number;
}

export function suggestCategory(
  description: string,
  type: 'expense' | 'income',
): CategorySuggestion {
  if (type === 'income')
    return { categoryId: 'income', confidence: INCOME.test(description) ? 0.9 : 0.6 };
  const rule = RULES.find((r) => r.pattern.test(description));
  return rule
    ? { categoryId: rule.categoryId, confidence: 0.75 }
    : { categoryId: 'other', confidence: 0.2 };
}
