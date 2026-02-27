'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { absCents, formatCents, formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';

type AccountItem = { id: string; name: string; currency: string };
type CategoryItem = { id: string; name: string };

type TxItem = {
  id: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER' | string;
  date: string;
  amountCents: string;
  currency: string;
  label: string;
  note: string | null;
  account: { id: string; name: string };
  category: { id: string; name: string } | null;
};

type ApiErrorShape = { error: string };

function isApiErrorShape(x: unknown): x is ApiErrorShape {
  return (
    !!x &&
    typeof x === 'object' &&
    'error' in x &&
    typeof (x as { error?: unknown }).error === 'string'
  );
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Erreur';
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

type AccountApiItem = { id: unknown; name: unknown; currency?: unknown };
type CategoryApiItem = { id: unknown; name: unknown };

function toAccountItem(a: AccountApiItem): AccountItem {
  return {
    id: String(a.id),
    name: String(a.name),
    currency: String(a.currency ?? 'EUR'),
  };
}

function toCategoryItem(c: CategoryApiItem): CategoryItem {
  return {
    id: String(c.id),
    name: String(c.name),
  };
}

type TxApiItem = {
  id: unknown;
  type: unknown;
  date: unknown;
  amountCents: unknown;
  currency?: unknown;
  label?: unknown;
  note?: unknown;
  account?: { id?: unknown; name?: unknown } | null;
  category?: { id?: unknown; name?: unknown } | null;
};

function toTxItem(t: TxApiItem): TxItem {
  return {
    id: String(t.id),
    type: String(t.type),
    date: String(t.date),
    amountCents: String(t.amountCents),
    currency: String(t.currency ?? 'EUR'),
    label: String(t.label ?? ''),
    note: t.note == null ? null : String(t.note),
    account: { id: String(t.account?.id ?? ''), name: String(t.account?.name ?? '') },
    category: t.category ? { id: String(t.category.id), name: String(t.category.name ?? '') } : null,
  };
}

function isTxnType(v: string): v is 'INCOME' | 'EXPENSE' | 'TRANSFER' {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

type TxUpsertPayload = {
  accountId: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  date: string;
  amountCents: string;
  currency: string;
  label: string;
  note: string | null;
  categoryId?: string | null;
};

function buildQuery(params: Record<string, string | undefined | null>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s) continue;
    sp.set(k, s);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

function toISOFromDateOnly(value: string) {
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}

function isoDateOnly(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateFR(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function isNegCents(cents: string) {
  try {
    return BigInt(cents) < 0n; // ✅ pas de 0n
  } catch {
    return String(cents).startsWith('-');
  }
}

export default function PersoTransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();

  // data
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [items, setItems] = useState<TxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // ui state
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [accountId, setAccountId] = useState<string>(''); // "" = tous comptes
  const [type, setType] = useState<string>(''); // "" = tous types
  const [q, setQ] = useState<string>('');
  const [from, setFrom] = useState<string>(''); // YYYY-MM-DD
  const [to, setTo] = useState<string>(''); // YYYY-MM-DD

  // modal add
  const [openAdd, setOpenAdd] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // add form
  const [fAccountId, setFAccountId] = useState<string>('');
  const [fType, setFType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [fDate, setFDate] = useState<string>(isoDateOnly(new Date()));
  const [fAmountEuro, setFAmountEuro] = useState<string>('');
  const [fCurrency, setFCurrency] = useState<string>('EUR');
  const [fLabel, setFLabel] = useState<string>('');
  const [fNote, setFNote] = useState<string>('');
  const [fCategoryId, setFCategoryId] = useState<string>(''); // optional numeric string
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  // selection / bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  // modal edit
  const [openEdit, setOpenEdit] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TxItem | null>(null);

  // edit form
  const [eAccountId, setEAccountId] = useState<string>('');
  const [eType, setEType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [eDate, setEDate] = useState<string>(isoDateOnly(new Date()));
  const [eAmountEuro, setEAmountEuro] = useState<string>('');
  const [eCurrency, setECurrency] = useState<string>('EUR');
  const [eLabel, setELabel] = useState<string>('');
  const [eNote, setENote] = useState<string>('');
  const [eCategoryId, setECategoryId] = useState<string>('');
  const eAmountRef = useRef<HTMLInputElement | null>(null);
  const [editAttemptedSubmit, setEditAttemptedSubmit] = useState(false);

  function euroFromCentsStr(centsStr: string) {
    return formatCentsToEuroInput(absCents(centsStr));
  }
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function selectAllVisible() {
    setSelectedIds(new Set(items.map((x) => x.id)));
  }

  async function handle401() {
    router.push(`/login?from=${encodeURIComponent(pathname || '/app/personal/transactions')}`);
  }

  async function fetchAccounts() {
    setLoadingAccounts(true);
    setError(null);
    try {
      const res = await fetch('/api/personal/accounts', { credentials: 'include' });
      if (res.status === 401) return handle401();
      if (!res.ok) throw new Error('Impossible de charger les comptes');

      const data = await safeJson(res);

      const raw =
        data && typeof data === 'object' && 'items' in data
          ? (data as { items?: unknown }).items
          : [];

      const list = Array.isArray(raw) ? raw.map((x) => toAccountItem(x as AccountApiItem)) : [];

      setAccounts(list);

      // defaults for create form
      if (!fAccountId && list.length) {
        setFAccountId(list[0].id);
        setFCurrency(list[0].currency ?? 'EUR');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Erreur lors du chargement des comptes');
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function fetchCategories() {
    setLoadingCategories(true);
    try {
      const res = await fetch('/api/personal/categories', { credentials: 'include' });
      if (res.status === 401) return handle401();
      if (!res.ok) throw new Error('Impossible de charger les catégories');

      const data = await safeJson(res);
      const raw =
        data && typeof data === 'object' && 'items' in data
          ? (data as { items?: unknown }).items
          : [];
      const list = Array.isArray(raw) ? raw.map((x) => toCategoryItem(x as CategoryApiItem)) : [];
      setCategories(list);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setLoadingCategories(false);
    }
  }

  async function fetchTransactions(opts?: { reset?: boolean }) {
    const reset = !!opts?.reset;

    if (reset) {
      setLoadingList(true);
      setItems([]);
      setNextCursor(null);
    } else {
      setLoadingMore(true);
    }

    setError(null);

    try {
      const query = buildQuery({
        accountId: accountId || undefined, // ✅ si "" => tous comptes
        type: type || undefined,
        q: q.trim() || undefined,
        from: from ? toISOFromDateOnly(from) : undefined,
        to: to ? toISOFromDateOnly(to) : undefined,
        limit: '50',
        cursor: reset ? undefined : nextCursor,
      });

      const res = await fetch(`/api/personal/transactions${query}`, { credentials: 'include' });
      if (res.status === 401) return handle401();
      if (!res.ok) throw new Error('Impossible de charger les transactions');

      const data = await safeJson(res);

      const raw =
        data && typeof data === 'object' && 'items' in data
          ? (data as { items?: unknown }).items
          : [];

      const got = Array.isArray(raw) ? raw.map((x) => toTxItem(x as TxApiItem)) : [];

      setItems((prev) => (reset ? got : [...prev, ...got]));
      const cursor =
        data && typeof data === 'object' && 'nextCursor' in data
          ? (data as { nextCursor?: unknown }).nextCursor
          : null;
      setNextCursor(typeof cursor === 'string' ? cursor : null);
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Erreur lors du chargement des transactions');
    } finally {
      setLoadingList(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loadingAccounts) return;
    fetchTransactions({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, type, from, to, loadingAccounts]);

  useEffect(() => {
    if (loadingAccounts) return;
    const t = setTimeout(() => fetchTransactions({ reset: true }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, loadingAccounts]);

  useEffect(() => {
    if (!accounts.length || !fAccountId) return;
    const a = accounts.find((x) => x.id === fAccountId);
    if (a?.currency && a.currency !== fCurrency) setFCurrency(a.currency);
  }, [accounts, fAccountId, fCurrency]);

  const accountLabel = useMemo(() => {
    if (!accountId) return 'Tous les comptes';
    return accounts.find((a) => a.id === accountId)?.name ?? 'Compte';
  }, [accountId, accounts]);

  const amountCentsRaw = useMemo(() => {
    const cents = parseEuroToCents(fAmountEuro);
    return Number.isFinite(cents) ? String(cents) : null;
  }, [fAmountEuro]);
  const dateIso = useMemo(() => (fDate ? toISOFromDateOnly(fDate) : ''), [fDate]);

  const required = useMemo(
    () => ({
      account: !!fAccountId,
      type: !!fType,
      date: !!dateIso,
      amount: !!amountCentsRaw,
      label: !!fLabel.trim(),
    }),
    [fAccountId, fType, dateIso, amountCentsRaw, fLabel]
  );

  const isValid = useMemo(
    () => required.account && required.type && required.date && required.amount && required.label,
    [required]
  );

  function openEditModal(t: TxItem) {
    setEditing(t);
    setEditError(null);
    setEditAttemptedSubmit(false);

    setEAccountId(t.account?.id || accounts[0]?.id || '');
    setEType(isTxnType(String(t.type)) ? (t.type as 'INCOME' | 'EXPENSE' | 'TRANSFER') : 'EXPENSE');
    setEDate(t.date ? isoDateOnly(new Date(t.date)) : isoDateOnly(new Date()));
    setEAmountEuro(euroFromCentsStr(t.amountCents));
    setECurrency((t.currency || 'EUR').toUpperCase());
    setELabel(t.label || '');
    setENote(t.note || '');
    setECategoryId(t.category?.id ?? '');

    setOpenEdit(true);
    setTimeout(() => eAmountRef.current?.focus(), 50);
  }

  const eAmountCentsRaw = useMemo(() => {
    const cents = parseEuroToCents(eAmountEuro);
    return Number.isFinite(cents) ? String(cents) : null;
  }, [eAmountEuro]);
  const eDateIso = useMemo(() => (eDate ? toISOFromDateOnly(eDate) : ''), [eDate]);

  const eRequired = useMemo(
    () => ({
      account: !!eAccountId,
      type: !!eType,
      date: !!eDateIso,
      amount: !!eAmountCentsRaw,
      label: !!eLabel.trim(),
    }),
    [eAccountId, eType, eDateIso, eAmountCentsRaw, eLabel]
  );

  const eIsValid = useMemo(
    () => eRequired.account && eRequired.type && eRequired.date && eRequired.amount && eRequired.label,
    [eRequired]
  );

  function eFieldError(ok: boolean) {
    return editAttemptedSubmit && !ok;
  }

  async function saveEdit() {
    setEditAttemptedSubmit(true);
    setEditError(null);

    if (!editing) return;
    if (!eIsValid) {
      if (!eRequired.amount) return eAmountRef.current?.focus();
      return;
    }

    let amount = BigInt(eAmountCentsRaw!);
    if (amount === 0n) {
      setEditError('Le montant ne peut pas être 0.');
      return;
    }
    if (eType === 'EXPENSE' && amount > 0n) amount = -amount;
    if (eType === 'INCOME' && amount < 0n) amount = -amount;

    const payload: TxUpsertPayload = {
      accountId: eAccountId,
      type: eType,
      date: eDateIso,
      amountCents: amount.toString(),
      currency: (eCurrency || 'EUR').trim(),
      label: eLabel.trim(),
      note: eNote.trim() ? eNote.trim() : null,
    };
    payload.categoryId = eCategoryId ? eCategoryId : null;

    setEditLoading(true);
    try {
      const res = await fetch(`/api/personal/transactions/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) return handle401();
      const data = await safeJson(res);
      if (!res.ok) {
        setEditError(isApiErrorShape(data) ? data.error : 'Modification impossible.');
        return;
      }

      setOpenEdit(false);
      setEditing(null);
      await fetchTransactions({ reset: true });
    } catch (e: unknown) {
      setEditError(getErrorMessage(e) || 'Erreur réseau.');
    } finally {
      setEditLoading(false);
    }
  }

  function fieldError(ok: boolean) {
    return attemptedSubmit && !ok;
  }

  const inputBase =
    'h-12 w-full rounded-2xl border bg-[var(--surface)] px-4 text-base text-slate-50';
  const inputOk = 'border-[var(--border)]';
  const inputBad = 'border-red-500/60 ring-2 ring-red-500/25';

  async function deleteMany(ids: string[]) {
    if (!ids.length) return;

    const ok = window.confirm(
      ids.length === 1 ? 'Supprimer cette transaction ?' : `Supprimer ${ids.length} transactions ?`
    );
    if (!ok) return;

    try {
      const res = await fetch('/api/personal/transactions/bulk-delete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });

      if (res.status === 401) return handle401();
      const j = await safeJson(res);
      if (!res.ok) throw new Error(isApiErrorShape(j) ? j.error : 'Suppression impossible');

      clearSelection();
      await fetchTransactions({ reset: true });
    } catch (e: unknown) {
      setError(getErrorMessage(e) || 'Suppression impossible');
    }
  }

  async function deleteOne(id: string) {
    return deleteMany([id]);
  }

  function resetFilters() {
    setAccountId(''); // ✅ reset => tous comptes
    setType('');
    setQ('');
    setFrom('');
    setTo('');
  }

  function openAddModal() {
    setAttemptedSubmit(false);

    const baseAccountId = accountId || accounts[0]?.id || '';
    if (baseAccountId) setFAccountId(baseAccountId);

    const acc = accounts.find((a) => a.id === baseAccountId);
    setFCurrency(acc?.currency ?? 'EUR');

    setFType('EXPENSE');
    setFDate(isoDateOnly(new Date()));
    setFAmountEuro('');
    setFLabel('');
    setFNote('');
    setFCategoryId('');
    setCreateError(null);

    setOpenAdd(true);

    // focus montant dès ouverture
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  async function createTransaction() {
    setAttemptedSubmit(true);
    setCreateError(null);

    if (!isValid) {
      // focus sur le 1er champ invalide (UX)
      if (!required.amount) return amountRef.current?.focus();
      if (!required.label) return;
      return;
    }

    // Convention: EXPENSE => négatif, INCOME => positif
    let amount = BigInt(amountCentsRaw!);
    if (amount === 0n) {
      setCreateError('Le montant ne peut pas être 0.');
      return;
    }
    if (fType === 'EXPENSE' && amount > 0n) amount = -amount;
    if (fType === 'INCOME' && amount < 0n) amount = -amount;

    const payload: TxUpsertPayload = {
      accountId: fAccountId,
      type: fType,
      date: dateIso,
      amountCents: amount.toString(),
      currency: (fCurrency || 'EUR').trim(),
      label: fLabel.trim(),
      note: fNote.trim() ? fNote.trim() : null,
    };
    if (fCategoryId.trim()) payload.categoryId = fCategoryId.trim();

    setCreateLoading(true);
    try {
      const res = await fetch('/api/personal/transactions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 401) return handle401();
      const data = await safeJson(res);

      if (!res.ok) {
        setCreateError(isApiErrorShape(data) ? data.error : 'Création impossible.');
        return;
      }

      setOpenAdd(false);
      await fetchTransactions({ reset: true });
    } catch (e: unknown) {
      setCreateError(getErrorMessage(e) || 'Erreur réseau.');
    } finally {
      setCreateLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-50">Transactions</h1>
          <p className="text-sm text-slate-400">
            Point unique pour filtrer, ajouter et nettoyer tes mouvements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetFilters} disabled={loadingAccounts || loadingList}>
            Réinitialiser
          </Button>
          <Button onClick={openAddModal} disabled={loadingAccounts || !accounts.length}>
            Ajouter une transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs text-slate-400">Compte</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-slate-50"
              disabled={loadingAccounts}
            >
              <option value="">Tous les comptes</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-slate-50"
              disabled={loadingAccounts || loadingList}
            >
              <option value="">Tous</option>
              <option value="INCOME">Revenus</option>
              <option value="EXPENSE">Dépenses</option>
              <option value="TRANSFER">Virements</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Du</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-slate-50"
              disabled={loadingAccounts || loadingList}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-slate-400">Au</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-12 w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 text-base text-slate-50"
              disabled={loadingAccounts || loadingList}
            />
          </div>

          <div className="lg:col-span-1">
            <label className="mb-1 block text-xs text-slate-400">Recherche</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Label / note…"
              className="h-12 rounded-2xl px-4 text-base"
            />
          </div>
        </div>
      </Card>

      {/* Error */}
      {error ? (
        <Card>
          <div className="p-4 text-sm text-red-300">{error}</div>
        </Card>
      ) : null}

      {selectedCount > 0 ? (
        <div className="sticky top-2 z-20">
          <div className="mx-auto w-fit rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/70 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-lg">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="px-2 text-sm text-slate-200">
                {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
              </span>

              <Button variant="outline" onClick={selectAllVisible} className="h-10 rounded-2xl px-4">
                Tout sélectionner
              </Button>

              <Button variant="outline" onClick={clearSelection} className="h-10 rounded-2xl px-4">
                Effacer
              </Button>

              <Button onClick={() => deleteMany(Array.from(selectedIds))} className="h-10 rounded-2xl px-4">
                Supprimer
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* List */}
      <Card>
        <div className="border-b border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-300">
              {loadingList ? 'Chargement…' : `${items.length} transaction(s)`}
            </p>
            <p className="text-xs text-slate-500">{accountLabel}</p>
          </div>
        </div>

        {loadingList ? (
          <div className="p-4 text-sm text-slate-400">Chargement des transactions…</div>
        ) : items.length === 0 ? (
          <div className="p-8">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <p className="text-sm font-medium text-slate-50">Aucune transaction</p>
              <p className="mt-1 text-sm text-slate-400">
                Ajoute ta première transaction pour commencer à suivre tes finances.
              </p>
              <div className="mt-4 flex justify-center">
                <Button onClick={openAddModal} disabled={loadingAccounts || !accounts.length}>
                  Ajouter une transaction
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {items.map((t) => {
              const neg = isNegCents(t.amountCents);
              return (
                <div
                  key={t.id}
                  className="group flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => toggleSelected(t.id)}
                      className="mt-1 h-5 w-5 accent-blue-500"
                      aria-label="Sélectionner"
                    />

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-50">{t.label}</p>

                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-slate-300">
                          {t.account?.name || 'Compte'}
                        </span>

                        {t.category ? (
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-slate-300">
                            {t.category.name}
                          </span>
                        ) : null}

                        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-slate-400">
                          {t.type}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500">
                        {formatDateFR(t.date)}
                        {t.note ? ` • ${t.note}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <p className={`text-sm font-semibold ${neg ? 'text-red-300' : 'text-emerald-300'}`}>
                      {neg ? '-' : '+'}
                      {formatCents(absCents(t.amountCents), t.currency)}
                    </p>

                    <div className="flex gap-2 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <Button
                        variant="outline"
                        onClick={() => openEditModal(t)}
                        className="h-10 rounded-2xl px-4"
                      >
                        Modifier
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => deleteOne(t.id)}
                        className="h-10 rounded-2xl px-4"
                      >
                        Supprimer
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-[var(--border)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">{nextCursor ? 'Plus de résultats disponibles' : 'Fin de liste'}</p>
            <Button
              variant="outline"
              onClick={() => fetchTransactions({ reset: false })}
              disabled={!nextCursor || loadingMore || loadingList}
            >
              {loadingMore ? 'Chargement…' : 'Charger plus'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal add */}
      <Modal
        open={openAdd}
        onCloseAction={() => (createLoading ? null : setOpenAdd(false))}
        title="Ajouter une transaction"
        description="Renseigne les infos principales."
      >
        <div className="space-y-5">
          {/* Montant — grand, tap-to-edit */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-xs text-slate-400">Montant</p>

            <div
              className={[
                'mt-2 flex items-center gap-3 rounded-2xl border bg-[var(--surface)] px-4 py-3',
                fieldError(required.amount) ? inputBad : inputOk,
              ].join(' ')}
              onClick={() => amountRef.current?.focus()}
              role="button"
              tabIndex={0}
            >
              <input
                ref={amountRef}
                value={fAmountEuro}
                onChange={(e) => setFAmountEuro(sanitizeEuroInput(e.target.value))}
                placeholder="0,00"
                className="w-full bg-transparent text-4xl font-semibold tracking-tight text-slate-50 outline-none"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
              />
              <span className="text-sm text-slate-400">{(fCurrency || 'EUR').toUpperCase()}</span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Saisie rapide. Clavier numérique sur mobile.
              </p>
              <p className="text-xs text-slate-500">
                Aperçu: {amountCentsRaw ? formatCents(absCents(amountCentsRaw), fCurrency || 'EUR') : '—'}
              </p>
            </div>
          </div>

          {/* Type — segmented control */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-sm font-semibold text-slate-50">Type</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
                const active = fType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFType(t)}
                    className={[
                      'h-12 rounded-2xl border px-3 text-sm font-medium',
                      active
                        ? 'border-[var(--border)] bg-[var(--surface)] text-slate-50'
                        : 'border-[var(--border)] bg-transparent text-slate-300 hover:bg-[var(--surface)]/60',
                      fieldError(required.type) ? 'ring-2 ring-red-500/25 border-red-500/60' : '',
                    ].join(' ')}
                  >
                    {t === 'EXPENSE' ? 'Dépense' : t === 'INCOME' ? 'Revenu' : 'Virement'}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Dépense = enregistré en négatif, Revenu = positif.
            </p>
          </div>

          {/* Infos principales */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-sm font-semibold text-slate-50">Infos</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Compte</label>
                <select
                  value={fAccountId}
                  onChange={(e) => setFAccountId(e.target.value)}
                  className={[inputBase, fieldError(required.account) ? inputBad : inputOk].join(' ')}
                  disabled={createLoading}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Date</label>
                <input
                  type="date"
                  value={fDate}
                  onChange={(e) => setFDate(e.target.value)}
                  className={[inputBase, fieldError(required.date) ? inputBad : inputOk].join(' ')}
                  disabled={createLoading}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-slate-300">Libellé</label>
                <input
                  value={fLabel}
                  onChange={(e) => setFLabel(e.target.value)}
                  placeholder="ex: Courses, Loyer, Salaire…"
                  className={[inputBase, fieldError(required.label) ? inputBad : inputOk].join(' ')}
                  disabled={createLoading}
                />
                <p className="mt-1 text-xs text-slate-500">
                  Recommandé : une phrase courte et stable (“Courses”, “Salaire”, “Loyer”…)
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Devise</label>
                <input
                  value={fCurrency}
                  onChange={(e) => setFCurrency(e.target.value.toUpperCase())}
                  className={inputBase + ' ' + inputOk}
                  disabled={createLoading}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Catégorie (optionnel)</label>
                <select
                  value={fCategoryId}
                  onChange={(e) => setFCategoryId(e.target.value)}
                  className={inputBase + ' ' + inputOk}
                  disabled={createLoading || loadingCategories}
                >
                  <option value="">Aucune catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {loadingCategories ? 'Chargement des catégories…' : 'Optionnel'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-slate-300">Note (optionnel)</label>
                <textarea
                  value={fNote}
                  onChange={(e) => setFNote(e.target.value)}
                  placeholder="Détails…"
                  className="min-h-[110px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base text-slate-50 outline-none"
                  disabled={createLoading}
                />
              </div>

              {/* Erreur serveur uniquement (pas validation) */}
              {createError ? (
                <div className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {createError}
                </div>
              ) : null}
            </div>
          </div>

          {/* Actions — bouton s’éclaire quand valid */}
          <div className="sticky bottom-0 -mx-6 px-6 pb-6 pt-3">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />

            <div className="relative mx-auto w-fit -translate-y-2 rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/70 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-lg">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpenAdd(false)}
                  disabled={createLoading}
                  className="h-12 rounded-2xl px-6 text-base"
                >
                  Annuler
                </Button>

                <Button
                  onClick={createTransaction}
                  disabled={createLoading || !isValid}
                  className={[
                    'h-12 rounded-2xl px-6 text-base transition',
                    isValid ? 'shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30' : 'opacity-70',
                  ].join(' ')}
                >
                  {createLoading ? 'Création…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal edit */}
      <Modal
        open={openEdit}
        onCloseAction={() => (editLoading ? null : setOpenEdit(false))}
        title="Modifier la transaction"
        description="Modifie une transaction passée."
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-xs text-slate-400">Montant</p>

            <div
              className={[
                'mt-2 flex items-center gap-3 rounded-2xl border bg-[var(--surface)] px-4 py-3',
                eFieldError(eRequired.amount) ? inputBad : inputOk,
              ].join(' ')}
              onClick={() => eAmountRef.current?.focus()}
              role="button"
              tabIndex={0}
            >
              <input
                ref={eAmountRef}
                value={eAmountEuro}
                onChange={(e) => setEAmountEuro(sanitizeEuroInput(e.target.value))}
                placeholder="0,00"
                className="w-full bg-transparent text-4xl font-semibold tracking-tight text-slate-50 outline-none"
                inputMode="decimal"
                enterKeyHint="done"
                autoComplete="off"
              />
              <span className="text-sm text-slate-400">{(eCurrency || 'EUR').toUpperCase()}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-sm font-semibold text-slate-50">Type</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(['EXPENSE', 'INCOME', 'TRANSFER'] as const).map((t) => {
                const active = eType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEType(t)}
                    className={[
                      'h-12 rounded-2xl border px-3 text-sm font-medium',
                      active
                        ? 'border-[var(--border)] bg-[var(--surface)] text-slate-50'
                        : 'border-[var(--border)] bg-transparent text-slate-300 hover:bg-[var(--surface)]/60',
                      eFieldError(eRequired.type) ? 'ring-2 ring-red-500/25 border-red-500/60' : '',
                    ].join(' ')}
                  >
                    {t === 'EXPENSE' ? 'Dépense' : t === 'INCOME' ? 'Revenu' : 'Virement'}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
            <p className="text-sm font-semibold text-slate-50">Infos</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Compte</label>
                <select
                  value={eAccountId}
                  onChange={(e) => setEAccountId(e.target.value)}
                  className={[inputBase, eFieldError(eRequired.account) ? inputBad : inputOk].join(' ')}
                  disabled={editLoading}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Date</label>
                <input
                  type="date"
                  value={eDate}
                  onChange={(e) => setEDate(e.target.value)}
                  className={[inputBase, eFieldError(eRequired.date) ? inputBad : inputOk].join(' ')}
                  disabled={editLoading}
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-slate-300">Libellé</label>
                <input
                  value={eLabel}
                  onChange={(e) => setELabel(e.target.value)}
                  className={[inputBase, eFieldError(eRequired.label) ? inputBad : inputOk].join(' ')}
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Devise</label>
                <input
                  value={eCurrency}
                  onChange={(e) => setECurrency(e.target.value.toUpperCase())}
                  className={inputBase + ' ' + inputOk}
                  disabled={editLoading}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-slate-300">Catégorie (optionnel)</label>
                <select
                  value={eCategoryId}
                  onChange={(e) => setECategoryId(e.target.value)}
                  className={inputBase + ' ' + inputOk}
                  disabled={editLoading || loadingCategories}
                >
                  <option value="">Aucune catégorie</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  {loadingCategories ? 'Chargement des catégories…' : 'Optionnel'}
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm text-slate-300">Note</label>
                <textarea
                  value={eNote}
                  onChange={(e) => setENote(e.target.value)}
                  className="min-h-[110px] w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-base text-slate-50 outline-none"
                  disabled={editLoading}
                />
              </div>

              {editError ? (
                <div className="sm:col-span-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                  {editError}
                </div>
              ) : null}
            </div>
          </div>

          <div className="sticky bottom-0 -mx-6 px-6 pb-6 pt-3">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/35 to-transparent" />

            <div className="relative mx-auto w-fit -translate-y-2 rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/70 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-lg">
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setOpenEdit(false)}
                  disabled={editLoading}
                  className="h-12 rounded-2xl px-6 text-base"
                >
                  Annuler
                </Button>

                <Button
                  onClick={saveEdit}
                  disabled={editLoading || !eIsValid}
                  className={[
                    'h-12 rounded-2xl px-6 text-base transition',
                    eIsValid ? 'shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/30' : 'opacity-70',
                  ].join(' ')}
                >
                  {editLoading ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
