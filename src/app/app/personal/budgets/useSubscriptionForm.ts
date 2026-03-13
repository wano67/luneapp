import { useState } from 'react';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { parseEuroToCents } from '@/lib/money';
import { revalidate } from '@/lib/revalidate';
import type { SubscriptionProvider, SubscriptionPlan } from '@/config/commonSubscriptions';
import type { RecurringCandidate, Subscription } from './useBudgetData';
import { centsToInputValue, toDateInput } from './useBudgetData';

/* ═══ Types ═══ */

export type SubFormState = {
  name: string;
  amount: string;
  frequency: 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
  startDate: string;
  endDate: string;
  categoryId: string;
  note: string;
};

const EMPTY_SUB_FORM: SubFormState = {
  name: '', amount: '', frequency: 'MONTHLY',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '', categoryId: '', note: '',
};

/* ═══ Hook ═══ */

export function useSubscriptionForm(opts: {
  defaultSubscriptionFrequency: string;
  load: () => Promise<void>;
  loadRecurring: () => Promise<void>;
}) {
  const { defaultSubscriptionFrequency, load, loadRecurring } = opts;

  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subEditingId, setSubEditingId] = useState<string | null>(null);
  const [subForm, setSubForm] = useState<SubFormState>(EMPTY_SUB_FORM);
  const [subSaving, setSubSaving] = useState(false);
  const [subSaveError, setSubSaveError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<SubscriptionProvider | null>(null);

  function openSubCreate() {
    setSubEditingId(null);
    setSubForm({ ...EMPTY_SUB_FORM, frequency: defaultSubscriptionFrequency as SubFormState['frequency'] });
    setSubSaveError(null);
    setSubModalOpen(true);
  }

  function openSubFromPlan(provider: SubscriptionProvider, plan: SubscriptionPlan) {
    setCatalogOpen(false);
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

  function closeSubModal() {
    setSubModalOpen(false);
  }

  function openCatalog() {
    setCatalogOpen(true);
  }

  function closeCatalog() {
    setCatalogOpen(false);
    setSelectedProvider(null);
  }

  function clearSelectedProvider() {
    setSelectedProvider(null);
  }

  return {
    subModalOpen,
    subEditingId,
    subForm,
    setSubForm,
    subSaving,
    subSaveError,
    catalogOpen,
    selectedProvider,
    openSubCreate,
    openSubFromPlan,
    handleProviderClick,
    openManualCreate,
    openSubEdit,
    handleSubSave,
    handleSubToggleActive,
    handleSubDelete,
    addRecurringAsSub,
    closeSubModal,
    openCatalog,
    closeCatalog,
    clearSelectedProvider,
  };
}
