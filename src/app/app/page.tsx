'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { fetchJson } from '@/lib/apiClient';
import { IconPerso, IconEntreprise } from '@/components/pivot-icons';
import { fmtKpi } from '@/lib/format';
import { PageContainer } from '@/components/layouts/PageContainer';
import { PageHeader } from '@/components/layouts/PageHeader';
import { KpiCard } from '@/components/ui/kpi-card';
import { SectionHeader } from '@/components/ui/section-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListRow } from '@/components/ui/list-row';
import { Button } from '@/components/ui/button';

type AccountMini = { id: string; name: string; balanceCents: string; currency: string };

type SummaryResponse = {
  kpis?: { totalBalanceCents?: string; monthNetCents?: string };
  accounts?: Array<{ id?: string; name?: string; balanceCents?: string; currency?: string }>;
  latestTransactions?: Array<{
    id: string;
    type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
    date: string;
    amountCents: string;
    label: string;
    account: { id: string; name: string };
  }>;
};
type BusinessResponse = {
  items?: Array<{ business?: { id?: string; name?: string } }>;
};
type BusinessItem = { id: string; name: string };

export default function AppHomePage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    totalBalanceCents: string;
    monthNetCents: string;
    accountsCount: number;
    accounts: AccountMini[];
    transactions: SummaryResponse['latestTransactions'];
  } | null>(null);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [meRes, sumRes, bizRes] = await Promise.all([
        fetchJson<{ user?: { name?: string } }>('/api/auth/me', {}, ctrl.signal),
        fetchJson<SummaryResponse>('/api/personal/summary', {}, ctrl.signal),
        fetchJson<BusinessResponse>('/api/pro/businesses', {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;

      if (meRes.ok && meRes.data?.user?.name) {
        const parts = meRes.data.user.name.trim().split(/\s+/);
        setUserName(parts[0] || null);
      }

      if (sumRes.ok && sumRes.data?.kpis) {
        const d = sumRes.data;
        const kpis = d.kpis!;
        const accounts = (d.accounts ?? []).filter(
          (a): a is AccountMini =>
            typeof a?.id === 'string' && typeof a?.name === 'string' &&
            typeof a?.balanceCents === 'string' && typeof a?.currency === 'string'
        );
        setSummary({
          totalBalanceCents: kpis.totalBalanceCents ?? '0',
          monthNetCents: kpis.monthNetCents ?? '0',
          accountsCount: accounts.length,
          accounts,
          transactions: d.latestTransactions ?? [],
        });
      }

      if (bizRes.ok) {
        setBusinesses(
          (bizRes.data?.items ?? [])
            .filter((it): it is { business: { id: string; name: string } } =>
              typeof it?.business?.id === 'string' && typeof it?.business?.name === 'string'
            )
            .map((it) => ({ id: it.business.id, name: it.business.name }))
        );
      }

      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const lastBusiness = useMemo(() => {
    if (!businesses.length) return null;
    try {
      const stored = localStorage.getItem('lastProBusinessId');
      if (stored) {
        const found = businesses.find((b) => b.id === stored);
        if (found) return found;
      }
    } catch { /* ignore */ }
    return businesses[0];
  }, [businesses]);

  const greeting = loading ? 'Chargement…' : userName ? `Bonjour ${userName}` : 'Bonjour';
  const netCents = summary ? BigInt(summary.monthNetCents) : 0n;

  return (
    <PageContainer className="gap-7">
      <PageHeader title={greeting} />

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Solde total" value={fmtKpi(summary?.totalBalanceCents)} loading={loading} delay={0} />
        <KpiCard
          label="Net ce mois"
          value={fmtKpi(summary?.monthNetCents)}
          loading={loading}
          delay={50}
          delta={summary ? (netCents >= 0n ? '+' : '') + fmtKpi(summary.monthNetCents) : undefined}
          trend={netCents >= 0n ? 'up' : 'down'}
        />
        <KpiCard label="Comptes" value={String(summary?.accountsCount ?? 0)} loading={loading} delay={100} />
        <KpiCard label="Entreprises" value={String(businesses.length)} loading={loading} delay={150} />
      </div>

      {/* Space cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        <SpaceCard
          icon={<IconPerso size={20} color="white" />}
          title="Finances personnelles"
          buttonLabel="Wallet"
          href="/app/personal"
          amount={fmtKpi(summary?.totalBalanceCents)}
          loading={loading}
          delay={200}
        />
        <SpaceCard
          icon={<IconEntreprise size={20} color="white" />}
          title="Pilotage entreprise"
          buttonLabel={lastBusiness ? 'Studio' : 'Créer'}
          href={lastBusiness ? `/app/pro/${lastBusiness.id}` : '/app/pro'}
          amount={`${businesses.length} entreprise${businesses.length !== 1 ? 's' : ''}`}
          loading={loading}
          delay={250}
        />
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
        ) : !summary?.transactions?.length ? (
          <EmptyState title="Aucune transaction" />
        ) : (
          summary.transactions.slice(0, 8).map((tx) => {
            const amt = BigInt(tx.amountCents);
            const isPositive = amt >= 0n;
            return (
              <ListRow
                key={tx.id}
                left={tx.label || '—'}
                sub={`${tx.account.name} · ${new Date(tx.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`}
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
          })
        )}
      </div>
    </PageContainer>
  );
}

/* ═══ SpaceCard (local — accent-colored entry point card) ═══ */

function SpaceCard({
  icon,
  title,
  buttonLabel,
  href,
  amount,
  loading,
  delay = 0,
}: {
  icon: ReactNode;
  title: string;
  buttonLabel: string;
  href: string;
  amount: string;
  loading?: boolean;
  delay?: number;
}) {
  return (
    <div
      className="flex flex-col justify-between p-3 rounded-xl animate-fade-in-up"
      style={{
        height: 200,
        background: 'var(--shell-accent)',
        animationDelay: `${delay}ms`,
        animationFillMode: 'backwards',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-black/30">
          {icon}
        </div>
        <span className="text-white text-sm font-medium">{title}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <Button variant="outline" size="sm" asChild>
          <Link href={href}>{buttonLabel} <ChevronRight size={14} /></Link>
        </Button>
        {loading ? (
          <div className="h-6 w-20 rounded-lg animate-skeleton-pulse" style={{ background: 'rgba(255,255,255,0.3)' }} />
        ) : (
          <span className="text-white text-xl font-extrabold shrink-0">{amount}</span>
        )}
      </div>
    </div>
  );
}
