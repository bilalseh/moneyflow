import { computeHealthScore, factorPoints, statusFor, type HealthInput } from './healthScore';

const healthy: HealthInput = {
  monthlyIncome: 500000,
  monthlySpending: 350000,
  essentialSpending: 200000,
  emergencyFund: 1200000,
  debtMinimums: 0,
  fixedCosts: 150000,
};

describe('computeHealthScore', () => {
  it('gives 100 when every factor is at or past its healthy threshold', () => {
    const result = computeHealthScore(healthy);
    expect(result.score).toBe(100);
    expect(result.factors.map((f) => f.status)).toEqual(['good', 'good', 'good', 'good']);
  });

  it('reports each factor value', () => {
    const [savings, emergency, dti, fixed] = computeHealthScore(healthy).factors;
    expect(savings?.value).toBeCloseTo(0.3);
    expect(emergency?.value).toBe(6);
    expect(dti?.value).toBe(0);
    expect(fixed?.value).toBeCloseTo(0.3);
  });

  it('scores linearly between thresholds', () => {
    expect(factorPoints('savingsRate', 0.1)).toBe(13);
    expect(factorPoints('emergencyFund', 3)).toBe(13);
    expect(factorPoints('debtToIncome', 0.265)).toBe(13);
    expect(factorPoints('fixedCosts', 0.675)).toBe(13);
  });

  it('gives zero points at or past the poor end', () => {
    expect(factorPoints('savingsRate', -0.2)).toBe(0);
    expect(factorPoints('debtToIncome', 0.6)).toBe(0);
    expect(factorPoints('fixedCosts', 0.9)).toBe(0);
  });

  it('marks ratio factors unknown without income', () => {
    const result = computeHealthScore({ ...healthy, monthlyIncome: 0 });
    const statuses = Object.fromEntries(result.factors.map((f) => [f.id, f.status]));
    expect(statuses).toEqual({
      savingsRate: 'unknown',
      emergencyFund: 'good',
      debtToIncome: 'unknown',
      fixedCosts: 'unknown',
    });
    expect(result.score).toBe(25);
  });

  it('treats an emergency fund with no essential spending as fully covered', () => {
    const result = computeHealthScore({ ...healthy, essentialSpending: 0 });
    expect(result.factors[1]?.points).toBe(25);
  });

  it('maps points to statuses', () => {
    expect(statusFor(25)).toBe('good');
    expect(statusFor(20)).toBe('good');
    expect(statusFor(10)).toBe('fair');
    expect(statusFor(9)).toBe('poor');
  });
});
