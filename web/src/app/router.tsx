import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';

import { RootLayout } from '@/app/RootLayout';
import { PageLoader } from '@/components/ui/PageLoader';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { LandingPage } from '@/pages/LandingPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const AppShell = lazy(() => import('@/app/AppShell').then((m) => ({ default: m.AppShell })));
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

const CheckinPage = lazy(() =>
  import('@/features/checkin/CheckinPage').then((m) => ({ default: m.CheckinPage })),
);
const CoachPage = lazy(() =>
  import('@/features/coach/CoachPage').then((m) => ({ default: m.CoachPage })),
);
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const BillingSuccessPage = lazy(() =>
  import('@/features/billing/BillingSuccessPage').then((m) => ({ default: m.BillingSuccessPage })),
);
const ReportPage = lazy(() =>
  import('@/features/reports/ReportPage').then((m) => ({ default: m.ReportPage })),
);
const PricingPage = lazy(() =>
  import('@/features/billing/PricingPage').then((m) => ({ default: m.PricingPage })),
);
const PrivacyPage = lazy(() =>
  import('@/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);

const page = (node: ReactNode) => <Suspense fallback={<PageLoader />}>{node}</Suspense>;

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'pricing', element: page(<PricingPage />) },
      { path: 'privacy', element: page(<PrivacyPage />) },
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
            element: page(<AppShell />),
            children: [
              { index: true, element: page(<DashboardPage />) },
              { path: 'health', element: page(<HealthPage />) },
              { path: 'transactions', element: page(<TransactionsPage />) },
              { path: 'transactions/import', element: page(<ImportPage />) },
              { path: 'transactions/recurring', element: page(<RecurringPage />) },
              { path: 'subscriptions', element: page(<SubscriptionsPage />) },
              { path: 'checkin', element: page(<CheckinPage />) },
              { path: 'coach', element: page(<CoachPage />) },
              { path: 'settings', element: page(<SettingsPage />) },
              { path: 'billing/success', element: page(<BillingSuccessPage />) },
              { path: 'report/:month', element: page(<ReportPage />) },
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
