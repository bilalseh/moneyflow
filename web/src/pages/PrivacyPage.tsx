import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';

const SECTIONS = ['stored', 'ai', 'payments', 'browser', 'control', 'notStored'] as const;

export function PrivacyPage() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = `${t('privacy.title')} · ${t('app.name')}`;
  }, [t]);
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-10 flex items-center justify-between">
        <Link to="/" aria-label={t('notFound.home')}>
          <Logo />
        </Link>
        <LanguageSwitch />
      </header>
      <h1 className="text-3xl font-bold tracking-tight">{t('privacy.title')}</h1>
      <p className="text-ink-muted mt-2">{t('privacy.intro')}</p>
      {SECTIONS.map((key) => (
        <section key={key} className="mt-8" aria-labelledby={`privacy-${key}`}>
          <h2 id={`privacy-${key}`} className="text-lg font-semibold">
            {t(`privacy.sections.${key}.title`)}
          </h2>
          <p className="text-ink-muted mt-2 leading-relaxed">{t(`privacy.sections.${key}.body`)}</p>
        </section>
      ))}
      <p className="text-ink-muted mt-10 text-sm">{t('privacy.updated')}</p>
    </div>
  );
}
