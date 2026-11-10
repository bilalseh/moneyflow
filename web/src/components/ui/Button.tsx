import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';

import { cn } from '@/components/ui/cn';
import { Spinner } from '@/components/ui/Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition select-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong shadow-sm',
  secondary: 'border border-line bg-surface-raised text-ink hover:border-brand hover:text-brand',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-negative text-white hover:opacity-90 shadow-sm',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
};

export function buttonClass(
  variant: Variant = 'primary',
  size: Size = 'md',
  extra?: string,
): string {
  return cn(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass(variant, size, typeof className === 'string' ? className : undefined)}
      {...rest}
    />
  );
}
