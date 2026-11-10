import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';

import { NAV_ITEMS } from '@/app/navItems';
import { Icon } from '@/components/Icon';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { cn } from '@/components/ui/cn';
import { Dialog } from '@/components/ui/Dialog';

/** Full navigation for phones, where the bottom bar only fits four destinations. */
export function MobileMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="text-ink-muted hover:bg-surface-sunken rounded-md p-1.5 lg:hidden"
        aria-label={t('nav.menu')}
        aria-haspopup="dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Icon name="more" />
      </button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        title={t('nav.more')}
        variant="sheet"
      >
        <nav aria-label={t('nav.label')} className="grid grid-cols-2 gap-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              end={item.end ?? false}
              onClick={() => {
                setOpen(false);
              }}
              className={({ isActive }) =>
                cn(
                  'border-line flex items-center gap-2 rounded-lg border p-3 text-sm font-medium',
                  isActive
                    ? 'border-brand bg-brand-soft text-brand-strong'
                    : 'hover:bg-surface-sunken',
                )
              }
            >
              <Icon name={item.icon} />
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4">
          <LanguageSwitch />
        </div>
      </Dialog>
    </>
  );
}
