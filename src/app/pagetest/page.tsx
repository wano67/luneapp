'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { FigmaKpiCard, FigmaSpaceCard, FigmaFooter, FigmaSectionTitle, FIGMA, fmtKpi } from './figma-ui';
import { IconPerso, IconEntreprise } from './pivot-icons';

/* ═══ Types ═══ */

type Summary = {
  kpis?: {
    totalBalanceCents?: string;
    monthNetCents?: string;
    monthIncomeCents?: string;
    monthExpenseCents?: string;
  };
  accounts?: Array<{ id?: string; name?: string; balanceCents?: string }>;
  latestTransactions?: Array<{
    id: string;
    type: string;
    date: string;
    amountCents: string;
    label: string;
    account?: { name?: string };
    category?: { name?: string } | null;
  }>;
};

type BizResponse = {
  items?: Array<{ business?: { id?: string; name?: string } }>;
};

/* ═══ Page ═══ */

export default function PagetestHome() {
  const [user, setUser] = useState<{ name?: string } | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [businesses, setBusinesses] = useState<BizResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [me, sum, biz] = await Promise.all([
        fetchJson<{ user?: { name?: string } }>('/api/auth/me', {}, ctrl.signal),
        fetchJson<Summary>('/api/personal/summary', {}, ctrl.signal),
        fetchJson<BizResponse>('/api/pro/businesses', {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (me.ok) setUser(me.data?.user ?? null);
      if (sum.ok) setSummary(sum.data ?? null);
      if (biz.ok) setBusinesses(biz.data ?? null);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const name = user?.name?.split(' ')[0] || '';
  const kpis = summary?.kpis;
  const accountCount = summary?.accounts?.length ?? 0;
  const bizItems = businesses?.items ?? [];
  const firstBizId = bizItems[0]?.business?.id;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      {/* Greeting */}
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>
        {loading ? 'Bonjour' : name ? `Bonjour ${name}` : 'Bonjour'}
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FigmaKpiCard label="Solde total" value={fmtKpi(kpis?.totalBalanceCents)} loading={loading} delay={0} />
        <FigmaKpiCard label="Net ce mois" value={fmtKpi(kpis?.monthNetCents)} loading={loading} delay={50} />
        <FigmaKpiCard label="Comptes" value={loading ? '—' : String(accountCount)} delay={100} />
        <FigmaKpiCard label="Entreprises" value={loading ? '—' : String(bizItems.length)} delay={150} />
      </div>

      {/* Space cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FigmaSpaceCard
          icon={<IconPerso size={18} color="white" />}
          title="Espace personnel"
          buttonLabel="Accéder"
          href="/pagetest/personal/transactions"
          amount={fmtKpi(kpis?.totalBalanceCents)}
          loading={loading}
          delay={200}
        />
        <FigmaSpaceCard
          icon={<IconEntreprise size={18} color="white" />}
          title="Espace entreprise"
          buttonLabel="Accéder"
          href={firstBizId ? `/pagetest/business/${firstBizId}` : '/pagetest/pro'}
          amount={
            bizItems.length > 0
              ? `${bizItems.length} entreprise${bizItems.length > 1 ? 's' : ''}`
              : 'Aucune'
          }
          loading={loading}
          delay={250}
        />
      </div>

      {/* Latest transactions */}
      {!loading && summary?.latestTransactions && summary.latestTransactions.length > 0 && (
        <div className="flex flex-col gap-3 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
          <FigmaSectionTitle>Dernières transactions</FigmaSectionTitle>
          <div className="flex flex-col">
            {summary.latestTransactions.slice(0, 8).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 border-b"
                style={{ borderColor: FIGMA.gray }}
              >
                <div className="flex-1 min-w-0">
                  <p style={{ color: FIGMA.dark, fontSize: 14, fontWeight: 500 }}>{tx.label}</p>
                  <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                    {new Date(tx.date).toLocaleDateString('fr-FR')}
                    {tx.account?.name ? ` · ${tx.account.name}` : ''}
                    {tx.category?.name ? ` · ${tx.category.name}` : ''}
                  </p>
                </div>
                <span
                  style={{
                    color: tx.type === 'INCOME' ? '#16a34a' : FIGMA.rose,
                    fontWeight: 700,
                    fontSize: 14,
                    fontFamily: 'var(--font-roboto-mono), monospace',
                  }}
                >
                  {tx.type === 'INCOME' ? '+' : ''}
                  {formatCentsToEuroDisplay(tx.amountCents)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <FigmaFooter />
    </div>
  );
}
