import { useTranslation } from 'react-i18next';

export function Logo({ className = '' }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        aria-hidden="true"
        viewBox="0 0 64 64"
        className="size-8 shrink-0"
        fill="none"
        focusable="false"
      >
        <rect width="64" height="64" rx="16" className="fill-brand" />
        <path
          d="M14 42 L26 26 L36 36 L50 18"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="50" cy="18" r="5" fill="#99f6e4" />
      </svg>
      <span className="text-lg font-semibold tracking-tight">{t('app.name')}</span>
    </span>
  );
}
