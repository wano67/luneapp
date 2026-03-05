'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import {
  FigmaKpiCard,
  FigmaTimeFilters,
  FigmaDonut,
  FigmaCashflowChart,
  FigmaSectionTitle,
  FigmaListRow,
  FigmaStatusPill,
  FigmaFooter,
  FIGMA,
  fmtKpi,
} from '../../figma-ui';

/* ═══ Types ═══ */

type Dashboard = {
  kpis?: {
    projectsActiveCount?: number;
    openTasksCount?: number;
    mtdIncomeCents?: string;
    mtdExpenseCents?: string;
  };
  treasury?: {
    balanceCents?: string;
  };
  billing?: {
    pendingCollectionCents?: string;
  };
  projectMetrics?: {
    avgProfitabilityPercent?: number;
  };
  clientsCount?: number;
  latestTasks?: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    projectName: string | null;
  }>;
  monthlySeries?: Array<{
    month: string;
    incomeCents: string | number;
    expenseCents: string | number;
  }>;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  projectName?: string | null;
};

type TasksResponse = { items?: TaskItem[] };

/* ═══ Page ═══ */

export default function BusinessDashboard() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState('12 mois');

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const [dashRes, tasksRes] = await Promise.all([
        fetchJson<Dashboard>(`/api/pro/businesses/${businessId}/dashboard`, {}, ctrl.signal),
        fetchJson<TasksResponse>(`/api/pro/businesses/${businessId}/tasks`, {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (dashRes.ok) setDash(dashRes.data ?? null);
      if (tasksRes.ok) setTasks(tasksRes.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  // Task counts for donut
  const todoCount = tasks.filter((t) => t.status === 'TODO').length;
  const inProgressCount = tasks.filter((t) => t.status === 'IN_PROGRESS').length;
  const doneCount = tasks.filter((t) => t.status === 'DONE').length;
  const totalTasks = todoCount + inProgressCount + doneCount;
  const todoPct = totalTasks > 0 ? Math.round((todoCount / totalTasks) * 100) : 0;

  const profitPct = dash?.projectMetrics?.avgProfitabilityPercent;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      {/* Time filters */}
      <FigmaTimeFilters active={timeFilter} onChange={setTimeFilter} />

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FigmaKpiCard
          label="Trésorerie"
          value={fmtKpi(dash?.treasury?.balanceCents)}
          loading={loading}
          delay={0}
        />
        <FigmaKpiCard
          label="En attente"
          value={fmtKpi(dash?.billing?.pendingCollectionCents)}
          loading={loading}
          delay={50}
        />
        <FigmaKpiCard
          label="Rentabilité"
          value={loading ? '—' : `${profitPct ?? 0}%`}
          delay={100}
        />
        <FigmaKpiCard
          label="Projets actifs"
          value={loading ? '—' : String(dash?.kpis?.projectsActiveCount ?? 0)}
          delay={150}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cashflow chart */}
        <div className="rounded-xl p-5 flex flex-col gap-3" style={{ background: FIGMA.rose }}>
          <div className="flex items-center justify-between">
            <span className="text-white font-semibold text-sm">Cash flow (12 mois)</span>
            <div className="flex items-center gap-4 text-xs text-white">
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 bg-white rounded" />
                Revenus
              </span>
              <span className="flex items-center gap-1">
                <div className="w-3 h-0.5 rounded" style={{ background: FIGMA.roseDark }} />
                Dépenses
              </span>
            </div>
          </div>
          <FigmaCashflowChart series={dash?.monthlySeries} />
        </div>

        {/* Tasks donut */}
        <div
          className="rounded-xl p-5 flex flex-col items-center justify-center gap-3"
          style={{ background: FIGMA.rose }}
        >
          <span className="text-white font-semibold text-sm self-start">Tâches par statut</span>
          {loading ? (
            <div className="w-[220px] h-[220px] rounded-full animate-skeleton-pulse" style={{ background: 'rgba(255,255,255,0.2)' }} />
          ) : (
            <FigmaDonut
              segments={[
                { label: 'À faire', value: todoCount, color: FIGMA.rosePink },
                { label: 'En cours', value: inProgressCount, color: FIGMA.roseDark },
                { label: 'Terminé', value: doneCount, color: 'white' },
              ]}
              centerValue={`${todoPct}%`}
              centerLabel="À faire"
            />
          )}
        </div>
      </div>

      {/* Latest tasks */}
      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Dernières tâches</FigmaSectionTitle>
        {(dash?.latestTasks ?? []).slice(0, 6).map((task) => (
          <FigmaListRow
            key={task.id}
            left={task.title}
            sub={task.projectName ?? undefined}
            right={
              <FigmaStatusPill
                status={
                  task.status === 'DONE'
                    ? 'success'
                    : task.status === 'IN_PROGRESS'
                    ? 'warning'
                    : 'neutral'
                }
                label={
                  task.status === 'DONE'
                    ? 'Terminé'
                    : task.status === 'IN_PROGRESS'
                    ? 'En cours'
                    : 'À faire'
                }
              />
            }
          />
        ))}
        {!loading && (!dash?.latestTasks || dash.latestTasks.length === 0) && (
          <p style={{ color: 'rgba(0,0,0,0.4)', fontSize: 14 }}>Aucune tâche</p>
        )}
      </div>

      <FigmaFooter />
    </div>
  );
}
