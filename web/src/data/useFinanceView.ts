import { todayIso } from '@moneyflow/shared';
import { useMemo } from 'react';

import { buildFinanceView, type FinanceView } from '@/data/financeView';
import { useCollection, useProfile } from '@/data/hooks';

export interface FinanceViewState {
  view: FinanceView | null;
  isLoading: boolean;
  error: unknown;
  refetch: () => void;
}

/** Load everything the finance view needs and derive it once per data change. */
export function useFinanceView(): FinanceViewState {
  const profile = useProfile();
  const incomes = useCollection('incomes');
  const fixedCosts = useCollection('fixedCosts');
  const debts = useCollection('debts');
  const accounts = useCollection('accounts');
  const goals = useCollection('goals');
  const transactions = useCollection('transactions');
  const budgets = useCollection('budgets');
  const queries = [profile, incomes, fixedCosts, debts, accounts, goals, transactions, budgets];

  const today = todayIso();
  const view = useMemo(() => {
    if (
      !profile.data ||
      !incomes.data ||
      !fixedCosts.data ||
      !debts.data ||
      !accounts.data ||
      !goals.data ||
      !transactions.data ||
      !budgets.data
    ) {
      return null;
    }
    return buildFinanceView(
      {
        profile: profile.data,
        incomes: incomes.data,
        fixedCosts: fixedCosts.data,
        debts: debts.data,
        accounts: accounts.data,
        goals: goals.data,
        transactions: transactions.data,
        budgets: budgets.data,
      },
      today,
    );
  }, [
    profile.data,
    incomes.data,
    fixedCosts.data,
    debts.data,
    accounts.data,
    goals.data,
    transactions.data,
    budgets.data,
    today,
  ]);

  return {
    view,
    isLoading: queries.some((q) => q.isLoading),
    error: queries.find((q) => q.error)?.error ?? null,
    refetch: () => {
      queries.forEach((q) => void q.refetch());
    },
  };
}
