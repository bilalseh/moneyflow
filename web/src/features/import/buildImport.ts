import {
  suggestCategory,
  type CategoryId,
  type DuplicateKind,
  type ImportRow,
  type Transaction,
} from '@moneyflow/shared';

export interface ReviewRow extends ImportRow {
  duplicate: DuplicateKind;
  include: boolean;
  categoryId: CategoryId;
  /** Where the current category came from: keyword rules, an AI suggestion, or the person. */
  categorySource: 'rules' | 'ai' | 'user';
  aiConfidence: number | null;
}

/** Initial review state: duplicates unticked, categories from the keyword rules. */
export function toReviewRows(
  rows: readonly (ImportRow & { duplicate: DuplicateKind })[],
): ReviewRow[] {
  return rows.map((r) => ({
    ...r,
    include: r.duplicate === null,
    categoryId: suggestCategory(r.description, r.type).categoryId,
    categorySource: 'rules',
    aiConfidence: null,
  }));
}

/** Apply AI suggestions without overriding anything the person already chose. */
export function applySuggestions(
  rows: readonly ReviewRow[],
  suggestions: readonly { id: string; categoryId: CategoryId; confidence: number }[],
): ReviewRow[] {
  const byId = new Map(suggestions.map((s) => [s.id, s]));
  return rows.map((r) => {
    const s = byId.get(String(r.rowIndex));
    if (!s || r.categorySource === 'user' || r.type === 'income') return r;
    return { ...r, categoryId: s.categoryId, categorySource: 'ai', aiConfidence: s.confidence };
  });
}

/** Transactions to write for the rows the person kept. */
export function toTransactions(
  rows: readonly ReviewRow[],
  now: string,
  id: (row: ReviewRow) => string,
): Transaction[] {
  return rows
    .filter((r) => r.include)
    .map((r) => ({
      id: id(r),
      date: r.date,
      amount: r.amount,
      currency: r.currency,
      type: r.type,
      categoryId: r.type === 'income' ? 'income' : r.categoryId,
      note: r.description,
      source: 'csv',
      recurringId: null,
      importHash: r.hash,
      createdAt: now,
    }));
}
