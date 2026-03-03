'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import { fmtKpi, fmtDate } from '@/lib/format';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
    <PageContainer className="gap-7">
      <PageHeader title="Focus" />

      {error ? <Alert variant="danger" title={error} /> : null}

      {loading ? (
        <EmptyState title="Chargement…" />
      ) : (
        <>
          {/* ── Wallet — Personnel ── */}
          <div className="flex flex-col gap-4">
            <SectionHeader
              title="Wallet — Personnel"
              actions={
                <Button variant="outline" size="sm" asChild>
                  <Link href="/app/personal">Wallet <ChevronRight size={14} /></Link>
                </Button>
              }
            />

            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <KpiCard
                label="Solde total"
                value={personal ? fmtKpi(personal.totalBalanceCents) : '—'}
                delay={0}
              />
              <KpiCard
                label="Revenus (mois)"
                value={personal ? fmtKpi(personal.monthIncomeCents) : '—'}
                delay={50}
              />
              <KpiCard
                label="Net (mois)"
                value={personal ? fmtKpi(personal.monthNetCents) : '—'}
                delay={100}
                delta={personal ? (monthNet >= 0n ? '+' : '') + fmtKpi(personal.monthNetCents) : undefined}
                trend={monthNet >= 0n ? 'up' : 'down'}
              />
            </div>
          </div>

          {/* ── Studio — Pro ── */}
          {pro ? (
            <div className="flex flex-col gap-4">
              <SectionHeader
                title={`Studio — ${pro.businessName}`}
                actions={
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/app/pro/${pro.businessId}`}>Studio <ChevronRight size={14} /></Link>
                  </Button>
                }
              />

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <KpiCard label="CA encaissé (mois)" value={fmtKpi(pro.monthRevenueCents)} delay={150} />
                <KpiCard label="Projets actifs" value={String(pro.activeProjectsCount)} delay={200} />
                <KpiCard label="Factures en attente" value={String(pro.pendingInvoicesCount)} delay={250} />
              </div>

              {/* Next due invoice */}
              {pro.nextDueInvoice && (
                <div
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
                  style={{ background: 'var(--shell-accent)' }}
                >
                  <div className="min-w-0">
                    <p className="text-xs text-white/70">Prochaine facture à encaisser</p>
                    <p className="text-sm font-semibold text-white mt-0.5">{pro.nextDueInvoice.projectName}</p>
                    <p className="text-xs text-white/70">Échéance le {fmtDate(pro.nextDueInvoice.dueAt)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-white font-extrabold"
                      style={{ fontFamily: 'var(--font-roboto-mono), monospace', fontSize: 20 }}
                    >
                      {fmtKpi(pro.nextDueInvoice.totalCents)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app/pro/${pro.businessId}/finances`}>Voir</Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <SectionHeader title="Studio — Pro" />
              <EmptyState
                title="Aucune activité pro pour le moment."
                action={
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/app/pro">Créer un espace pro <ChevronRight size={14} /></Link>
                  </Button>
                }
              />
            </div>
          )}

          {/* ── Dernières transactions perso ── */}
          {personal && personal.latestTransactions.length > 0 && (
            <div className="flex flex-col gap-3">
              <SectionHeader
                title="Dernières transactions perso"
                actions={
                  <Link href="/app/personal/transactions" className="text-xs font-semibold hover:underline" style={{ color: 'var(--shell-accent)' }}>
                    Tout voir →
                  </Link>
                }
              />

              {personal.latestTransactions.slice(0, 5).map((tx) => {
                const amt = BigInt(tx.amountCents);
                const isPositive = amt >= 0n;
                return (
                  <ListRow
                    key={tx.id}
                    left={tx.label || '—'}
                    sub={`${tx.accountName}${tx.categoryName ? ` · ${tx.categoryName}` : ''} · ${new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                    right={
                      <span
                        className="text-sm font-semibold"
                        style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                      >
                        {isPositive ? '+' : ''}{fmtKpi(tx.amountCents)}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}
