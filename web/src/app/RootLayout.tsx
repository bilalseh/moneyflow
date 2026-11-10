import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';

import { DisclaimerBanner } from '@/components/DisclaimerBanner';
import { getDirection } from '@/lib/i18n';

export function RootLayout() {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = i18n.language;
    root.dir = getDirection(i18n.language);
  }, [i18n.language]);

  return (
    <div className="bg-surface text-ink flex min-h-dvh flex-col">
      <a
        href="#main"
        className="focus:bg-brand no-print sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-white"
      >
        {t('common.skipToContent')}
      </a>
      <DisclaimerBanner />
      <main id="main" className="flex flex-1 flex-col">
        <Outlet />
      </main>
    </div>
  );
}
