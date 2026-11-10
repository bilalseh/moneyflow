import { useId } from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Formatted value shown next to the label and announced by screen readers. */
  valueText: string;
  hint?: string;
}

/** Native range input: keyboard, touch and screen-reader support come from the platform. */
export function Slider({ label, value, min, max, step, onChange, valueText, hint }: SliderProps) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <output htmlFor={id} className="tabular text-brand text-sm font-semibold">
          {valueText}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={valueText}
        onChange={(e) => {
          onChange(Number(e.target.value));
        }}
        className="accent-brand h-2 w-full cursor-pointer"
      />
      {hint !== undefined && <p className="text-ink-muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}
