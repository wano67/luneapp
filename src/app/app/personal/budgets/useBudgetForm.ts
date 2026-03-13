import { useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { parseEuroToCents } from '@/lib/money';
import { revalidate } from '@/lib/revalidate';
import type { Budget, BudgetTemplate, Category } from './useBudgetData';
import { centsToInputValue } from './useBudgetData';

/* ═══ Types ═══ */

export type BudgetFormState = {
  name: string;
  limitAmount: string;
  period: 'MONTHLY' | 'YEARLY';
  categoryId: string;
};

const EMPTY_BUDGET_FORM: BudgetFormState = { name: '', limitAmount: '', period: 'MONTHLY', categoryId: '' };

/* ═══ Hook ═══ */

export function useBudgetForm(opts: {
  categories: Category[];
  defaultBudgetPeriod: string;
  load: () => Promise<void>;
}) {
  const { categories, defaultBudgetPeriod, load } = opts;

  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetEditingId, setBudgetEditingId] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState<BudgetFormState>(EMPTY_BUDGET_FORM);
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetSaveError, setBudgetSaveError] = useState<string | null>(null);
  const [budgetPickerStep, setBudgetPickerStep] = useState<'picker' | 'form'>('picker');

  function openBudgetCreate() {
    setBudgetEditingId(null);
    setBudgetForm({ ...EMPTY_BUDGET_FORM, period: defaultBudgetPeriod as BudgetFormState['period'] });
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
    setBudgetForm({ ...EMPTY_BUDGET_FORM, period: defaultBudgetPeriod as BudgetFormState['period'] });
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

  function closeBudgetModal() {
    setBudgetModalOpen(false);
  }

  function goBackToPicker() {
    setBudgetPickerStep('picker');
  }

  return {
    budgetModalOpen,
    budgetEditingId,
    budgetForm,
    setBudgetForm,
    budgetSaving,
    budgetSaveError,
    budgetPickerStep,
    openBudgetCreate,
    openBudgetEdit,
    selectBudgetTemplate,
    openBudgetCustom,
    handleBudgetSave,
    handleBudgetDelete,
    closeBudgetModal,
    goBackToPicker,
  };
}
