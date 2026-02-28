import { useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';

// ─── Types ────────────────────────────────────────────────────────────────────

type FinanceType = 'INCOME' | 'EXPENSE';
type PaymentMethod = 'WIRE' | 'CARD' | 'CHECK' | 'CASH' | 'OTHER';

type Finance = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  categoryReferenceId: string | null;
  categoryReferenceName: string | null;
  tagReferences: { id: string; name: string }[];
  type: FinanceType;
  amountCents: string;
  amount: number;
  category: string;
  vendor: string | null;
  method: PaymentMethod | null;
  isRecurring: boolean;
  recurringUnit: 'MONTHLY' | 'YEARLY' | null;
  recurringRuleId: string | null;
  isRuleOverride: boolean;
  lockedFromRule: boolean;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type RecurringRule = {
  id: string;
  businessId: string;
  projectId: string | null;
  categoryReferenceId: string | null;
  type: FinanceType;
  amountCents: string;
  category: string;
  vendor: string | null;
  method: PaymentMethod | null;
  note: string | null;
  startDate: string;
  endDate: string | null;
  dayOfMonth: number;
  frequency: 'MONTHLY' | 'YEARLY';
  isActive: boolean;
};

// ─── Hook types ───────────────────────────────────────────────────────────────

type UseRecurringRuleOptions = {
  businessId: string;
  loadFinances: () => Promise<void>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRecurringRule({ businessId, loadFinances }: UseRecurringRuleOptions) {
  const [recurringModalOpen, setRecurringModalOpen] = useState(false);
  const [recurringRule, setRecurringRule] = useState<RecurringRule | null>(null);
  const [recurringOccurrences, setRecurringOccurrences] = useState<Finance[]>([]);
  const [recurringRuleForm, setRecurringRuleForm] = useState({
    amount: '',
    category: '',
    vendor: '',
    method: 'WIRE' as PaymentMethod,
    startDate: '',
    endDate: '',
    dayOfMonth: '',
    isActive: true,
  });
  const [recurringApplyFuture, setRecurringApplyFuture] = useState(true);
  const [recurringRecalculate, setRecurringRecalculate] = useState(false);
  const [recurringHorizonMonths, setRecurringHorizonMonths] = useState('12');
  const [recurringRuleLoading, setRecurringRuleLoading] = useState(false);
  const [recurringRuleError, setRecurringRuleError] = useState<string | null>(null);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  async function openRecurringRule(ruleId: string) {
    setRecurringRuleError(null);
    setRecurringRuleLoading(true);
    setRecurringModalOpen(true);
    try {
      const res = await fetchJson<{ item: RecurringRule; occurrences: Finance[] }>(
        `/api/pro/businesses/${businessId}/finances/recurring/${ruleId}`
      );
      if (!res.ok || !res.data) {
        setRecurringRuleError(res.error ?? 'Impossible de charger la récurrence.');
        setRecurringRule(null);
        setRecurringOccurrences([]);
        return;
      }
      setRecurringRule(res.data.item);
      setRecurringOccurrences(res.data.occurrences ?? []);
      setRecurringRuleForm({
        amount: formatCentsToEuroInput(res.data.item.amountCents),
        category: res.data.item.category,
        vendor: res.data.item.vendor ?? '',
        method: res.data.item.method ?? 'WIRE',
        startDate: res.data.item.startDate.slice(0, 10),
        endDate: res.data.item.endDate ? res.data.item.endDate.slice(0, 10) : '',
        dayOfMonth: String(res.data.item.dayOfMonth ?? ''),
        isActive: res.data.item.isActive,
      });
    } catch (err) {
      setRecurringRuleError(getErrorMessage(err));
      setRecurringRule(null);
      setRecurringOccurrences([]);
    } finally {
      setRecurringRuleLoading(false);
    }
  }

  async function handleSaveRecurringRule() {
    if (!recurringRule) return;
    setRecurringRuleError(null);
    setRecurringRuleLoading(true);
    try {
      const amountCents = parseEuroToCents(recurringRuleForm.amount);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        setRecurringRuleError('Montant invalide.');
        return;
      }
      const dayOfMonth = recurringRuleForm.dayOfMonth
        ? Math.min(31, Math.max(1, Number.parseInt(recurringRuleForm.dayOfMonth, 10)))
        : recurringRule.dayOfMonth;
      if (!Number.isFinite(dayOfMonth) || dayOfMonth <= 0) {
        setRecurringRuleError('Jour de facturation invalide.');
        return;
      }
      const res = await fetchJson<{ item: RecurringRule }>(
        `/api/pro/businesses/${businessId}/finances/recurring/${recurringRule.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amountCents,
            category: recurringRuleForm.category,
            vendor: recurringRuleForm.vendor || null,
            method: recurringRuleForm.method,
            startDate: recurringRuleForm.startDate,
            endDate: recurringRuleForm.endDate || null,
            dayOfMonth,
            isActive: recurringRuleForm.isActive,
            applyToFuture: recurringApplyFuture,
            recalculateFuture: recurringRecalculate,
            horizonMonths: Number.parseInt(recurringHorizonMonths, 10) || 12,
          }),
        }
      );
      if (!res.ok || !res.data) {
        setRecurringRuleError(res.error ?? 'Mise à jour impossible.');
        return;
      }
      setRecurringRule(res.data.item);
      await loadFinances();
      await openRecurringRule(recurringRule.id);
    } catch (err) {
      setRecurringRuleError(getErrorMessage(err));
    } finally {
      setRecurringRuleLoading(false);
    }
  }

  return {
    recurringModalOpen,
    setRecurringModalOpen,
    recurringRule,
    recurringOccurrences,
    recurringRuleForm,
    setRecurringRuleForm,
    recurringApplyFuture,
    setRecurringApplyFuture,
    recurringRecalculate,
    setRecurringRecalculate,
    recurringHorizonMonths,
    setRecurringHorizonMonths,
    recurringRuleLoading,
    recurringRuleError,
    openRecurringRule,
    handleSaveRecurringRule,
  };
}
