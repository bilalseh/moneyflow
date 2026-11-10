import { useRef, type KeyboardEvent } from 'react';

import { cn } from '@/components/ui/cn';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Single-choice segmented control (radiogroup) with roving focus and arrow
 * keys. Arrow direction follows the document direction so it feels right in RTL.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: SegmentedProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const rtl = document.documentElement.dir === 'rtl';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = index;
    if (e.key === forward || e.key === 'ArrowDown') next = (index + 1) % options.length;
    else if (e.key === back || e.key === 'ArrowUp')
      next = (index - 1 + options.length) % options.length;
    else return;
    e.preventDefault();
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('bg-surface-sunken inline-flex flex-wrap gap-1 rounded-lg p-1', className)}
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              onChange(o.value);
            }}
            onKeyDown={(e) => {
              onKeyDown(e, i);
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition',
              selected ? 'bg-surface-raised text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
