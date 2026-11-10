import {
  compareStrategies,
  monthlyInterest,
  orderDebts,
  simulatePayoff,
  type DebtInput,
} from './debts';

const card: DebtInput = {
  id: 'card',
  name: 'Card',
  balance: 500000,
  aprBps: 2400,
  minPayment: 10000,
};
const loan: DebtInput = {
  id: 'loan',
  name: 'Loan',
  balance: 100000,
  aprBps: 600,
  minPayment: 5000,
};

describe('monthlyInterest', () => {
  it('charges apr / 12 on the balance, rounded half up', () => {
    expect(monthlyInterest(100000, 1200)).toBe(1000);
    expect(monthlyInterest(151, 1200)).toBe(2);
    expect(monthlyInterest(0, 1200)).toBe(0);
    expect(monthlyInterest(1000, 0)).toBe(0);
  });
});

describe('simulatePayoff', () => {
  it('matches a hand-computed schedule exactly', () => {
    const r = simulatePayoff(
      [{ id: 'x', name: 'X', balance: 10000, aprBps: 1200, minPayment: 5000 }],
      'avalanche',
      0,
      '2026-11',
    );
    // month 1: +100 interest, pay 5000 -> 5100; month 2: +51, pay 5000 -> 151; month 3: +2, pay 153 -> 0
    expect(r.feasible).toBe(true);
    expect(r.months).toBe(3);
    expect(r.totalInterest).toBe(153);
    expect(r.totalPaid).toBe(10153);
    expect(r.payoffMonth).toBe('2027-02');
    expect(r.series.map((s) => s.balance)).toEqual([10000, 5100, 151, 0]);
  });

  it('always pays back principal plus interest', () => {
    const r = simulatePayoff([card, loan], 'snowball', 20000, '2026-11');
    expect(r.totalPaid).toBe(card.balance + loan.balance + r.totalInterest);
  });

  it('flags plans that never finish', () => {
    const r = simulatePayoff(
      [{ id: 'x', name: 'X', balance: 100000, aprBps: 3600, minPayment: 2000 }],
      'avalanche',
      0,
      '2026-11',
    );
    expect(r.feasible).toBe(false);
    expect(r.payoffMonth).toBeNull();
  });

  it('ignores debts that are already paid', () => {
    const r = simulatePayoff([{ ...loan, balance: 0 }], 'avalanche', 0, '2026-11');
    expect(r.months).toBe(0);
    expect(r.order).toEqual([]);
  });
});

describe('ordering and comparison', () => {
  it('orders avalanche by rate and snowball by balance', () => {
    expect(orderDebts([loan, card], 'avalanche').map((d) => d.id)).toEqual(['card', 'loan']);
    expect(orderDebts([card, loan], 'snowball').map((d) => d.id)).toEqual(['loan', 'card']);
  });

  it('avalanche never costs more interest than snowball', () => {
    const c = compareStrategies([card, loan], 20000, '2026-11');
    expect(c.avalanche.totalInterest).toBeLessThanOrEqual(c.snowball.totalInterest);
    expect(c.interestSaved).toBeGreaterThan(0);
    expect(c.cheapest).toBe('avalanche');
    expect(c.snowball.debts[0]?.id).toBe('loan');
  });

  it('extra payments shorten the plan and cut interest', () => {
    const slow = simulatePayoff([card], 'avalanche', 0, '2026-11');
    const fast = simulatePayoff([card], 'avalanche', 20000, '2026-11');
    expect(fast.months).toBeLessThan(slow.months);
    expect(fast.totalInterest).toBeLessThan(slow.totalInterest);
  });
});
