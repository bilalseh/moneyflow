import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import ar from '@/locales/ar.json';
import en from '@/locales/en.json';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar']);

export function getDirection(language: string): 'ltr' | 'rtl' {
  const base = language.split('-')[0] ?? language;
  return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
    },
    fallbackLng: 'en',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'moneyflow.language',
      caches: ['localStorage'],
    },
  });

export default i18n;
