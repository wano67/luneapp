'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaProgressBar, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi, fmtDate } from '../../figma-ui';

type SavingsGoal = {
  id: string;
  name: string;
  targetCents: string;
  currentCents: string;
  deadline?: string | null;
  completedAt?: string | null;
};

export default function EpargnePage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const res = await fetchJson<{ items?: SavingsGoal[] }>('/api/personal/savings', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok) setGoals(res.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const totalTarget = goals.reduce((s, g) => s + Number(g.targetCents || 0), 0);
  const totalCurrent = goals.reduce((s, g) => s + Number(g.currentCents || 0), 0);
  const completedCount = goals.filter((g) => g.completedAt).length;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Épargne</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FigmaKpiCard label="Objectifs" value={loading ? '—' : String(goals.length)} delay={0} />
        <FigmaKpiCard label="Épargné" value={loading ? '—' : fmtKpi(String(totalCurrent))} delay={50} />
        <FigmaKpiCard label="Atteints" value={loading ? '—' : String(completedCount)} delay={100} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Objectifs d&apos;épargne</FigmaSectionTitle>
        {goals.length === 0 && !loading && <FigmaEmpty message="Aucun objectif d'épargne" />}
        {goals.map((g) => {
          const current = Number(g.currentCents || 0);
          const target = Number(g.targetCents || 0);
          const pct = target > 0 ? Math.round((current / target) * 100) : 0;
          const isComplete = !!g.completedAt;
          return (
            <div key={g.id} className="py-3 border-b" style={{ borderColor: FIGMA.gray }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p style={{ color: FIGMA.dark, fontSize: 14, fontWeight: 500 }}>
                    {g.name}
                    {isComplete && <span style={{ color: '#16a34a', marginLeft: 8 }}>Atteint</span>}
                  </p>
                  {g.deadline && (
                    <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 12 }}>
                      Échéance : {fmtDate(g.deadline)}
                    </p>
                  )}
                </div>
                <span style={{ color: FIGMA.dark, fontWeight: 700, fontSize: 14, fontFamily: 'var(--font-roboto-mono), monospace' }}>
                  {fmtKpi(String(current))} / {fmtKpi(String(target))}
                </span>
              </div>
              <FigmaProgressBar value={current} max={target} color={isComplete ? '#16a34a' : FIGMA.rose} />
              <p className="mt-1 text-right" style={{ fontSize: 12, color: 'rgba(0,0,0,0.4)' }}>
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
