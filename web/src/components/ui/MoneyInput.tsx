import { getCurrency, type CurrencyCode } from '@moneyflow/shared';
import { forwardRef, useEffect, useState, type InputHTMLAttributes } from 'react';

import { cn } from '@/components/ui/cn';
import { controlClass } from '@/components/ui/Field';
import { parseMajorInput, toInputString } from '@/lib/numberInput';

interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: number | null;
  onChange: (minorUnits: number | null) => void;
  currency: CurrencyCode;
}

/**
 * Text input for money. Shows the currency code, accepts any locale's digits
 * and separators, and reports integer minor units (or null when empty or
 * unreadable) to the parent.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onChange, currency, className, onBlur, ...rest },
  ref,
) {
  const [text, setText] = useState(() => toInputString(value, currency));

  useEffect(() => {
    // Sync when the value changes from outside (reset, edit another row).
    if (parseMajorInput(text, currency) !== value) setText(toInputString(value, currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to external value changes
  }, [value, currency]);

  return (
    <div className="relative">
      <input
        ref={ref}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        dir="ltr"
        className={cn(controlClass, 'pe-14 text-end tabular-nums', className)}
        value={text}
        placeholder={getCurrency(currency).minorUnits === 0 ? '0' : '0.00'}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parseMajorInput(e.target.value, currency));
        }}
        onBlur={(e) => {
          const parsed = parseMajorInput(text, currency);
          if (parsed !== null) setText(toInputString(parsed, currency));
          onBlur?.(e);
        }}
        {...rest}
      />
      <span className="text-ink-muted pointer-events-none absolute inset-y-0 end-3 flex items-center text-xs font-semibold">
        {currency}
      </span>
    </div>
  );
});
