import type { CurrencyCode } from '@moneyflow/shared';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Icon } from '@/components/Icon';

/** Shown when some amounts are in a currency without an exchange rate, so totals leave them out. */
export function MissingRatesNotice({ currencies }: { currencies: readonly CurrencyCode[] }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="border-warning/40 bg-warning-soft mb-6 flex items-start gap-3 rounded-lg border p-3 text-sm"
    >
      <Icon name="alert" className="text-warning mt-0.5 size-5" />
      <p>
        {t('dashboard.missingRates', { currencies: currencies.join(', ') })}{' '}
        <Link to="/app/settings" className="text-brand font-medium underline">
          {t('dashboard.missingRatesLink')}
        </Link>
      </p>
    </div>
  );
}
