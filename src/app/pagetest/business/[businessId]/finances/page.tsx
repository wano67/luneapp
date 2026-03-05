'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroDisplay } from '@/lib/money';
import { FigmaKpiCard, FigmaSectionTitle, FigmaListRow, FigmaEmpty, FigmaFooter, FIGMA, fmtKpi, fmtDate } from '../../../figma-ui';

type Finance = {
  id: string;
  type: string;
  amountCents: string;
  category?: string | null;
  vendor?: string | null;
  date: string;
  label?: string | null;
  projectId?: string | null;
};

type Dashboard = {
  treasury?: { balanceCents?: string; allTimeIncomeCents?: string; allTimeExpenseCents?: string };
  billing?: { pendingCollectionCents?: string };
  monthFinance?: { income?: { amountCents?: string }; expense?: { amountCents?: string } };
};

export default function FinancesPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [finances, setFinances] = useState<Finance[]>([]);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const [fRes, dRes] = await Promise.all([
        fetchJson<{ items?: Finance[] }>(`/api/pro/businesses/${businessId}/finances`, {}, ctrl.signal),
        fetchJson<Dashboard>(`/api/pro/businesses/${businessId}/dashboard`, {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (fRes.ok) setFinances(fRes.data?.items ?? []);
      if (dRes.ok) setDash(dRes.data ?? null);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Finances</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FigmaKpiCard label="Trésorerie" value={fmtKpi(dash?.treasury?.balanceCents)} loading={loading} delay={0} />
        <FigmaKpiCard label="Revenus (mois)" value={fmtKpi(dash?.monthFinance?.income?.amountCents)} loading={loading} delay={50} />
        <FigmaKpiCard label="Dépenses (mois)" value={fmtKpi(dash?.monthFinance?.expense?.amountCents)} loading={loading} delay={100} />
        <FigmaKpiCard label="En attente" value={fmtKpi(dash?.billing?.pendingCollectionCents)} loading={loading} delay={150} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Écritures ({finances.length})</FigmaSectionTitle>
        {finances.length === 0 && !loading && <FigmaEmpty message="Aucune écriture financière" />}
        {finances.slice(0, 30).map((f) => (
          <FigmaListRow
            key={f.id}
            left={f.label || f.vendor || f.category || 'Écriture'}
            sub={[fmtDate(f.date), f.category].filter(Boolean).join(' · ')}
            right={
              <span
                style={{
                  color: f.type === 'INCOME' ? '#16a34a' : FIGMA.rose,
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: 'var(--font-roboto-mono), monospace',
                }}
              >
                {f.type === 'INCOME' ? '+' : '-'}
                {formatCentsToEuroDisplay(f.amountCents)}
              </span>
            }
          />
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
