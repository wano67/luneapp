import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { useRevalidationKey, revalidate } from '@/lib/revalidate';
import { SUBSCRIPTION_PROVIDERS, groupProvidersByCategory } from '@/config/commonSubscriptions';

/* ═══ Types ═══ */

export type Category = { id: string; name: string };

export type Budget = {
  id: string;
  name: string;
  period: 'MONTHLY' | 'YEARLY';
  limitCents: string;
  spentCents: string;
  category: Category | null;
};

export type Subscription = {
  id: string;
  name: string;
  amountCents: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  note: string | null;
  category: Category | null;
};

export type RecurringCandidate = {
  label: string;
  estimatedAmountCents: string;
  estimatedFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  occurrences: number;
  lastSeen: string;
  categoryId: string | null;
  categoryName: string | null;
};

export type SavingsGoalBudget = {
  id: string;
  name: string;
  targetCents: string;
  monthlyContributionCents: string | null;
  priority: number;
  deadline: string | null;
};

/* ═══ Helpers ═══ */

export function toMonthlyCents(amountCents: string, freq: string): bigint {
  const a = BigInt(amountCents);
  switch (freq) {
    case 'WEEKLY':    return (a * 52n) / 12n;
    case 'QUARTERLY': return (a * 4n) / 12n;
    case 'YEARLY':    return a / 12n;
    default:          return a;
  }
}

export function toYearlyCents(amountCents: string, freq: string): bigint {
  const a = BigInt(amountCents);
  switch (freq) {
    case 'WEEKLY':    return a * 52n;
    case 'MONTHLY':   return a * 12n;
    case 'QUARTERLY': return a * 4n;
    default:          return a;
  }
}

export function formatLastSeen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function centsToInputValue(cents: string): string {
  try {
    const b = BigInt(cents);
    const abs = b < 0n ? -b : b;
    const euros = abs / 100n;
    const rem = abs % 100n;
    return `${euros}.${rem.toString().padStart(2, '0')}`;
  } catch {
    return '';
  }
}

export function toDateInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

export const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdo',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

/* ═══ Budget Templates ═══ */

export type BudgetTemplate = {
  name: string;
  icon: string;
  suggestedCents: number;
  period: 'MONTHLY' | 'YEARLY';
  categoryMatch?: string;
};

export const BUDGET_TEMPLATES: { category: string; items: BudgetTemplate[] }[] = [
  {
    category: 'Logement',
    items: [
      { name: 'Loyer', icon: '🏠', suggestedCents: 80000, period: 'MONTHLY', categoryMatch: 'loyer' },
      { name: 'Électricité', icon: '⚡', suggestedCents: 12000, period: 'MONTHLY', categoryMatch: 'électricité' },
      { name: 'Gaz', icon: '🔥', suggestedCents: 8000, period: 'MONTHLY', categoryMatch: 'gaz' },
      { name: 'Eau', icon: '💧', suggestedCents: 4000, period: 'MONTHLY', categoryMatch: 'eau' },
      { name: 'Assurance habitation', icon: '🛡️', suggestedCents: 3000, period: 'MONTHLY', categoryMatch: 'assurance' },
    ],
  },
  {
    category: 'Quotidien',
    items: [
      { name: 'Courses & alimentation', icon: '🛒', suggestedCents: 40000, period: 'MONTHLY', categoryMatch: 'alimentation' },
      { name: 'Restaurants', icon: '🍽️', suggestedCents: 15000, period: 'MONTHLY', categoryMatch: 'restaurant' },
      { name: 'Transport', icon: '🚗', suggestedCents: 15000, period: 'MONTHLY', categoryMatch: 'transport' },
      { name: 'Essence / Carburant', icon: '⛽', suggestedCents: 12000, period: 'MONTHLY', categoryMatch: 'essence' },
    ],
  },
  {
    category: 'Loisirs & personnel',
    items: [
      { name: 'Loisirs & sorties', icon: '🎭', suggestedCents: 15000, period: 'MONTHLY', categoryMatch: 'loisir' },
      { name: 'Shopping & vêtements', icon: '👕', suggestedCents: 10000, period: 'MONTHLY', categoryMatch: 'vêtement' },
      { name: 'Abonnements', icon: '📱', suggestedCents: 5000, period: 'MONTHLY', categoryMatch: 'abonnement' },
      { name: 'Sport & bien-être', icon: '🏋️', suggestedCents: 5000, period: 'MONTHLY', categoryMatch: 'sport' },
    ],
  },
  {
    category: 'Santé & éducation',
    items: [
      { name: 'Santé', icon: '🏥', suggestedCents: 8000, period: 'MONTHLY', categoryMatch: 'santé' },
      { name: 'Mutuelle', icon: '💊', suggestedCents: 5000, period: 'MONTHLY', categoryMatch: 'mutuelle' },
      { name: 'Éducation & formation', icon: '📚', suggestedCents: 10000, period: 'MONTHLY', categoryMatch: 'éducation' },
    ],
  },
];

/* ═══ Hook ═══ */

