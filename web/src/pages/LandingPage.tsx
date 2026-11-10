import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon, type IconName } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { useAuthStore } from '@/features/auth/authStore';
import { useStartSession } from '@/features/auth/useStartSession';

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'health', icon: 'heart' },
  { key: 'plan', icon: 'target' },
  { key: 'simulator', icon: 'chart' },
  { key: 'daily', icon: 'list' },
  { key: 'coach', icon: 'sparkles' },
  { key: 'private', icon: 'card' },
];

export function LandingPage() {
  const { t } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const { start, pending } = useStartSession();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        <nav aria-label={t('landing.navLabel')} className="flex items-center gap-4 text-sm">
          <Link to="/pricing" className="text-ink-muted hover:text-ink font-medium">
            {t('landing.pricing')}
          </Link>
          <LanguageSwitch />
        </nav>
      </header>

      <section className="flex flex-col items-start gap-6 py-14 sm:py-20">
        <p className="text-brand text-sm font-medium uppercase tracking-wide">{t('app.tagline')}</p>
        <h1 className="max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
          {t('landing.headline')}
        </h1>
        <p className="text-ink-muted max-w-2xl text-pretty text-lg">{t('landing.subhead')}</p>

        {status === 'signedIn' ? (
          <ButtonLink to="/app" size="lg">
            {t('landing.openApp')}
          </ButtonLink>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              size="lg"
              loading={pending === 'demo'}
              disabled={pending !== null}
              onClick={() => void start('demo')}
            >
              {t('landing.tryDemo')}
            </Button>
            <Button
              size="lg"
              variant="secondary"
              loading={pending === 'google'}
              disabled={pending !== null}
              onClick={() => void start('google')}
            >
              {t('landing.signIn')}
            </Button>
            <Button
              size="lg"
              variant="ghost"
              loading={pending === 'guest'}
              disabled={pending !== null}
              onClick={() => void start('guest')}
            >
              {t('landing.startGuest')}
            </Button>
          </div>
        )}
        <p className="text-ink-muted text-sm">{t('landing.demoNote')}</p>
      </section>

      <section aria-labelledby="features-title" className="pb-12">
        <h2 id="features-title" className="sr-only">
          {t('landing.featuresTitle')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ key, icon }) => (
            <article
              key={key}
              className="rounded-card border-line bg-surface-raised border p-5 shadow-sm"
            >
              <Icon name={icon} className="text-brand size-6" />
              <h3 className="mt-3 font-semibold">{t(`landing.features.${key}.title`)}</h3>
              <p className="text-ink-muted mt-2 text-sm">{t(`landing.features.${key}.body`)}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-line text-ink-muted flex flex-wrap items-center gap-x-6 gap-y-2 border-t py-6 text-sm">
        <span>© 2026 {t('app.name')}</span>
        <Link to="/privacy" className="hover:text-ink">
          {t('landing.privacy')}
        </Link>
        <Link to="/pricing" className="hover:text-ink">
          {t('landing.pricing')}
        </Link>
        <a
          href="https://github.com/bilalseh/moneyflow"
          className="hover:text-ink"
          rel="noreferrer"
          target="_blank"
        >
          {t('landing.source')}
        </a>
      </footer>
    </div>
  );
}
