import { create } from 'zustand';

export interface SessionUser {
  uid: string;
  isAnonymous: boolean;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  setUser: (user) => {
    set({ user, status: user ? 'signedIn' : 'signedOut' });
  },
}));

/** The signed-in user. Only call inside routes guarded by RequireAuth. */
export function useSessionUser(): SessionUser {
  const user = useAuthStore((s) => s.user);
  if (!user) throw new Error('useSessionUser called outside an authenticated route');
  return user;
}
