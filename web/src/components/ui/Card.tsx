import { type HTMLAttributes, type ReactNode } from 'react';

import { cn } from '@/components/ui/cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-card border-line bg-surface-raised border p-4 shadow-sm sm:p-5',
        className,
      )}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
  id?: string;
}

export function CardHeader({
  title,
  description,
  action,
  as: Heading = 'h2',
  id,
}: CardHeaderProps) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <Heading id={id} className="text-base font-semibold">
          {title}
        </Heading>
        {description !== undefined && (
          <p className="text-ink-muted mt-0.5 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
