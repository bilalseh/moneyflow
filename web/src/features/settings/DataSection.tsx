import { addMonths, currentMonth, type Profile } from '@moneyflow/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { Icon } from '@/components/Icon';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { TextInput } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';
import { clearUserData, deleteProfile } from '@/data/firestore';
import { isUserCancelled, linkGuestToGoogle } from '@/features/auth/authActions';
import { useSessionUser } from '@/features/auth/authStore';
import { resetDemo } from '@/features/demo/seedDemo';
import { useWizard } from '@/features/onboarding/wizardStore';
import { deleteAccount } from '@/features/settings/deleteAccount';
import { downloadExport } from '@/features/settings/exportData';

export function DataSection({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const user = useSessionUser();
  const client = useQueryClient();
  const navigate = useNavigate();
  const resetWizard = useWizard((s) => s.reset);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const word = t('settings.data.deleteWord');

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (error) {
      if (!isUserCancelled(error)) {
        console.error(error);
        toast.error(t('settings.data.failed'));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader
        title={t('settings.data.title')}
        description={
          <>
            {t('settings.data.description')}{' '}
            <Link to="/privacy" className="text-brand underline">
              {t('landing.privacy')}
            </Link>
          </>
        }
      />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={busy === 'export'}
            onClick={() => void run('export', () => downloadExport(user.uid))}
          >
            <Icon name="download" className="size-4" />
            {t('settings.data.export')}
          </Button>
          <ButtonLink to={`/app/report/${addMonths(currentMonth(), -1)}`} variant="secondary">
            <Icon name="file" className="size-4" />
            {t('settings.data.report')}
          </ButtonLink>
        </div>
        {user.isAnonymous && (
          <div className="bg-brand-soft rounded-lg p-3 text-sm">
            <p className="text-brand-strong font-medium">{t('settings.data.guestTitle')}</p>
            <p className="text-ink-muted mt-1">{t('settings.data.guestBody')}</p>
            <Button
              size="sm"
              className="mt-2"
              loading={busy === 'link'}
              onClick={() =>
                void run('link', async () => {
                  await linkGuestToGoogle();
                  toast.success(t('settings.data.linked'));
                })
              }
            >
              {t('settings.data.link')}
            </Button>
          </div>
        )}
        <div className="border-line flex flex-wrap gap-2 border-t pt-3">
          {profile.isDemo && (
            <Button
              variant="ghost"
              loading={busy === 'reset'}
              onClick={() =>
                void run('reset', async () => {
                  await resetDemo(user.uid, profile.locale);
                  await client.invalidateQueries();
                  toast.success(t('settings.data.resetDone'));
                })
              }
            >
              {t('settings.data.resetDemo')}
            </Button>
          )}
          <Button
            variant="ghost"
            loading={busy === 'restart'}
            onClick={() => {
              if (!window.confirm(t('settings.data.confirmRestart'))) return;
              void run('restart', async () => {
                await clearUserData(user.uid);
                await deleteProfile(user.uid);
                await client.invalidateQueries();
                resetWizard();
                void navigate('/app/onboarding');
              });
            }}
          >
            {t('settings.data.restart')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirmOpen(true);
            }}
          >
            {t('settings.data.delete')}
          </Button>
        </div>
      </div>
      <Dialog
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
        title={t('settings.data.deleteTitle')}
        description={t('settings.data.deleteBody')}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (confirmText.trim() !== word) return;
            void run('delete', async () => {
              await deleteAccount(user.uid);
              client.clear();
              void navigate('/', { replace: true });
              toast.success(t('settings.data.deleted'));
            });
          }}
        >
          <label htmlFor="delete-confirm" className="block text-sm">
            {t('settings.data.typeToConfirm', { word })}
          </label>
          <TextInput
            id="delete-confirm"
            autoComplete="off"
            value={confirmText}
            onChange={(e) => {
              setConfirmText(e.target.value);
            }}
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={confirmText.trim() !== word}
              loading={busy === 'delete'}
            >
              {t('settings.data.deleteForever')}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