export function useBudgetData() {
  // ── Budget state ──
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthExpenseCents, setMonthExpenseCents] = useState(0n);
  const [monthIncomeCents, setMonthIncomeCents] = useState(0n);
  const [unbudgetedExpenseCents, setUnbudgetedExpenseCents] = useState(0n);
  const [totalFixedChargesMonthlyCents, setTotalFixedChargesMonthlyCents] = useState(0n);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Subscription state ──
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);

  // ── Savings goals state ──
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalBudget[]>([]);
  const [totalSavingsBudgetCents, setTotalSavingsBudgetCents] = useState(0n);
  const [editingSavingsId, setEditingSavingsId] = useState<string | null>(null);
  const [editingSavingsAmount, setEditingSavingsAmount] = useState('');
  const [savingSavingsGoal, setSavingSavingsGoal] = useState(false);

  // ── Recurring detection state ──
  const [recurring, setRecurring] = useState<RecurringCandidate[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

  // ── Linking state ──
  const [linkingLabel, setLinkingLabel] = useState<string | null>(null);

  // ── Catalog search ──
  const [catalogSearch, setCatalogSearch] = useState('');

  /* ═══ Data loading ═══ */

  const load = useCallback(async () => {
    setLoading(true);
    const [bRes, cRes, sRes] = await Promise.all([
      fetchJson<{
        items: Budget[];
        monthExpenseCents: string;
        monthIncomeCents: string;
        unbudgetedExpenseCents: string;
        totalFixedChargesMonthlyCents: string;
        savingsGoals: SavingsGoalBudget[];
        totalSavingsBudgetCents: string;
      }>('/api/personal/budgets'),
      fetchJson<{ items: Category[] }>('/api/personal/categories'),
      fetchJson<{ items: Subscription[] }>('/api/personal/subscriptions'),
    ]);
    if (bRes.ok && bRes.data) {
      setBudgets(bRes.data.items ?? []);
      setMonthExpenseCents(BigInt(String(bRes.data.monthExpenseCents ?? '0')));
      setMonthIncomeCents(BigInt(String(bRes.data.monthIncomeCents ?? '0')));
      setUnbudgetedExpenseCents(BigInt(String(bRes.data.unbudgetedExpenseCents ?? '0')));
      setTotalFixedChargesMonthlyCents(BigInt(String(bRes.data.totalFixedChargesMonthlyCents ?? '0')));
      setSavingsGoals(bRes.data.savingsGoals ?? []);
      setTotalSavingsBudgetCents(BigInt(String(bRes.data.totalSavingsBudgetCents ?? '0')));
    } else {
      setError(bRes.error ?? 'Impossible de charger les budgets.');
    }
    if (cRes.ok && cRes.data) setCategories(cRes.data.items ?? []);
    if (sRes.ok && sRes.data) setSubscriptions(sRes.data.items ?? []);
    setLoading(false);
  }, []);

  const loadRecurring = useCallback(async () => {
    setRecurringLoading(true);
    const res = await fetchJson<{ items: RecurringCandidate[] }>('/api/personal/transactions/recurring');
    if (res.ok && res.data) setRecurring(res.data.items ?? []);
    setRecurringLoading(false);
  }, []);

  const walletRv = useRevalidationKey(['personal:wallet']);
  useEffect(() => {
    void load();
    void loadRecurring();
  }, [load, loadRecurring, walletRv]);

  /* ═══ Savings contribution inline edit ═══ */

  function startEditSavings(g: SavingsGoalBudget) {
    setEditingSavingsId(g.id);
    setEditingSavingsAmount(g.monthlyContributionCents ? centsToInputValue(g.monthlyContributionCents) : '');
  }

  async function saveSavingsContribution(goalId: string) {
    setSavingSavingsGoal(true);
    try {
      const cents = editingSavingsAmount.trim()
        ? parseEuroToCents(editingSavingsAmount.replace(',', '.'))
        : 0;
      if (!Number.isFinite(cents) || cents < 0) return;
      await fetchJson(`/api/personal/savings/${goalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyContributionCents: cents || null }),
      });
      setEditingSavingsId(null);
      await load();
      revalidate('personal:savings');
    } finally {
      setSavingSavingsGoal(false);
    }
  }

  function cancelEditSavings() {
    setEditingSavingsId(null);
  }

  function onEditingSavingsAmountChange(value: string) {
    setEditingSavingsAmount(sanitizeEuroInput(value));
  }

  /* ═══ Link recurring to budget ═══ */

  async function linkRecurringToBudget(recurringLabel: string, budgetId: string) {
    const budget = budgets.find((b) => b.id === budgetId);
    if (!budget?.category) return;
    setLinkingLabel(recurringLabel);
    try {
      const res = await fetchJson('/api/personal/transactions/categorize-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: recurringLabel, categoryId: budget.category.id }),
      });
      if (res.ok) {
        await Promise.all([load(), loadRecurring()]);
        revalidate('personal:wallet');
      }
    } catch {
      // ignore
    } finally {
      setLinkingLabel(null);
    }
  }

  /* ═══ Computed ═══ */

  const totalLimit = budgets.reduce((s, b) => s + BigInt(b.limitCents), 0n);
  const overBudget = budgets.filter((b) => BigInt(b.spentCents) > BigInt(b.limitCents)).length;

  const catalogGrouped = useMemo(() => {
    const q = catalogSearch.toLowerCase().trim();
    const filtered = q
      ? SUBSCRIPTION_PROVIDERS.filter((p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
      : SUBSCRIPTION_PROVIDERS;
    return groupProvidersByCategory(filtered);
  }, [catalogSearch]);

  return {
    // Data
    budgets,
    subscriptions,
    categories,
    recurring,
    savingsGoals,

    // Aggregated values
    monthExpenseCents,
    monthIncomeCents,
    unbudgetedExpenseCents,
    totalFixedChargesMonthlyCents,
    totalSavingsBudgetCents,
    totalLimit,
    overBudget,

    // Loading / error
    loading,
    error,
    recurringLoading,

    // Refetch
    load,
    loadRecurring,

    // Savings inline edit
    editingSavingsId,
    editingSavingsAmount,
    savingSavingsGoal,
    startEditSavings,
    saveSavingsContribution,
    cancelEditSavings,
    onEditingSavingsAmountChange,

    // Recurring → budget linking
    linkingLabel,
    linkRecurringToBudget,

    // Catalog search + grouped
    catalogSearch,
    setCatalogSearch,
    catalogGrouped,
  };
}
