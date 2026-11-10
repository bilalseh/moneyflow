import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';

import { MobileMenu } from '@/app/MobileMenu';
import { MOBILE_KEYS, NAV_ITEMS, type NavItem } from '@/app/navItems';
import { Icon } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { Logo } from '@/components/Logo';
import { cn } from '@/components/ui/cn';
import { QuickAddButton, QuickAddHost } from '@/features/transactions/QuickAdd';
import { useRecurringSync } from '@/features/transactions/useRecurringSync';
import { UserMenu } from '@/app/UserMenu';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
    isActive
      ? 'bg-brand-soft text-brand-strong'
      : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  );

export function AppLayout() {
  const { t } = useTranslation();
  useRecurringSync();
  const mobile = NAV_ITEMS.filter((i) => MOBILE_KEYS.includes(i.key));

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="border-line bg-surface-raised no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-e p-4 lg:flex">
        <Logo className="mb-6 px-2" />
        <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.key} to={item.to} end={item.end ?? false} className={linkClass}>
              <Icon name={item.icon} />
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-3">
          <QuickAddButton variant="sidebar" />
          <LanguageSwitch />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-line bg-surface-raised/90 no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur lg:justify-end">
          <div className="flex items-center gap-1 lg:hidden">
            <MobileMenu />
            <Logo />
          </div>
          <UserMenu />
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6 lg:pb-10">
          <Outlet />
        </div>
      </div>

      <nav
        aria-label={t('nav.label')}
        className="border-line bg-surface-raised no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {mobile.slice(0, 2).map((item) => (
          <MobileLink key={item.key} item={item} />
        ))}
        <div className="flex items-center justify-center">
          <QuickAddButton variant="fab" />
        </div>
        {mobile.slice(2).map((item) => (
          <MobileLink key={item.key} item={item} />
        ))}
      </nav>
      <QuickAddHost />
    </div>
  );
}

function MobileLink({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={item.to}
      end={item.end ?? false}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
          isActive ? 'text-brand' : 'text-ink-muted',
        )
      }
    >
      <Icon name={item.icon} />
      {t(`nav.${item.key}`)}
    </NavLink>
  );
}
