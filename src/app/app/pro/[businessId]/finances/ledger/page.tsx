// src/app/app/pro/[businessId]/finances/ledger/page.tsx
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { PageHeader } from '../../../../components/PageHeader';

type LedgerLine = {
  id: string;
  accountCode: string;
  accountName: string | null;
  debitCents: string | null;
  creditCents: string | null;
  metadata: unknown;
  createdAt: string;
};

type LedgerEntry = {
  id: string;
  date: string;
  memo: string | null;
  sourceType: string;
  sourceId: string | null;
  createdAt: string;
  lines: LedgerLine[];
};

const SOURCE_LABELS: Record<string, string> = {
  INVENTORY_MOVEMENT: 'Mouvement stock',
  INVOICE_STOCK_CONSUMPTION: 'COGS facture',
  INVOICE_CASH_SALE: 'Vente (caisse)',
};

export default function LedgerPage() {
  const active = useActiveBusiness({ optional: true });
  const businessId = active?.activeBusiness?.id;
  const role = active?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    try {
      setLoading(true);
      setError(null);
      const res = await fetchJson<{ items?: LedgerEntry[] }>(
        `/api/pro/businesses/${businessId}/ledger?limit=50`,
        {},
        controller.signal
      );
      setRequestId(res.requestId ?? null);
      if (!res.ok || !res.data) {
        setError(res.requestId ? `${res.error ?? 'Impossible de charger'} (Ref: ${res.requestId})` : res.error ?? 'Impossible de charger');
        setEntries([]);
        return;
      }
      setEntries(res.data.items ?? []);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(getErrorMessage(err));
      setEntries([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [businessId, load]);

  const formatted = useMemo(
    () =>
      entries.map((e) => ({
        ...e,
        dateFmt: new Date(e.date).toLocaleString('fr-FR'),
        debit: e.lines.reduce((acc, l) => acc + (l.debitCents ? Number(l.debitCents) : 0), 0),
        credit: e.lines.reduce((acc, l) => acc + (l.creditCents ? Number(l.creditCents) : 0), 0),
        sourceLabel: SOURCE_LABELS[e.sourceType] ?? e.sourceType,
      })),
    [entries]
  );

  if (!businessId) {
    return <p className="text-sm text-[var(--text-secondary)]">Aucune entreprise active.</p>;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        backHref={`/app/pro/${businessId}/finances`}
        backLabel="Finances"
        title="Grand livre"
        subtitle="Écritures liées au stock et aux factures."
      />
      {requestId ? <p className="text-[10px] text-[var(--text-secondary)]">Req: {requestId}</p> : null}

      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Écritures récentes</p>
            <p className="text-xs text-[var(--text-secondary)]">Lecture seule. Equilibre débit/crédit requis.</p>
          </div>
          <div className="flex items-center gap-2">
            {error ? <span className="text-xs text-rose-500">{error}</span> : null}
            <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
              Recharger
            </Button>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : formatted.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Aucune écriture.</p>
        ) : (
          <div className="space-y-3">
            {formatted.map((entry) => (
              <Link
                key={entry.id}
                href={`/api/pro/businesses/${businessId}/ledger/${entry.id}`}
                className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                <Card className="border border-[var(--border)] bg-[var(--surface)]/60 p-3 space-y-2 transition-colors hover:border-[var(--accent)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {entry.dateFmt} · {entry.memo ?? 'Écriture'}
                      </p>
                      <p className="text-[11px] text-[var(--text-secondary)]">
                        Source: {entry.sourceLabel} {entry.sourceId ? `#${entry.sourceId}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                      <Badge variant="neutral">Débit {entry.debit}</Badge>
                      <Badge variant="neutral">Crédit {entry.credit}</Badge>
                      <Badge variant="neutral">{entry.lines.length} lignes</Badge>
                      <span className="text-[var(--text-primary)] underline">Détail</span>
                    </div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {entry.lines.map((line) => (
                      <div key={line.id} className="rounded border border-[var(--border)]/70 bg-white/40 p-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[var(--text-primary)]">{line.accountCode}</span>
                          <span className="text-[11px] text-[var(--text-secondary)]">{new Date(line.createdAt).toLocaleDateString('fr-FR')}</span>
                        </div>
                        {line.accountName ? <p className="text-[11px] text-[var(--text-secondary)]">{line.accountName}</p> : null}
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Débit: {line.debitCents ?? '0'} · Crédit: {line.creditCents ?? '0'}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {!isAdmin ? (
        <p className="text-xs text-[var(--text-secondary)]">Lecture seule (permissions admin requises pour modifier la comptabilité).</p>
      ) : null}
    </div>
  );
}
