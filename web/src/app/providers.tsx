import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { Toaster } from '@/components/ui/toast';
import { listenToAuth } from '@/features/auth/authActions';
import { useAuthStore } from '@/features/auth/authStore';
import { hasFirebaseConfig } from '@/lib/env';

import '@/lib/i18n';

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Subscribe to Firebase Auth once. Without a Firebase config (static preview), stay signed out. */
function AuthListener() {
  useEffect(() => {
    if (!hasFirebaseConfig()) {
      useAuthStore.getState().setUser(null);
      return;
    }
    return listenToAuth();
  }, []);
  return null;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
