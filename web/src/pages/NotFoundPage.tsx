import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-bold">{t('notFound.title')}</h1>
      <p className="text-ink-muted">{t('notFound.body')}</p>
      <Link to="/" className="text-brand font-medium underline-offset-4 hover:underline">
        {t('notFound.home')}
      </Link>
    </div>
  );
}
