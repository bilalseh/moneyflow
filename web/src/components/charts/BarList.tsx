import { cn } from '@/components/ui/cn';

export interface BarListItem {
  key: string;
  label: string;
  value: number;
  display: string;
  /** Optional secondary text, e.g. "of 200.00 planned". */
  detail?: string;
}

/**
 * Horizontal ranked bars in plain HTML: one hue for magnitude, values as
 * text next to each bar so nothing depends on reading bar lengths.
 */
export function BarList({
  items,
  max,
  className,
}: {
  items: readonly BarListItem[];
  max?: number;
  className?: string;
}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn('space-y-2.5', className)}>
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{item.label}</span>
            <span className="tabular whitespace-nowrap font-semibold">{item.display}</span>
          </div>
          <div className="bg-surface-sunken h-2 overflow-hidden rounded-full" aria-hidden="true">
            <div
              className="bg-chart-1 h-full rounded-full"
              style={{ width: `${String(Math.max(2, (item.value / top) * 100))}%` }}
            />
          </div>
          {item.detail !== undefined && (
            <p className="text-ink-subtle mt-0.5 text-xs">{item.detail}</p>
          )}
        </li>
      ))}
    </ul>
  );
}
