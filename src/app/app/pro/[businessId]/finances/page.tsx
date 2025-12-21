// src/app/app/pro/[businessId]/finances/page.tsx
'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrency } from '../../pro-data';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { ReferencePicker } from '../references/ReferencePicker';

type FinanceType = 'INCOME' | 'EXPENSE';

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
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type FinanceListResponse = { items: Finance[] };
type FinanceDetailResponse = { item: Finance };

const TYPE_OPTIONS: { value: FinanceType; label: string }[] = [
  { value: 'INCOME', label: 'Revenu' },
  { value: 'EXPENSE', label: 'Dépense' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function FinancesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';

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

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Finance | null>(null);
  const [form, setForm] = useState({
    type: 'EXPENSE' as FinanceType,
    amount: '',
    category: '',
    date: '',
    projectId: '',
    note: '',
    categoryReferenceId: '',
    tagReferenceIds: [] as string[],
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [deleteModal, setDeleteModal] = useState<Finance | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  function openCreate() {
    setEditing(null);
    setForm({
      type: 'EXPENSE',
      amount: '',
      category: '',
      date: '',
      projectId: '',
      note: '',
      categoryReferenceId: '',
      tagReferenceIds: [],
    });
    setActionError(null);
    setModalOpen(true);
  }

  function openEdit(item: Finance) {
    setEditing(item);
    setForm({
      type: item.type,
      amount: (item.amount ?? 0).toString(),
      category: item.category,
      date: item.date.slice(0, 10),
      projectId: item.projectId ?? '',
      note: item.note ?? '',
      categoryReferenceId: item.categoryReferenceId ?? '',
      tagReferenceIds: item.tagReferences?.map((t) => t.id) ?? [],
    });
    setActionError(null);
    setModalOpen(true);
  }

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

  useEffect(() => {
    const controller = new AbortController();
    async function loadRefs() {
      setReferenceError(null);
      setReferenceRequestId(null);
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
          {},
          controller.signal
        ),
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`,
          {},
          controller.signal
        ),
      ]);
      if (controller.signal.aborted) return;
      setReferenceRequestId(catRes.requestId || tagRes.requestId || null);
      if (!catRes.ok || !catRes.data || !tagRes.ok || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setReferenceError(
          catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg
        );
        return;
      }
      setCategoryOptions(catRes.data.items);
      setTagOptions(tagRes.data.items);
    }
    void loadRefs();
    return () => controller.abort();
  }, [businessId]);

  function handleChange<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setActionError(null);
    setInfo(null);
    setCreating(true);

    const payload = {
      type: form.type,
      amount: Number(form.amount),
      category: form.category.trim(),
      date: form.date,
      projectId: form.projectId.trim() || undefined,
      note: form.note.trim() || undefined,
      categoryReferenceId: form.categoryReferenceId || null,
      tagReferenceIds: form.tagReferenceIds,
    };

    const endpoint = editing
      ? `/api/pro/businesses/${businessId}/finances/${editing.id}`
      : `/api/pro/businesses/${businessId}/finances`;
    const method = editing ? 'PATCH' : 'POST';

    const res = await fetchJson<FinanceDetailResponse>(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRequestId(res.requestId);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
      );
      setCreating(false);
      return;
    }

    setInfo(editing ? 'Opération mise à jour.' : 'Opération créée.');
    setModalOpen(false);
    setCreating(false);
    setEditing(null);
    await loadFinances();
  }

  async function confirmDelete() {
    if (!deleteModal) return;
    setDeleteError(null);
    setInfo(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/finances/${deleteModal.id}`,
      { method: 'DELETE' }
    );
    setRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok) {
      setDeleteError(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setInfo('Opération supprimée.');
    setDeleteModal(null);
    await loadFinances();
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
          Finances
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Finances de l’entreprise
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Vue unique pour suivre revenus, dépenses et trésorerie avant export.
        </p>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Paiements</p>
            <Badge variant="neutral">Live</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Encaissements, retards, moyenne de paiement.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/payments`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Ouvrir →
          </Link>
        </Card>

        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Trésorerie</p>
            <Badge variant="neutral">Live</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Cash, flux entrants/sortants, runway.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/treasury`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Voir la table →
          </Link>
        </Card>

        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">TVA</p>
            <Badge variant="neutral">Live</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Collectée, déductible, déclarations.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/vat`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Suivi TVA →
          </Link>
        </Card>

        <Card className="space-y-2 border-dashed border-[var(--border)] bg-transparent p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Prévisions</p>
            <Badge variant="neutral">À venir</Badge>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Forecast revenu/net, scénarios, runway.
          </p>
          <Link
            href={`/app/pro/${businessId}/finances/forecasting`}
            className="text-sm font-semibold text-[var(--accent)] underline"
          >
            Ouvrir le forecast →
          </Link>
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Opérations finances</p>
            <p className="text-xs text-[var(--text-secondary)]">Liste + filtres + actions.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {info ? <span className="text-xs text-emerald-500">{info}</span> : null}
            {error ? <span className="text-xs text-rose-500">{error}</span> : null}
            {isAdmin ? <Button size="sm" onClick={openCreate}>Nouvelle ligne</Button> : null}
          </div>
        </div>
        {referenceError ? (
          <p className="text-xs text-rose-500">
            {referenceError}
            {referenceRequestId ? ` (Ref: ${referenceRequestId})` : ''}
          </p>
        ) : referenceRequestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Refs Req: {referenceRequestId}</p>
        ) : null}

        <div className="grid gap-2 md:grid-cols-4">
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as FinanceType | 'ALL');
            }}
          >
            <option value="ALL">Tous</option>
              <option value="INCOME">Revenu</option>
              <option value="EXPENSE">Dépense</option>
            </Select>
            <Input
              label="Du"
            type="date"
            value={fromDate}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFromDate(e.target.value)}
          />
            <Input
              label="Au"
              type="date"
              value={toDate}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setToDate(e.target.value)}
            />
            <Select
              label="Catégorie ref"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">Toutes</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Select label="Tag ref" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
              <option value="">Tous</option>
              {tagOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Catégorie</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Projet</TableHead>
                <TableHead>Références</TableHead>
                {isAdmin ? <TableHead>Actions</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableEmpty>Aucune opération.</TableEmpty>
              ) : (
                filtered.map((finance) => (
                  <TableRow
                    key={finance.id}
                    className={finance.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                    onClick={() => setSelectedId(finance.id)}
                  >
                    <TableCell className="font-semibold text-[var(--text-primary)]">
                      {finance.category}
                      <p className="text-[10px] text-[var(--text-secondary)]">{finance.note ?? '—'}</p>
                    </TableCell>
                    <TableCell className={finance.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}>
                      {formatCurrency(finance.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="neutral"
                        className={
                          finance.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }
                      >
                        {finance.type === 'INCOME' ? 'Revenu' : 'Dépense'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(finance.date)}</TableCell>
                    <TableCell>{finance.projectName ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {finance.categoryReferenceName ? (
                          <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                            {finance.categoryReferenceName}
                          </Badge>
                        ) : null}
                        {finance.tagReferences?.map((tag) => (
                          <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    {isAdmin ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => openEdit(finance)}>
                            Modifier
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDeleteModal(finance)}>
                            Supprimer
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {selected ? (
        <Card className="space-y-3 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.category}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.type === 'INCOME' ? 'Revenu' : 'Dépense'} · {formatDate(selected.date)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">
                {formatCurrency(selected.amount)} · {selected.type === 'INCOME' ? 'IN' : 'OUT'}
              </Badge>
              {selected.categoryReferenceName ? (
                <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                  {selected.categoryReferenceName}
                </Badge>
              ) : null}
              {selected.tagReferences?.map((tag) => (
                <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                  {tag.name}
                </Badge>
              ))}
              {selected.projectId ? (
                <Button size="sm" variant="ghost" asChild>
                  <Link href={`/app/pro/${businessId}/projects/${selected.projectId}`}>
                    Voir le projet
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Montant</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.amount)}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">Business #{selected.businessId}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Projet</p>
              <p className="text-sm text-[var(--text-primary)]">{selected.projectName ?? '—'}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Note</p>
              <p className="text-sm text-[var(--text-primary)]">{selected.note ?? '—'}</p>
            </Card>
          </div>
        </Card>
      ) : null}

      <Modal
        open={modalOpen}
        onCloseAction={() => {
          if (creating) return;
          setModalOpen(false);
          setEditing(null);
          setActionError(null);
        }}
        title={editing ? 'Modifier une opération' : 'Nouvelle opération'}
        description="Enregistre un revenu ou une dépense."
      >
        <form onSubmit={handleSubmit} className="space-y-3">
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value as FinanceType)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Montant"
              type="number"
              value={form.amount}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('amount', e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('date', e.target.value)}
            />
          </div>
          <Input
            label="Catégorie"
            value={form.category}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('category', e.target.value)}
          />
          <Input
            label="Projet ID (optionnel)"
            value={form.projectId}
            onChange={(e: ChangeEvent<HTMLInputElement>) => handleChange('projectId', e.target.value)}
            placeholder="ID projet"
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Note</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={form.note}
              onChange={(e) => handleChange('note', e.target.value)}
              placeholder="Observations"
            />
          </label>
          <ReferencePicker
            businessId={businessId}
            categoryId={form.categoryReferenceId || null}
            tagIds={form.tagReferenceIds}
            onCategoryChange={(id) => handleChange('categoryReferenceId', id ?? '')}
            onTagsChange={(ids) => handleChange('tagReferenceIds', ids)}
            disabled={creating}
            title="Références (catégorie / tags)"
          />
          <div className="flex items-center justify-between">
            {actionError ? <p className="text-xs text-rose-500">{actionError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setModalOpen(false)} disabled={creating}>
                Annuler
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!deleteModal}
        onCloseAction={() => setDeleteModal(null)}
        title="Supprimer cette opération ?"
        description={deleteModal ? `${deleteModal.category} sera supprimée.` : undefined}
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--text-secondary)]">
            Action définitive. Les données liées resteront sur les projets.
          </p>
          {deleteError ? <p className="text-xs text-rose-500">{deleteError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteModal(null)}>
              Annuler
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
