import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? 'en') as Language;

  return (
    <label className="text-ink-muted inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t('language.label')}</span>
      <select
        value={current}
        onChange={(e) => void i18n.changeLanguage(e.target.value)}
        className="border-line bg-surface-raised text-ink rounded-md border px-2 py-1 text-sm"
      >
        {SUPPORTED_LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>
            {t(`language.${lng}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
