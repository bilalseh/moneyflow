import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate } from 'react-router';

import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { ErrorState } from '@/components/ui/Feedback';
import { PageLoader } from '@/components/ui/PageLoader';
import { useProfile } from '@/data/hooks';
import { CurrencyStep } from '@/features/onboarding/steps/CurrencyStep';
import { DebtsStep } from '@/features/onboarding/steps/DebtsStep';
import { FixedCostsStep } from '@/features/onboarding/steps/FixedCostsStep';
import { GoalsStep } from '@/features/onboarding/steps/GoalsStep';
import { IncomeStep } from '@/features/onboarding/steps/IncomeStep';
import { ReviewStep } from '@/features/onboarding/steps/ReviewStep';
import { SavingsStep } from '@/features/onboarding/steps/SavingsStep';
import { useWizard, type WizardStep } from '@/features/onboarding/wizardStore';

const STEP_COMPONENTS: Record<WizardStep, () => React.JSX.Element> = {
  currency: CurrencyStep,
  income: IncomeStep,
  fixedCosts: FixedCostsStep,
  debts: DebtsStep,
  savings: SavingsStep,
  goals: GoalsStep,
  review: ReviewStep,
};

export function OnboardingPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  const step = useWizard((s) => s.step);

  useEffect(() => {
    document.title = `${t('onboarding.pageTitle')} · ${t('app.name')}`;
  }, [t]);

  if (profile.isLoading) return <PageLoader />;
  if (profile.error)
    return (
      <ErrorState error={profile.error} onRetry={() => void profile.refetch()} className="m-6" />
    );
  if (profile.data?.onboardingCompleted === true) return <Navigate to="/app" replace />;

  const Step = STEP_COMPONENTS[step];
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-6 sm:px-6">
      <header className="mb-8 flex items-center justify-between">
        <Logo />
        <LanguageSwitch />
      </header>
      <Step />
    </div>
  );
}
