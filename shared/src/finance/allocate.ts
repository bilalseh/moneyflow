/**
 * Split an integer `total` across `weights` so the parts are integers that sum
 * exactly to `total` (largest remainder method). Zero or empty weights split
 * evenly. Ties go to the earlier index, so results are deterministic.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (!Number.isInteger(total)) throw new Error('allocate: total must be an integer');
  if (weights.length === 0) return [];
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new Error('allocate: weights must be finite and non-negative');
  }
  const sum = weights.reduce((a, b) => a + b, 0);
  const effective = sum > 0 ? weights : weights.map(() => 1);
  const effectiveSum = sum > 0 ? sum : weights.length;

  const sign = total < 0 ? -1 : 1;
  const magnitude = Math.abs(total);
  const exact = effective.map((w) => (magnitude * w) / effectiveSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = magnitude - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder -= 1;
  }
  return floors.map((x) => x * sign);
}

/** Round half away from zero to an integer. */
export function roundHalfUp(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
