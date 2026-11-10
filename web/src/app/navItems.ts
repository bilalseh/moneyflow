import type { IconName } from '@/components/Icon';

export interface NavItem {
  to: string;
  key: string;
  icon: IconName;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/app', key: 'dashboard', icon: 'home', end: true },
  { to: '/app/transactions', key: 'transactions', icon: 'list' },
  { to: '/app/plan', key: 'plan', icon: 'target' },
  { to: '/app/health', key: 'health', icon: 'heart' },
  { to: '/app/coach', key: 'coach', icon: 'sparkles' },
  { to: '/app/checkin', key: 'checkin', icon: 'calendar' },
  { to: '/app/subscriptions', key: 'subscriptions', icon: 'repeat' },
  { to: '/app/settings', key: 'settings', icon: 'settings' },
];

/** Destinations in the phone's bottom bar; the rest are in the menu. */
export const MOBILE_KEYS = ['dashboard', 'transactions', 'plan', 'coach'];
