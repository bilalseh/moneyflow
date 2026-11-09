import { z } from 'zod';

/**
 * Currencies supported by Moneyflow. Minor units follow ISO 4217.
 * No live exchange rates are used; users enter a manual rate when needed.
 */
export const CURRENCIES = [
  { code: 'USD', minorUnits: 2, nameEn: 'US Dollar', nameAr: 'دولار أمريكي' },
  { code: 'EUR', minorUnits: 2, nameEn: 'Euro', nameAr: 'يورو' },
  { code: 'GBP', minorUnits: 2, nameEn: 'British Pound', nameAr: 'جنيه إسترليني' },
  { code: 'LBP', minorUnits: 0, nameEn: 'Lebanese Pound', nameAr: 'ليرة لبنانية' },
  { code: 'AED', minorUnits: 2, nameEn: 'UAE Dirham', nameAr: 'درهم إماراتي' },
  { code: 'SAR', minorUnits: 2, nameEn: 'Saudi Riyal', nameAr: 'ريال سعودي' },
  { code: 'JOD', minorUnits: 3, nameEn: 'Jordanian Dinar', nameAr: 'دينار أردني' },
  { code: 'KWD', minorUnits: 3, nameEn: 'Kuwaiti Dinar', nameAr: 'دينار كويتي' },
  { code: 'EGP', minorUnits: 2, nameEn: 'Egyptian Pound', nameAr: 'جنيه مصري' },
  { code: 'TRY', minorUnits: 2, nameEn: 'Turkish Lira', nameAr: 'ليرة تركية' },
  { code: 'CAD', minorUnits: 2, nameEn: 'Canadian Dollar', nameAr: 'دولار كندي' },
  { code: 'AUD', minorUnits: 2, nameEn: 'Australian Dollar', nameAr: 'دولار أسترالي' },
] as const;

export type CurrencyInfo = (typeof CURRENCIES)[number];
export type CurrencyCode = CurrencyInfo['code'];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as unknown as readonly [
  CurrencyCode,
  ...CurrencyCode[],
];

export const currencyCodeSchema = z.enum(CURRENCY_CODES);

const byCode = new Map<string, CurrencyInfo>(CURRENCIES.map((c) => [c.code, c]));

export function getCurrency(code: CurrencyCode): CurrencyInfo {
  const found = byCode.get(code);
  if (!found) {
    throw new Error(`Unsupported currency: ${code}`);
  }
  return found;
}

export function isCurrencyCode(value: string): value is CurrencyCode {
  return byCode.has(value);
}
