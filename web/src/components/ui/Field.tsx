import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { cn } from '@/components/ui/cn';

export const controlClass =
  'block w-full rounded-lg border border-line bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 aria-invalid:border-negative aria-invalid:ring-negative/20 disabled:opacity-60';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  className?: string;
  /** Render prop receiving the ids to wire into the control. */
  children: (ids: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactElement;
}

/** Label, control, hint and inline error with correct aria wiring. */
export function Field({ label, hint, error, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint !== undefined ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint !== undefined && (
        <p id={hintId} className="text-ink-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-negative text-xs font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlClass, className)} {...rest} />;
  },
);

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectInput({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, 'pe-8', className)} {...rest}>
        {children}
      </select>
    );
  },
);
