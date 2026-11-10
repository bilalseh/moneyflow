import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';

import { AppLayout } from '@/app/AppLayout';
import { RootLayout } from '@/app/RootLayout';
import { PageLoader } from '@/components/ui/PageLoader';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { RequireOnboarded } from '@/features/auth/RequireOnboarded';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const OnboardingPage = lazy(() =>
  import('@/features/onboarding/OnboardingPage').then((m) => ({ default: m.OnboardingPage })),
);
const DashboardPage = lazy(() =>
  import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);

const page = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      {
        path: 'app',
        element: (
          <RequireAuth>
            <Outlet />
          </RequireAuth>
        ),
        children: [
          { path: 'onboarding', element: page(<OnboardingPage />) },
          {
            element: (
              <RequireOnboarded>
                <AppLayout />
              </RequireOnboarded>
            ),
            children: [
              { index: true, element: page(<DashboardPage />) },
              { path: '*', element: <Navigate to="/app" replace /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
