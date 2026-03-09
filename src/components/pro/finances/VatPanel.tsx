'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';

type TauxEntry = {
  tauxBps: number;
  tauxPercent: number;
  baseHTCents: string;
  tvaCents: string;
};

type TvaData = {
  periode: { from: string; to: string };
  ventesParTaux: TauxEntry[];
  achatsParTaux: TauxEntry[];
  totalTvaCollecteeCents: string;
  totalTvaDeductibleCents: string;
  tvaAPayerCents: string;
  creditTvaCents: string;
};

function kpi(cents: string) {
  return formatCents(Number(cents));
}

export function VatPanel({ businessId }: { businessId: string }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const [mode, setMode] = useState<'monthly' | 'quarterly'>('monthly');
  const [year, setYear] = useState(String(currentYear));
  const [month, setMonth] = useState(String(currentMonth));
  const [quarter, setQuarter] = useState(String(Math.floor(currentMonth / 3)));

  const [data, setData] = useState<TvaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const computePeriod = useCallback(() => {
    const y = Number.parseInt(year, 10);
    if (mode === 'monthly') {
      const m = Number.parseInt(month, 10);
      const from = new Date(y, m, 1);
      const to = new Date(y, m + 1, 0);
      return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
    }
    const q = Number.parseInt(quarter, 10);
    const from = new Date(y, q * 3, 1);
    const to = new Date(y, q * 3 + 3, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, [year, month, quarter, mode]);

  useEffect(() => {
    let cancelled = false;
    const period = computePeriod();
    fetchJson<TvaData>(
      `/api/pro/businesses/${businessId}/accounting/tva?from=${period.from}&to=${period.to}`
    ).then(res => {
      if (cancelled) return;
      setLoading(false);
      if (res.ok && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger la TVA.');
        setData(null);
      }
    });
    return () => { cancelled = true; };
  }, [businessId, computePeriod]);

  const tvaAPayer = data ? Number(data.tvaAPayerCents) : 0;
  const creditTva = data ? Number(data.creditTvaCents) : 0;

  const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const quarterNames = ['T1 (Jan-Mar)', 'T2 (Avr-Jun)', 'T3 (Jul-Sep)', 'T4 (Oct-Déc)'];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-32" value={mode} onChange={(e) => setMode(e.target.value as 'monthly' | 'quarterly')}>
          <option value="monthly">Mensuel</option>
          <option value="quarterly">Trimestriel</option>
        </Select>
        <Select className="w-24" value={year} onChange={(e) => setYear(e.target.value)}>
          {Array.from({ length: 5 }, (_, i) => currentYear - i).map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        {mode === 'monthly' ? (
          <Select className="w-36" value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthNames.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </Select>
        ) : (
          <Select className="w-36" value={quarter} onChange={(e) => setQuarter(e.target.value)}>
            {quarterNames.map((name, i) => (
              <option key={i} value={i}>{name}</option>
            ))}
          </Select>
        )}
      </div>

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {loading ? <p className="text-sm text-[var(--text-secondary)]">Chargement…</p> : null}

      {!loading && data ? (
        <>
          {/* KPIs */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">TVA collectée</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.totalTvaCollecteeCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">TVA déductible</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{kpi(data.totalTvaDeductibleCents)}</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-xs text-[var(--text-secondary)]">
                {tvaAPayer > 0 ? 'TVA à payer' : creditTva > 0 ? 'Crédit de TVA' : 'Solde TVA'}
              </p>
              <p className={`text-lg font-semibold ${tvaAPayer > 0 ? 'text-[var(--danger)]' : creditTva > 0 ? 'text-emerald-600' : 'text-[var(--text-primary)]'}`}>
                {tvaAPayer > 0 ? kpi(data.tvaAPayerCents) : creditTva > 0 ? kpi(data.creditTvaCents) : '0 €'}
              </p>
            </Card>
          </div>

          {/* Ventes par taux */}
          {data.ventesParTaux.length > 0 ? (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                TVA collectée (ventes)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taux</TableHead>
                    <TableHead className="text-right">Base HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ventesParTaux.map((t) => (
                    <TableRow key={t.tauxBps}>
                      <TableCell>{t.tauxPercent} %</TableCell>
                      <TableCell className="text-right">{kpi(t.baseHTCents)}</TableCell>
                      <TableCell className="text-right">{kpi(t.tvaCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          {/* Achats par taux */}
          {data.achatsParTaux.length > 0 ? (
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--text-secondary)]">
                TVA déductible (achats)
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Taux</TableHead>
                    <TableHead className="text-right">Base HT</TableHead>
                    <TableHead className="text-right">TVA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.achatsParTaux.map((t) => (
                    <TableRow key={t.tauxBps}>
                      <TableCell>{t.tauxPercent} %</TableCell>
                      <TableCell className="text-right">{kpi(t.baseHTCents)}</TableCell>
                      <TableCell className="text-right">{kpi(t.tvaCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : null}

          {data.ventesParTaux.length === 0 && data.achatsParTaux.length === 0 ? (
            <Card className="border-dashed p-6 text-center">
              <p className="text-sm text-[var(--text-secondary)]">
                Aucune écriture avec TVA sur cette période.
              </p>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
