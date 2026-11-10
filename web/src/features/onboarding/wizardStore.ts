import type { CategoryId, CurrencyCode, GoalPriority } from '@moneyflow/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export const WIZARD_STEPS = [
  'currency',
  'income',
  'fixedCosts',
  'debts',
  'savings',
  'goals',
  'review',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

/** Steps the person may skip with "I'll add this later". */
export const OPTIONAL_STEPS: ReadonlySet<WizardStep> = new Set([
  'fixedCosts',
  'debts',
  'savings',
  'goals',
]);

export interface IncomeDraft {
  name: string;
  amount: number | null;
  kind: 'fixed' | 'variable';
}
export interface FixedCostDraft {
  name: string;
  categoryId: CategoryId;
  amount: number | null;
}
export interface DebtDraft {
  name: string;
  balance: number | null;
  aprBps: number | null;
  minPayment: number | null;
}
export interface GoalDraft {
  name: string;
  targetAmount: number | null;
  savedAmount: number | null;
  targetDate: string;
  priority: GoalPriority;
}

export interface WizardData {
  currency: CurrencyCode | null;
  incomes: IncomeDraft[];
  fixedCosts: FixedCostDraft[];
  debts: DebtDraft[];
  savings: { savingsBalance: number | null; emergencyFund: number | null };
  goals: GoalDraft[];
  /** Steps the person explicitly skipped, shown as such on the review screen. */
  skipped: WizardStep[];
}

export const EMPTY_WIZARD: WizardData = {
  currency: null,
  incomes: [{ name: '', amount: null, kind: 'fixed' }],
  fixedCosts: [
    { name: '', categoryId: 'housing', amount: null },
    { name: '', categoryId: 'utilities', amount: null },
    { name: '', categoryId: 'transport', amount: null },
    { name: '', categoryId: 'subscriptions', amount: null },
  ],
  debts: [],
  savings: { savingsBalance: null, emergencyFund: null },
  goals: [],
  skipped: [],
};

const STEP_OF_KEY: Readonly<Record<keyof WizardData, WizardStep | null>> = {
  currency: 'currency',
  incomes: 'income',
  fixedCosts: 'fixedCosts',
  debts: 'debts',
  savings: 'savings',
  goals: 'goals',
  skipped: null,
};

/** Wizard data with the answers of skipped steps removed. */
export function effectiveData(data: WizardData): WizardData {
  const skipped = new Set(data.skipped);
  return {
    ...data,
    fixedCosts: skipped.has('fixedCosts') ? [] : data.fixedCosts,
    debts: skipped.has('debts') ? [] : data.debts,
    savings: skipped.has('savings') ? { savingsBalance: null, emergencyFund: null } : data.savings,
    goals: skipped.has('goals') ? [] : data.goals,
  };
}

interface WizardState {
  step: WizardStep;
  data: WizardData;
  goTo: (step: WizardStep) => void;
  update: <K extends keyof WizardData>(key: K, value: WizardData[K]) => void;
  skip: (step: WizardStep) => void;
  unskip: (step: WizardStep) => void;
  reset: () => void;
}

/**
 * Wizard answers live in sessionStorage, so Back, Next and even a reload never
 * lose what the person typed. Cleared after a successful save.
 */
export const useWizard = create<WizardState>()(
  persist(
    (set, get) => ({
      step: 'currency',
      data: EMPTY_WIZARD,
      goTo: (step) => {
        set({ step });
      },
      update: (key, value) => {
        // Editing a step's answers means it is no longer skipped.
        const step = STEP_OF_KEY[key];
        const skipped = get().data.skipped.filter((s) => s !== step);
        set({ data: { ...get().data, [key]: value, skipped } });
      },
      skip: (step) => {
        const skipped = new Set(get().data.skipped).add(step);
        set({ data: { ...get().data, skipped: [...skipped] } });
      },
      unskip: (step) => {
        set({ data: { ...get().data, skipped: get().data.skipped.filter((s) => s !== step) } });
      },
      reset: () => {
        set({ step: 'currency', data: EMPTY_WIZARD });
      },
    }),
    { name: 'moneyflow.wizard', storage: createJSONStorage(() => sessionStorage), version: 1 },
  ),
);

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}
