import { z } from 'zod';

import { categoryIdSchema } from './categories';
import { currencyCodeSchema } from './currency';
import { isoDateSchema, monthKeySchema } from './dates';
import { BUDGET_METHODS } from './finance/budget';
import { rateSchema } from './finance/convert';
import { GOAL_PRIORITIES } from './finance/goals';
import { HEALTH_FACTOR_IDS } from './finance/healthScore';
import { CADENCES } from './finance/recurring';

/**
 * Firestore document shapes. Everything lives under `users/{uid}`; the
 * collection for each schema is noted next to it. Amounts are integer minor
 * units in the document's own `currency`.
 */
const amount = z.number().int().min(0).max(1e13);
const name = z.string().trim().min(1).max(60);
const id = z.string().min(1).max(64);

export const LOCALES = ['en', 'ar'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

/** users/{uid} */
export const profileSchema = z.object({
  displayName: z.string().max(80).default(''),
  mainCurrency: currencyCodeSchema,
  rates: z.partialRecord(currencyCodeSchema, rateSchema).default({}),
  locale: localeSchema.default('en'),
  budgetMethod: z.enum(BUDGET_METHODS).default('fiftyThirtyTwenty'),
  onboardingCompleted: z.boolean().default(false),
  isDemo: z.boolean().default(false),
  notifications: z
    .object({ monthlyCheckin: z.boolean(), budgetAlerts: z.boolean(), productUpdates: z.boolean() })
    .default({ monthlyCheckin: true, budgetAlerts: true, productUpdates: false }),
  createdAt: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

/** users/{uid}/incomes */
export const incomeSchema = z.object({
  id,
  name,
  amount,
  currency: currencyCodeSchema,
  kind: z.enum(['fixed', 'variable']),
});
export type Income = z.infer<typeof incomeSchema>;

/** users/{uid}/fixedCosts */
export const fixedCostSchema = z.object({
  id,
  name,
  categoryId: categoryIdSchema,
  amount,
  currency: currencyCodeSchema,
});
export type FixedCost = z.infer<typeof fixedCostSchema>;

/** users/{uid}/debts */
export const debtSchema = z.object({
  id,
  name,
  balance: amount,
  aprBps: z.number().int().min(0).max(10_000),
  minPayment: amount,
  currency: currencyCodeSchema,
});
export type Debt = z.infer<typeof debtSchema>;

/** users/{uid}/accounts */
export const accountSchema = z.object({
  id,
  name,
  kind: z.enum(['cash', 'savings', 'emergency']),
  balance: z.number().int().min(-1e13).max(1e13),
  currency: currencyCodeSchema,
});
export type Account = z.infer<typeof accountSchema>;

/** users/{uid}/goals */
export const goalSchema = z.object({
  id,
  name,
  targetAmount: amount.min(1),
  savedAmount: amount,
  currency: currencyCodeSchema,
  targetDate: isoDateSchema.nullable(),
  priority: z.enum(GOAL_PRIORITIES),
  createdAt: z.string(),
});
export type Goal = z.infer<typeof goalSchema>;

export const TRANSACTION_SOURCES = ['manual', 'csv', 'recurring', 'demo'] as const;

/** users/{uid}/transactions */
export const transactionSchema = z.object({
  id,
  date: isoDateSchema,
  amount: amount.min(1),
  currency: currencyCodeSchema,
  type: z.enum(['expense', 'income']),
  categoryId: categoryIdSchema,
  note: z.string().max(200).default(''),
  source: z.enum(TRANSACTION_SOURCES),
  recurringId: z.string().max(64).nullable().default(null),
  importHash: z.string().max(16).nullable().default(null),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof transactionSchema>;

/** users/{uid}/recurring */
export const recurringRuleSchema = z.object({
  id,
  type: z.enum(['expense', 'income']),
  amount: amount.min(1),
  currency: currencyCodeSchema,
  categoryId: categoryIdSchema,
  note: z.string().max(200).default(''),
  cadence: z.enum(CADENCES),
  nextDate: isoDateSchema,
  active: z.boolean(),
});
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

/** users/{uid}/budgets/{YYYY-MM}. Amounts in the main currency. */
export const budgetSchema = z.object({
  month: monthKeySchema,
  method: z.enum(BUDGET_METHODS),
  income: amount,
  lines: z.array(z.object({ categoryId: categoryIdSchema, planned: amount })).max(20),
  updatedAt: z.string(),
});
export type Budget = z.infer<typeof budgetSchema>;

/** users/{uid}/scores/{YYYY-MM}. Monthly health-score history plus net worth. */
export const scoreSnapshotSchema = z.object({
  month: monthKeySchema,
  score: z.number().int().min(0).max(100),
  factors: z.array(
    z.object({
      id: z.enum(HEALTH_FACTOR_IDS),
      value: z.number().nullable(),
      points: z.number().int().min(0).max(25),
    }),
  ),
  netWorth: z.number().int(),
  savingsRate: z.number().nullable(),
  tips: z
    .object({
      locale: localeSchema,
      source: z.enum(['ai', 'fallback']),
      items: z.array(z.object({ factorId: z.enum(HEALTH_FACTOR_IDS), text: z.string().max(400) })),
    })
    .nullable()
    .default(null),
  computedAt: z.string(),
});
export type ScoreSnapshot = z.infer<typeof scoreSnapshotSchema>;

/** users/{uid}/checkins/{YYYY-MM} */
export const checkinSchema = z.object({
  month: monthKeySchema,
  summary: z.string().max(1000),
  highlights: z.array(z.string().max(200)).max(4),
  questions: z
    .array(z.object({ id, text: z.string().max(240), answer: z.string().max(500).default('') }))
    .max(3),
  adjustments: z
    .array(
      z.object({
        id,
        categoryId: categoryIdSchema,
        changePercent: z.number().int().min(-30).max(30),
        reason: z.string().max(240),
        status: z.enum(['pending', 'accepted', 'dismissed']),
      }),
    )
    .max(4),
  source: z.enum(['ai', 'fallback']),
  locale: localeSchema,
  createdAt: z.string(),
});
export type Checkin = z.infer<typeof checkinSchema>;

/** users/{uid}/subscriptionPrefs/{merchantKey} */
export const subscriptionPrefSchema = z.object({
  key: z.string().min(1).max(120),
  used: z.boolean(),
  updatedAt: z.string(),
});
export type SubscriptionPref = z.infer<typeof subscriptionPrefSchema>;

/** billing/{uid}: written only by the API. */
export const billingSchema = z.object({ plan: z.enum(['free', 'pro']).default('free') });
export type Billing = z.infer<typeof billingSchema>;
