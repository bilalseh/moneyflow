/** Short random id with a readable prefix, e.g. "tx_3f9a1c2b7d4e". */
export function newId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return `${prefix}_${random}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
