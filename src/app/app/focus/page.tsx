'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';

type LatestTx = {
  id: string;
  label: string;
  amountCents: string;
  date: string;
  categoryName: string | null;
  accountName: string;
};

type PersonalSummary = {
  totalBalanceCents: string;
  monthNetCents: string;
  monthIncomeCents: string;
  monthExpenseCents: string;
  latestTransactions: LatestTx[];
};

type NextDueInvoice = {
  id: string;
  totalCents: string;
  dueAt: string;
  projectName: string;
};

type ProSummary = {
  businessId: string;
  businessName: string;
  activeProjectsCount: number;
  pendingInvoicesCount: number;
  monthRevenueCents: string;
  nextDueInvoice: NextDueInvoice | null;
};

type FocusSummary = {
  personal: PersonalSummary;
  pro: ProSummary | null;
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatDueDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function FocusPage() {
  const [data, setData] = useState<FocusSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<FocusSummary>('/api/focus/summary');
    if (res.ok && res.data) setData(res.data);
    else setError(res.error ?? 'Impossible de charger le résumé.');
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const personal = data?.personal;
  const pro = data?.pro;

  const monthNet = personal ? BigInt(personal.monthNetCents) : 0n;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="Focus"
        subtitle="Vue croisée de tes finances perso et pro."
      />

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-[var(--text-faint)]">Chargement…</p>
      ) : (
        <>
          {/* ── Wallet ───────────────────────────────────────────── */}
          <section className="space-y-4">
            <SectionHeader
              title="Wallet — Perso"
              actions={
                <Button asChild variant="outline" size="sm">
                  <Link href="/app/personal">Voir le wallet</Link>
                </Button>
              }
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiCard
                label="Solde total"
                value={personal ? formatCentsToEuroDisplay(personal.totalBalanceCents) : '—'}
              />
              <KpiCard
                label="Revenus (mois)"
                value={personal ? formatCentsToEuroDisplay(personal.monthIncomeCents) : '—'}
                trend="up"
              />
              <KpiCard
                label="Net (mois)"
                value={personal ? formatCentsToEuroDisplay(personal.monthNetCents) : '—'}
                trend={monthNet >= 0n ? 'up' : 'down'}
              />
            </div>
          </section>

          {/* ── Studio ───────────────────────────────────────────── */}
          {pro ? (
            <section className="space-y-4">
              <SectionHeader
                title={`Studio — ${pro.businessName}`}
                actions={
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/app/pro/${pro.businessId}`}>Voir le studio</Link>
                  </Button>
                }
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <KpiCard
                  label="CA encaissé (mois)"
                  value={formatCentsToEuroDisplay(pro.monthRevenueCents)}
                  trend="up"
                />
                <KpiCard
                  label="Projets actifs"
                  value={String(pro.activeProjectsCount)}
                />
                <KpiCard
                  label="Factures en attente"
                  value={String(pro.pendingInvoicesCount)}
                  trend={pro.pendingInvoicesCount > 0 ? 'down' : 'up'}
                />
              </div>

              {/* Next due invoice */}
              {pro.nextDueInvoice ? (
                <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-xs text-[var(--text-faint)]">Prochaine facture à encaisser</p>
                    <p className="mt-0.5 font-semibold">{pro.nextDueInvoice.projectName}</p>
                    <p className="text-sm text-[var(--text-faint)]">
                      Échéance le {formatDueDate(pro.nextDueInvoice.dueAt)} —{' '}
                      <span className="font-medium text-[var(--text)]">
                        {formatCentsToEuroDisplay(pro.nextDueInvoice.totalCents)}
                      </span>
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/pro/${pro.businessId}/finances/invoices/${pro.nextDueInvoice.id}`}>
                      Voir la facture
                    </Link>
                  </Button>
                </Card>
              ) : null}
            </section>
          ) : (
            <section className="space-y-4">
              <SectionHeader title="Studio — Pro" />
              <Card className="p-6 text-center">
                <p className="text-sm text-[var(--text-faint)]">
                  Aucune activité pro pour le moment.
                </p>
                <Button asChild size="sm" className="mt-3">
                  <Link href="/app/pro">Créer un espace pro</Link>
                </Button>
              </Card>
            </section>
          )}

          {/* ── Activité récente ──────────────────────────────────── */}
          {personal && personal.latestTransactions.length > 0 ? (
            <section className="space-y-4">
              <SectionHeader
                title="Dernières transactions"
                actions={
                  <Button asChild variant="outline" size="sm">
                    <Link href="/app/personal/transactions">Toutes les transactions</Link>
                  </Button>
                }
              />
              <Card className="divide-y divide-[var(--border)]">
                {personal.latestTransactions.map((tx) => {
                  const amt = BigInt(tx.amountCents);
                  const isPositive = amt >= 0n;
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{tx.label || '—'}</p>
                        <p className="text-xs text-[var(--text-faint)]">
                          {tx.accountName}
                          {tx.categoryName ? ` · ${tx.categoryName}` : ''}
                          {' · '}
                          {formatDate(tx.date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tx.categoryName ? (
                          <Badge variant="neutral" className="hidden sm:inline-flex">
                            {tx.categoryName}
                          </Badge>
                        ) : null}
                        <span
                          className="text-sm font-semibold"
                          style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                        >
                          {isPositive ? '+' : ''}
                          {formatCentsToEuroDisplay(tx.amountCents)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </Card>
            </section>
          ) : null}
        </>
      )}
    </PageContainer>
  );
}
