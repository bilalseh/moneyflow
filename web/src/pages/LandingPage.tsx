import { useTranslation } from 'react-i18next';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';

const FEATURE_KEYS = ['health', 'plan', 'coach'] as const;

export function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <Logo />
        <LanguageSwitch />
      </header>

      <section className="flex flex-1 flex-col items-start justify-center gap-6 py-16 sm:py-24">
        <p className="text-brand text-sm font-medium uppercase tracking-wide">{t('app.tagline')}</p>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {t('landing.headline')}
        </h1>
        <p className="text-ink-muted max-w-2xl text-pretty text-lg">{t('landing.subhead')}</p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled
            title={t('landing.comingSoon')}
            className="bg-brand hover:bg-brand-strong inline-flex items-center rounded-lg px-5 py-2.5 font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('landing.signIn')}
          </button>
          <button
            type="button"
            disabled
            title={t('landing.comingSoon')}
            className="border-line bg-surface-raised text-ink hover:border-brand inline-flex items-center rounded-lg border px-5 py-2.5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('landing.tryDemo')}
          </button>
          <span className="text-ink-muted text-sm">{t('landing.comingSoon')}</span>
        </div>
      </section>

      <section aria-label="Features" className="grid gap-4 pb-12 sm:grid-cols-3">
        {FEATURE_KEYS.map((key) => (
          <article
            key={key}
            className="rounded-card border-line bg-surface-raised border p-5 shadow-sm"
          >
            <h2 className="font-semibold">{t(`landing.features.${key}.title`)}</h2>
            <p className="text-ink-muted mt-2 text-sm">{t(`landing.features.${key}.body`)}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
