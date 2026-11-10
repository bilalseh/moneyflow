import { allocate, clamp, roundHalfUp } from './allocate';

describe('allocate', () => {
  it('splits exactly and sums to the total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(500000, [50, 30, 20])).toEqual([250000, 150000, 100000]);
  });

  it('gives the remainder to the largest fractions first, earlier index on ties', () => {
    expect(allocate(10, [1, 2])).toEqual([3, 7]);
    expect(allocate(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it('splits evenly when all weights are zero', () => {
    expect(allocate(9, [0, 0, 0])).toEqual([3, 3, 3]);
  });

  it('handles negative totals symmetrically', () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it('always sums to the total over many random inputs', () => {
    let seed = 42;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let run = 0; run < 500; run++) {
      const total = Math.floor(rand() * 10_000_000) - 1_000_000;
      const weights = Array.from({ length: 1 + Math.floor(rand() * 8) }, () =>
        Math.floor(rand() * 100),
      );
      const parts = allocate(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      parts.forEach((p) => {
        expect(Number.isInteger(p)).toBe(true);
      });
    }
  });

  it('rejects bad input', () => {
    expect(() => allocate(1.5, [1])).toThrow();
    expect(() => allocate(10, [-1, 2])).toThrow();
    expect(allocate(10, [])).toEqual([]);
  });
});

describe('helpers', () => {
  it('rounds half away from zero', () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(-2.5)).toBe(-3);
  });

  it('clamps', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
  });
});
