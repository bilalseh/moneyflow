import { useTranslation } from 'react-i18next';

export function DisclaimerBanner() {
  const { t } = useTranslation();
  return (
    <p
      role="note"
      className="bg-brand-soft text-brand-strong px-4 py-1.5 text-center text-xs font-medium"
    >
      {t('app.disclaimer')}
    </p>
  );
}
