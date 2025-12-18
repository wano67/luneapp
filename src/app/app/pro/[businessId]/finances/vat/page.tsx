// src/app/app/pro/[businessId]/finances/vat/page.tsx
'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatCurrency, formatDate, getMockVatPeriods, paginate, type VatPeriod } from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

type SortKey = 'period' | 'due';

const STATUS_LABELS: Record<VatPeriod['status'], string> = {
  draft: 'Brouillon',
  filed: 'Déposé',
  paid: 'Payé',
};

export default function VatPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [periods, setPeriods] = usePersistentState<VatPeriod[]>(
    `vat:${businessId}`,
    getMockVatPeriods()
  );
  const [statusFilter, setStatusFilter] = useState<VatPeriod['status'] | 'ALL'>('ALL');
  const [sort, setSort] = useState<SortKey>('period');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = periods;
    if (statusFilter !== 'ALL') list = list.filter((p) => p.status === statusFilter);
    return [...list].sort((a, b) =>
      sort === 'period'
        ? a.period.localeCompare(b.period)
        : b.due - a.due
    );
  }, [periods, sort, statusFilter]);

  const { pageItems, totalPages } = useMemo(
    () => paginate(filtered, page, pageSize),
    [filtered, page]
  );

  const displaySelectedId = selectedId ?? pageItems[0]?.id ?? null;
  const selected = periods.find((p) => p.id === displaySelectedId) ?? null;

  const kpis = useMemo(() => {
    const collected = periods.reduce((sum, p) => sum + p.collected, 0);
    const deductible = periods.reduce((sum, p) => sum + p.deductible, 0);
    const due = periods.reduce((sum, p) => sum + p.due, 0);
    const unpaid = periods
      .filter((p) => p.status !== 'paid')
      .reduce((sum, p) => sum + p.due, 0);
    return [
      { label: 'TVA collectée', value: formatCurrency(collected) },
      { label: 'TVA déductible', value: formatCurrency(deductible) },
      { label: 'TVA due (total)', value: formatCurrency(due) },
      { label: 'Due non payée', value: formatCurrency(unpaid) },
    ];
  }, [periods]);

  function markStatus(status: VatPeriod['status']) {
    if (!selected) return;
    setInfo(null);
    setPeriods((prev) =>
      prev.map((p) => (p.id === selected.id ? { ...p, status } : p))
    );
    setInfo(`Période marquée ${STATUS_LABELS[status]}.`);
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · VAT
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">TVA</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Suivi TVA pour Business #{businessId}.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
        ))}
      </div>

      <Card className="p-5 space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Déclarations</p>
            <p className="text-xs text-[var(--text-secondary)]">Filtres, tri, actions rapides.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setInfo('Export TVA simulé.')}>
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <Select
            label="Statut"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as VatPeriod['status'] | 'ALL');
              setPage(1);
            }}
          >
            <option value="ALL">Tous</option>
            <option value="draft">Brouillon</option>
            <option value="filed">Déposé</option>
            <option value="paid">Payé</option>
          </Select>
          <Select label="Tri" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="period">Période</option>
            <option value="due">Montant</option>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Période</TableHead>
              <TableHead>Collectée</TableHead>
              <TableHead>Déductible</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableEmpty>Aucune période.</TableEmpty>
            ) : (
              pageItems.map((period) => (
                <TableRow
                  key={period.id}
                  className={period.id === displaySelectedId ? 'bg-[var(--surface-2)]' : ''}
                  onClick={() => setSelectedId(period.id)}
                >
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {period.period}
                  </TableCell>
                  <TableCell>{formatCurrency(period.collected)}</TableCell>
                  <TableCell>{formatCurrency(period.deductible)}</TableCell>
                  <TableCell>{formatCurrency(period.due)}</TableCell>
                  <TableCell>{formatDate(period.dueAt)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="neutral"
                      className={
                        period.status === 'paid'
                          ? 'bg-emerald-100 text-emerald-700'
                          : period.status === 'filed'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                      }
                    >
                      {STATUS_LABELS[period.status]}
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
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                Période {selected.period}
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Échéance {formatDate(selected.dueAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="neutral">{STATUS_LABELS[selected.status]}</Badge>
              <Button size="sm" variant="outline" onClick={() => markStatus('filed')}>
                Marquer déposé
              </Button>
              <Button size="sm" variant="outline" onClick={() => markStatus('paid')}>
                Marquer payé
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Collectée</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.collected)}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Déductible</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.deductible)}
              </p>
            </Card>
            <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
              <p className="text-xs text-[var(--text-secondary)]">Due</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatCurrency(selected.due)}
              </p>
            </Card>
          </div>

          <Card className="border-dashed border-[var(--border)] bg-transparent p-3">
            <p className="text-xs text-[var(--text-secondary)]">Historique</p>
            <p className="text-sm text-[var(--text-primary)]">
              Échéance {formatDate(selected.dueAt)} · statut {STATUS_LABELS[selected.status]}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">Business #{businessId}</p>
          </Card>
        </Card>
      ) : null}
    </div>
  );
}
