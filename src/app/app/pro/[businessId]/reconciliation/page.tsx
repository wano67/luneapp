'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePageTitle } from '@/lib/hooks/usePageTitle';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchJson } from '@/lib/apiClient';
import { formatCents } from '@/lib/money';
import { Check, Link2, Unlink, RefreshCw } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Suggestion = {
  financeId: string;
  paymentId: string;
  confidence: 'high' | 'medium';
  financeLabel: string;
  financeAmountCents: string;
  financeDate: string;
  paymentAmountCents: string;
  paymentDate: string;
  paymentReference: string | null;
  invoiceNumber: string | null;
  clientName: string | null;
};

type UnreconciledItem = {
  id: string;
  amountCents: string;
  date: string;
  label: string;
  method: string | null;
  pieceRef: string | null;
};

type ReconciliationData = {
  unreconciledCount: number;
  reconciledCount: number;
  suggestions: Suggestion[];
  unreconciled: UnreconciledItem[];
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReconciliationPage() {
  usePageTitle('Rapprochement');
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const basePath = `/api/pro/businesses/${businessId}/reconciliation`;

  const [data, setData] = useState<ReconciliationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await fetchJson<ReconciliationData>(basePath);
      if (res.ok && res.data) {
        setData(res.data);
        setError(null);
      } else {
        setError(res.error ?? 'Impossible de charger les données.');
      }
    } finally {
      setLoading(false);
    }
  }, [businessId, basePath]);

  useEffect(() => { void load(); }, [load]);

  async function confirmMatch(financeId: string, paymentId: string) {
    setConfirming(financeId);
    const res = await fetchJson<{ ok: boolean }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeId, paymentId }),
    });
    setConfirming(null);
    if (res.ok) void load();
    else setError(res.error ?? 'Erreur lors du rapprochement.');
  }

  async function manualReconcile(financeId: string) {
    setConfirming(financeId);
    const res = await fetchJson<{ ok: boolean }>(basePath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeId }),
    });
    setConfirming(null);
    if (res.ok) void load();
    else setError(res.error ?? 'Erreur lors du rapprochement.');
  }

  const suggestions = data?.suggestions ?? [];
  const unreconciled = data?.unreconciled ?? [];
  const matchedFinIds = new Set(suggestions.map((s) => s.financeId));
  const unmatchedFinances = unreconciled.filter((f) => !matchedFinIds.has(f.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Rapprochement bancaire</h1>
        <p className="text-sm text-[var(--text-faint)]">
          Rapprochez automatiquement vos écritures comptables avec les paiements reçus.
        </p>
      </div>

      {error && (
        <div className="text-sm text-[var(--danger)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* KPIs */}
      {data && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-[var(--success)]">{data.reconciledCount}</div>
            <div className="text-xs text-[var(--text-faint)]">Rapprochées</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-[var(--warning)]">{data.unreconciledCount}</div>
            <div className="text-xs text-[var(--text-faint)]">Non rapprochées</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-2xl font-bold text-[var(--accent)]">{suggestions.length}</div>
            <div className="text-xs text-[var(--text-faint)]">Suggestions</div>
          </Card>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
        <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
        Actualiser
      </Button>

      {/* Suggested matches */}
      {suggestions.length > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Rapprochements suggérés ({suggestions.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Écriture</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Paiement</TableHead>
                <TableHead>Confiance</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {suggestions.map((s) => (
                <TableRow key={`${s.financeId}-${s.paymentId}`}>
                  <TableCell>
                    <div className="font-medium">{s.financeLabel}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {new Date(s.financeDate).toLocaleDateString('fr-FR')}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">{formatCents(Number(s.financeAmountCents))}</TableCell>
                  <TableCell>
                    <div>{s.clientName ?? '—'}</div>
                    <div className="text-xs text-[var(--text-faint)]">
                      {s.invoiceNumber ? `Facture ${s.invoiceNumber}` : s.paymentReference ?? '—'}
                      {' · '}
                      {new Date(s.paymentDate).toLocaleDateString('fr-FR')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.confidence === 'high' ? 'pro' : 'neutral'}>
                      {s.confidence === 'high' ? 'Forte' : 'Moyenne'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      onClick={() => confirmMatch(s.financeId, s.paymentId)}
                      disabled={confirming === s.financeId}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Confirmer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Unmatched finances */}
      {unmatchedFinances.length > 0 && (
        <Card className="p-4 space-y-3">
          <h2 className="font-medium flex items-center gap-2">
            <Unlink className="w-4 h-4" />
            Écritures sans correspondance ({unmatchedFinances.length})
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Réf.</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {unmatchedFinances.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.label}</TableCell>
                  <TableCell className="font-mono">{formatCents(Number(f.amountCents))}</TableCell>
                  <TableCell className="text-sm">{new Date(f.date).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="text-sm">{f.pieceRef ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => manualReconcile(f.id)}
                      disabled={confirming === f.id}
                    >
                      Rapprocher manuellement
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {loading && <div className="text-sm text-[var(--text-faint)]">Chargement...</div>}
      {!loading && !data && <div className="text-sm text-[var(--text-faint)]">Aucune donnée.</div>}
    </div>
  );
}
