import { AppLayout } from '@/app/AppLayout';
import { RequireOnboarded } from '@/features/auth/RequireOnboarded';

/** Signed-in, onboarded area. Lazy-loaded so the landing page never ships Firestore. */
export function AppShell() {
  return (
    <RequireOnboarded>
      <AppLayout />
    </RequireOnboarded>
  );
}
