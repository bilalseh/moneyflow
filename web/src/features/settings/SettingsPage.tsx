import { useTranslation } from 'react-i18next';

import { ErrorState } from '@/components/ui/Feedback';
import { PageHeader } from '@/components/ui/Page';
import { PageLoader } from '@/components/ui/PageLoader';
import { useProfile } from '@/data/hooks';
import { CurrencySection } from '@/features/settings/CurrencySection';
import { DataSection } from '@/features/settings/DataSection';
import { PlanSection } from '@/features/settings/PlanSection';
import { PreferencesSection } from '@/features/settings/PreferencesSection';

export function SettingsPage() {
  const { t } = useTranslation();
  const profile = useProfile();
  if (profile.isLoading) return <PageLoader />;
  if (profile.error || !profile.data)
    return <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />;
  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <PreferencesSection profile={profile.data} />
        <CurrencySection profile={profile.data} />
        <PlanSection />
        <DataSection profile={profile.data} />
      </div>
    </>
  );
}
