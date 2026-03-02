'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { FigmaKpiCard, FigmaSectionTitle, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi, fmtDate } from '../../figma-ui';

type Transaction = {
  id: string;
  type: string;
  date: string;
  amountCents: string;
  label: string;
  account?: { name?: string };
  category?: { name?: string } | null;
};

type Summary = {
  kpis?: {
    totalBalanceCents?: string;
    monthIncomeCents?: string;
    monthExpenseCents?: string;
    monthNetCents?: string;
  };
  latestTransactions?: Transaction[];
};

export default function TransactionsPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<Summary>('/api/personal/summary', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setSummary(res.data ?? null);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const kpis = summary?.kpis;
  const txs = summary?.latestTransactions ?? [];

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Transactions</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FigmaKpiCard label="Solde total" value={fmtKpi(kpis?.totalBalanceCents)} loading={loading} delay={0} />
        <FigmaKpiCard label="Revenus (mois)" value={fmtKpi(kpis?.monthIncomeCents)} loading={loading} delay={50} />
        <FigmaKpiCard label="Dépenses (mois)" value={fmtKpi(kpis?.monthExpenseCents)} loading={loading} delay={100} />
        <FigmaKpiCard label="Net (mois)" value={fmtKpi(kpis?.monthNetCents)} loading={loading} delay={150} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Dernières transactions ({txs.length})</FigmaSectionTitle>
        {txs.length === 0 && !loading && <FigmaEmpty message="Aucune transaction" />}
        {txs.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: FIGMA.gray }}
          >
            <div className="flex-1 min-w-0">
              <p style={{ color: FIGMA.dark, fontSize: 14, fontWeight: 500 }}>{tx.label}</p>
              <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                {fmtDate(tx.date)}
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

      <FigmaFooter />
    </div>
  );
}
