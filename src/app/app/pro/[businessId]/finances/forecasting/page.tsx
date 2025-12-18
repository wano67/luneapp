// src/app/app/pro/[businessId]/finances/forecasting/page.tsx
'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { KpiCard } from '@/components/ui/kpi-card';
import {
  formatCurrency,
  getMockForecast,
  type ForecastRow,
} from '../../../pro-data';
import { usePersistentState } from '../../../usePersistentState';

type Horizon = '3' | '6' | '12';

export default function ForecastingPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;

  const [rows, setRows] = usePersistentState<ForecastRow[]>(
    `forecast:${businessId}`,
    getMockForecast()
  );
  const [horizon, setHorizon] = useState<Horizon>('6');
  const [info, setInfo] = useState<string | null>(null);

  const [form, setForm] = useState({
    month: '',
    revenue: '',
    expenses: '',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const limit = Number(horizon);
    return rows.slice(0, limit);
  }, [horizon, rows]);

  const kpis = useMemo(() => {
    if (!filtered.length) return [];
    const avgRevenue = filtered.reduce((sum, r) => sum + r.revenue, 0) / filtered.length;
    const avgNet = filtered.reduce((sum, r) => sum + r.net, 0) / filtered.length;
    const runway = filtered[0]?.runway ?? 0;
    const forecastTotal = filtered.reduce((sum, r) => sum + r.net, 0);
    return [
      { label: 'CA moyen', value: formatCurrency(avgRevenue) },
      { label: 'Net moyen', value: formatCurrency(avgNet) },
      { label: 'Runway', value: `${runway} mois` },
      { label: 'Net cumulé horizon', value: formatCurrency(forecastTotal) },
    ];
  }, [filtered]);

  function addScenario(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    setInfo(null);
    const revenue = Number(form.revenue);
    const expenses = Number(form.expenses);
    if (!form.month) {
      setFormError('Mois requis (YYYY-MM)');
      return;
    }
    if (!Number.isFinite(revenue) || !Number.isFinite(expenses)) {
      setFormError('Montants invalides');
      return;
    }
    const net = revenue - expenses;
    const next: ForecastRow = {
      id: `fc-${Date.now()}`,
      month: form.month,
      revenue,
      expenses,
      net,
      runway: Math.max(0, Math.round((net > 0 ? net : 1) / 1000)),
    };
    const nextRows = [...rows, next].sort((a, b) => a.month.localeCompare(b.month));
    setRows(nextRows);
    setInfo('Scénario ajouté.');
    setForm({ month: '', revenue: '', expenses: '' });
  }

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--text-secondary)]">
          PRO · Finances · Forecasting
        </p>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Prévisions</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Scénarios et projections financières pour Business #{businessId}.
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
            <p className="text-sm font-semibold text-[var(--text-primary)]">Prévisions mensuelles</p>
            <p className="text-xs text-[var(--text-secondary)]">Table + horizon dynamique</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={horizon} onChange={(e) => setHorizon(e.target.value as Horizon)}>
              <option value="3">3 mois</option>
              <option value="6">6 mois</option>
              <option value="12">12 mois</option>
            </Select>
            <Button size="sm" variant="outline" onClick={() => setInfo('Export forecast simulé.')}>
              Export
            </Button>
            {info ? <span className="text-[10px] text-emerald-500">{info}</span> : null}
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mois</TableHead>
              <TableHead>Revenu</TableHead>
              <TableHead>Charges</TableHead>
              <TableHead>Net</TableHead>
              <TableHead>Runway</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableEmpty>Aucune projection.</TableEmpty>
            ) : (
              filtered.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold text-[var(--text-primary)]">
                    {row.month}
                  </TableCell>
                  <TableCell>{formatCurrency(row.revenue)}</TableCell>
                  <TableCell>{formatCurrency(row.expenses)}</TableCell>
                  <TableCell className={row.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                    {formatCurrency(row.net)}
                  </TableCell>
                  <TableCell>{row.runway} mois</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Card className="space-y-3 p-5">
        <p className="text-sm font-semibold text-[var(--text-primary)]">Ajouter un scénario</p>
        <form onSubmit={addScenario} className="grid gap-3 md:grid-cols-4">
          <Input
            label="Mois (YYYY-MM)"
            value={form.month}
            onChange={(e) => setForm((prev) => ({ ...prev, month: e.target.value }))}
            placeholder="2024-12"
          />
          <Input
            label="Revenu"
            type="number"
            value={form.revenue}
            onChange={(e) => setForm((prev) => ({ ...prev, revenue: e.target.value }))}
          />
          <Input
            label="Charges"
            type="number"
            value={form.expenses}
            onChange={(e) => setForm((prev) => ({ ...prev, expenses: e.target.value }))}
          />
          <div className="flex items-end gap-2">
            <Button type="submit">Ajouter</Button>
            {formError ? <span className="text-xs text-rose-500">{formError}</span> : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
