'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrency } from '@/app/app/pro/pro-data';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import { PageHeader } from '@/app/app/components/PageHeader';
import { Plus } from 'lucide-react';
import { useRowSelection } from '@/app/app/components/selection/useRowSelection';
import { BulkActionBar } from '@/app/app/components/selection/BulkActionBar';
import { sanitizeEuroInput } from '@/lib/money';
import { useRecurringRule } from '@/components/pro/finances/hooks/useRecurringRule';
import { useFinanceForm } from '@/components/pro/finances/hooks/useFinanceForm';

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

type FinanceListResponse = { items: Finance[] };


const TYPE_OPTIONS: { value: FinanceType; label: string }[] = [
  { value: 'INCOME', label: 'Revenu' },
  { value: 'EXPENSE', label: 'Dépense' },
];

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'WIRE', label: 'Virement' },
  { value: 'CARD', label: 'Carte' },
  { value: 'CHECK', label: 'Chèque' },
  { value: 'CASH', label: 'Espèces' },
  { value: 'OTHER', label: 'Autre' },
];

const RECURRING_OPTIONS: { value: RecurringUnit; label: string }[] = [
  { value: 'MONTHLY', label: 'Mensuel' },
  { value: 'YEARLY', label: 'Annuel' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

type Props = {
  businessId: string;
};

export function FinanceEntriesPanel({ businessId }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [items, setItems] = useState<Finance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [typeFilter, setTypeFilter] = useState<FinanceType | 'ALL'>('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const {
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
  } = useFinanceForm({
    businessId,
    isAdmin,
    readOnlyMessage,
    loadFinances,
    setSelectedId,
    setInfo,
    setError,
  });

  const [deleteModal, setDeleteModal] = useState<Finance | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const { selectedArray, selectedCount, toggle, toggleAll, clear, isSelected } = useRowSelection();



  const controllerRef = useRef<AbortController | null>(null);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (categoryFilter && item.categoryReferenceId !== categoryFilter) return false;
      if (tagFilter && !item.tagReferences?.some((t) => t.id === tagFilter)) return false;
      const ts = new Date(item.date).getTime();
      if (fromDate) {
        const fromTs = new Date(fromDate).getTime();
        if (Number.isFinite(fromTs) && ts < fromTs) return false;
      }
      if (toDate) {
        const toTs = new Date(toDate).getTime();
        if (Number.isFinite(toTs) && ts > toTs) return false;
      }
      return true;
    });
  }, [fromDate, items, toDate, typeFilter, categoryFilter, tagFilter]);

  const displaySelectedId = selectedId ?? filtered[0]?.id ?? null;
  const selected = filtered.find((f) => f.id === displaySelectedId) ?? null;

  async function loadFinances(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (typeFilter !== 'ALL') query.set('type', typeFilter);
      if (fromDate) query.set('from', fromDate);
      if (toDate) query.set('to', toDate);
      if (categoryFilter) query.set('categoryReferenceId', categoryFilter);
      if (tagFilter) query.set('tagReferenceId', tagFilter);
      const res = await fetchJson<FinanceListResponse>(
        `/api/pro/businesses/${businessId}/finances${query.toString() ? `?${query.toString()}` : ''}`,
        {},
        effectiveSignal
      );
      setRequestId(res.requestId);
      if (effectiveSignal?.aborted) return;
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        setError(
          res.requestId
            ? `${res.error ?? 'Erreur de chargement.'} (Ref: ${res.requestId})`
            : res.error ?? 'Erreur de chargement.'
        );
        setItems([]);
        return;
      }
      const normalized = res.data.items.map((item) => ({
        ...item,
        categoryReferenceId: item.categoryReferenceId ?? null,
        categoryReferenceName: item.categoryReferenceName ?? null,
        tagReferences: item.tagReferences ?? [],
      }));
      setItems(normalized);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }



  useEffect(() => {
    void loadFinances();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, typeFilter, fromDate, toDate, categoryFilter, tagFilter]);

  async function loadReferences() {
    setReferenceError(null);
    setReferenceRequestId(null);
    const [categories, tags] = await Promise.all([
      fetchJson<{ items: Array<{ id: string; name: string }> }>(
        `/api/pro/businesses/${businessId}/references?type=FINANCE_CATEGORY&limit=30`
      ),
      fetchJson<{ items: Array<{ id: string; name: string }> }>(
        `/api/pro/businesses/${businessId}/references?type=FINANCE_TAG&limit=30`
      ),
    ]);
    setReferenceRequestId(categories.requestId ?? tags.requestId ?? null);
    if (!categories.ok || !tags.ok || !categories.data || !tags.data) {
      const msg = categories.error ?? tags.error ?? 'Impossible de charger les références.';
      setReferenceError(categories.requestId ? `${msg} (Ref: ${categories.requestId})` : msg);
      return;
    }
    setCategoryOptions(categories.data.items ?? []);
    setTagOptions(tags.data.items ?? []);
  }

  useEffect(() => {
    void loadReferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const {
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
  } = useRecurringRule({ businessId, loadFinances });

  async function deleteFinance(finance: Finance) {
    const res = await fetchJson(`/api/pro/businesses/${businessId}/finances/${finance.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      setDeleteError(res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.');
      return;
    }
    setDeleteModal(null);
    setSelectedId(null);
    setInfo(finance.type === 'EXPENSE' ? 'Charge supprimée.' : 'Écriture supprimée.');
    await loadFinances();
  }

  async function bulkDelete() {
    setBulkLoading(true);
    setBulkError(null);
    try {
      await Promise.all(
        selectedArray.map((id) =>
          fetchJson(`/api/pro/businesses/${businessId}/finances/${id}`, { method: 'DELETE' })
        )
      );
      clear();
      setInfo('Écritures supprimées.');
      await loadFinances();
    } catch (err) {
      setBulkError(getErrorMessage(err));
    } finally {
      setBulkLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/app/pro/${businessId}`}
        backLabel="Dashboard"
        title="Écritures"
        subtitle="Charges et revenus pour piloter votre activité."
        primaryAction={{
          label: 'Ajouter une charge',
          onClick: openCreate,
          icon: <Plus size={14} />,
        }}
      />

      {info ? <p className="text-sm text-emerald-500">{info}</p> : null}

      <Card className="p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as FinanceType | 'ALL')}>
            <option value="ALL">Toutes</option>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
          />
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm"
          />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Catégorie</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tag</option>
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </div>

        {loading ? <p className="text-xs text-[var(--text-secondary)]">Chargement…</p> : null}
        {error ? <p className="text-xs text-rose-500">{error}</p> : null}
        {requestId ? <p className="text-[10px] text-[var(--text-secondary)]">Req: {requestId}</p> : null}

        {referenceError ? (
          <p className="text-xs text-rose-500">
            {referenceError} {referenceRequestId ? `(Ref: ${referenceRequestId})` : null}
          </p>
        ) : null}

        {bulkError ? <p className="text-xs text-rose-500">{bulkError}</p> : null}
        {selectedCount > 0 ? (
          <BulkActionBar
            count={selectedCount}
            onClear={clear}
            actions={[
              {
                label: 'Supprimer',
                onClick: bulkDelete,
                variant: 'danger',
                disabled: bulkLoading,
              },
            ]}
          />
        ) : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={selectedCount > 0 && selectedCount === filtered.length}
                  onChange={() => toggleAll(filtered.map((f) => f.id))}
                />
              </TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Projet</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item) => {
              const selectedRow = isSelected(item.id);
              const methodLabel = item.method
                ? METHOD_OPTIONS.find((opt) => opt.value === item.method)?.label ?? item.method
                : null;
              const recurringLabel = item.isRecurring
                ? `Récurrent ${item.recurringUnit === 'YEARLY' ? 'annuel' : 'mensuel'}`
                : null;
              const metaLine = [item.categoryReferenceName, item.vendor, methodLabel, recurringLabel]
                .filter(Boolean)
                .join(' · ');
              return (
                <TableRow key={item.id} data-selected={selectedRow} className={selectedRow ? 'bg-[var(--surface-hover)]' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedRow}
                      onChange={() => toggle(item.id)}
                      aria-label={`Sélectionner ${item.category}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.type === 'INCOME' ? 'pro' : 'neutral'}>
                      {item.type === 'INCOME' ? 'Revenu' : 'Dépense'}
                    </Badge>
                  </TableCell>
                  <TableCell className="min-w-0">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{item.category}</span>
                      {metaLine ? (
                        <span className="text-[11px] text-[var(--text-secondary)]">{metaLine}</span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>{item.projectName ?? '—'}</TableCell>
                  <TableCell className="font-semibold">{formatCurrency(Number(item.amountCents) / 100)}</TableCell>
                  <TableCell>{formatDate(item.date)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedId(item.id)}>
                        Détails
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(item)}>
                        Modifier
                      </Button>
                      {item.recurringRuleId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRecurringRule(item.recurringRuleId as string)}
                        >
                          Récurrence
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => setDeleteModal(item)}>
                        Supprimer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 ? (
              <TableEmpty>
                <div className="space-y-1">
                  <p className="font-semibold">Aucune écriture</p>
                  <p className="text-sm text-[var(--text-secondary)]">Ajoutez une première écriture pour commencer.</p>
                </div>
              </TableEmpty>
            ) : null}
          </TableBody>
        </Table>
      </Card>

      {selected ? (
        <Card className="space-y-2 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {selected.category} · {formatCurrency(Number(selected.amountCents) / 100)}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.type === 'INCOME' ? 'Revenu' : 'Dépense'} · {formatDate(selected.date)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void loadDetail(selected.id)}>
                Charger détails
              </Button>
              {selected.recurringRuleId ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openRecurringRule(selected.recurringRuleId as string)}
                >
                  Gérer la récurrence
                </Button>
              ) : null}
            </div>
          </div>
          {info ? <p className="text-xs text-[var(--text-secondary)]">{info}</p> : null}
          {(selected.vendor || selected.method || selected.isRecurring) ? (
            <div className="text-xs text-[var(--text-secondary)]">
              {selected.vendor ? <p>Fournisseur : {selected.vendor}</p> : null}
              {selected.method ? (
                <p>
                  Mode : {METHOD_OPTIONS.find((opt) => opt.value === selected.method)?.label ?? selected.method}
                </p>
              ) : null}
              {selected.isRecurring ? (
                <p>Récurrence : {selected.recurringUnit === 'YEARLY' ? 'Annuelle' : 'Mensuelle'}</p>
              ) : null}
              {selected.isRuleOverride ? <p className="text-amber-600">Occurrence modifiée manuellement.</p> : null}
            </div>
          ) : null}
          {selected.tagReferences?.length ? (
            <div className="flex flex-wrap gap-2">
              {selected.tagReferences.map((tag) => (
                <Badge key={tag.id} variant="neutral">
                  {tag.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onCloseAction={() => setModalOpen(false)}
        title={editing ? 'Modifier écriture' : 'Nouvelle charge'}
        description="Montant, libellé et date sont requis."
      >
        <form className="space-y-3" onSubmit={handleSubmit}>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Type</span>
              <Select name="type" value={form.type} onChange={onFieldChange}>
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Montant (€)</span>
              <Input
                name="amount"
                type="text"
                inputMode="decimal"
                value={form.amount}
                onChange={onFieldChange}
                required
              />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Libellé</span>
              <Input name="category" value={form.category} onChange={onFieldChange} required />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Date</span>
              <Input name="date" type="date" value={form.date} onChange={onFieldChange} required />
            </label>
            <label className="text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Projet (optionnel)</span>
              <Input name="projectId" value={form.projectId} onChange={onFieldChange} />
            </label>
          </div>

          <details className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              Options avancées
            </summary>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Fournisseur</span>
                <Input name="vendor" value={form.vendor} onChange={onFieldChange} />
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Mode de paiement</span>
                <Select name="method" value={form.method} onChange={onFieldChange}>
                  {METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                <input
                  type="checkbox"
                  name="isRecurring"
                  checked={form.isRecurring}
                  onChange={onFieldChange}
                  className="h-4 w-4 rounded border border-[var(--border)]"
                />
                <span>Récurrent</span>
              </label>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Fréquence</span>
                <Select
                  name="recurringUnit"
                  value={form.recurringUnit}
                  onChange={onFieldChange}
                  disabled={!form.isRecurring}
                >
                  {RECURRING_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </label>
              {form.isRecurring && form.recurringUnit === 'MONTHLY' ? (
                <>
                  <label className="text-sm text-[var(--text-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Créer sur (mois)</span>
                    <Input
                      name="recurringMonths"
                      value={form.recurringMonths}
                      onChange={onFieldChange}
                      type="number"
                      min={1}
                      max={36}
                    />
                  </label>
                  <label className="text-sm text-[var(--text-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Jour de facturation</span>
                    <Input
                      name="recurringDayOfMonth"
                      value={form.recurringDayOfMonth}
                      onChange={onFieldChange}
                      type="number"
                      min={1}
                      max={31}
                      placeholder="Auto"
                    />
                  </label>
                  <label className="text-sm text-[var(--text-primary)]">
                    <span className="text-xs text-[var(--text-secondary)]">Fin de récurrence</span>
                    <Input
                      name="recurringEndDate"
                      type="date"
                      value={form.recurringEndDate}
                      onChange={onFieldChange}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                    <input
                      type="checkbox"
                      name="recurringRetroactive"
                      checked={form.recurringRetroactive}
                      onChange={onFieldChange}
                      className="h-4 w-4 rounded border border-[var(--border)]"
                    />
                    <span>Créer rétroactivement depuis la date de début</span>
                  </label>
                  {recurringPreview ? (
                    <div className="text-xs text-[var(--text-secondary)] md:col-span-2">
                      +{recurringPreview.pastCount} occurrences passées · +{recurringPreview.futureCount} occurrences futures
                    </div>
                  ) : null}
                </>
              ) : null}
              <label className="text-sm text-[var(--text-primary)] md:col-span-2">
                <span className="text-xs text-[var(--text-secondary)]">Note</span>
                <Input name="note" value={form.note} onChange={onFieldChange} />
              </label>
              <label className="text-sm text-[var(--text-primary)] md:col-span-2">
                <span className="text-xs text-[var(--text-secondary)]">Catégorie de référence</span>
                <Select
                  value={form.categoryReferenceId}
                  onChange={(e) => setForm((prev) => ({ ...prev, categoryReferenceId: e.target.value }))}
                >
                  <option value="">Aucune</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-sm text-[var(--text-primary)] md:col-span-2">
                <span className="text-xs text-[var(--text-secondary)]">Tags</span>
                <Select
                  multiple
                  value={form.tagReferenceIds}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      tagReferenceIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                    }))
                  }
                >
                  {tagOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </details>
          {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
          {!isAdmin ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
        </form>
      </Modal>

      <Modal
        open={!!deleteModal}
        onCloseAction={() => setDeleteModal(null)}
        title="Supprimer cette écriture ?"
        description={deleteModal ? deleteModal.category : undefined}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Cette action est irréversible. Assurez-vous d’avoir exporté les données si nécessaire.
          </p>
          {deleteError ? <p className="text-xs text-rose-500">{deleteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={() => deleteModal && deleteFinance(deleteModal)}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={recurringModalOpen}
        onCloseAction={() => setRecurringModalOpen(false)}
        title="Règle de récurrence"
        description="Modifie la règle et les occurrences futures."
      >
        <div className="space-y-4">
          {recurringRuleLoading ? <p className="text-xs text-[var(--text-secondary)]">Chargement…</p> : null}
          {recurringRuleError ? <p className="text-xs text-rose-500">{recurringRuleError}</p> : null}
          {recurringRule ? (
            <>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Montant (€)</span>
                  <Input
                    value={recurringRuleForm.amount}
                    onChange={(e) =>
                      setRecurringRuleForm((prev) => ({ ...prev, amount: sanitizeEuroInput(e.target.value) }))
                    }
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Libellé</span>
                  <Input
                    value={recurringRuleForm.category}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, category: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Fournisseur</span>
                  <Input
                    value={recurringRuleForm.vendor}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, vendor: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Mode</span>
                  <Select
                    value={recurringRuleForm.method}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, method: e.target.value as PaymentMethod }))}
                  >
                    {METHOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Date de début</span>
                  <Input
                    type="date"
                    value={recurringRuleForm.startDate}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Date de fin</span>
                  <Input
                    type="date"
                    value={recurringRuleForm.endDate}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </label>
                <label className="text-sm text-[var(--text-primary)]">
                  <span className="text-xs text-[var(--text-secondary)]">Jour de facturation</span>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={recurringRuleForm.dayOfMonth}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--text-primary)]">
                  <input
                    type="checkbox"
                    checked={recurringRuleForm.isActive}
                    onChange={(e) => setRecurringRuleForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 rounded border border-[var(--border)]"
                  />
                  <span>Règle active</span>
                </label>
              </div>

              <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-3 text-xs text-[var(--text-secondary)]">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recurringApplyFuture}
                      onChange={(e) => setRecurringApplyFuture(e.target.checked)}
                      className="h-4 w-4 rounded border border-[var(--border)]"
                    />
                    <span>Appliquer aux occurrences futures</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={recurringRecalculate}
                      onChange={(e) => setRecurringRecalculate(e.target.checked)}
                      className="h-4 w-4 rounded border border-[var(--border)]"
                    />
                    <span>Recalculer (re-générer)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <span>Horizon</span>
                    <Input
                      className="w-20"
                      value={recurringHorizonMonths}
                      onChange={(e) => setRecurringHorizonMonths(e.target.value)}
                      type="number"
                      min={1}
                      max={36}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRecurringModalOpen(false)}
                >
                  Fermer
                </Button>
                <Button size="sm" onClick={handleSaveRecurringRule} disabled={recurringRuleLoading}>
                  {recurringRuleLoading ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>

              <div className="rounded-2xl border border-[var(--border)]/60 bg-[var(--surface)]/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                  Occurrences
                </p>
                <div className="mt-2 max-h-64 space-y-2 overflow-auto">
                  {recurringOccurrences.length ? (
                    recurringOccurrences.map((occ) => (
                      <div
                        key={occ.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)]/60 bg-[var(--surface)] px-3 py-2 text-xs"
                      >
                        <div>
                          <p className="text-[var(--text-primary)]">
                            {formatDate(occ.date)} · {formatCurrency(Number(occ.amountCents) / 100)}
                          </p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {occ.isRuleOverride ? 'Modifiée' : 'Automatique'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setRecurringModalOpen(false);
                              openEdit(occ);
                            }}
                          >
                            Modifier
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-secondary)]">Aucune occurrence.</p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
