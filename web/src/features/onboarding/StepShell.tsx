import { useEffect, useRef, type ReactNode, type SubmitEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import {
  OPTIONAL_STEPS,
  WIZARD_STEPS,
  stepIndex,
  useWizard,
  type WizardStep,
} from '@/features/onboarding/wizardStore';

interface StepShellProps {
  step: WizardStep;
  title: string;
  hint?: ReactNode;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  submitting?: boolean;
  /** Save the current (possibly unfinished) answers before going back. */
  onBack?: () => void;
  children: ReactNode;
}

/**
 * Frame shared by every wizard step: progress, the question as a heading
 * that receives focus on arrival (so screen readers announce each new
 * question), and Back / Skip / Next.
 */
export function StepShell({
  step,
  title,
  hint,
  onSubmit,
  submitLabel,
  submitting = false,
  onBack,
  children,
}: StepShellProps) {
  const { t } = useTranslation();
  const goTo = useWizard((s) => s.goTo);
  const skip = useWizard((s) => s.skip);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const index = stepIndex(step);
  const total = WIZARD_STEPS.length;
  const previous = WIZARD_STEPS[index - 1];
  const next = WIZARD_STEPS[index + 1];

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-1 flex-col">
      <div className="mb-8">
        <p className="text-ink-muted mb-2 text-sm font-medium">
          {t('onboarding.progress', { current: index + 1, total })}
        </p>
        <div
          role="progressbar"
          aria-label={t('onboarding.progressLabel')}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          className="bg-surface-sunken h-1.5 overflow-hidden rounded-full"
        >
          <div
            className="bg-brand h-full rounded-full transition-[width] duration-300"
            style={{ width: `${String(((index + 1) / total) * 100)}%` }}
          />
        </div>
      </div>

      <h1
        ref={headingRef}
        tabIndex={-1}
        className="text-2xl font-bold tracking-tight focus:outline-none sm:text-3xl"
      >
        {title}
      </h1>
      {hint !== undefined && <p className="text-ink-muted mt-2">{hint}</p>}

      <div className="mt-6 flex-1 space-y-4">{children}</div>

      <div className="border-line mt-8 flex flex-wrap items-center gap-3 border-t pt-5">
        {previous !== undefined && (
          <Button
            variant="ghost"
            onClick={() => {
              onBack?.();
              goTo(previous);
            }}
          >
            {t('onboarding.back')}
          </Button>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-3">
          {OPTIONAL_STEPS.has(step) && next !== undefined && (
            <Button
              variant="secondary"
              onClick={() => {
                skip(step);
                goTo(next);
              }}
            >
              {t('onboarding.skip')}
            </Button>
          )}
          <Button type="submit" loading={submitting}>
            {submitLabel ?? t('onboarding.next')}
          </Button>
        </div>
      </div>
    </form>
  );
}
