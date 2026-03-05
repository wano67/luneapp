'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaProgressBar, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi } from '../../figma-ui';

type Budget = {
  id: string;
  name: string;
  limitCents: string;
  spentCents: string;
  period: string;
  category?: { name?: string } | null;
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<{ items?: Budget[] }>('/api/personal/budgets', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setBudgets(res.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const totalLimit = budgets.reduce((s, b) => s + Number(b.limitCents || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + Number(b.spentCents || 0), 0);

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Budgets</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FigmaKpiCard label="Budgets" value={loading ? '—' : String(budgets.length)} delay={0} />
        <FigmaKpiCard label="Total alloué" value={loading ? '—' : fmtKpi(String(totalLimit))} delay={50} />
        <FigmaKpiCard label="Total dépensé" value={loading ? '—' : fmtKpi(String(totalSpent))} delay={100} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Mes budgets</FigmaSectionTitle>
        {budgets.length === 0 && !loading && <FigmaEmpty message="Aucun budget configuré" />}
        {budgets.map((b) => {
          const spent = Number(b.spentCents || 0);
          const limit = Number(b.limitCents || 0);
          const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
          const overBudget = pct > 100;
          return (
            <div key={b.id} className="py-3 border-b" style={{ borderColor: FIGMA.gray }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p style={{ color: FIGMA.dark, fontSize: 14, fontWeight: 500 }}>{b.name}</p>
                  <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                    {b.category?.name ?? b.period}
                  </p>
                </div>
                <span style={{ color: overBudget ? '#dc2626' : FIGMA.dark, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-roboto-mono), monospace' }}>
                  {fmtKpi(String(spent))} / {fmtKpi(String(limit))}
                </span>
              </div>
              <FigmaProgressBar value={spent} max={limit} color={overBudget ? '#dc2626' : FIGMA.rose} />
              <p className="mt-1 text-right" style={{ fontSize: 12, color: overBudget ? '#dc2626' : 'rgba(0,0,0,0.4)' }}>
                {pct}%
              </p>
            </div>
          );
        })}
      </div>

      <FigmaFooter />
    </div>
  );
}
