// src/app/app/pro/[businessId]/finances/treasury/page.tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  formatCurrency,
  formatDate,
  getMockTreasury,
  paginate,
  type TreasuryEntry,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';
import { KpiCard } from '@/components/ui/kpi-card';

type SortKey = 'date' | 'amount';

export default function TreasuryPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [entries, setEntries] = usePersistentState<TreasuryEntry[]>(
    `treasury:${businessId}`,
    getMockTreasury()
  );
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INFLOW' | 'OUTFLOW'>('ALL');
  const [sort, setSort] = useState<SortKey>('date');
  const [page, setPage] = useState(1);
  const pageSize = 6;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<{
    label: string;
    type: 'INFLOW' | 'OUTFLOW';
    amount: string;
    date: string;
    category: string;
    note: string;
  }>({
    label: '',
    type: 'INFLOW',
    amount: '',
    date: '',
    category: '',
    note: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = entries;
    if (typeFilter !== 'ALL') list = list.filter((e) => e.type === typeFilter);
    if (term) {
      list = list.filter(
        (e) =>
          e.label.toLowerCase().includes(term) ||
          e.category.toLowerCase().includes(term) ||
          (e.note ?? '').toLowerCase().includes(term)
      );
    }
    return [...list].sort((a, b) =>
      sort === 'amount'
        ? b.amount - a.amount
        : new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [entries, search, sort, typeFilter]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const displaySelectedId = selectedId ?? pageItems[0]?.id ?? null;
  const selected = entries.find((e) => e.id === displaySelectedId) ?? null;

  const kpis = useMemo(() => {
    const balance = entries.reduce(
      (sum, e) => sum + (e.type === 'INFLOW' ? e.amount : -e.amount),
      0
    );
    const horizon = 30;
    const now = new Date();
    const last30 = entries.filter(
      (e) => now.getTime() - new Date(e.date).getTime() <= horizon * 24 * 60 * 60 * 1000
    );
    const cashflow30 = last30.reduce(
      (sum, e) => sum + (e.type === 'INFLOW' ? e.amount : -e.amount),
      0
    );
    const monthlyBurn = entries
      .filter((e) => e.type === 'OUTFLOW')
      .reduce((sum, e) => sum + e.amount, 0);
    const runway = monthlyBurn > 0 ? Math.max(0, balance / monthlyBurn) : Infinity;
    const forecast3m = balance + cashflow30 * 3;

    return [
      { label: 'Solde trésorerie', value: formatCurrency(balance) },
      { label: 'Cashflow 30j', value: formatCurrency(cashflow30) },
      { label: 'Runway estimé', value: runway === Infinity ? '∞' : `${runway.toFixed(1)} mois` },
      { label: 'Projection 3 mois', value: formatCurrency(forecast3m) },
    ];
  }, [entries]);

  function resetForm() {
    setForm({
      label: '',
      type: 'INFLOW',
      amount: '',
      date: '',
      category: '',
      note: '',
    });
    setFormError(null);
  }

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setInfo(null);
    const amount = Number(form.amount);
    if (!form.label.trim()) {
      setFormError('Libellé requis');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError('Montant invalide');
      return;
    }
    if (!form.date) {
      setFormError('Date requise');
      return;
    }
    const next: TreasuryEntry = {
      id: `tre-${Date.now()}`,
      label: form.label.trim(),
      type: form.type,
      amount,
      currency: 'EUR',
      date: new Date(form.date).toISOString(),
      category: form.category || 'Divers',
      note: form.note.trim() || undefined,
    };
    const updated = [...entries, next];
    setEntries(updated);
    setSelectedId(next.id);
    setInfo('Entrée ajoutée.');
    setCreateOpen(false);
    resetForm();
  }

  return (
    <div className="space-y-5">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Treasury
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Trésorerie</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suivi cash et projections pour Business #{businessId}.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Flux de trésorerie</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + filtres + pagination</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Ajouter une ligne
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInfo('Export trésorerie simulé.')}
            >
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <Input
            label="Recherche"
            placeholder="Libellé, catégorie…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'ALL' | 'INFLOW' | 'OUTFLOW');
              setPage(1);
            }}
          >
            <option value="ALL">Tous</option>
            <option value="INFLOW">Entrée</option>
            <option value="OUTFLOW">Sortie</option>
          </Select>
          <Select
            label="Tri"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="date">Date</option>
            <option value="amount">Montant</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Montant</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucune donnée de trésorerie.</TableEmpty>
            ) : (
              pageItems.map((entry) => (
                <TableRow
                  key={entry.id}
                  className={entry.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(entry.id)}
                >
                  <TableCell className="font-medium text-[var(--text-primary)]">
                    {entry.label}
                    <p className="text-[10px] text-[var(--text-secondary)]">{entry.note ?? '—'}</p>
                  </TableCell>
                  <TableCell>{entry.category}</TableCell>
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>{formatCurrency(entry.amount, entry.currency)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={
                        entry.type === 'INFLOW'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }
                    >
                      {entry.type === 'INFLOW' ? 'Entrée' : 'Sortie'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Page précédente
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Page suivante
            </Button>
          </div>
          <p>
            Page {page}/{totalPages}
          </p>
        </div>
      </Card>

      {selected ? (
        <Card className="space-y-3 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{selected.label}</p>
              <p className="text-xs text-[var(--text-secondary)]">{selected.category}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">
                {selected.type === 'INFLOW' ? 'Entrée' : 'Sortie'} · {formatCurrency(selected.amount)}
              </Badge>
              <Button size="sm" variant="outline">
                Ajuster
              </Button>
              <Button size="sm" variant="outline">
                Marquer vérifié
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Date</p>
              <p className="text-sm text-[var(--text-primary)]">{formatDate(selected.date)}</p>
              <p className="text-[10px] text-[var(--text-secondary)]">
                Source {selected.source ?? 'Manuel'}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Montant</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.amount, selected.currency)}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">{selected.note ?? '—'}</p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">KPI</p>
              <p className="text-sm text-[var(--text-primary)]">
                Impact trésorerie {selected.type === 'INFLOW' ? '+' : '-'}
                {formatCurrency(selected.amount)}
              </p>
              <p className="text-[10px] text-[var(--text-secondary)]">Business #{businessId}</p>
            </Card>
          </div>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        onCloseAction={() => {
          setCreateOpen(false);
          resetForm();
        }}
        title="Ajouter un flux"
        description="Flux manuel pour suivre la trésorerie."
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <Input
            label="Libellé"
            value={form.label}
            onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, type: e.target.value as 'INFLOW' | 'OUTFLOW' }))
              }
            >
              <option value="INFLOW">Entrée</option>
              <option value="OUTFLOW">Sortie</option>
            </Select>
            <Input
              label="Montant"
              type="number"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Date"
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
            />
            <Input
              label="Catégorie"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
              placeholder="Charges fixes, encaissement..."
            />
          </div>
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Note</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              placeholder="Justification, banque, référence."
            />
          </label>
          <div className="flex items-center justify-between">
            {formError ? <p className="text-xs text-rose-500">{formError}</p> : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
