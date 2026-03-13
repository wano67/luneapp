'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { EmptyState } from '@/components/ui/empty-state';
import { Modal } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { FaviconAvatar } from '@/app/app/components/FaviconAvatar';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroDisplay, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { useUserPreferences } from '@/lib/hooks/useUserPreferences';
import { revalidate, useRevalidationKey } from '@/lib/revalidate';
import { SUBSCRIPTION_PROVIDERS, groupProvidersByCategory, type SubscriptionProvider, type SubscriptionPlan } from '@/config/commonSubscriptions';
import { Plus, Search, ChevronLeft, Zap, PiggyBank, Pencil, Check, X, TrendingUp, TrendingDown, AlertTriangle, Calendar } from 'lucide-react';
import Link from 'next/link';

/* ═══ Types ═══ */

type Category = { id: string; name: string };

type Budget = {
  id: string;
  name: string;
  period: 'MONTHLY' | 'YEARLY';
  limitCents: string;
  spentCents: string;
  category: Category | null;
};

type Subscription = {
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

type RecurringCandidate = {
  label: string;
  estimatedAmountCents: string;
  estimatedFrequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  occurrences: number;
  lastSeen: string;
  categoryId: string | null;
  categoryName: string | null;
};

type SavingsGoalBudget = {
  id: string;
  name: string;
  targetCents: string;
  monthlyContributionCents: string | null;
  priority: number;
  deadline: string | null;
};

type BudgetFormState = {
  name: string;
  limitAmount: string;
  period: 'MONTHLY' | 'YEARLY';
  categoryId: string;
};

type SubFormState = {
  name: string;
  amount: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  categoryId: string;
  note: string;
};

const EMPTY_BUDGET_FORM: BudgetFormState = { name: '', limitAmount: '', period: 'MONTHLY', categoryId: '' };
const EMPTY_SUB_FORM: SubFormState = {
  name: '', amount: '', frequency: 'MONTHLY',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '', categoryId: '', note: '',
};

const FREQUENCY_LABELS: Record<string, string> = {
  WEEKLY: 'Hebdo',
  MONTHLY: 'Mensuel',
  QUARTERLY: 'Trimestriel',
  YEARLY: 'Annuel',
};

/* ═══ Budget Templates ═══ */

type BudgetTemplate = {
  name: string;
  icon: string;
  suggestedCents: number;
  period: 'MONTHLY' | 'YEARLY';
  categoryMatch?: string; // auto-match category name (lowercase)
};

const BUDGET_TEMPLATES: { category: string; items: BudgetTemplate[] }[] = [
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

/* ═══ Helpers ═══ */

function toMonthlyCents(amountCents: string, freq: string): bigint {
  const a = BigInt(amountCents);
  switch (freq) {
    case 'WEEKLY':    return (a * 52n) / 12n;
    case 'QUARTERLY': return (a * 4n) / 12n;
    case 'YEARLY':    return a / 12n;
    default:          return a;
  }
}

function toYearlyCents(amountCents: string, freq: string): bigint {
  const a = BigInt(amountCents);
  switch (freq) {
    case 'WEEKLY':    return a * 52n;
    case 'MONTHLY':   return a * 12n;
    case 'QUARTERLY': return a * 4n;
    default:          return a;
  }
}

function formatLastSeen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function centsToInputValue(cents: string): string {
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

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

/* ═══ Page ═══ */

export default function BudgetsPage() {
  const { prefs } = useUserPreferences();

  // ── Budget state ──
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [monthExpenseCents, setMonthExpenseCents] = useState(0n);
  const [monthIncomeCents, setMonthIncomeCents] = useState(0n);
  const [unbudgetedExpenseCents, setUnbudgetedExpenseCents] = useState(0n);
  const [totalFixedChargesMonthlyCents, setTotalFixedChargesMonthlyCents] = useState(0n);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetEditingId, setBudgetEditingId] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(EMPTY_BUDGET_FORM);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaveError, setBudgetSaveError] = useState<string | null>(null);
  const [budgetPickerStep, setBudgetPickerStep] = useState<'picker' | 'form'>('picker');

  // ── Subscription state ──
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subEditingId, setSubEditingId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<SubFormState>(EMPTY_SUB_FORM);
  const [subSaving, setSubSaving] = useState(false);
  const [subSaveError, setSubSaveError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<SubscriptionProvider | null>(null);

  // ── Savings goals (épargne programmée) state ──
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoalBudget[]>([]);
  const [totalSavingsBudgetCents, setTotalSavingsBudgetCents] = useState(0n);
  const [editingSavingsId, setEditingSavingsId] = useState<string | null>(null);
  const [editingSavingsAmount, setEditingSavingsAmount] = useState('');
  const [savingSavingsGoal, setSavingSavingsGoal] = useState(false);

  // ── Recurring detection state ──
  const [recurring, setRecurring] = useState<RecurringCandidate[]>([]);
  const [recurringLoading, setRecurringLoading] = useState(false);

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

  /* ═══ Budget CRUD ═══ */

  function openBudgetCreate() {
    setBudgetEditingId(null);
    setBudgetForm({ ...EMPTY_BUDGET_FORM, period: prefs.defaultBudgetPeriod as BudgetFormState['period'] });
    setBudgetSaveError(null);
    setBudgetPickerStep('picker');
    setBudgetModalOpen(true);
  }

  function openBudgetEdit(b: Budget) {
    setBudgetEditingId(b.id);
    setBudgetForm({
      name: b.name,
      limitAmount: centsToInputValue(b.limitCents),
      period: b.period,
      categoryId: b.category?.id ?? '',
    });
    setBudgetSaveError(null);
    setBudgetPickerStep('form');
    setBudgetModalOpen(true);
  }

  function selectBudgetTemplate(tpl: BudgetTemplate) {
    const matchedCat = tpl.categoryMatch
      ? categories.find((c) => c.name.toLowerCase().includes(tpl.categoryMatch!))
      : undefined;
    setBudgetForm({
      name: tpl.name,
      limitAmount: (tpl.suggestedCents / 100).toFixed(2),
      period: tpl.period,
      categoryId: matchedCat?.id ?? '',
    });
    setBudgetPickerStep('form');
  }

  function openBudgetCustom() {
    setBudgetForm({ ...EMPTY_BUDGET_FORM, period: prefs.defaultBudgetPeriod as BudgetFormState['period'] });
    setBudgetPickerStep('form');
  }

  async function handleBudgetSave() {
    setBudgetSaveError(null);
    setBudgetSaving(true);
    try {
      const limitCents = parseEuroToCents(budgetForm.limitAmount.replace(',', '.'));
      if (!Number.isFinite(limitCents) || limitCents <= 0) {
        setBudgetSaveError('Montant invalide.');
        return;
      }
      if (!budgetForm.name.trim()) {
        setBudgetSaveError('Nom requis.');
        return;
      }
      const body = {
        name: budgetForm.name.trim(),
        limitCents,
        period: budgetForm.period,
        categoryId: budgetForm.categoryId || null,
      };
      const res = budgetEditingId
        ? await fetchJson(`/api/personal/budgets/${budgetEditingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchJson('/api/personal/budgets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        setBudgetSaveError(res.error ?? 'Erreur lors de la sauvegarde.');
        return;
      }
      setBudgetModalOpen(false);
      await load();
      revalidate('personal:wallet');
    } catch (e) {
      setBudgetSaveError(getErrorMessage(e));
    } finally {
      setBudgetSaving(false);
    }
  }

  async function handleBudgetDelete(id: string) {
    const res = await fetchJson(`/api/personal/budgets/${id}`, { method: 'DELETE' });
    if (res.ok) { await load(); revalidate('personal:wallet'); }
  }

  /* ═══ Subscription CRUD ═══ */

  function openSubCreate() {
    setSubEditingId(null);
    setSubForm({ ...EMPTY_SUB_FORM, frequency: prefs.defaultSubscriptionFrequency as SubFormState['frequency'] });
    setSubSaveError(null);
    setSubModalOpen(true);
  }

  function openSubFromPlan(provider: SubscriptionProvider, plan: SubscriptionPlan) {
    setCatalogOpen(false);
    setCatalogSearch('');
    setSelectedProvider(null);
    setSubEditingId(null);
    setSubForm({
      name: provider.plans.length === 1 ? provider.name : `${provider.name} — ${plan.label}`,
      amount: (plan.defaultCents / 100).toFixed(2),
      frequency: plan.frequency,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      categoryId: '',
      note: '',
    });
    setSubSaveError(null);
    setSubModalOpen(true);
  }

  function handleProviderClick(provider: SubscriptionProvider) {
    if (provider.plans.length === 1) {
      openSubFromPlan(provider, provider.plans[0]);
    } else {
      setSelectedProvider(provider);
    }
  }

  function openManualCreate() {
    setCatalogOpen(false);
    setCatalogSearch('');
    setSelectedProvider(null);
    openSubCreate();
  }

  function openSubEdit(s: Subscription) {
    setSubEditingId(s.id);
    setSubForm({
      name: s.name,
      amount: centsToInputValue(s.amountCents),
      frequency: s.frequency,
      startDate: toDateInput(s.startDate),
      endDate: toDateInput(s.endDate),
      categoryId: s.category?.id ?? '',
      note: s.note ?? '',
    });
    setSubSaveError(null);
    setSubModalOpen(true);
  }

  async function handleSubSave() {
    setSubSaveError(null);
    setSubSaving(true);
    try {
      const amountCents = parseEuroToCents(subForm.amount.replace(',', '.'));
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setSubSaveError('Montant invalide.');
        return;
      }
      if (!subForm.name.trim()) {
        setSubSaveError('Nom requis.');
        return;
      }
      if (!subForm.startDate) {
        setSubSaveError('Date de début requise.');
        return;
      }
      const body = {
        name: subForm.name.trim(),
        amountCents,
        frequency: subForm.frequency,
        startDate: subForm.startDate,
        endDate: subForm.endDate || null,
        categoryId: subForm.categoryId || null,
        note: subForm.note.trim() || null,
      };
      const res = subEditingId
        ? await fetchJson(`/api/personal/subscriptions/${subEditingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetchJson('/api/personal/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        setSubSaveError(res.error ?? 'Erreur lors de la sauvegarde.');
        return;
      }
      setSubModalOpen(false);
      await load();
      revalidate('personal:wallet');
      void loadRecurring();
    } catch (e) {
      setSubSaveError(getErrorMessage(e));
    } finally {
      setSubSaving(false);
    }
  }

  async function handleSubToggleActive(s: Subscription) {
    await fetchJson(`/api/personal/subscriptions/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    await load();
    revalidate('personal:wallet');
  }

  async function handleSubDelete(id: string) {
    const res = await fetchJson(`/api/personal/subscriptions/${id}`, { method: 'DELETE' });
    if (res.ok) { await load(); revalidate('personal:wallet'); }
  }

  /* ═══ Add recurring as subscription ═══ */

  function addRecurringAsSub(r: RecurringCandidate) {
    setSubEditingId(null);
    setSubForm({
      name: r.label,
      amount: centsToInputValue(r.estimatedAmountCents),
      frequency: r.estimatedFrequency,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
      categoryId: r.categoryId ?? '',
      note: '',
    });
    setSubSaveError(null);
    setSubModalOpen(true);
  }

  const [linkingLabel, setLinkingLabel] = useState<string | null>(null);

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

  /* ═══ Render ═══ */

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Gestion du budget"
        subtitle="Vue d'ensemble de tes finances, budgets et charges."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCatalogOpen(true)}>
              <Plus size={14} /> Charge fixe
            </Button>
            <Button size="sm" onClick={openBudgetCreate}>
              <Plus size={14} /> Budget
            </Button>
          </div>
        }
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {/* ── KPIs ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Revenus du mois"
          value={formatCentsToEuroDisplay(monthIncomeCents.toString())}
          trend={monthIncomeCents > 0n ? 'up' : undefined}
        />
        <KpiCard
          label="Charges fixes / mois"
          value={formatCentsToEuroDisplay(totalFixedChargesMonthlyCents.toString())}
        />
        <KpiCard
          label="Dépensé ce mois"
          value={formatCentsToEuroDisplay(monthExpenseCents.toString())}
          trend={monthExpenseCents > totalLimit ? 'down' : 'up'}
        />
        <KpiCard
          label="Hors budget"
          value={formatCentsToEuroDisplay(unbudgetedExpenseCents.toString())}
          trend={unbudgetedExpenseCents > 0n ? 'down' : 'up'}
        />
      </div>

      {/* ── Synthèse mensuelle ── */}
      {(() => {
        const disponible = monthIncomeCents - totalFixedChargesMonthlyCents - totalLimit - totalSavingsBudgetCents;
        const disponiblePositive = disponible >= 0n;
        return (
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-faint)] mb-3">
              Synthèse mensuelle
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingUp size={14} className="text-[var(--success)]" /> Revenus
                </span>
                <span className="font-semibold text-[var(--success)]">
                  +{formatCentsToEuroDisplay(monthIncomeCents.toString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingDown size={14} className="text-[var(--danger)]" /> Charges fixes
                </span>
                <span className="font-medium text-[var(--danger)]">
                  -{formatCentsToEuroDisplay(totalFixedChargesMonthlyCents.toString())}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                  <TrendingDown size={14} className="text-[var(--danger)]" /> Budgets alloués
                </span>
                <span className="font-medium text-[var(--danger)]">
                  -{formatCentsToEuroDisplay(totalLimit.toString())}
                </span>
              </div>
              {totalSavingsBudgetCents > 0n ? (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <PiggyBank size={14} className="text-[var(--primary)]" /> Épargne programmée
                  </span>
                  <span className="font-medium text-[var(--primary)]">
                    -{formatCentsToEuroDisplay(totalSavingsBudgetCents.toString())}
                  </span>
                </div>
              ) : null}
              <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between">
                <span className="font-semibold">Capacité restante</span>
                <span className={`font-bold text-base ${disponiblePositive ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                  {disponiblePositive ? '' : '-'}{formatCentsToEuroDisplay((disponiblePositive ? disponible : -disponible).toString())}
                </span>
              </div>
              {unbudgetedExpenseCents > 0n ? (
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="flex items-center gap-1.5 text-[var(--warning)]">
                    <AlertTriangle size={12} /> Dépenses hors budget ce mois
                  </span>
                  <span className="font-semibold text-[var(--warning)]">
                    {formatCentsToEuroDisplay(unbudgetedExpenseCents.toString())}
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        );
      })()}

      {overBudget > 0 ? (
        <p className="text-sm font-semibold text-[var(--danger)]">
          {overBudget} budget{overBudget > 1 ? 's' : ''} dépassé{overBudget > 1 ? 's' : ''}
        </p>
      ) : null}

      {/* ════════════════ BUDGETS SECTION ════════════════ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Budgets</h2>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : budgets.length === 0 ? (
          <EmptyState
            title="Aucun budget"
            description="Crée des enveloppes pour suivre tes catégories de dépenses."
            action={<Button size="sm" onClick={openBudgetCreate}>Créer un budget</Button>}
          />
        ) : (
          <div className="space-y-3">
            {budgets.map((b) => {
              const spent = BigInt(b.spentCents);
              const limit = BigInt(b.limitCents);
              const pct = limit > 0n ? Number((spent * 100n) / limit) : 0;
              const over = spent > limit;
              return (
                <Card key={b.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{b.name}</p>
                        {b.category ? <Badge variant="neutral">{b.category.name}</Badge> : null}
                        <Badge variant={b.period === 'MONTHLY' ? 'pro' : 'neutral'}>
                          {b.period === 'MONTHLY' ? 'Mensuel' : 'Annuel'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(b.spentCents)} / {formatCentsToEuroDisplay(b.limitCents)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openBudgetEdit(b)}>Modifier</Button>
                      <Button size="sm" variant="danger" onClick={() => handleBudgetDelete(b.id)}>Supprimer</Button>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        backgroundColor: over ? 'var(--danger)' : 'var(--success)',
                      }}
                    />
                  </div>
                  {over ? (
                    <p className="mt-1 text-xs font-semibold text-[var(--danger)]">
                      Dépassé de {formatCentsToEuroDisplay((spent - limit).toString())}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════ ÉPARGNE PROGRAMMÉE SECTION ════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <PiggyBank size={18} className="text-[var(--primary)]" />
            <h2 className="text-lg font-semibold">Épargne programmée</h2>
          </div>
          <Link href="/app/personal/epargne" className="text-xs text-[var(--primary)] hover:underline">
            Gérer les objectifs →
          </Link>
        </div>
        {savingsGoals.length === 0 ? (
          <Card className="p-4">
            <p className="text-sm text-[var(--text-faint)]">
              Aucun objectif d&apos;épargne avec contribution mensuelle.{' '}
              <Link href="/app/personal/epargne" className="text-[var(--primary)] hover:underline">
                Définis tes objectifs
              </Link>{' '}
              et programme un montant mensuel pour chacun.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {savingsGoals.map((g) => (
              <Card key={g.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{g.name}</p>
                      {g.priority >= 2 && <Badge variant="danger">Prioritaire</Badge>}
                      {g.priority === 1 && <Badge variant="neutral">Moyenne</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-[var(--text-faint)]">
                      Objectif : {formatCentsToEuroDisplay(g.targetCents)}
                      {g.deadline ? ` · Échéance : ${new Date(g.deadline).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {editingSavingsId === g.id ? (
                      <>
                        <Input
                          value={editingSavingsAmount}
                          onChange={(e) => setEditingSavingsAmount(sanitizeEuroInput(e.target.value))}
                          placeholder="0.00"
                          className="w-24 text-right text-sm"
                        />
                        <span className="text-xs text-[var(--text-faint)]">€/mois</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void saveSavingsContribution(g.id)}
                          disabled={savingSavingsGoal}
                        >
                          <Check size={14} />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingSavingsId(null)}>
                          <X size={14} />
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-[var(--primary)]">
                          {g.monthlyContributionCents
                            ? `${formatCentsToEuroDisplay(g.monthlyContributionCents)} / mois`
                            : '—'}
                        </p>
                        <Button size="sm" variant="outline" onClick={() => startEditSavings(g)}>
                          <Pencil size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
            <div className="flex justify-end pt-1">
              <p className="text-sm font-semibold">
                Total : {formatCentsToEuroDisplay(totalSavingsBudgetCents.toString())} / mois
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ════════════════ CHARGES FIXES SECTION ════════════════ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Charges fixes</h2>
          <Button size="sm" variant="outline" onClick={() => setCatalogOpen(true)}>
            <Plus size={14} /> Ajouter
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
        ) : subscriptions.length === 0 ? (
          <EmptyState
            title="Aucune charge fixe"
            description="Ajoute tes abonnements et charges récurrentes pour calculer ta capacité d'épargne."
            action={
              <Button size="sm" onClick={() => setCatalogOpen(true)}>
                Ajouter un abonnement
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {subscriptions.map((s) => {
              const monthly = toMonthlyCents(s.amountCents, s.frequency);
              return (
                <Card key={s.id} className="p-4" style={s.isActive ? undefined : { opacity: 0.6 }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{s.name}</p>
                        <Badge variant={s.isActive ? 'pro' : 'neutral'}>
                          {s.isActive ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Badge variant="neutral">{FREQUENCY_LABELS[s.frequency] ?? s.frequency}</Badge>
                        {s.category ? <Badge variant="neutral">{s.category.name}</Badge> : null}
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-faint)]">
                        {formatCentsToEuroDisplay(s.amountCents)} / {FREQUENCY_LABELS[s.frequency]?.toLowerCase() ?? s.frequency}
                        {s.frequency !== 'MONTHLY' ? ` · ${formatCentsToEuroDisplay(monthly.toString())} / mois` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openSubEdit(s)}>Modifier</Button>
                      <Button size="sm" variant="outline" onClick={() => handleSubToggleActive(s)}>
                        {s.isActive ? 'Désactiver' : 'Activer'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleSubDelete(s.id)}>Supprimer</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ════════════════ DÉPENSES RÉCURRENTES DÉTECTÉES ════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={18} className="text-[var(--warning)]" />
          <h2 className="text-lg font-semibold">Dépenses récurrentes détectées</h2>
        </div>
        <p className="text-xs text-[var(--text-faint)] mb-3">
          Analyse automatique de tes transactions des 12 derniers mois. Ajoute-les en charges fixes pour mieux suivre ton budget.
        </p>
        {recurringLoading ? (
          <p className="text-sm text-[var(--text-faint)]">Analyse en cours…</p>
        ) : recurring.length === 0 ? (
          <p className="text-sm text-[var(--text-faint)]">
            Aucune dépense récurrente détectée pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {recurring.map((r) => {
              const monthly = toMonthlyCents(r.estimatedAmountCents, r.estimatedFrequency);
              const yearly = toYearlyCents(r.estimatedAmountCents, r.estimatedFrequency);
              const impactPct = monthExpenseCents > 0n
                ? Number((monthly * 100n) / monthExpenseCents)
                : 0;
              return (
                <Card key={r.label} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <p className="text-base font-semibold capitalize">{r.label}</p>
                        {r.categoryName ? <Badge variant="neutral">{r.categoryName}</Badge> : null}
                      </div>

                      {/* Données clés mises en évidence */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-2">
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Coût mensuel</p>
                          <p className="text-sm font-bold text-[var(--danger)]">
                            ~{formatCentsToEuroDisplay(monthly.toString())}
                          </p>
                        </div>
                        <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Coût annuel</p>
                          <p className="text-sm font-bold text-[var(--text)]">
                            ~{formatCentsToEuroDisplay(yearly.toString())}
                          </p>
                        </div>
                        {impactPct > 0 ? (
                          <div className="rounded-lg bg-[var(--surface-2)] px-3 py-2">
                            <p className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Impact budget</p>
                            <p className="text-sm font-bold text-[var(--warning)]">
                              {impactPct}% des dépenses
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {/* Détails */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-faint)]">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} /> {FREQUENCY_LABELS[r.estimatedFrequency]}
                        </span>
                        <span>·</span>
                        <span>{r.occurrences} occurrence{r.occurrences > 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>Dernière : {formatLastSeen(r.lastSeen)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {budgets.filter((b) => b.category).length > 0 && (
                        <Select
                          value=""
                          onChange={(e) => { if (e.target.value) linkRecurringToBudget(r.label, e.target.value); }}
                          disabled={linkingLabel === r.label}
                          className="h-8 w-44 rounded-lg text-xs"
                        >
                          <option value="">
                            {linkingLabel === r.label ? 'Association…' : 'Associer à un budget'}
                          </option>
                          {budgets.filter((b) => b.category).map((b) => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </Select>
                      )}
                      <Button size="sm" variant="outline" className="shrink-0" onClick={() => addRecurringAsSub(r)}>
                        <Plus size={14} /> Charge fixe
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}

            {/* Total estimé */}
            {(() => {
              const totalMonthly = recurring.reduce(
                (sum, r) => sum + toMonthlyCents(r.estimatedAmountCents, r.estimatedFrequency), 0n,
              );
              const totalYearly = recurring.reduce(
                (sum, r) => sum + toYearlyCents(r.estimatedAmountCents, r.estimatedFrequency), 0n,
              );
              return (
                <Card className="p-4 border-dashed">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text-secondary)]">
                      Total estimé des dépenses récurrentes non suivies
                    </p>
                    <div className="flex gap-4 text-sm">
                      <span className="font-bold text-[var(--danger)]">
                        ~{formatCentsToEuroDisplay(totalMonthly.toString())} / mois
                      </span>
                      <span className="font-semibold text-[var(--text-faint)]">
                        ~{formatCentsToEuroDisplay(totalYearly.toString())} / an
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })()}
          </div>
        )}
      </section>

      {/* ══════════ CATALOG PICKER MODAL ══════════ */}
      <Modal
        open={catalogOpen}
        onCloseAction={() => { setCatalogOpen(false); setCatalogSearch(''); setSelectedProvider(null); }}
        title={selectedProvider ? selectedProvider.name : 'Ajouter une charge fixe'}
        description={selectedProvider ? 'Choisis un abonnement.' : 'Choisis un service ou crée un abonnement personnalisé.'}
      >
        {selectedProvider ? (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="flex items-center gap-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
            >
              <ChevronLeft size={16} /> Retour
            </button>
            <div className="flex items-center gap-3 mb-2">
              <FaviconAvatar name={selectedProvider.name} websiteUrl={selectedProvider.websiteUrl} size={36} />
              <p className="font-semibold">{selectedProvider.name}</p>
            </div>
            <div className="space-y-2">
              {selectedProvider.plans.map((plan) => (
                <button
                  key={plan.label}
                  type="button"
                  onClick={() => openSubFromPlan(selectedProvider, plan)}
                  className="flex items-center justify-between w-full rounded-xl border border-[var(--border)] p-4 text-left hover:bg-[var(--surface-hover)] transition-colors"
                >
                  <p className="text-sm font-semibold">{plan.label}</p>
                  <p className="text-sm text-[var(--text-faint)]">
                    {(plan.defaultCents / 100).toFixed(2).replace('.', ',')} € / {plan.frequency === 'YEARLY' ? 'an' : 'mois'}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
              <Input
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="Rechercher un service…"
                className="pl-9"
              />
            </div>
            <button
              type="button"
              onClick={openManualCreate}
              className="flex items-center gap-3 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={16} className="text-[var(--text-faint)]" />
              Saisie manuelle
            </button>
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {Array.from(catalogGrouped.entries()).map(([cat, providers]) => (
                <div key={cat}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">{cat}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {providers.map((provider) => (
                      <button
                        key={provider.name}
                        type="button"
                        onClick={() => handleProviderClick(provider)}
                        className="flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <FaviconAvatar name={provider.name} websiteUrl={provider.websiteUrl} size={28} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{provider.name}</p>
                          <p className="text-xs text-[var(--text-faint)]">
                            {provider.plans.length} offre{provider.plans.length > 1 ? 's' : ''}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {catalogGrouped.size === 0 ? (
                <p className="text-sm text-[var(--text-faint)] text-center py-4">Aucun résultat</p>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* ══════════ SUBSCRIPTION FORM MODAL ══════════ */}
      <Modal
        open={subModalOpen}
        onCloseAction={() => setSubModalOpen(false)}
        title={subEditingId ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'}
        description="Déclare une charge fixe ou récurrente."
      >
        <div className="space-y-4">
          {subSaveError ? <p className="text-xs text-[var(--danger)]">{subSaveError}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Nom du service</span>
              <Input
                value={subForm.name}
                onChange={(e) => setSubForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Netflix, Loyer, Assurance"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Montant (€)</span>
              <Input
                value={subForm.amount}
                onChange={(e) => setSubForm((p) => ({ ...p, amount: sanitizeEuroInput(e.target.value) }))}
                placeholder="15.99"
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Fréquence</span>
              <Select
                value={subForm.frequency}
                onChange={(e) => setSubForm((p) => ({ ...p, frequency: e.target.value as SubFormState['frequency'] }))}
              >
                <option value="WEEKLY">Hebdomadaire</option>
                <option value="MONTHLY">Mensuel</option>
                <option value="QUARTERLY">Trimestriel</option>
                <option value="YEARLY">Annuel</option>
              </Select>
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Date de début</span>
              <Input
                type="date"
                value={subForm.startDate}
                onChange={(e) => setSubForm((p) => ({ ...p, startDate: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-xs text-[var(--text-faint)]">Date de fin (optionnel)</span>
              <Input
                type="date"
                value={subForm.endDate}
                onChange={(e) => setSubForm((p) => ({ ...p, endDate: e.target.value }))}
              />
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Catégorie (optionnel)</span>
              <Select
                value={subForm.categoryId}
                onChange={(e) => setSubForm((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">— Aucune catégorie —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </label>
            <label className="col-span-2 text-sm">
              <span className="text-xs text-[var(--text-faint)]">Note (optionnel)</span>
              <Input
                value={subForm.note}
                onChange={(e) => setSubForm((p) => ({ ...p, note: e.target.value }))}
                placeholder="Ex: Engagement 12 mois"
              />
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setSubModalOpen(false)}>Annuler</Button>
            <Button size="sm" onClick={handleSubSave} disabled={subSaving}>
              {subSaving ? 'Enregistrement…' : subEditingId ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ══════════ BUDGET FORM MODAL ══════════ */}
      <Modal
        open={budgetModalOpen}
        onCloseAction={() => setBudgetModalOpen(false)}
        title={
          budgetEditingId
            ? 'Modifier le budget'
            : budgetPickerStep === 'picker'
              ? 'Nouveau budget'
              : `Budget : ${budgetForm.name || 'Personnalisé'}`
        }
        description={
          budgetEditingId
            ? 'Modifiez votre enveloppe budgétaire.'
            : budgetPickerStep === 'picker'
              ? 'Choisissez un type de budget ou créez le vôtre.'
              : 'Ajustez le montant et la catégorie liée.'
        }
      >
        {budgetPickerStep === 'picker' && !budgetEditingId ? (
          <div className="space-y-4">
            {/* Custom budget button */}
            <button
              type="button"
              onClick={openBudgetCustom}
              className="flex items-center gap-3 w-full rounded-xl border border-dashed border-[var(--border)] p-3 text-sm font-medium hover:bg-[var(--surface-hover)] transition-colors"
            >
              <Plus size={16} className="text-[var(--text-faint)]" />
              Budget personnalisé
            </button>

            {/* Template grid by category */}
            <div className="max-h-[50vh] overflow-y-auto space-y-4">
              {BUDGET_TEMPLATES.map((group) => (
                <div key={group.category}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-faint)] mb-2">
                    {group.category}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.items.map((tpl) => {
                      const alreadyExists = budgets.some(
                        (b) => b.name.toLowerCase() === tpl.name.toLowerCase(),
                      );
                      return (
                        <button
                          key={tpl.name}
                          type="button"
                          onClick={() => selectBudgetTemplate(tpl)}
                          disabled={alreadyExists}
                          className={`flex items-center gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-colors ${alreadyExists ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[var(--surface-hover)]'}`}
                        >
                          <span className="text-xl">{tpl.icon}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold truncate">{tpl.name}</p>
                            <p className="text-xs text-[var(--text-faint)]">
                              ~{(tpl.suggestedCents / 100).toFixed(0)} € / mois
                            </p>
                          </div>
                          {alreadyExists && (
                            <span className="shrink-0 text-[10px] font-medium text-[var(--success)]">
                              <Check size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!budgetEditingId && (
              <button
                type="button"
                onClick={() => setBudgetPickerStep('picker')}
                className="flex items-center gap-1 text-sm text-[var(--text-faint)] hover:text-[var(--text)] transition-colors"
              >
                <ChevronLeft size={16} /> Retour aux suggestions
              </button>
            )}
            {budgetSaveError ? <p className="text-xs text-[var(--danger)]">{budgetSaveError}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="col-span-2 text-sm">
                <span className="text-xs text-[var(--text-faint)]">Nom du budget</span>
                <Input
                  value={budgetForm.name}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Alimentation"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--text-faint)]">Montant limite (€)</span>
                <Input
                  value={budgetForm.limitAmount}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, limitAmount: sanitizeEuroInput(e.target.value) }))}
                  placeholder="500"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-[var(--text-faint)]">Période</span>
                <Select
                  value={budgetForm.period}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, period: e.target.value as 'MONTHLY' | 'YEARLY' }))}
                >
                  <option value="MONTHLY">Mensuel</option>
                  <option value="YEARLY">Annuel</option>
                </Select>
              </label>
              <label className="col-span-2 text-sm">
                <span className="text-xs text-[var(--text-faint)]">Catégorie liée (optionnel)</span>
                <Select
                  value={budgetForm.categoryId}
                  onChange={(e) => setBudgetForm((p) => ({ ...p, categoryId: e.target.value }))}
                >
                  <option value="">— Aucune catégorie —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setBudgetModalOpen(false)}>Annuler</Button>
              <Button size="sm" onClick={handleBudgetSave} disabled={budgetSaving}>
                {budgetSaving ? 'Enregistrement…' : budgetEditingId ? 'Enregistrer' : 'Créer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}
