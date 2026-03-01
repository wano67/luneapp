'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { onWalletRefresh } from '@/lib/personalEvents';

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
    const s = data?.kpis;
    if (!s) return null;
    const net = BigInt(s.monthNetCents ?? '0');
    return {
      total: formatCentsToEuroDisplay(s.totalBalanceCents),
      income: formatCentsToEuroDisplay(s.monthIncomeCents),
      expense: formatCentsToEuroDisplay(s.monthExpenseCents),
      net: formatCentsToEuroDisplay(s.monthNetCents),
      netTrend: net > 0n ? ('up' as const) : net < 0n ? ('down' as const) : ('neutral' as const),
      accountsCount: data?.accounts?.length ?? 0,
    };
  }, [data]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Wallet"
        subtitle="Vue rapide : solde, cashflow du mois, comptes."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/app/personal/comptes">Comptes</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/personal/transactions">Transactions</Link>
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="p-4 text-sm text-[var(--danger)]">{error}</Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Solde total"
          value={loading ? '—' : (kpi?.total ?? '—')}
        />
        <KpiCard
          label="Revenus (mois)"
          value={loading ? '—' : (kpi?.income ?? '—')}
          trend="up"
        />
        <KpiCard
          label="Dépenses (mois)"
          value={loading ? '—' : (kpi?.expense ?? '—')}
          trend="down"
        />
        <KpiCard
          label="Net (mois)"
          value={loading ? '—' : (kpi?.net ?? '—')}
          trend={kpi?.netTrend ?? 'neutral'}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Comptes</p>
            <p className="text-xs text-[var(--text-faint)]">
              {loading ? '…' : `${kpi?.accountsCount ?? 0} compte(s)`}
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-sm text-[var(--text-faint)]">Chargement…</p>
          ) : (data?.accounts?.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-[var(--text-faint)]">
              Aucun compte. Commence par créer un compte dans "Comptes".
            </p>
          ) : (
            data!.accounts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.name}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {a.type} · {a.currency}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCentsToEuroDisplay(a.balanceCents)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Dernières transactions</p>
            <p className="text-xs text-[var(--text-faint)]">12 dernières</p>
          </div>
          <Link
            href="/app/personal/transactions"
            className="text-xs font-semibold text-[var(--accent)] hover:underline"
          >
            Tout voir →
          </Link>
        </div>

        <div className="mt-4 divide-y divide-[var(--border)]">
          {loading ? (
            <p className="py-3 text-sm text-[var(--text-faint)]">Chargement…</p>
          ) : (data?.latestTransactions?.length ?? 0) === 0 ? (
            <p className="py-3 text-sm text-[var(--text-faint)]">Aucune transaction.</p>
          ) : (
            data!.latestTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{t.label}</p>
                  <p className="text-xs text-[var(--text-faint)]">
                    {new Date(t.date).toLocaleDateString('fr-FR')} · {t.account.name}
                    {t.category ? ` · ${t.category.name}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold">{formatCentsToEuroDisplay(t.amountCents)}</p>
                  <p className="text-[11px] text-[var(--text-faint)]">{t.type}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </PageContainer>
  );
}
