import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';

import { useAuthStore } from '@/features/auth/authStore';
import { PageLoader } from '@/components/ui/PageLoader';

export function RequireAuth({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();
  if (status === 'loading') return <PageLoader />;
  if (status === 'signedOut')
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
