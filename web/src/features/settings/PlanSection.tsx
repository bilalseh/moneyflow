import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge, ProgressBar } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/toast';
import { queryKeys } from '@/data/hooks';
import { useSessionUser } from '@/features/auth/authStore';
import { cancelSubscription } from '@/features/billing/billingActions';
import { usePlan } from '@/features/billing/usePlan';
import { useFormatters } from '@/lib/format';

export function PlanSection() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const plan = usePlan();
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const [cancelling, setCancelling] = useState(false);
  const usage = plan.data?.usage;

  const cancel = async () => {
    if (!window.confirm(t('settings.plan.confirmCancel'))) return;
    setCancelling(true);
    try {
      await cancelSubscription();
      await client.invalidateQueries({ queryKey: queryKeys.me(uid) });
      toast.success(t('settings.plan.cancelled'));
    } catch {
      toast.error(t('settings.plan.cancelFailed'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.plan.title')}
        action={
          plan.data && (
            <Badge tone={plan.data.plan === 'pro' ? 'brand' : 'neutral'}>
              {plan.data.plan === 'pro' ? 'Pro' : t('settings.plan.free')}
            </Badge>
          )
        }
      />
      {plan.isError ? (
        <p className="text-ink-muted text-sm">{t('settings.plan.unavailable')}</p>
      ) : usage ? (
        <div className="space-y-2">
          <p className="text-sm">
            {t('settings.plan.usage', { used: usage.used, limit: usage.limit })}
          </p>
          <ProgressBar
            value={usage.used}
            max={usage.limit}
            label={t('settings.plan.usageLabel')}
            tone={usage.used >= usage.limit ? 'warning' : 'brand'}
          />
          <p className="text-ink-muted text-xs">
            {t('settings.plan.resets', {
              time: new Date(usage.resetsAt).toLocaleTimeString(fmt.locale, {
                hour: '2-digit',
                minute: '2-digit',
              }),
            })}
          </p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {plan.data?.plan === 'pro' ? (
          <Button variant="secondary" loading={cancelling} onClick={() => void cancel()}>
            {t('settings.plan.cancel')}
          </Button>
        ) : (
          <ButtonLink to="/pricing">{t('settings.plan.upgrade')}</ButtonLink>
        )}
      </div>
      <p className="text-ink-muted mt-3 text-xs">{t('settings.plan.testNote')}</p>
    </Card>
  );
}
