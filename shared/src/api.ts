import { z } from 'zod';

import { categoryIdSchema, type CategoryId } from './categories';
import { monthKeySchema } from './dates';
import { HEALTH_FACTOR_IDS } from './finance/healthScore';
import type { CurrencyCode } from './currency';
import type { Locale } from './domain';

/**
 * Client-side mirror of docs/api-contract.md. Requests are typed; responses
 * are validated with Zod so a misbehaving server can never inject an
 * unexpected shape into the UI.
 */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryAfterSeconds: z.number().optional(),
  }),
});

const source = z.enum(['ai', 'fallback']);

export const meResponseSchema = z.object({
  uid: z.string(),
  plan: z.enum(['free', 'pro']),
  usage: z.object({ used: z.number().int(), limit: z.number().int(), resetsAt: z.string() }),
  features: z.object({ ai: z.boolean(), billing: z.boolean() }),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

export interface HealthTipsRequest {
  locale: Locale;
  currency: CurrencyCode;
  score: number;
  factors: {
    id: (typeof HEALTH_FACTOR_IDS)[number];
    value: number | null;
    points: number;
    maxPoints: number;
    status: 'good' | 'fair' | 'poor' | 'unknown';
    healthy: string;
  }[];
}

export const healthTipsResponseSchema = z.object({
  tips: z.array(
    z.object({ factorId: z.enum(HEALTH_FACTOR_IDS), text: z.string().min(1).max(400) }),
  ),
  source,
});
export type HealthTipsResponse = z.infer<typeof healthTipsResponseSchema>;

export interface CategorizeRequest {
  locale: Locale;
  categories: CategoryId[];
  transactions: {
    id: string;
    description: string;
    amount: number;
    currency: CurrencyCode;
    type: 'expense' | 'income';
  }[];
}

export const categorizeResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      id: z.string(),
      categoryId: categoryIdSchema,
      confidence: z.number().min(0).max(1),
    }),
  ),
  source,
});
export type CategorizeResponse = z.infer<typeof categorizeResponseSchema>;

export interface CheckinRequest {
  locale: Locale;
  currency: CurrencyCode;
  month: string;
  income: number;
  spending: number;
  /** 0 when there is no income. */
  savingsRate: number;
  categories: { categoryId: CategoryId; planned: number; actual: number }[];
  goals: {
    id: string;
    name: string;
    target: number;
    saved: number;
    onTrack: boolean;
    projectedMonth: string | null;
  }[];
  scoreChange: number | null;
}

export const checkinResponseSchema = z.object({
  summary: z.string().max(1000),
  highlights: z.array(z.string().max(200)).max(4),
  questions: z
    .array(z.object({ id: z.string(), text: z.string().max(240) }))
    .min(1)
    .max(3),
  adjustments: z
    .array(
      z.object({
        id: z.string(),
        categoryId: categoryIdSchema,
        changePercent: z.number().int().min(-30).max(30),
        reason: z.string().max(240),
      }),
    )
    .max(4),
  source,
});
export type CheckinResponse = z.infer<typeof checkinResponseSchema>;

export const COACH_TOOLS = [
  'check_affordability',
  'simulate_scenario',
  'project_goal',
  'compare_debt_strategies',
] as const;
export type CoachToolName = (typeof COACH_TOOLS)[number];

export const toolArgsSchemas = {
  check_affordability: z.object({
    amountMajor: z.number().positive(),
    month: monthKeySchema,
    label: z.string().max(60).optional(),
  }),
  simulate_scenario: z.object({
    extraSavingsMajor: z.number().min(0).default(0),
    categoryCuts: z
      .array(z.object({ categoryId: categoryIdSchema, percent: z.number().int().min(1).max(100) }))
      .max(5)
      .default([]),
    incomeChangeMajor: z.number().default(0),
  }),
  project_goal: z.object({ goalId: z.string().min(1) }),
  compare_debt_strategies: z.object({ extraPerMonthMajor: z.number().min(0).default(0) }),
} as const;

export const toolCallSchema = z.object({
  id: z.string(),
  name: z.enum(COACH_TOOLS),
  args: z.record(z.string(), z.unknown()),
});
export type ToolCall = z.infer<typeof toolCallSchema>;

export type CoachMessage =
  | { role: 'user'; text: string }
  | { role: 'assistant'; text: string }
  | { role: 'assistant'; toolCall: ToolCall }
  | {
      role: 'tool';
      toolResult: { id: string; name: CoachToolName; result: Record<string, unknown> };
    };

export interface CoachContext {
  month: string;
  monthlyIncome: number;
  monthlySpending: number;
  savingsRate: number;
  savingsBalance: number;
  emergencyFund: number;
  emergencyMonths: number;
  healthScore: number | null;
  categories: { categoryId: CategoryId; planned: number; actual: number }[];
  goals: {
    id: string;
    name: string;
    target: number;
    saved: number;
    targetDate: string | null;
    projectedMonth: string | null;
  }[];
  debts: { id: string; name: string; balance: number; aprBps: number; minPayment: number }[];
}

export interface CoachRequest {
  locale: Locale;
  currency: CurrencyCode;
  context: CoachContext;
  messages: CoachMessage[];
}

export const coachResponseSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('message'),
    text: z.string().max(4000),
    refusal: z.boolean(),
    source,
  }),
  z.object({ type: z.literal('tool_call'), toolCall: toolCallSchema, source }),
]);
export type CoachResponse = z.infer<typeof coachResponseSchema>;

export const checkoutResponseSchema = z.object({ url: z.url() });
export const planResponseSchema = z.object({ plan: z.enum(['free', 'pro']) });
