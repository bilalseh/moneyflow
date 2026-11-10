import { type ReactNode } from 'react';
import { Navigate } from 'react-router';

import { ErrorState } from '@/components/ui/Feedback';
import { PageLoader } from '@/components/ui/PageLoader';
import { useProfile } from '@/data/hooks';

/** Sends people without a finished profile to the setup wizard. */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const profile = useProfile();
  if (profile.isLoading) return <PageLoader />;
  if (profile.error)
    return (
      <ErrorState error={profile.error} onRetry={() => void profile.refetch()} className="m-6" />
    );
  if (profile.data?.onboardingCompleted !== true) return <Navigate to="/app/onboarding" replace />;
  return <>{children}</>;
}
