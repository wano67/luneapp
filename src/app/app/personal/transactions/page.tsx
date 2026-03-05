'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { absCents, formatCents, formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';
import { emitWalletRefresh } from '@/lib/personalEvents';
import { TransactionFormModal } from './TransactionFormModal';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function isNegCents(cents: string) {
  try {
    return BigInt(cents) < 0n;
  } catch {
    return String(cents).startsWith('-');
  }
}

function isTxnType(v: string): v is 'INCOME' | 'EXPENSE' | 'TRANSFER' {
  return v === 'INCOME' || v === 'EXPENSE' || v === 'TRANSFER';
}

function euroFromCentsStr(centsStr: string) {
  return formatCentsToEuroInput(absCents(centsStr));
}

function buildAmountCents(amountEuro: string, type: 'INCOME' | 'EXPENSE' | 'TRANSFER'): string | null {
  const cents = parseEuroToCents(amountEuro);
  if (!Number.isFinite(cents)) return null;
  let amount = BigInt(String(cents));
  if (amount === 0n) return null;
  if (type === 'EXPENSE' && amount > 0n) amount = -amount;
  if (type === 'INCOME' && amount < 0n) amount = -amount;
  return amount.toString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PersoTransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Data
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [items, setItems] = useState<TxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // UI state
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectedCount = selectedIds.size;

  // Create modal
  const [openAdd, setOpenAdd] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fAccountId, setFAccountId] = useState('');
  const [fType, setFType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [fDate, setFDate] = useState(isoDateOnly(new Date()));
  const [fAmountEuro, setFAmountEuro] = useState('');
  const [fCurrency, setFCurrency] = useState('EUR');
  const [fLabel, setFLabel] = useState('');
  const [fNote, setFNote] = useState('');
  const [fCategoryId, setFCategoryId] = useState('');
  const amountRef = useRef<HTMLInputElement | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  // Edit modal
  const [openEdit, setOpenEdit] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TxItem | null>(null);
  const [eAccountId, setEAccountId] = useState('');
  const [eType, setEType] = useState<'INCOME' | 'EXPENSE' | 'TRANSFER'>('EXPENSE');
  const [eDate, setEDate] = useState(isoDateOnly(new Date()));
  const [eAmountEuro, setEAmountEuro] = useState('');
  const [eCurrency, setECurrency] = useState('EUR');
  const [eLabel, setELabel] = useState('');
  const [eNote, setENote] = useState('');
  const [eCategoryId, setECategoryId] = useState('');
  const eAmountRef = useRef<HTMLInputElement | null>(null);
  const [editAttemptedSubmit, setEditAttemptedSubmit] = useState(false);

  // ─── Derived ────────────────────────────────────────────────────────────────

  function handle401() {
    router.push(`/login?from=${encodeURIComponent(pathname || '/app/personal/transactions')}`);
  }

  const accountLabel = useMemo(() => {
    if (!accountId) return 'Tous les comptes';
    return accounts.find((a) => a.id === accountId)?.name ?? 'Compte';
  }, [accountId, accounts]);

  const amountCentsRaw = useMemo(() => {
    const c = parseEuroToCents(fAmountEuro);
    return Number.isFinite(c) ? String(c) : null;
  }, [fAmountEuro]);

  const dateIso = useMemo(() => (fDate ? toISOFromDateOnly(fDate) : ''), [fDate]);

  const required = useMemo(() => ({
    account: !!fAccountId, type: !!fType, date: !!dateIso, amount: !!amountCentsRaw, label: !!fLabel.trim(),
  }), [fAccountId, fType, dateIso, amountCentsRaw, fLabel]);

  const isValid = useMemo(
    () => required.account && required.type && required.date && required.amount && required.label,
    [required],
  );

  const eAmountCentsRaw = useMemo(() => {
    const c = parseEuroToCents(eAmountEuro);
    return Number.isFinite(c) ? String(c) : null;
  }, [eAmountEuro]);

  const eDateIso = useMemo(() => (eDate ? toISOFromDateOnly(eDate) : ''), [eDate]);

  const eRequired = useMemo(() => ({
    account: !!eAccountId, type: !!eType, date: !!eDateIso, amount: !!eAmountCentsRaw, label: !!eLabel.trim(),
  }), [eAccountId, eType, eDateIso, eAmountCentsRaw, eLabel]);

  const eIsValid = useMemo(
    () => eRequired.account && eRequired.type && eRequired.date && eRequired.amount && eRequired.label,
    [eRequired],
  );

  // ─── Data loaders ───────────────────────────────────────────────────────────

  async function fetchAccounts() {
    setLoadingAccounts(true);
    setError(null);
    try {
      const res = await fetchJson<{ items: AccountItem[] }>('/api/personal/accounts');
      if (!res.ok) { if (res.status === 401) return handle401(); throw new Error('Impossible de charger les comptes'); }
      const list = res.data?.items ?? [];
      setAccounts(list);
      if (!fAccountId && list.length) { setFAccountId(list[0].id); setFCurrency(list[0].currency ?? 'EUR'); }
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingAccounts(false);
    }
  }

  async function fetchCategories() {
    setLoadingCategories(true);
    try {
      const res = await fetchJson<{ items: CategoryItem[] }>('/api/personal/categories');
      if (!res.ok) { if (res.status === 401) return handle401(); throw new Error('Impossible de charger les catégories'); }
      setCategories(res.data?.items ?? []);
    } catch {
      // Categories are optional — fail silently
    } finally {
      setLoadingCategories(false);
    }
  }

  async function fetchTransactions(opts?: { reset?: boolean }) {
    const reset = !!opts?.reset;
    if (reset) { setLoadingList(true); setItems([]); setNextCursor(null); } else { setLoadingMore(true); }
    setError(null);
    try {
      const query = buildQuery({
        accountId: accountId || undefined,
        type: type || undefined,
        q: q.trim() || undefined,
        from: from ? toISOFromDateOnly(from) : undefined,
        to: to ? toISOFromDateOnly(to) : undefined,
        limit: '50',
        cursor: reset ? undefined : nextCursor,
      });
      const res = await fetchJson<{ items: TxItem[]; nextCursor?: string }>(`/api/personal/transactions${query}`);
      if (!res.ok) { if (res.status === 401) return handle401(); throw new Error('Impossible de charger les transactions'); }
      const got = res.data?.items ?? [];
      setItems((prev) => (reset ? got : [...prev, ...got]));
      setNextCursor(res.data?.nextCursor ?? null);
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoadingList(false);
      setLoadingMore(false);
    }
  }

  // ─── Effects ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAccounts(); fetchCategories(); }, []);

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

  // ─── Selection ──────────────────────────────────────────────────────────────

  function toggleSelected(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function clearSelection() { setSelectedIds(new Set()); }
  function selectAllVisible() { setSelectedIds(new Set(items.map((x) => x.id))); }

  // ─── CRUD handlers ─────────────────────────────────────────────────────────

  function openAddModal() {
    setAttemptedSubmit(false);
    const baseAccountId = accountId || accounts[0]?.id || '';
    if (baseAccountId) setFAccountId(baseAccountId);
    const acc = accounts.find((a) => a.id === baseAccountId);
    setFCurrency(acc?.currency ?? 'EUR');
    setFType('EXPENSE');
    setFDate(isoDateOnly(new Date()));
    setFAmountEuro(''); setFLabel(''); setFNote(''); setFCategoryId('');
    setCreateError(null);
    setOpenAdd(true);
    setTimeout(() => amountRef.current?.focus(), 50);
  }

  async function createTransaction() {
    setAttemptedSubmit(true);
    setCreateError(null);
    if (!isValid) { if (!required.amount) amountRef.current?.focus(); return; }
    const finalAmount = buildAmountCents(fAmountEuro, fType);
    if (!finalAmount) { setCreateError('Le montant ne peut pas être 0.'); return; }
    const payload: TxUpsertPayload = {
      accountId: fAccountId, type: fType, date: dateIso, amountCents: finalAmount,
      currency: (fCurrency || 'EUR').trim(), label: fLabel.trim(), note: fNote.trim() || null,
    };
    if (fCategoryId.trim()) payload.categoryId = fCategoryId.trim();
    setCreateLoading(true);
    try {
      const res = await fetchJson('/api/personal/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { if (res.status === 401) return handle401(); setCreateError(res.error ?? 'Création impossible.'); return; }
      setOpenAdd(false);
      await fetchTransactions({ reset: true });
      emitWalletRefresh();
    } catch (e) {
      setCreateError(getErrorMessage(e));
    } finally {
      setCreateLoading(false);
    }
  }

  function openEditModal(t: TxItem) {
    setEditing(t);
    setEditError(null);
    setEditAttemptedSubmit(false);
    setEAccountId(t.account?.id || accounts[0]?.id || '');
    setEType(isTxnType(String(t.type)) ? (t.type as 'INCOME' | 'EXPENSE' | 'TRANSFER') : 'EXPENSE');
    setEDate(t.date ? isoDateOnly(new Date(t.date)) : isoDateOnly(new Date()));
    setEAmountEuro(euroFromCentsStr(t.amountCents));
    setECurrency((t.currency || 'EUR').toUpperCase());
    setELabel(t.label || ''); setENote(t.note || ''); setECategoryId(t.category?.id ?? '');
    setOpenEdit(true);
    setTimeout(() => eAmountRef.current?.focus(), 50);
  }

  async function saveEdit() {
    setEditAttemptedSubmit(true);
    setEditError(null);
    if (!editing || !eIsValid) { if (!eRequired.amount) eAmountRef.current?.focus(); return; }
    const finalAmount = buildAmountCents(eAmountEuro, eType);
    if (!finalAmount) { setEditError('Le montant ne peut pas être 0.'); return; }
    const payload: TxUpsertPayload = {
      accountId: eAccountId, type: eType, date: eDateIso, amountCents: finalAmount,
      currency: (eCurrency || 'EUR').trim(), label: eLabel.trim(), note: eNote.trim() || null,
    };
    payload.categoryId = eCategoryId || null;
    setEditLoading(true);
    try {
      const res = await fetchJson(`/api/personal/transactions/${encodeURIComponent(editing.id)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) { if (res.status === 401) return handle401(); setEditError(res.error ?? 'Modification impossible.'); return; }
      setOpenEdit(false); setEditing(null);
      await fetchTransactions({ reset: true });
      emitWalletRefresh();
    } catch (e) {
      setEditError(getErrorMessage(e));
    } finally {
      setEditLoading(false);
    }
  }

  async function deleteMany(ids: string[]) {
    if (!ids.length) return;
    const ok = window.confirm(ids.length === 1 ? 'Supprimer cette transaction ?' : `Supprimer ${ids.length} transactions ?`);
    if (!ok) return;
    try {
      const res = await fetchJson('/api/personal/transactions/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
      if (!res.ok) { if (res.status === 401) return handle401(); throw new Error(res.error ?? 'Suppression impossible'); }
      clearSelection();
      await fetchTransactions({ reset: true });
      emitWalletRefresh();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  function resetFilters() { setAccountId(''); setType(''); setQ(''); setFrom(''); setTo(''); }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <PageContainer>
      <div className="space-y-4">
        <PageHeader
          title="Transactions"
          subtitle="Point unique pour filtrer, ajouter et nettoyer tes mouvements."
          actions={
            <>
              <Button variant="outline" onClick={resetFilters} disabled={loadingAccounts || loadingList}>
                Réinitialiser
              </Button>
              <Button onClick={openAddModal} disabled={loadingAccounts || !accounts.length}>
                Ajouter une transaction
              </Button>
            </>
          }
        />

        {/* Filters */}
        <Card>
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label className="mb-1 block text-xs text-[var(--text-faint)]">Compte</label>
              <Select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={loadingAccounts}
              >
                <option value="">Tous les comptes</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[var(--text-faint)]">Type</label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={loadingAccounts || loadingList}
              >
                <option value="">Tous</option>
                <option value="INCOME">Revenus</option>
                <option value="EXPENSE">Dépenses</option>
                <option value="TRANSFER">Virements</option>
              </Select>
            </div>

            <div>
              <Input
                label="Du"
                type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="h-12 rounded-2xl"
                disabled={loadingAccounts || loadingList}
              />
            </div>

            <div>
              <Input
                label="Au"
                type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="h-12 rounded-2xl"
                disabled={loadingAccounts || loadingList}
              />
            </div>

            <div className="lg:col-span-1">
              <label className="mb-1 block text-xs text-[var(--text-faint)]">Recherche</label>
              <Input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Label / note…" className="h-12 rounded-2xl px-4 text-base"
              />
            </div>
          </div>
        </Card>

        {/* Error */}
        {error ? <Card><div className="p-4 text-sm text-[var(--danger)]">{error}</div></Card> : null}

        {/* Bulk selection */}
        {selectedCount > 0 ? (
          <div className="sticky top-2 z-20">
            <div className="mx-auto w-fit rounded-2xl border border-[var(--border)] bg-[var(--background-alt)]/70 px-3 py-3 shadow-2xl shadow-black/40 backdrop-blur-lg">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="px-2 text-sm text-[var(--text)]">
                  {selectedCount} sélectionnée{selectedCount > 1 ? 's' : ''}
                </span>
                <Button variant="outline" onClick={selectAllVisible} className="h-10 rounded-2xl px-4">Tout sélectionner</Button>
                <Button variant="outline" onClick={clearSelection} className="h-10 rounded-2xl px-4">Effacer</Button>
                <Button onClick={() => deleteMany(Array.from(selectedIds))} className="h-10 rounded-2xl px-4">Supprimer</Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* List */}
        <Card>
          <div className="border-b border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-faint)]">{loadingList ? 'Chargement…' : `${items.length} transaction(s)`}</p>
              <p className="text-xs text-[var(--text-muted)]">{accountLabel}</p>
            </div>
          </div>

          {loadingList ? (
            <div className="p-4 text-sm text-[var(--text-faint)]">Chargement des transactions…</div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
                <p className="text-sm font-medium text-[var(--text)]">Aucune transaction</p>
                <p className="mt-1 text-sm text-[var(--text-faint)]">
                  Ajoute ta première transaction pour commencer à suivre tes finances.
                </p>
                <div className="mt-4 flex justify-center">
                  <Button onClick={openAddModal} disabled={loadingAccounts || !accounts.length}>Ajouter une transaction</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {items.map((t) => {
                const neg = isNegCents(t.amountCents);
                return (
                  <div key={t.id} className="group flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelected(t.id)}
                        className="mt-1 h-5 w-5 accent-blue-500" aria-label="Sélectionner"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-[var(--text)]">{t.label}</p>
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-faint)]">
                            {t.account?.name || 'Compte'}
                          </span>
                          {t.category ? (
                            <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-faint)]">
                              {t.category.name}
                            </span>
                          ) : null}
                          <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px] text-[var(--text-faint)]">
                            {t.type}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatDateFR(t.date)}{t.note ? ` • ${t.note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <p className={`text-sm font-semibold ${neg ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                        {neg ? '-' : '+'}{formatCents(absCents(t.amountCents), t.currency)}
                      </p>
                      <div className="flex gap-2 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <Button variant="outline" onClick={() => openEditModal(t)} className="h-10 rounded-2xl px-4">Modifier</Button>
                        <Button variant="outline" onClick={() => deleteMany([t.id])} className="h-10 rounded-2xl px-4">Supprimer</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-muted)]">{nextCursor ? 'Plus de résultats disponibles' : 'Fin de liste'}</p>
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

        {/* Create modal */}
        <TransactionFormModal
          open={openAdd}
          onClose={() => setOpenAdd(false)}
          title="Ajouter une transaction"
          description="Renseigne les infos principales."
          accountId={fAccountId}
          type={fType}
          date={fDate}
          amountEuro={fAmountEuro}
          currency={fCurrency}
          label={fLabel}
          note={fNote}
          categoryId={fCategoryId}
          required={required}
          isValid={isValid}
          attemptedSubmit={attemptedSubmit}
          amountPreview={amountCentsRaw ? formatCents(absCents(amountCentsRaw), fCurrency || 'EUR') : '—'}
          accounts={accounts}
          categories={categories}
          loadingCategories={loadingCategories}
          loading={createLoading}
          error={createError}
          submitLabel="Enregistrer"
          loadingLabel="Création…"
          amountRef={amountRef}
          onAccountChange={setFAccountId}
          onTypeChange={setFType}
          onDateChange={setFDate}
          onAmountChange={setFAmountEuro}
          onCurrencyChange={setFCurrency}
          onLabelChange={setFLabel}
          onNoteChange={setFNote}
          onCategoryChange={setFCategoryId}
          onSubmit={createTransaction}
        />

        {/* Edit modal */}
        <TransactionFormModal
          open={openEdit}
          onClose={() => setOpenEdit(false)}
          title="Modifier la transaction"
          description="Modifie une transaction passée."
          accountId={eAccountId}
          type={eType}
          date={eDate}
          amountEuro={eAmountEuro}
          currency={eCurrency}
          label={eLabel}
          note={eNote}
          categoryId={eCategoryId}
          required={eRequired}
          isValid={eIsValid}
          attemptedSubmit={editAttemptedSubmit}
          amountPreview={null}
          accounts={accounts}
          categories={categories}
          loadingCategories={loadingCategories}
          loading={editLoading}
          error={editError}
          submitLabel="Enregistrer"
          loadingLabel="Enregistrement…"
          amountRef={eAmountRef}
          onAccountChange={setEAccountId}
          onTypeChange={setEType}
          onDateChange={setEDate}
          onAmountChange={setEAmountEuro}
          onCurrencyChange={setECurrency}
          onLabelChange={setELabel}
          onNoteChange={setENote}
          onCategoryChange={setECategoryId}
          onSubmit={saveEdit}
        />
      </div>
    </PageContainer>
  );
}
