import { useTranslation } from 'react-i18next';

import { Icon } from '@/components/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export function CoachPrompt() {
  const { t } = useTranslation();
  return (
    <Card className="bg-brand-soft border-brand/20 flex flex-col gap-3">
      <Icon name="sparkles" className="text-brand-strong size-6" />
      <h2 className="text-brand-strong font-semibold">{t('dashboard.coach.title')}</h2>
      <p className="text-ink-muted text-sm">{t('dashboard.coach.body')}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        <ButtonLink to="/app/coach" size="sm">
          {t('dashboard.coach.ask')}
        </ButtonLink>
        <ButtonLink to="/app/checkin" size="sm" variant="secondary">
          {t('dashboard.coach.checkin')}
        </ButtonLink>
      </div>
    </Card>
  );
}
