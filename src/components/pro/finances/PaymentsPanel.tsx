'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, formatDate, paginate, type PaymentMethod } from '@/app/app/pro/pro-data';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageHeader } from '@/app/app/components/PageHeader';

// ─── Types ────────────────────────────────────────────────────────────────────

type FinanceType = 'INCOME' | 'EXPENSE';
type TypeFilter = FinanceType | 'ALL';
type SortKey = 'date' | 'amount';

type FinanceEntry = {
  id: string;
  businessId: string;
  projectId: string | null;
  projectName: string | null;
  type: FinanceType;
  amountCents: string;
  category: string;
  vendor: string | null;
  method: PaymentMethod | null;
  date: string;
  note: string | null;
  isRecurring: boolean;
  recurringUnit: string | null;
  createdAt: string;
};

type FinanceListResponse = { items: FinanceEntry[] };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_LABELS: Record<PaymentMethod, string> = {
  WIRE: 'Virement',
  CARD: 'Carte',
  CHECK: 'Chèque',
  CASH: 'Espèces',
  OTHER: 'Autre',
};

function centsToEuro(amountCents: string): number {
  const n = Number(amountCents);
  return Number.isFinite(n) ? n / 100 : 0;
}

function entryLabel(entry: FinanceEntry): string {
  const parts: string[] = [];
  if (entry.category) parts.push(entry.category);
  if (entry.vendor) parts.push(entry.vendor);
  if (parts.length === 0) return entry.type === 'INCOME' ? 'Entrée' : 'Sortie';
  return parts.join(' · ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PaymentsPanel({ businessId }: { businessId: string }) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [methodFilter, setMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('date');
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // ─── Data loading ─────────────────────────────────────────────────────────

  async function loadEntries() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<FinanceListResponse>(
        `/api/pro/businesses/${businessId}/finances`
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Chargement impossible.');
        setEntries([]);
        return;
      }
      setEntries(res.data.items);
    } catch (err) {
      setError(getErrorMessage(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!businessId) return;
    void loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  // ─── Filtered & sorted ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = entries;
    if (typeFilter !== 'ALL') list = list.filter((e) => e.type === typeFilter);
    if (methodFilter !== 'ALL') list = list.filter((e) => e.method === methodFilter);
    if (term) {
      list = list.filter(
        (e) =>
          e.category.toLowerCase().includes(term) ||
          (e.vendor ?? '').toLowerCase().includes(term) ||
          (e.note ?? '').toLowerCase().includes(term) ||
          (e.projectName ?? '').toLowerCase().includes(term)
      );
    }

    return [...list].sort((a, b) => {
      if (sort === 'amount') return Math.abs(centsToEuro(b.amountCents)) - Math.abs(centsToEuro(a.amountCents));
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [entries, methodFilter, search, sort, typeFilter]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  // ─── KPIs (mois en cours) ────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const now = new Date();
    const thisMonth = entries.filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const incomeCents = thisMonth
      .filter((e) => e.type === 'INCOME')
      .reduce((sum, e) => sum + centsToEuro(e.amountCents), 0);
    const expenseCents = thisMonth
      .filter((e) => e.type === 'EXPENSE')
      .reduce((sum, e) => sum + centsToEuro(e.amountCents), 0);
    return {
      income: incomeCents,
      expense: expenseCents,
      net: incomeCents - expenseCents,
    };
  }, [entries]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/app/pro/${businessId}/finances`}
        backLabel="Finances"
        title="Mouvements"
        subtitle="Vue complète des entrées et sorties d'argent."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <KpiCard
          label="Entrées (mois)"
          value={formatCurrency(kpis.income)}
          trend={kpis.income > 0 ? 'up' : 'neutral'}
        />
        <KpiCard
          label="Sorties (mois)"
          value={formatCurrency(kpis.expense)}
          trend={kpis.expense > 0 ? 'down' : 'neutral'}
        />
        <KpiCard
          label="Solde net (mois)"
          value={formatCurrency(kpis.net)}
          trend={kpis.net > 0 ? 'up' : kpis.net < 0 ? 'down' : 'neutral'}
        />
      </div>

      <Card className="p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-4">
          <Input
            placeholder="Rechercher (catégorie, fournisseur, projet…)"
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(1); }}
          />
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); setPage(1); }}>
            <option value="ALL">Tous types</option>
            <option value="INCOME">Entrées</option>
            <option value="EXPENSE">Sorties</option>
          </Select>
          <Select value={methodFilter} onChange={(e) => { setMethodFilter(e.target.value as PaymentMethod | 'ALL'); setPage(1); }}>
            <option value="ALL">Tous moyens</option>
            {Object.entries(METHOD_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="date">Date</option>
            <option value="amount">Montant</option>
          </Select>
        </div>

        {loading ? <p className="text-xs text-[var(--text-secondary)]">Chargement…</p> : null}
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Méthode</TableHead>
              <TableHead>Projet</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.map((entry) => {
              const amount = centsToEuro(entry.amountCents);
              const isIncome = entry.type === 'INCOME';
              return (
                <TableRow
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className="cursor-pointer hover:bg-[var(--surface-hover)]"
                  data-selected={selectedId === entry.id}
                >
                  <TableCell className="text-xs whitespace-nowrap">{formatDate(entry.date)}</TableCell>
                  <TableCell className="font-medium">{entryLabel(entry)}</TableCell>
                  <TableCell>
                    <Badge variant={isIncome ? 'pro' : 'performance'}>
                      {isIncome ? '↑ Entrée' : '↓ Sortie'}
                    </Badge>
                  </TableCell>
                  <TableCell className={`text-right font-semibold tabular-nums ${isIncome ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                    {isIncome ? '+' : '−'}{formatCurrency(amount)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {entry.method ? METHOD_LABELS[entry.method] ?? entry.method : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-[var(--text-secondary)]">
                    {entry.projectName ?? '—'}
                  </TableCell>
                </TableRow>
              );
            })}
            {pageItems.length === 0 ? (
              <TableEmpty>
                <div className="space-y-1">
                  <p className="font-semibold">Aucun mouvement</p>
                  <p className="text-sm text-[var(--text-secondary)]">
                    Aucune écriture comptable trouvée.
                  </p>
                </div>
              </TableEmpty>
            ) : null}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
          <div>{filtered.length} écriture{filtered.length > 1 ? 's' : ''} · Page {page} / {totalPages || 1}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              Précédent
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))} disabled={page >= totalPages}>
              Suivant
            </Button>
          </div>
        </div>
      </Card>

      {selected ? (
        <Card className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{entryLabel(selected)}</p>
              <p className="text-xs text-[var(--text-secondary)]">
                {selected.type === 'INCOME' ? 'Entrée' : 'Sortie'} · {formatDate(selected.date)}
                {selected.projectName ? ` · ${selected.projectName}` : ''}
              </p>
            </div>
            <p className={`text-sm font-semibold ${selected.type === 'INCOME' ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
              {selected.type === 'INCOME' ? '+' : '−'}{formatCurrency(centsToEuro(selected.amountCents))}
            </p>
          </div>
          {selected.vendor ? (
            <p className="text-xs text-[var(--text-secondary)]">Fournisseur : {selected.vendor}</p>
          ) : null}
          {selected.method ? (
            <p className="text-xs text-[var(--text-secondary)]">Méthode : {METHOD_LABELS[selected.method] ?? selected.method}</p>
          ) : null}
          {selected.note ? (
            <p className="text-xs text-[var(--text-secondary)]">Note : {selected.note}</p>
          ) : null}
          {selected.isRecurring ? (
            <Badge variant="neutral">Récurrent ({selected.recurringUnit === 'MONTHLY' ? 'mensuel' : 'annuel'})</Badge>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
