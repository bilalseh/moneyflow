import { HEALTH_RULES, type HealthFactor, type HealthFactorId } from '@moneyflow/shared';
import type { TFunction } from 'i18next';

import type { Formatters } from '@/lib/format';

/** Human value of a factor: a percentage, or months for the emergency fund. */
export function formatFactorValue(
  factor: Pick<HealthFactor, 'id' | 'value'>,
  fmt: Formatters,
  t: TFunction,
): string {
  if (factor.value === null) return t('health.unknownValue');
  if (factor.id === 'emergencyFund')
    return t('health.monthsValue', { value: fmt.number(factor.value, 1) });
  return fmt.percent(factor.value, 1);
}

/** "20% or more", "6 months or more", "10% or less"... built from the same rules the score uses. */
export function healthyLabel(id: HealthFactorId, fmt: Formatters, t: TFunction): string {
  const rule = HEALTH_RULES[id];
  const value =
    id === 'emergencyFund'
      ? t('health.monthsValue', { value: fmt.number(rule.full) })
      : fmt.percent(rule.full);
  return rule.direction === 'higherIsBetter'
    ? t('health.atLeast', { value })
    : t('health.atMost', { value });
}

export const STATUS_TONE = {
  good: 'positive',
  fair: 'warning',
  poor: 'negative',
  unknown: 'neutral',
} as const;
