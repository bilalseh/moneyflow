import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/toast';
import { useAuthStore } from '@/features/auth/authStore';
import { startCheckout } from '@/features/billing/billingActions';
import { ApiError } from '@/lib/api';

const FREE = ['budget', 'score', 'simulator', 'import', 'ai20', 'export'] as const;
const PRO = ['everything', 'ai200', 'household', 'priority'] as const;

export function PricingPage() {
  const { t, i18n } = useTranslation();
  const status = useAuthStore((s) => s.status);
  const [pending, setPending] = useState(false);

  const upgrade = async () => {
    setPending(true);
    try {
      await startCheckout(i18n.language.startsWith('ar') ? 'ar' : 'en');
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.code === 'billing_not_configured'
          ? t('pricing.notConfigured')
          : t('pricing.failed'),
      );
      setPending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <header className="mb-10 flex items-center justify-between">
        <Link to="/" aria-label={t('notFound.home')}>
          <Logo />
        </Link>
        <LanguageSwitch />
      </header>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('pricing.title')}</h1>
      <p className="text-ink-muted mt-2 max-w-2xl">{t('pricing.subtitle')}</p>
      <div
        role="note"
        className="border-warning/40 bg-warning-soft mt-6 flex items-start gap-3 rounded-lg border p-4 text-sm"
      >
        <Icon name="alert" className="text-warning mt-0.5" />
        <p>
          <strong>{t('pricing.testModeTitle')}</strong> {t('pricing.testModeBody')}{' '}
          <code className="bg-surface-raised rounded px-1.5 py-0.5 font-mono" dir="ltr">
            4242 4242 4242 4242
          </code>
        </p>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card className="flex flex-col">
          <h2 className="text-lg font-semibold">{t('pricing.free.name')}</h2>
          <p className="mt-2">
            <span className="text-4xl font-bold">{t('pricing.free.price')}</span>
          </p>
          <p className="text-ink-muted mt-1 text-sm">{t('pricing.free.tagline')}</p>
          <ul className="mt-6 flex-1 space-y-2 text-sm">
            {FREE.map((k) => (
              <li key={k} className="flex gap-2">
                <Icon name="check" className="text-positive size-4" />
                {t(`pricing.free.features.${k}`)}
              </li>
            ))}
          </ul>
          <ButtonLink
            to={status === 'signedIn' ? '/app' : '/'}
            variant="secondary"
            className="mt-6"
          >
            {status === 'signedIn' ? t('pricing.free.current') : t('pricing.free.cta')}
          </ButtonLink>
        </Card>
        <Card className="border-brand ring-brand/20 flex flex-col ring-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('pricing.pro.name')}</h2>
            <Badge tone="brand">{t('pricing.pro.badge')}</Badge>
          </div>
          <p className="mt-2">
            <span className="text-4xl font-bold">{t('pricing.pro.price')}</span>{' '}
            <span className="text-ink-muted">{t('pricing.pro.period')}</span>
          </p>
          <p className="text-ink-muted mt-1 text-sm">{t('pricing.pro.tagline')}</p>
          <ul className="mt-6 flex-1 space-y-2 text-sm">
            {PRO.map((k) => (
              <li key={k} className="flex gap-2">
                <Icon name="check" className="text-positive size-4" />
                {t(`pricing.pro.features.${k}`)}
              </li>
            ))}
          </ul>
          {status === 'signedIn' ? (
            <Button className="mt-6" loading={pending} onClick={() => void upgrade()}>
              {t('pricing.pro.cta')}
            </Button>
          ) : (
            <ButtonLink to="/" className="mt-6">
              {t('pricing.pro.signInFirst')}
            </ButtonLink>
          )}
        </Card>
      </div>
      <p className="text-ink-muted mt-8 text-sm">{t('pricing.footnote')}</p>
    </div>
  );
}
