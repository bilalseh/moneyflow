import { clamp } from './allocate';

/**
 * Financial health score out of 100: four factors worth 25 points each.
 * Each factor scores linearly between a "zero points" value and a "full
 * points" value. The thresholds are documented in docs/finance-rules.md and
 * are deliberately simple so users can see exactly why they got their score.
 */
export const HEALTH_FACTOR_IDS = [
  'savingsRate',
  'emergencyFund',
  'debtToIncome',
  'fixedCosts',
] as const;
export type HealthFactorId = (typeof HEALTH_FACTOR_IDS)[number];
export type HealthStatus = 'good' | 'fair' | 'poor' | 'unknown';

export const FACTOR_MAX_POINTS = 25;

interface Rule {
  /** Value that earns full points. */
  full: number;
  /** Value that earns zero points. */
  zero: number;
  direction: 'higherIsBetter' | 'lowerIsBetter';
}

export const HEALTH_RULES: Readonly<Record<HealthFactorId, Rule>> = {
  savingsRate: { full: 0.2, zero: 0, direction: 'higherIsBetter' },
  emergencyFund: { full: 6, zero: 0, direction: 'higherIsBetter' },
  debtToIncome: { full: 0.1, zero: 0.43, direction: 'lowerIsBetter' },
  fixedCosts: { full: 0.5, zero: 0.85, direction: 'lowerIsBetter' },
};

export interface HealthInput {
  monthlyIncome: number;
  /** Needs and wants, excluding transfers to savings. */
  monthlySpending: number;
  /** Monthly spending in the needs group. */
  essentialSpending: number;
  emergencyFund: number;
  debtMinimums: number;
  fixedCosts: number;
}

export interface HealthFactor {
  id: HealthFactorId;
  /** Ratio (0.12 = 12%) or, for emergencyFund, months. Null when it cannot be computed. */
  value: number | null;
  points: number;
  maxPoints: number;
  status: HealthStatus;
}

export interface HealthScore {
  score: number;
  factors: HealthFactor[];
}

export function factorPoints(id: HealthFactorId, value: number): number {
  const rule = HEALTH_RULES[id];
  const t =
    rule.direction === 'higherIsBetter'
      ? (value - rule.zero) / (rule.full - rule.zero)
      : (rule.zero - value) / (rule.zero - rule.full);
  // The epsilon keeps exact midpoints (12.5 points) from rounding down due to float error.
  return Math.round(clamp(t, 0, 1) * FACTOR_MAX_POINTS + 1e-9);
}

export function statusFor(points: number): Exclude<HealthStatus, 'unknown'> {
  if (points >= 20) return 'good';
  if (points >= 10) return 'fair';
  return 'poor';
}

function factor(id: HealthFactorId, value: number | null): HealthFactor {
  if (value === null || !Number.isFinite(value)) {
    return { id, value: null, points: 0, maxPoints: FACTOR_MAX_POINTS, status: 'unknown' };
  }
  const points = factorPoints(id, value);
  return { id, value, points, maxPoints: FACTOR_MAX_POINTS, status: statusFor(points) };
}

export function computeHealthScore(input: HealthInput): HealthScore {
  const hasIncome = input.monthlyIncome > 0;
  const ratio = (n: number) => (hasIncome ? n / input.monthlyIncome : null);

  let emergencyMonths: number | null = null;
  if (input.essentialSpending > 0) emergencyMonths = input.emergencyFund / input.essentialSpending;
  else if (input.emergencyFund > 0) emergencyMonths = HEALTH_RULES.emergencyFund.full;

  const factors = [
    factor('savingsRate', ratio(input.monthlyIncome - input.monthlySpending)),
    factor('emergencyFund', emergencyMonths),
    factor('debtToIncome', ratio(input.debtMinimums)),
    factor('fixedCosts', ratio(input.fixedCosts)),
  ];
  return { score: factors.reduce((a, f) => a + f.points, 0), factors };
}
