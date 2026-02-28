import { useState, useMemo, type ChangeEvent, type FormEvent } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';

type FinanceType = 'INCOME' | 'EXPENSE';
type PaymentMethod = 'WIRE' | 'CARD' | 'CHECK' | 'CASH' | 'OTHER';
type RecurringUnit = 'MONTHLY' | 'YEARLY';

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
  recurringUnit: RecurringUnit | null;
  recurringRuleId: string | null;
  isRuleOverride: boolean;
  lockedFromRule: boolean;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type FinanceDetailResponse = { item: Finance };

export type FinanceFormState = {
  type: FinanceType;
  amount: string;
  category: string;
  date: string;
  projectId: string;
  note: string;
  vendor: string;
  method: PaymentMethod;
  isRecurring: boolean;
  recurringUnit: RecurringUnit;
  recurringMonths: string;
  recurringRetroactive: boolean;
  recurringEndDate: string;
  recurringDayOfMonth: string;
  categoryReferenceId: string;
  tagReferenceIds: string[];
};

const EMPTY_FORM: FinanceFormState = {
  type: 'EXPENSE',
  amount: '',
  category: 'Autre',
  date: '',
  projectId: '',
  note: '',
  vendor: '',
  method: 'WIRE',
  isRecurring: false,
  recurringUnit: 'MONTHLY',
  recurringMonths: '12',
  recurringRetroactive: true,
  recurringEndDate: '',
  recurringDayOfMonth: '',
  categoryReferenceId: '',
  tagReferenceIds: [],
};

interface UseFinanceFormParams {
  businessId: string;
  isAdmin: boolean;
  readOnlyMessage: string;
  loadFinances: () => Promise<void>;
  setSelectedId: (id: string | null) => void;
  setInfo: (msg: string | null) => void;
  setError: (msg: string | null) => void;
}

export function useFinanceForm(params: UseFinanceFormParams) {
  const { businessId, isAdmin, readOnlyMessage, loadFinances, setSelectedId, setInfo, setError } = params;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Finance | null>(null);
  const [form, setForm] = useState<FinanceFormState>({ ...EMPTY_FORM });
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const recurringPreview = useMemo(() => {
    if (!form.isRecurring || form.recurringUnit !== 'MONTHLY' || !form.date) return null;
    const start = new Date(form.date);
    if (Number.isNaN(start.getTime())) return null;
    const now = new Date();
    const startIndex = start.getFullYear() * 12 + start.getMonth();
    const currentIndex = now.getFullYear() * 12 + now.getMonth();
    const pastCount =
      form.recurringRetroactive && startIndex < currentIndex ? currentIndex - startIndex : 0;
    const futureCount = Number.parseInt(form.recurringMonths, 10) || 12;
    return { pastCount, futureCount };
  }, [form.date, form.isRecurring, form.recurringMonths, form.recurringRetroactive, form.recurringUnit]);

  function openCreate() {
    setEditing(null);
    setInfo(null);
    setForm({ ...EMPTY_FORM });
    setActionError(null);
    setModalOpen(true);
  }

  function openEdit(item: Finance) {
    setEditing(item);
    setInfo(null);
    setForm({
      type: item.type,
      amount: formatCentsToEuroInput(item.amountCents),
      category: item.category,
      date: item.date.slice(0, 10),
      projectId: item.projectId ?? '',
      note: item.note ?? '',
      vendor: item.vendor ?? '',
      method: item.method ?? 'WIRE',
      isRecurring: Boolean(item.isRecurring),
      recurringUnit: item.recurringUnit ?? 'MONTHLY',
      recurringMonths: '12',
      recurringRetroactive: true,
      recurringEndDate: '',
      recurringDayOfMonth: '',
      categoryReferenceId: item.categoryReferenceId ?? '',
      tagReferenceIds: item.tagReferences?.map((t) => t.id) ?? [],
    });
    setActionError(null);
    setModalOpen(true);
  }

  function onFieldChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const target = e.target as HTMLInputElement;
    const { name, value } = target;
    const nextValue =
      target.type === 'checkbox'
        ? target.checked
        : name === 'amount'
          ? sanitizeEuroInput(value)
          : value;
    setForm((prev) => ({ ...prev, [name]: nextValue }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setInfo(readOnlyMessage);
      return;
    }
    setActionError(null);
    setInfo(null);
    setCreating(true);
    const amountCents = parseEuroToCents(form.amount);
    if (!Number.isFinite(amountCents)) {
      setActionError('Montant invalide.');
      setCreating(false);
      return;
    }
    const payload: Record<string, unknown> = {
      type: form.type,
      amountCents,
      category: form.category,
      date: form.date,
      projectId: form.projectId || null,
      note: form.note || null,
      vendor: form.vendor || null,
      method: form.method || null,
      isRecurring: form.isRecurring,
      recurringUnit: form.isRecurring ? form.recurringUnit : null,
      recurringMonths:
        form.isRecurring && form.recurringUnit === 'MONTHLY'
          ? Number.parseInt(form.recurringMonths, 10) || 12
          : null,
      recurringRetroactive:
        form.isRecurring && form.recurringUnit === 'MONTHLY' ? Boolean(form.recurringRetroactive) : null,
      recurringEndDate:
        form.isRecurring && form.recurringUnit === 'MONTHLY' && form.recurringEndDate
          ? form.recurringEndDate
          : null,
      recurringDayOfMonth:
        form.isRecurring && form.recurringUnit === 'MONTHLY' && form.recurringDayOfMonth
          ? Number.parseInt(form.recurringDayOfMonth, 10) || null
          : null,
      categoryReferenceId: form.categoryReferenceId || null,
      tagReferenceIds: form.tagReferenceIds,
    };
    const res = await fetchJson<FinanceDetailResponse>(
      `/api/pro/businesses/${businessId}/finances${editing ? `/${editing.id}` : ''}`,
      {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    setCreating(false);
    if (!res.ok || !res.data) {
      setActionError(res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.');
      return;
    }
    setModalOpen(false);
    setSelectedId(res.data.item.id);
    const isExpense = res.data.item.type === 'EXPENSE';
    setInfo(editing ? (isExpense ? 'Charge mise à jour.' : 'Écriture mise à jour.') : isExpense ? 'Charge ajoutée.' : 'Écriture ajoutée.');
    await loadFinances();
  }

  async function loadDetail(id: string) {
    const res = await fetchJson<FinanceDetailResponse>(`/api/pro/businesses/${businessId}/finances/${id}`);
    if (!res.ok || !res.data) {
      setError(res.requestId ? `${res.error ?? 'Impossible de charger'} (Ref: ${res.requestId})` : res.error ?? 'Impossible de charger');
      return;
    }
    setInfo(
      res.data.item.categoryReferenceName
        ? `Catégorie: ${res.data.item.categoryReferenceName}`
        : res.data.item.category
    );
  }

  return {
    modalOpen,
    setModalOpen,
    editing,
    form,
    setForm,
    actionError,
    creating,
    recurringPreview,
    openCreate,
    openEdit,
    onFieldChange,
    handleSubmit,
    loadDetail,
  };
}
