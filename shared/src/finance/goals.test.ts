import { progressRatio, projectGoals, splitContributions, type GoalInput } from './goals';

const goal = (over: Partial<GoalInput>): GoalInput => ({
  id: 'g',
  name: 'Goal',
  targetAmount: 120000,
  savedAmount: 0,
  targetDate: null,
  priority: 'medium',
  ...over,
});

describe('projectGoals', () => {
  it('projects a single goal at a steady pace', () => {
    const [p] = projectGoals([goal({})], 10000, '2026-11');
    expect(p?.monthsToGoal).toBe(12);
    expect(p?.projectedMonth).toBe('2027-11');
    expect(p?.series).toHaveLength(13);
    expect(p?.series.at(-1)?.saved).toBe(120000);
  });

  it('computes the monthly amount needed for a deadline and whether it is on track', () => {
    const [slow] = projectGoals([goal({ targetDate: '2027-05-01' })], 10000, '2026-11');
    expect(slow?.requiredMonthly).toBe(20000);
    expect(slow?.onTrack).toBe(false);
    const [fast] = projectGoals([goal({ targetDate: '2027-05-01' })], 20000, '2026-11');
    expect(fast?.onTrack).toBe(true);
  });

  it('returns null timelines when nothing is contributed', () => {
    const [p] = projectGoals([goal({})], 0, '2026-11');
    expect(p?.monthsToGoal).toBeNull();
    expect(p?.projectedMonth).toBeNull();
  });

  it('treats already-funded goals as done at month zero', () => {
    const [p] = projectGoals([goal({ savedAmount: 120000 })], 5000, '2026-11');
    expect(p?.monthsToGoal).toBe(0);
    expect(p?.remaining).toBe(0);
  });

  it('splits by priority and rolls a finished goal share into the others', () => {
    const goals = [
      goal({ id: 'a', targetAmount: 10000, priority: 'high' }),
      goal({ id: 'b', targetAmount: 100000, priority: 'low' }),
    ];
    const [a, b] = projectGoals(goals, 10000, '2026-11');
    expect(a?.firstMonthContribution).toBe(7500);
    expect(b?.firstMonthContribution).toBe(2500);
    expect(a?.monthsToGoal).toBe(2);
    expect(b?.series[2]?.saved).toBe(10000);
    expect(b?.monthsToGoal).toBe(11);
  });
});

describe('splitContributions', () => {
  it('never gives a goal more than it needs', () => {
    const split = splitContributions(10000, [
      { id: 'a', remaining: 1000, priority: 'high' },
      { id: 'b', remaining: 50000, priority: 'medium' },
    ]);
    expect(split.get('a')).toBe(1000);
    expect(split.get('b')).toBe(9000);
  });

  it('keeps leftovers unassigned when every goal is full', () => {
    const split = splitContributions(10000, [{ id: 'a', remaining: 3000, priority: 'low' }]);
    expect(split.get('a')).toBe(3000);
  });
});

describe('progressRatio', () => {
  it('caps at one', () => {
    expect(progressRatio({ targetAmount: 100, savedAmount: 50 })).toBe(0.5);
    expect(progressRatio({ targetAmount: 100, savedAmount: 150 })).toBe(1);
  });
});
