'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/layouts/PageContainer';
import { fmtKpi } from '@/lib/format';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { TASK_STATUS_LABELS } from '@/lib/taskStatusUi';

const TreasuryCashflowChart = dynamic(() => import('./charts/TreasuryCashflowChart'), { ssr: false });
const TasksDonut = dynamic(() => import('./charts/TasksDonut'), { ssr: false });

type DashboardPayload = {
  kpis?: {
    projectsActiveCount?: number;
    activeProjectsCount?: number;
    projectsCompletedCount?: number;
    openTasksCount?: number;
    mtdIncomeCents?: string;
    mtdExpenseCents?: string;
  };
  periodRevenueCents?: string;
  periodExpenseCents?: string;
  treasury?: {
    allTimeIncomeCents?: string;
    allTimeExpenseCents?: string;
    balanceCents?: string;
    openingBalanceCents?: string;
  };
  billing?: {
    totalInvoicedCents?: string;
    totalPaidCents?: string;
    pendingCollectionCents?: string;
    totalPlannedCents?: string;
  };
  projectMetrics?: {
    avgProfitabilityPercent?: number;
    avgDurationDays?: number;
    completedProjectsCount?: number;
  };
  monthFinance?: {
    income?: { amountCents?: string | number; amount?: number };
    expense?: { amountCents?: string | number; amount?: number };
  };
  latestTasks?: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    projectId: string | null;
    projectName: string | null;
  }>;
  nextActions?: {
    tasks?: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      projectId: string | null;
      projectName: string | null;
    }>;
    interactions?: Array<{
      id: string;
      type: string;
      nextActionDate: string | null;
      clientId: string | null;
      projectId: string | null;
    }>;
  };
  granularity?: 'daily' | 'weekly' | 'monthly';
  timeSeries?: Array<{ label: string; incomeCents: string | number; expenseCents: string | number }>;
  monthlySeries?: Array<{ month: string; incomeCents: string | number; expenseCents: string | number }>;
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  createdAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

function countByStatus(tasks: TaskItem[]) {
  const counts: Record<string, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const t of tasks) {
    const status = t.status ?? 'TODO';
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

/* ═══ Period pills ═══ */

const PERIODS = [
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
  { value: 365, label: '1 an' },
] as const;

function PeriodPills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
          style={
            value === p.value
              ? { background: 'var(--shell-accent-dark)', color: 'white' }
              : { background: 'var(--surface)', color: 'rgba(0,0,0,0.6)' }
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ═══ Dashboard ═══ */

export default function ProDashboard({ businessId }: { businessId: string }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, tasksRes] = await Promise.all([
          fetchJson<DashboardPayload>(`/api/pro/businesses/${businessId}/dashboard?days=${periodDays}`, { cache: 'no-store' }),
          fetchJson<{ items: TaskItem[] }>(`/api/pro/businesses/${businessId}/tasks`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (!dashRes.ok) throw new Error(dashRes.error || 'Dashboard indisponible');
        if (!tasksRes.ok) throw new Error(tasksRes.error || 'Taches indisponibles');

        setDashboard(dashRes.data ?? null);
        setTasks(tasksRes.data?.items ?? []);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, periodDays]);

  const filteredTasks = useMemo(() => {
    if (periodDays === 0) return tasks;
    const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    return tasks.filter((t) => {
      const d = t.createdAt ? new Date(t.createdAt) : null;
      return !d || d >= cutoff;
    });
  }, [tasks, periodDays]);
  const tasksByStatus = useMemo(() => countByStatus(filteredTasks), [filteredTasks]);
  const granularity = dashboard?.granularity ?? 'monthly';
  const timeSeries = dashboard?.timeSeries ?? dashboard?.monthlySeries ?? [];
  const avgProfitability = dashboard?.projectMetrics?.avgProfitabilityPercent ?? 0;

  return (
    <PageContainer className="gap-5">
      {/* Top row: Retour + Period pills */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/pro">
            <ChevronLeft size={16} />
            Retour
          </Link>
        </Button>
        <PeriodPills value={periodDays} onChange={setPeriodDays} />
      </div>

      {/* KPIs — 5 cards */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Trésorerie" value={fmtKpi(dashboard?.treasury?.balanceCents)} loading={loading} delay={0} />
        <KpiCard label="CA période" value={fmtKpi(dashboard?.periodRevenueCents)} loading={loading} delay={50} />
        <KpiCard label="Charges période" value={fmtKpi(dashboard?.periodExpenseCents)} loading={loading} delay={100} />
        <KpiCard label="En attente" value={fmtKpi(dashboard?.billing?.pendingCollectionCents)} loading={loading} delay={150} />
        <KpiCard label="Marge brute" value={`${avgProfitability}%`} loading={loading} delay={200} />
      </div>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement du dashboard\u2026</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <p className="text-xs text-[var(--text-secondary)]">Verifie la connexion ou reessaie.</p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          {/* Cashflow card — accent background */}
          <div
            className="flex flex-col gap-3 rounded-xl bg-[var(--shell-accent)] p-4 animate-fade-in-up"
            style={{ animationDelay: '200ms', animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Cash flow</span>
              <Button asChild variant="outline" size="sm" className="!bg-white !text-black !border-0">
                <Link href={`/app/pro/${businessId}/finances`}>
                  <span className="font-semibold text-[16px]" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                    Voir mes finances
                  </span>
                  <ChevronLeft size={14} className="rotate-180" />
                </Link>
              </Button>
            </div>
            <TreasuryCashflowChart
              series={timeSeries}
              granularity={granularity}
              openingBalanceCents={dashboard?.treasury?.openingBalanceCents}
              variant="accent"
            />
          </div>

          {/* Tasks donut — accent background */}
          <div
            className="flex flex-col gap-3 rounded-xl bg-[var(--shell-accent)] p-4 animate-fade-in-up"
            style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Taches</span>
              <Button asChild variant="outline" size="sm" className="!bg-white !text-black !border-0">
                <Link href={`/app/pro/${businessId}/tasks`}>
                  <span className="font-semibold text-[16px]" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                    Taches a faire
                  </span>
                  <ChevronLeft size={14} className="rotate-180" />
                </Link>
              </Button>
            </div>
            <TasksDonut
              data={[
                { name: TASK_STATUS_LABELS.TODO, value: tasksByStatus.TODO },
                { name: TASK_STATUS_LABELS.IN_PROGRESS, value: tasksByStatus.IN_PROGRESS },
                { name: TASK_STATUS_LABELS.DONE, value: tasksByStatus.DONE },
              ]}
              variant="accent"
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}
