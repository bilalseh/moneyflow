import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Icon } from '@/components/Icon';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/Feedback';
import { PageLoader } from '@/components/ui/PageLoader';
import { queryKeys } from '@/data/hooks';
import { useSessionUser } from '@/features/auth/authStore';
import { confirmCheckout } from '@/features/billing/billingActions';

/** Stripe returns here; the API verifies the session belongs to this user before switching the plan. */
export function BillingSuccessPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const { uid } = useSessionUser();
  const client = useQueryClient();
  const sessionId = params.get('session_id') ?? '';
  const valid = /^cs_test_[A-Za-z0-9_]{1,200}$/.test(sessionId);
  const confirm = useQuery({
    queryKey: ['confirm', sessionId],
    queryFn: () => confirmCheckout(sessionId),
    enabled: valid,
    retry: 1,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (confirm.isSuccess) void client.invalidateQueries({ queryKey: queryKeys.me(uid) });
  }, [confirm.isSuccess, client, uid]);

  if (!valid) return <ErrorState error={new Error(t('billing.invalidSession'))} />;
  if (confirm.isLoading) return <PageLoader label={t('billing.confirming')} />;
  if (confirm.error)
    return <ErrorState error={confirm.error} onRetry={() => void confirm.refetch()} />;

  return (
    <Card className="mx-auto max-w-lg text-center">
      <Icon name="check" className="text-positive mx-auto size-10" />
      <h1 className="mt-3 text-2xl font-bold">{t('billing.welcomeTitle')}</h1>
      <p className="text-ink-muted mt-2">{t('billing.welcomeBody')}</p>
      <ButtonLink to="/app" className="mt-6">
        {t('billing.toDashboard')}
      </ButtonLink>
    </Card>
  );
}
