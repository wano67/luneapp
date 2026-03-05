'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { absCents, formatCents, formatCentsToEuroInput, parseEuroToCents } from '@/lib/money';
import { fmtKpi } from '@/lib/format';
import { emitWalletRefresh } from '@/lib/personalEvents';
import { TransactionFormModal } from './TransactionFormModal';

const CategoryPieChart = dynamic(
  () => import('@/components/ui/charts/CategoryPieChart').then((m) => ({ default: m.CategoryPieChart })),
  { ssr: false }
);

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

type Analytics = {
  totalIncomeCents: string;
  totalExpenseCents: string;
  txnCount: number;
  topExpenseCategories: { name: string; totalCents: string; count: number }[];
  topExpenses: { id: string; label: string; amountCents: string; date: string; currency: string; accountName: string }[];
  perAccount: { accountId: string; accountName: string; count: number; totalCents: string }[];
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

function periodLabel(from: string, to: string): string {
  if (!from && !to) return 'Ce mois-ci';
  if (from && to) return `${formatDateFR(from + 'T00:00:00')} — ${formatDateFR(to + 'T00:00:00')}`;
  if (from) return `Depuis le ${formatDateFR(from + 'T00:00:00')}`;
  return `Jusqu'au ${formatDateFR(to + 'T00:00:00')}`;
}

const CHART_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6',
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PersoTransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();

  // Data
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [items, setItems] = useState<TxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  // UI state
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingAnalytics, setLoadingAnalytics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Pie chart data
  const pieData = useMemo(() => {
    if (!analytics?.topExpenseCategories.length) return [];
    return analytics.topExpenseCategories.map((c, i) => ({
      name: c.name,
      value: Math.abs(Number(c.totalCents)) / 100,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  }, [analytics]);

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

  async function fetchAnalytics() {
    setLoadingAnalytics(true);
    try {
      const query = buildQuery({
        from: from ? toISOFromDateOnly(from) : undefined,
        to: to ? toISOFromDateOnly(to) : undefined,
      });
      const res = await fetchJson<Analytics>(`/api/personal/transactions/analytics${query}`);
      if (res.ok && res.data) setAnalytics(res.data);
    } catch {
      // Analytics optional
    } finally {
      setLoadingAnalytics(false);
    }
  }

  // ─── Effects ────────────────────────────────────────────────────────────────

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAccounts(); fetchCategories(); }, []);

  useEffect(() => {
    if (loadingAccounts) return;
    fetchTransactions({ reset: true });
    fetchAnalytics();
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
      await Promise.all([fetchTransactions({ reset: true }), fetchAnalytics()]);
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
      await Promise.all([fetchTransactions({ reset: true }), fetchAnalytics()]);
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
      await Promise.all([fetchTransactions({ reset: true }), fetchAnalytics()]);
      emitWalletRefresh();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  function resetFilters() { setAccountId(''); setType(''); setQ(''); setFrom(''); setTo(''); setFiltersOpen(false); }

  const activeFilterCount = [accountId, type, from, to].filter(Boolean).length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  const periodText = periodLabel(from, to);

  return (
    <PageContainer>
      <div className="space-y-5">
        <PageHeader
          title="Transactions"
          subtitle="Analyse tes dépenses et revenus en un coup d'oeil."
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

        {/* Filters — compact on mobile, full on desktop */}
        <div className="space-y-3">
          {/* Search bar + toggle (always visible) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-faint)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher une transaction…"
                className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-10 pr-4 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-faint)] focus:border-[var(--focus-ring)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              className="relative flex h-11 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]/50 lg:hidden"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" x2="20" y1="6" y2="6" /><line x1="7" x2="17" y1="12" y2="12" /><line x1="10" x2="14" y1="18" y2="18" />
              </svg>
              <span className="hidden sm:inline">Filtres</span>
              {activeFilterCount > 0 ? (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--shell-accent)] text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Expandable filter grid — always visible on lg, toggle on mobile */}
          <div className={[
            'overflow-hidden transition-all duration-200',
            filtersOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 lg:max-h-[500px] lg:opacity-100',
          ].join(' ')}>
            <Card>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
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
              </div>
            </Card>
          </div>
        </div>

        {error ? <Card><div className="p-4 text-sm text-[var(--danger)]">{error}</div></Card> : null}

        {/* ═══ Analytics Dashboard ═══ */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* KPIs Row */}
          <section className="lg:col-span-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Dépenses */}
            <div className="rounded-2xl bg-[var(--danger)] p-5">
              <p className="text-sm font-medium text-white/80">Dépenses</p>
              {loadingAnalytics ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
              ) : (
                <p className="mt-1 text-3xl font-extrabold text-white">
                  {fmtKpi(analytics?.totalExpenseCents ?? '0')}
                </p>
              )}
              <p className="mt-1 text-xs text-white/60">{periodText}</p>
            </div>

            {/* Revenus */}
            <div className="rounded-2xl bg-[var(--success)] p-5">
              <p className="text-sm font-medium text-white/80">Revenus</p>
              {loadingAnalytics ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
              ) : (
                <p className="mt-1 text-3xl font-extrabold text-white">
                  {fmtKpi(analytics?.totalIncomeCents ?? '0')}
                </p>
              )}
              <p className="mt-1 text-xs text-white/60">{periodText}</p>
            </div>

            {/* Solde net */}
            <div className="rounded-2xl bg-[var(--shell-accent)] p-5">
              <p className="text-sm font-medium text-white/80">Solde net</p>
              {loadingAnalytics ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
              ) : (
                <p className="mt-1 text-3xl font-extrabold text-white">
                  {fmtKpi(
                    String(
                      BigInt(analytics?.totalIncomeCents ?? '0') +
                      BigInt(analytics?.totalExpenseCents ?? '0')
                    )
                  )}
                </p>
              )}
              <p className="mt-1 text-xs text-white/60">{periodText}</p>
            </div>

            {/* Nombre de transactions */}
            <div className="rounded-2xl bg-[var(--shell-accent)] p-5">
              <p className="text-sm font-medium text-white/80">Transactions</p>
              {loadingAnalytics ? (
                <div className="mt-2 h-8 w-28 rounded-lg bg-white/20 animate-skeleton-pulse" />
              ) : (
                <p className="mt-1 text-3xl font-extrabold text-white">
                  {analytics?.txnCount ?? 0}
                </p>
              )}
              <p className="mt-1 text-xs text-white/60">{periodText}</p>
            </div>
          </section>

          {/* Allocation des dépenses (Pie Chart) */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text)]">Allocation des dépenses</p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">Par catégorie — {periodText}</p>
            {loadingAnalytics ? (
              <div className="mt-4 flex items-center justify-center" style={{ height: 260 }}>
                <div className="h-32 w-32 rounded-full bg-[var(--surface-2)] animate-skeleton-pulse" />
              </div>
            ) : pieData.length > 0 ? (
              <div className="mt-3">
                <CategoryPieChart data={pieData} height={260} />
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 260 }}>
                Aucune catégorie de dépense
              </div>
            )}
          </section>

          {/* Top dépenses */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text)]">Plus grosses dépenses</p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">{periodText}</p>
            {loadingAnalytics ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-[var(--surface-2)] animate-skeleton-pulse" />
                ))}
              </div>
            ) : analytics?.topExpenses.length ? (
              <div className="mt-4 space-y-2">
                {analytics.topExpenses.map((t, i) => (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)]/50 px-3 py-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--danger)]/10 text-xs font-bold text-[var(--danger)]">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--text)]">{t.label}</p>
                      <p className="text-xs text-[var(--text-faint)]">{t.accountName} · {formatDateFR(t.date)}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-[var(--danger)]">
                      {formatCents(absCents(t.amountCents), t.currency)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 200 }}>
                Aucune dépense
              </div>
            )}
          </section>

          {/* Transactions par compte */}
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text)]">Par compte</p>
            <p className="mt-0.5 text-xs text-[var(--text-faint)]">Nombre de transactions — {periodText}</p>
            {loadingAnalytics ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 rounded-xl bg-[var(--surface-2)] animate-skeleton-pulse" />
                ))}
              </div>
            ) : analytics?.perAccount.length ? (
              <div className="mt-4 space-y-2">
                {analytics.perAccount
                  .sort((a, b) => b.count - a.count)
                  .map((pa) => {
                    const maxCount = Math.max(...analytics.perAccount.map((x) => x.count));
                    const pct = maxCount > 0 ? (pa.count / maxCount) * 100 : 0;
                    return (
                      <div key={pa.accountId} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm text-[var(--text)]">{pa.accountName}</p>
                          <span className="shrink-0 text-xs font-medium text-[var(--text-faint)]">
                            {pa.count} txn · {fmtKpi(pa.totalCents)}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div
                            className="h-full rounded-full bg-[var(--shell-accent)] transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-center text-sm text-[var(--text-faint)]" style={{ height: 200 }}>
                Aucune donnée
              </div>
            )}
          </section>
        </div>

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

        {/* ═══ Transaction List ═══ */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text)]">
                {loadingList ? 'Chargement…' : `${items.length} transaction(s)`}
              </p>
              <p className="text-xs text-[var(--text-faint)]">{periodText}</p>
            </div>
          </div>

          {loadingList ? (
            <div className="space-y-0 divide-y divide-[var(--border)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="h-5 w-5 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
                    <div className="h-3 w-24 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
                  </div>
                  <div className="h-4 w-20 rounded bg-[var(--surface-2)] animate-skeleton-pulse" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-8">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/30 p-6 text-center">
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
                  <div key={t.id} className="group flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-[var(--surface-2)]/30 transition-colors">
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
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {formatDateFR(t.date)}{t.note ? ` · ${t.note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <p className={`text-sm font-semibold ${neg ? 'text-[var(--danger)]' : 'text-[var(--success)]'}`}>
                        {neg ? '-' : '+'}{formatCents(absCents(t.amountCents), t.currency)}
                      </p>
                      <div className="flex gap-2 transition sm:opacity-0 sm:group-hover:opacity-100">
                        <Button variant="outline" onClick={() => openEditModal(t)} className="h-9 rounded-xl px-3 text-xs">Modifier</Button>
                        <Button variant="outline" onClick={() => deleteMany([t.id])} className="h-9 rounded-xl px-3 text-xs">Supprimer</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="border-t border-[var(--border)] px-5 py-4">
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
        </section>

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
