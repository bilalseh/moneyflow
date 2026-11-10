import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const SUPPORTED_LANGUAGES = ['en', 'ar'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

const RTL_LANGUAGES: ReadonlySet<string> = new Set(['ar']);

export function getDirection(language: string): 'ltr' | 'rtl' {
  const base = language.split('-')[0] ?? language;
  return RTL_LANGUAGES.has(base) ? 'rtl' : 'ltr';
}

type Tree = Record<string, unknown>;

/** Every locales/<lang>/<area>.json file, merged per language. Each file owns its top-level keys. */
const files = import.meta.glob<Tree>('../locales/*/*.json', { eager: true, import: 'default' });

export const translations: Record<Language, Tree> = { en: {}, ar: {} };
for (const [path, content] of Object.entries(files)) {
  const lang = /locales\/(\w+)\//.exec(path)?.[1] as Language | undefined;
  if (lang && lang in translations) Object.assign(translations[lang], content);
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: translations.en },
      ar: { translation: translations.ar },
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
