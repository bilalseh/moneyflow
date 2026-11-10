import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { Icon } from '@/components/Icon';
import { Badge } from '@/components/ui/Feedback';
import { useProfile } from '@/data/hooks';
import { signOutUser } from '@/features/auth/authActions';
import { useSessionUser } from '@/features/auth/authStore';
import { usePlan } from '@/features/billing/usePlan';

export function UserMenu() {
  const { t } = useTranslation();
  const user = useSessionUser();
  const profile = useProfile();
  const plan = usePlan();
  const client = useQueryClient();
  const navigate = useNavigate();
  const name =
    [profile.data?.displayName, user.displayName].find((n): n is string => Boolean(n)) ??
    t('user.guest');

  return (
    <div className="flex items-center gap-2 text-sm">
      {profile.data?.isDemo === true && <Badge tone="warning">{t('user.demoBadge')}</Badge>}
      {plan.data?.plan === 'pro' && <Badge tone="brand">Pro</Badge>}
      <Link
        to="/app/settings"
        className="text-ink-muted hover:text-ink flex items-center gap-2 font-medium"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="size-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="bg-brand-soft text-brand-strong flex size-7 items-center justify-center rounded-full text-xs font-bold">
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-32 truncate sm:inline">{name}</span>
      </Link>
      <button
        type="button"
        className="text-ink-muted hover:bg-surface-sunken hover:text-ink rounded-md p-1.5"
        aria-label={t('user.signOut')}
        title={t('user.signOut')}
        onClick={() => {
          void signOutUser().then(() => {
            client.clear();
            void navigate('/');
          });
        }}
      >
        <Icon name="logout" />
      </button>
    </div>
  );
}
