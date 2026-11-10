import type { Profile } from '@moneyflow/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Field, SelectInput, TextInput } from '@/components/ui/Field';
import { toast } from '@/components/ui/toast';
import { useSaveProfile } from '@/data/hooks';
import { SUPPORTED_LANGUAGES, type Language } from '@/lib/i18n';

const NOTIFICATIONS = ['monthlyCheckin', 'budgetAlerts', 'productUpdates'] as const;

export function PreferencesSection({ profile }: { profile: Profile }) {
  const { t, i18n } = useTranslation();
  const save = useSaveProfile();
  const [name, setName] = useState(profile.displayName);
  const [notifications, setNotifications] = useState(profile.notifications);

  const persist = (patch: Partial<Profile>) => {
    save.mutate(
      { ...profile, ...patch },
      {
        onSuccess: () => {
          toast.success(t('common.saved'));
        },
        onError: () => {
          toast.error(t('common.saveFailed'));
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader title={t('settings.preferences.title')} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          persist({ displayName: name.trim().slice(0, 80), notifications });
        }}
      >
        <Field label={t('settings.preferences.name')}>
          {({ id }) => (
            <TextInput
              id={id}
              maxLength={80}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label={t('language.label')} hint={t('settings.preferences.languageHint')}>
          {({ id, describedBy }) => (
            <SelectInput
              id={id}
              aria-describedby={describedBy}
              value={i18n.resolvedLanguage ?? 'en'}
              onChange={(e) => {
                const locale = e.target.value as Language;
                void i18n.changeLanguage(locale);
                persist({ locale });
              }}
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {t(`language.${l}`)}
                </option>
              ))}
            </SelectInput>
          )}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            {t('settings.preferences.notifications')}
          </legend>
          <div className="space-y-2">
            {NOTIFICATIONS.map((key) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand mt-0.5 size-4"
                  checked={notifications[key]}
                  onChange={(e) => {
                    setNotifications({ ...notifications, [key]: e.target.checked });
                  }}
                />
                <span>{t(`settings.preferences.notify.${key}`)}</span>
              </label>
            ))}
          </div>
          <p className="text-ink-muted mt-2 text-xs">{t('settings.preferences.notifyNote')}</p>
        </fieldset>
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </form>
    </Card>
  );
}
