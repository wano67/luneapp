'use client';

import { useEffect, useState } from 'react';
import { fetchJson } from '@/lib/apiClient';
import {
  FigmaKpiCard,
  FigmaBusinessCard,
  FigmaButton,
  FigmaFooter,
  FigmaSectionTitle,
  FigmaEmpty,
  FIGMA,
  fmtKpi,
} from '../figma-ui';
import { Plus, UserPlus } from 'lucide-react';

/* ═══ Types ═══ */

type Business = { id: string; name: string };
type BizItem = { business?: Business; role?: string };
type BizResponse = { items?: BizItem[] };

type FocusSummary = {
  pro?: {
    activeProjectsCount?: number;
    pendingInvoicesCount?: number;
    monthRevenueCents?: string;
  } | null;
};

type DashboardData = {
  clientsCount?: number;
  treasury?: { balanceCents?: string };
};

type BizStats = { ca: string; salaries: number; clients: number };

/* ═══ Page ═══ */

export default function PagetestPro() {
  const [bizItems, setBizItems] = useState<BizItem[]>([]);
  const [focus, setFocus] = useState<FocusSummary | null>(null);
  const [bizStats, setBizStats] = useState<Record<string, BizStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      const [bizRes, focusRes] = await Promise.all([
        fetchJson<BizResponse>('/api/pro/businesses', {}, ctrl.signal),
        fetchJson<FocusSummary>('/api/focus/summary', {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;

      const items = bizRes.ok ? (bizRes.data?.items ?? []) : [];
      setBizItems(items);
      if (focusRes.ok) setFocus(focusRes.data ?? null);

      // Fetch dashboard per business for stats
      const statsMap: Record<string, BizStats> = {};
      await Promise.all(
        items.map(async (item) => {
          const id = item.business?.id;
          if (!id) return;
          const dashRes = await fetchJson<DashboardData>(
            `/api/pro/businesses/${id}/dashboard`,
            {},
            ctrl.signal
          );
          if (dashRes.ok && dashRes.data) {
            statsMap[id] = {
              ca: fmtKpi(dashRes.data.treasury?.balanceCents),
              salaries: 0,
              clients: dashRes.data.clientsCount ?? 0,
            };
          }
        })
      );
      if (ctrl.signal.aborted) return;
      setBizStats(statsMap);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  const activeProjects = focus?.pro?.activeProjectsCount ?? 0;
  const pendingInvoices = focus?.pro?.pendingInvoicesCount ?? 0;
  const monthRevenue = focus?.pro?.monthRevenueCents;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Entreprises</h1>
        <div className="flex items-center gap-3">
          <FigmaButton variant="cream">
            <UserPlus size={16} />
            Rejoindre
          </FigmaButton>
          <FigmaButton>
            <Plus size={16} />
            Créer
          </FigmaButton>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FigmaKpiCard label="Projets actifs" value={loading ? '—' : String(activeProjects)} delay={0} />
        <FigmaKpiCard label="CA encaissé (mois)" value={loading ? '—' : fmtKpi(monthRevenue)} delay={50} />
        <FigmaKpiCard label="Factures en attente" value={loading ? '—' : String(pendingInvoices)} delay={100} />
      </div>

      {/* Business cards */}
      <div className="flex flex-col gap-4">
        <FigmaSectionTitle>Mes entreprises ({bizItems.length})</FigmaSectionTitle>

        {loading ? (
          <div className="flex gap-4 flex-wrap">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex-1 min-w-[240px] max-w-[300px] h-[200px] rounded-xl animate-skeleton-pulse"
                style={{ background: FIGMA.cream }}
              />
            ))}
          </div>
        ) : bizItems.length === 0 ? (
          <FigmaEmpty message="Aucune entreprise. Créez ou rejoignez-en une." />
        ) : (
          <div className="flex gap-4 flex-wrap">
            {bizItems.map((item, i) => {
              const biz = item.business;
              if (!biz) return null;
              const stats = bizStats[biz.id] ?? { ca: '0 €', salaries: 0, clients: 0 };
              return (
                <FigmaBusinessCard
                  key={biz.id}
                  name={biz.name}
                  stats={stats}
                  href={`/pagetest/business/${biz.id}`}
                  delay={150 + i * 50}
                />
              );
            })}
          </div>
        )}
      </div>

      <FigmaFooter />
    </div>
  );
}
