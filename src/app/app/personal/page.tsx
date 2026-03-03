'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchJson } from '@/lib/apiClient';
import { onWalletRefresh } from '@/lib/personalEvents';
import { fmtKpi } from '@/lib/format';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

type SummaryResponse = {
  kpis: {
    totalBalanceCents: string;
    monthIncomeCents: string;
    monthExpenseCents: string;
    monthNetCents: string;
  };
  accounts: Array<{
    id: string;
    name: string;
    type: string;
    currency: string;
    balanceCents: string;
  }>;
  latestTransactions: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    currency: string;
    label: string;
    note?: string | null;
    account: { id: string; name: string };
    category: { id: string; name: string } | null;
  }>;
};

export default function WalletHomePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchJson<SummaryResponse>('/api/personal/summary');
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok || !res.data) {
      setError(res.error ?? 'Impossible de charger le Wallet.');
    } else {
      setData(res.data);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return onWalletRefresh(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void load();
    };
    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [load]);

  const kpi = useMemo(() => {
    if (!data?.kpis) return null;
    const net = BigInt(data.kpis.monthNetCents ?? '0');
    return {
      total: fmtKpi(data.kpis.totalBalanceCents),
      income: fmtKpi(data.kpis.monthIncomeCents),
      expense: fmtKpi(data.kpis.monthExpenseCents),
      net: fmtKpi(data.kpis.monthNetCents),
      netPositive: net >= 0n,
    };
  }, [data]);

  return (
    <PageContainer className="gap-7">
      <PageHeader
        title="Wallet"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/personal/comptes">Comptes</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/app/personal/transactions">Transactions</Link>
            </Button>
          </>
        }
      />

      {error ? <Alert variant="danger" title={error} /> : null}

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Solde total" value={kpi?.total ?? '—'} loading={loading} delay={0} />
        <KpiCard label="Revenus (mois)" value={kpi?.income ?? '—'} loading={loading} delay={50} />
        <KpiCard label="Dépenses (mois)" value={kpi?.expense ?? '—'} loading={loading} delay={100} />
        <KpiCard
          label="Net (mois)"
          value={kpi?.net ?? '—'}
          loading={loading}
          delay={150}
          delta={kpi ? (kpi.netPositive ? '+' : '') + kpi.net : undefined}
          trend={kpi?.netPositive ? 'up' : 'down'}
        />
      </div>

      {/* Accounts */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          title={`Comptes (${data?.accounts?.length ?? 0})`}
          actions={
            <Link href="/app/personal/comptes" className="text-xs font-semibold hover:underline" style={{ color: 'var(--shell-accent)' }}>
              Gérer →
            </Link>
          }
        />

        {loading ? (
          <EmptyState title="Chargement…" />
        ) : !data?.accounts?.length ? (
          <EmptyState title="Aucun compte. Créez-en un dans Comptes." />
        ) : (
          data.accounts.map((a) => (
            <ListRow
              key={a.id}
              href={`/app/personal/comptes/${a.id}`}
              left={a.name}
              sub={`${a.type} · ${a.currency}`}
              right={
                <span className="text-sm font-semibold" style={{ color: 'var(--shell-accent)' }}>
                  {fmtKpi(a.balanceCents)}
                </span>
              }
            />
          ))
        )}
      </div>

      {/* Latest transactions */}
      <div className="flex flex-col gap-3">
        <SectionHeader
          title="Dernières transactions"
          actions={
            <Link href="/app/personal/transactions" className="text-xs font-semibold hover:underline" style={{ color: 'var(--shell-accent)' }}>
              Tout voir →
            </Link>
          }
        />

        {loading ? (
          <EmptyState title="Chargement…" />
        ) : !data?.latestTransactions?.length ? (
          <EmptyState title="Aucune transaction." />
        ) : (
          data.latestTransactions.map((t) => {
            const amt = BigInt(t.amountCents);
            const isPositive = amt >= 0n;
            return (
              <ListRow
                key={t.id}
                left={t.label || '—'}
                sub={`${t.account.name}${t.category ? ` · ${t.category.name}` : ''} · ${new Date(t.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
                right={
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isPositive ? 'var(--success)' : 'var(--danger)' }}
                  >
                    {isPositive ? '+' : ''}{fmtKpi(t.amountCents)}
                  </span>
                }
              />
            );
          })
        )}
      </div>
    </PageContainer>
  );
}
