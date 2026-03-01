'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { DebugRequestId } from '@/components/ui/debug-request-id';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';

type TreasuryResponse = {
  businessId: string;
  range: { from: string; to: string };
  totals: { incomeCents: string; expenseCents: string; netCents: string };
  monthly: Array<{ month: string; incomeCents: string; expenseCents: string; netCents: string }>;
  byCategory: Array<{ category: string; netCents: string }>;
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

export function TreasuryPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<TreasuryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<TreasuryResponse>(`/api/pro/businesses/${businessId}/finances/treasury`);
      if (!mounted) return;
      setRequestId(res.requestId);
      setLoading(false);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger la trésorerie.';
        setError(msg);
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

      {error && <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">{error}</div>}
      <DebugRequestId requestId={requestId} />

      {loading && <p>Chargement…</p>}
      {!loading && data && (
        <>
          <Card className="p-4 space-y-2">
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-sm text-[var(--text-faint)]">Revenus</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.incomeCents)}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-faint)]">Dépenses</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.expenseCents)}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-faint)]">Net</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.netCents)}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--text-faint)]">
              Période : {new Date(data.range.from).toLocaleDateString()} → {new Date(data.range.to).toLocaleDateString()}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Par mois</h2>
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
                {data.monthly.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell>{formatMoney(m.incomeCents)}</TableCell>
                    <TableCell>{formatMoney(m.expenseCents)}</TableCell>
                    <TableCell>{formatMoney(m.netCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Top catégories (net)</h2>
            {data.byCategory.length === 0 ? (
              <p className="text-sm text-[var(--text-faint)]">Aucune catégorie disponible.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Net</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byCategory.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell>{c.category}</TableCell>
                      <TableCell>{formatMoney(c.netCents)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
