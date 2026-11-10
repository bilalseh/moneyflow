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

const HealthPage = lazy(() =>
  import('@/features/health/HealthPage').then((m) => ({ default: m.HealthPage })),
);
const PlanLayout = lazy(() =>
  import('@/features/plan/PlanLayout').then((m) => ({ default: m.PlanLayout })),
);
const BudgetTab = lazy(() =>
  import('@/features/plan/BudgetTab').then((m) => ({ default: m.BudgetTab })),
);
const GoalsTab = lazy(() =>
  import('@/features/plan/GoalsTab').then((m) => ({ default: m.GoalsTab })),
);
const DebtsTab = lazy(() =>
  import('@/features/plan/DebtsTab').then((m) => ({ default: m.DebtsTab })),
);
const SimulatorTab = lazy(() =>
  import('@/features/plan/SimulatorTab').then((m) => ({ default: m.SimulatorTab })),
);

const TransactionsPage = lazy(() =>
  import('@/features/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })),
);
const RecurringPage = lazy(() =>
  import('@/features/transactions/RecurringPage').then((m) => ({ default: m.RecurringPage })),
);
const ImportPage = lazy(() =>
  import('@/features/import/ImportPage').then((m) => ({ default: m.ImportPage })),
);
const SubscriptionsPage = lazy(() =>
  import('@/features/subscriptions/SubscriptionsPage').then((m) => ({
    default: m.SubscriptionsPage,
  })),
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
              { path: 'health', element: page(<HealthPage />) },
              { path: 'transactions', element: page(<TransactionsPage />) },
              { path: 'transactions/import', element: page(<ImportPage />) },
              { path: 'transactions/recurring', element: page(<RecurringPage />) },
              { path: 'subscriptions', element: page(<SubscriptionsPage />) },
              {
                path: 'plan',
                element: page(<PlanLayout />),
                children: [
                  { index: true, element: page(<BudgetTab />) },
                  { path: 'goals', element: page(<GoalsTab />) },
                  { path: 'debts', element: page(<DebtsTab />) },
                  { path: 'simulator', element: page(<SimulatorTab />) },
                ],
              },
              { path: '*', element: <Navigate to="/app" replace /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
