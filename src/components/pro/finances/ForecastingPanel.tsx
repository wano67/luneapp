'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { PageHeader } from '@/app/app/components/PageHeader';

type ForecastResponse = {
  businessId: string;
  historyRange: { from: string; to: string };
  assumptions: { monthsAveraged: number; note: string };
  history: Array<{ month: string; incomeCents: string; expenseCents: string; netCents: string }>;
  projections: Array<{
    month: string;
    projectedIncomeCents: string;
    projectedExpenseCents: string;
    projectedNetCents: string;
  }>;
};

function formatMoney(cents: string) {
  const num = Number(cents) / 100;
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num);
  } catch {
    return `${num.toFixed(0)} €`;
  }
}

export function ForecastingPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<ForecastResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<ForecastResponse>(`/api/pro/businesses/${businessId}/finances/forecasting`);
      if (!mounted) return;
      setRequestId(res.requestId);
      setLoading(false);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les prévisions.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setData(null);
        return;
      }
      setData(res.data);
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [businessId]);

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/app/pro/${businessId}/finances`}
        backLabel="Finances"
        title="Prévisions"
        subtitle="Projection simple basée sur la moyenne des 3 derniers mois."
      />

      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-3 py-2 rounded">{error}</div>}
      {requestId && (
        <div className="text-xs text-muted-foreground">
          Request ID: <code>{requestId}</code>
        </div>
      )}

      {loading && <p>Chargement…</p>}
      {!loading && data && (
        <>
          <Card className="p-4 space-y-1">
            <div className="text-sm text-muted-foreground">
              Historique: {new Date(data.historyRange.from).toLocaleDateString()} →{' '}
              {new Date(data.historyRange.to).toLocaleDateString()}
            </div>
            <div className="text-sm text-muted-foreground">
              Hypothèses: {data.assumptions.note} (moyenne sur {data.assumptions.monthsAveraged} mois)
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Historique (6 mois)</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>Revenus</TableHead>
                    <TableHead>Dépenses</TableHead>
                    <TableHead>Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.history.map((m) => (
                    <TableRow key={m.month}>
                      <TableCell>{m.month}</TableCell>
                      <TableCell>{formatMoney(m.incomeCents)}</TableCell>
                      <TableCell>{formatMoney(m.expenseCents)}</TableCell>
                      <TableCell>{formatMoney(m.netCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Projection (3 mois)</h2>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mois</TableHead>
                    <TableHead>Revenus projetés</TableHead>
                    <TableHead>Dépenses projetées</TableHead>
                    <TableHead>Net projeté</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.projections.map((p) => (
                    <TableRow key={p.month}>
                      <TableCell>{p.month}</TableCell>
                      <TableCell>{formatMoney(p.projectedIncomeCents)}</TableCell>
                      <TableCell>{formatMoney(p.projectedExpenseCents)}</TableCell>
                      <TableCell>{formatMoney(p.projectedNetCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
