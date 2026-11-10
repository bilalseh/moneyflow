import { todayIso, type CategoryId } from '@moneyflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Badge } from '@/components/ui/Feedback';
import { toast } from '@/components/ui/toast';
import { commitWrites } from '@/data/firestore';
import { queryKeys } from '@/data/hooks';
import { useSessionUser } from '@/features/auth/authStore';
import { buildOnboardingWrites } from '@/features/onboarding/buildOnboarding';
import { StepShell } from '@/features/onboarding/StepShell';
import { effectiveData, useWizard, type WizardStep } from '@/features/onboarding/wizardStore';
import { useFormatters } from '@/lib/format';
import { nowIso } from '@/lib/ids';

function Section({
  title,
  step,
  skipped,
  children,
}: {
  title: string;
  step: WizardStep;
  skipped: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const goTo = useWizard((s) => s.goTo);
  return (
    <section className="border-line bg-surface-raised rounded-card border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {skipped && <Badge>{t('onboarding.review.skipped')}</Badge>}
          <button
            type="button"
            className="text-brand text-sm font-medium hover:underline"
            onClick={() => {
              goTo(step);
            }}
          >
            {t('common.edit')}
            <span className="sr-only"> {title}</span>
          </button>
        </div>
      </div>
      <div className="text-ink-muted text-sm">{children}</div>
    </section>
  );
}

export function ReviewStep() {
  const { t, i18n } = useTranslation();
  const fmt = useFormatters();
  const user = useSessionUser();
  const client = useQueryClient();
  const navigate = useNavigate();
  const { data, complete, setFinishing } = useWizard();
  const [saving, setSaving] = useState(false);
  const currency = data.currency ?? 'USD';
  const d = effectiveData(data);
  const skipped = new Set(data.skipped);
  const money = (n: number | null) => fmt.money(n ?? 0, currency);
  const list = (items: string[]) =>
    items.length === 0 ? (
      <p>{t('onboarding.review.nothing')}</p>
    ) : (
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ul>
    );

  const finish = async () => {
    setSaving(true);
    try {
      const ops = buildOnboardingWrites(d, {
        locale: i18n.language.startsWith('ar') ? 'ar' : 'en',
        displayName: user.displayName ?? '',
        today: todayIso(),
        now: nowIso(),
        labelFor: (id: CategoryId) => t(`categories.${id}`),
        defaultIncomeName: t('onboarding.income.defaultName'),
      });
      setFinishing(true);
      await commitWrites(user.uid, ops);
      await client.invalidateQueries({ queryKey: queryKeys.user(user.uid) });
      complete();
      void navigate('/app/health', { replace: true, state: { welcome: true } });
    } catch (error) {
      setFinishing(false);
      toast.error(t('onboarding.review.saveFailed'));
      console.error(error);
      setSaving(false);
    }
  };

  return (
    <StepShell
      step="review"
      title={t('onboarding.review.title')}
      hint={t('onboarding.review.hint')}
      submitLabel={t('onboarding.review.finish')}
      submitting={saving}
      onSubmit={(e) => {
        e.preventDefault();
        void finish();
      }}
    >
      <Section title={t('onboarding.review.currency')} step="currency" skipped={false}>
        <p>{currency}</p>
      </Section>
      <Section title={t('onboarding.review.income')} step="income" skipped={false}>
        {list(
          d.incomes
            .filter((x) => x.amount)
            .map(
              (x) =>
                `${x.name || t('onboarding.income.defaultName')}: ${money(x.amount)} (${t(`onboarding.income.${x.kind}`)})`,
            ),
        )}
      </Section>
      <Section
        title={t('onboarding.review.fixedCosts')}
        step="fixedCosts"
        skipped={skipped.has('fixedCosts')}
      >
        {list(
          d.fixedCosts
            .filter((x) => x.amount)
            .map((x) => `${x.name || t(`categories.${x.categoryId}`)}: ${money(x.amount)}`),
        )}
      </Section>
      <Section title={t('onboarding.review.debts')} step="debts" skipped={skipped.has('debts')}>
        {list(
          d.debts.map(
            (x) =>
              `${x.name}: ${money(x.balance)} · ${fmt.percent((x.aprBps ?? 0) / 10000, 2)} · ${t('onboarding.review.minPayment', { amount: money(x.minPayment) })}`,
          ),
        )}
      </Section>
      <Section
        title={t('onboarding.review.savings')}
        step="savings"
        skipped={skipped.has('savings')}
      >
        <p>
          {t('onboarding.savings.savingsBalance')}: {money(d.savings.savingsBalance)} ·{' '}
          {t('onboarding.savings.emergencyFund')}: {money(d.savings.emergencyFund)}
        </p>
      </Section>
      <Section title={t('onboarding.review.goals')} step="goals" skipped={skipped.has('goals')}>
        {list(
          d.goals.map(
            (x) =>
              `${x.name}: ${money(x.savedAmount)} / ${money(x.targetAmount)}${x.targetDate ? ` · ${fmt.date(x.targetDate)}` : ''}`,
          ),
        )}
      </Section>
      <p className="text-ink-muted text-sm">{t('onboarding.review.recurringNote')}</p>
    </StepShell>
  );
}
