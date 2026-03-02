'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { FigmaKpiCard, FigmaSectionTitle, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi, fmtDate } from '../figma-ui';

type LatestTx = {
  id: string;
  label: string;
  amountCents: string;
  date: string;
  categoryName?: string | null;
  accountName?: string;
};

type NextInvoice = {
  id: string;
  totalCents: string;
  dueAt: string;
  projectName: string;
};

type FocusSummary = {
  personal?: {
    totalBalanceCents?: string;
    monthNetCents?: string;
    monthIncomeCents?: string;
    monthExpenseCents?: string;
    latestTransactions?: LatestTx[];
  };
  pro?: {
    businessId?: string;
    businessName?: string;
    activeProjectsCount?: number;
    pendingInvoicesCount?: number;
    monthRevenueCents?: string;
    nextDueInvoice?: NextInvoice | null;
  } | null;
};

export default function FocusPage() {
  const [data, setData] = useState<FocusSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<FocusSummary>('/api/focus/summary', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setData(res.data ?? null);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const p = data?.personal;
  const pro = data?.pro;
  const txs = p?.latestTransactions ?? [];

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Focus</h1>

      {/* Personal KPIs */}
      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Wallet — Personnel</FigmaSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FigmaKpiCard label="Solde total" value={fmtKpi(p?.totalBalanceCents)} loading={loading} delay={0} />
          <FigmaKpiCard label="Revenus (mois)" value={fmtKpi(p?.monthIncomeCents)} loading={loading} delay={50} />
          <FigmaKpiCard label="Net (mois)" value={fmtKpi(p?.monthNetCents)} loading={loading} delay={100} />
        </div>
      </div>

      {/* Pro KPIs */}
      {pro && (
        <div className="flex flex-col gap-3">
          <FigmaSectionTitle>Studio — {pro.businessName ?? 'Pro'}</FigmaSectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FigmaKpiCard label="CA encaissé (mois)" value={fmtKpi(pro.monthRevenueCents)} loading={loading} delay={150} />
            <FigmaKpiCard label="Projets actifs" value={loading ? '—' : String(pro.activeProjectsCount ?? 0)} delay={200} />
            <FigmaKpiCard label="Factures en attente" value={loading ? '—' : String(pro.pendingInvoicesCount ?? 0)} delay={250} />
          </div>
        </div>
      )}

      {/* Next invoice */}
      {pro?.nextDueInvoice && (
        <div
          className="rounded-xl p-5 animate-fade-in-up"
          style={{ background: FIGMA.rose, animationDelay: '300ms', animationFillMode: 'backwards' }}
        >
          <p className="text-white text-sm font-medium mb-2">Prochaine facture à encaisser</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-bold text-lg">{pro.nextDueInvoice.projectName}</p>
              <p className="text-white/70 text-sm">Échéance : {fmtDate(pro.nextDueInvoice.dueAt)}</p>
            </div>
            <span className="text-white font-extrabold text-2xl" style={{ fontFamily: 'var(--font-roboto-mono), monospace' }}>
              {fmtKpi(pro.nextDueInvoice.totalCents)}
            </span>
          </div>
        </div>
      )}

      {/* Latest transactions */}
      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Dernières transactions perso</FigmaSectionTitle>
        {txs.length === 0 && !loading && <FigmaEmpty message="Aucune transaction" />}
        {txs.slice(0, 5).map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: FIGMA.gray }}
          >
            <div className="flex-1 min-w-0">
              <p style={{ color: FIGMA.dark, fontSize: 14, fontWeight: 500 }}>{tx.label}</p>
              <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                {fmtDate(tx.date)}
                {tx.accountName ? ` · ${tx.accountName}` : ''}
                {tx.categoryName ? ` · ${tx.categoryName}` : ''}
              </p>
            </div>
            <span
              style={{
                color: Number(tx.amountCents) >= 0 ? '#16a34a' : FIGMA.rose,
                fontWeight: 700,
                fontSize: 14,
                fontFamily: 'var(--font-roboto-mono), monospace',
              }}
            >
              {Number(tx.amountCents) >= 0 ? '+' : ''}
              {formatCentsToEuroDisplay(tx.amountCents)}
            </span>
          </div>
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
