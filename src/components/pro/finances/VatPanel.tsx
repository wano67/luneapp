'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { PageHeader } from '@/app/app/components/PageHeader';

type VatResponse = {
  businessId: string;
  range: { from: string; to: string };
  isConfigured: boolean;
  totals: { collectedCents: string; deductibleCents: string; balanceCents: string };
  monthly: Array<{ month: string; collectedCents: string; deductibleCents: string; balanceCents: string }>;
  message?: string | null;
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

export function VatPanel({ businessId }: { businessId: string }) {
  const [data, setData] = useState<VatResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<VatResponse>(`/api/pro/businesses/${businessId}/finances/vat`);
      if (!mounted) return;
      setRequestId(res.requestId);
      setLoading(false);
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger la TVA.';
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
        title="TVA / Déclarations"
        subtitle="Synthèse TVA collectée/déductible basée sur vos écritures."
      />

      {error && <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">{error}</div>}
      {requestId && (
        <div className="text-xs text-[var(--text-faint)]">
          Request ID: <code>{requestId}</code>
        </div>
      )}

      {loading && <p>Chargement…</p>}
      {!loading && data && (
        <>
          <Card className="p-4 space-y-2">
            <div className="flex gap-6 flex-wrap">
              <div>
                <div className="text-sm text-[var(--text-faint)]">Collectée</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.collectedCents)}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-faint)]">Déductible</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.deductibleCents)}</div>
              </div>
              <div>
                <div className="text-sm text-[var(--text-faint)]">Balance</div>
                <div className="text-lg font-semibold">{formatMoney(data.totals.balanceCents)}</div>
              </div>
            </div>
            <div className="text-xs text-[var(--text-faint)]">
              Période : {new Date(data.range.from).toLocaleDateString()} → {new Date(data.range.to).toLocaleDateString()}
            </div>
            {!data.isConfigured && (
              <div className="text-sm text-[var(--warning)] bg-[var(--warning-bg)] border border-[var(--warning-border)] px-3 py-2 rounded">
                {data.message || 'Aucune écriture TVA détectée (categories VAT_COLLECTED / VAT_PAID).'}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-semibold mb-2">Par mois</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead>Collectée</TableHead>
                  <TableHead>Déductible</TableHead>
                  <TableHead>Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monthly.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell>{formatMoney(m.collectedCents)}</TableCell>
                    <TableCell>{formatMoney(m.deductibleCents)}</TableCell>
                    <TableCell>{formatMoney(m.balanceCents)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
