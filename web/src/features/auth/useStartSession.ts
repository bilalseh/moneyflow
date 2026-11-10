import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { toast } from '@/components/ui/toast';
import { isUserCancelled, signInAsGuest, signInWithGoogle } from '@/features/auth/authActions';
import { seedDemo } from '@/features/demo/seedDemo';
import { useWizard } from '@/features/onboarding/wizardStore';

type Mode = 'google' | 'demo' | 'guest';

/** The three ways in: Google, a seeded demo account, or an empty guest account. */
export function useStartSession() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const resetWizard = useWizard((s) => s.reset);
  const [pending, setPending] = useState<Mode | null>(null);

  const start = async (mode: Mode) => {
    setPending(mode);
    try {
      if (mode === 'google') {
        await signInWithGoogle();
        void navigate('/app');
      } else if (mode === 'demo') {
        const uid = await signInAsGuest();
        await seedDemo(uid, i18n.language.startsWith('ar') ? 'ar' : 'en');
        void navigate('/app');
      } else {
        await signInAsGuest();
        resetWizard();
        void navigate('/app/onboarding');
      }
    } catch (error) {
      if (!isUserCancelled(error)) {
        console.error(error);
        toast.error(t('landing.signInFailed'));
      }
    } finally {
      setPending(null);
    }
  };

  return { start, pending };
}
