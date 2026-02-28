'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrency } from '@/app/app/pro/pro-data';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import { PageHeader } from '@/app/app/components/PageHeader';
import { Plus } from 'lucide-react';
import { useRowSelection } from '@/app/app/components/selection/useRowSelection';
import { BulkActionBar } from '@/app/app/components/selection/BulkActionBar';
import { useRecurringRule } from '@/components/pro/finances/hooks/useRecurringRule';
import { useFinanceForm } from '@/components/pro/finances/hooks/useFinanceForm';
import { FinanceFormModal } from '@/components/pro/finances/modals/FinanceFormModal';
import { RecurringRuleModal } from '@/components/pro/finances/modals/RecurringRuleModal';
import type { Finance, FinanceType } from '@/components/pro/finances/finance-types';
import { TYPE_OPTIONS, METHOD_OPTIONS, formatFinanceDate } from '@/components/pro/finances/finance-types';

type FinanceListResponse = { items: Finance[] };

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

      {info ? <p className="text-sm text-[var(--success)]">{info}</p> : null}

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
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {requestId ? <p className="text-[10px] text-[var(--text-secondary)]">Req: {requestId}</p> : null}

        {referenceError ? (
          <p className="text-xs text-[var(--danger)]">
            {referenceError} {referenceRequestId ? `(Ref: ${referenceRequestId})` : null}
          </p>
        ) : null}

        {bulkError ? <p className="text-xs text-[var(--danger)]">{bulkError}</p> : null}
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
                  <TableCell>{formatFinanceDate(item.date)}</TableCell>
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
                {selected.type === 'INCOME' ? 'Revenu' : 'Dépense'} · {formatFinanceDate(selected.date)}
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
              {selected.isRuleOverride ? <p className="text-[var(--warning)]">Occurrence modifiée manuellement.</p> : null}
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

      <FinanceFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editing={editing}
        form={form}
        setForm={setForm}
        onFieldChange={onFieldChange}
        onSubmit={handleSubmit}
        creating={creating}
        actionError={actionError}
        isAdmin={isAdmin}
        readOnlyMessage={readOnlyMessage}
        categoryOptions={categoryOptions}
        tagOptions={tagOptions}
        recurringPreview={recurringPreview}
      />

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
          {deleteError ? <p className="text-xs text-[var(--danger)]">{deleteError}</p> : null}
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

      <RecurringRuleModal
        open={recurringModalOpen}
        onClose={() => setRecurringModalOpen(false)}
        rule={recurringRule}
        occurrences={recurringOccurrences}
        form={recurringRuleForm}
        setForm={setRecurringRuleForm}
        applyFuture={recurringApplyFuture}
        setApplyFuture={setRecurringApplyFuture}
        recalculate={recurringRecalculate}
        setRecalculate={setRecurringRecalculate}
        horizonMonths={recurringHorizonMonths}
        setHorizonMonths={setRecurringHorizonMonths}
        loading={recurringRuleLoading}
        error={recurringRuleError}
        onSave={handleSaveRecurringRule}
        onEditOccurrence={(occ) => {
          setRecurringModalOpen(false);
          openEdit(occ);
        }}
      />
    </div>
  );
}
