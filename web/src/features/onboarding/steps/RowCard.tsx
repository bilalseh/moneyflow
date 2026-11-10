import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

/** A fieldset for one repeatable row (an income, a debt, a goal) with an optional remove button. */
export function RowCard({
  label,
  onRemove,
  children,
}: {
  label: string;
  onRemove?: (() => void) | undefined;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="border-line bg-surface-raised rounded-card border p-4">
      <legend className="text-ink-muted float-start text-sm font-semibold">{label}</legend>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-negative float-end text-sm font-medium hover:underline"
        >
          {t('common.remove')}
          <span className="sr-only"> {label}</span>
        </button>
      )}
      <div className="clear-both grid gap-3 pt-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
