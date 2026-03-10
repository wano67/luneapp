'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Banknote, Briefcase, ListChecks, BookUser, Receipt } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/layouts/PageContainer';
import { fmtKpi } from '@/lib/format';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

const TreasuryCashflowChart = dynamic(() => import('./charts/TreasuryCashflowChart'), { ssr: false });

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
  projects?: {
    activeCount?: number;
    totalCount?: number;
  };
  clientsCount?: number;
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
};

/* ═══ Business Score ═══ */

function computeBusinessScore(dashboard: DashboardPayload | null, tasksDone: number, tasksTotal: number) {
  if (!dashboard) return { score: 0, label: 'Chargement', color: 'var(--text-faint)' };

  // Tasks: 25 pts
  const taskScore = tasksTotal > 0 ? Math.min(25, Math.round((tasksDone / tasksTotal) * 25)) : 0;

  // Projects: 25 pts
  const activeProjects = dashboard.projects?.activeCount ?? dashboard.kpis?.projectsActiveCount ?? 0;
  const completedProjects = dashboard.projectMetrics?.completedProjectsCount ?? 0;
  const totalProjects = (dashboard.projects?.totalCount ?? 0);
  const completedRate = totalProjects > 0 ? completedProjects / totalProjects : 0;
  const projectScore = activeProjects > 0 ? Math.min(25, 15 + Math.round(completedRate * 10)) : 0;

  // Finances: 25 pts
  const balance = Number(dashboard.treasury?.balanceCents ?? 0);
  const margin = dashboard.projectMetrics?.avgProfitabilityPercent ?? 0;
  let financeScore = balance > 0 ? 20 : 10;
  if (margin > 20) financeScore = Math.min(25, financeScore + 5);

  // Billing: 25 pts
  const invoiced = Number(dashboard.billing?.totalInvoicedCents ?? 0);
  const paid = Number(dashboard.billing?.totalPaidCents ?? 0);
  const billingScore = invoiced > 0 ? Math.min(25, Math.round((paid / invoiced) * 25)) : 0;

  const score = taskScore + projectScore + financeScore + billingScore;

  if (score >= 91) return { score, label: 'Excellent', color: 'var(--success)' };
  if (score >= 71) return { score, label: 'Bon', color: 'var(--accent)' };
  if (score >= 41) return { score, label: 'En progression', color: 'var(--warning)' };
  return { score, label: 'A ameliorer', color: 'var(--danger)' };
}

/* ═══ Period pills ═══ */

const PERIODS = [
  { value: 0, label: 'Global' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 365, label: '1 an' },
] as const;

function PeriodPills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
          style={
            value === p.value
              ? { background: 'var(--shell-accent-dark)', color: 'white' }
              : { background: 'var(--surface-2)', color: 'var(--text-faint)' }
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ═══ Mini progress bar ═══ */

function MiniProgress({ value, color }: { value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)', width: 60 }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

/* ═══ Universe card ═══ */

function UniverseCard({
  icon,
  title,
  href,
  children,
  delay = 0,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <Link href={href} className="block animate-fade-in-up" style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}>
      <Card className="card-interactive p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-lg card-interactive__icon"
              style={{ width: 32, height: 32, background: 'var(--surface-2)', border: '1px solid var(--border)' }}
            >
              {icon}
            </div>
            <span className="text-sm font-semibold">{title}</span>
          </div>
          <ChevronRight size={16} className="text-[var(--text-faint)]" />
        </div>
        {children}
      </Card>
    </Link>
  );
}

/* ═══ Dashboard ═══ */

export default function ProDashboard({ businessId }: { businessId: string }) {
  const [periodDays, setPeriodDays] = useState(0);
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

  const tasksDone = useMemo(() => tasks.filter((t) => t.status === 'DONE').length, [tasks]);
  const tasksTotal = tasks.length;
  const taskCompletionPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const businessScore = useMemo(
    () => computeBusinessScore(dashboard, tasksDone, tasksTotal),
    [dashboard, tasksDone, tasksTotal],
  );

  const granularity = dashboard?.granularity ?? 'monthly';
  const timeSeries = dashboard?.timeSeries ?? dashboard?.monthlySeries ?? [];

  // Billing
  const pendingCents = dashboard?.billing?.pendingCollectionCents ?? '0';
  const invoicedCents = Number(dashboard?.billing?.totalInvoicedCents ?? 0);
  const paidCents = Number(dashboard?.billing?.totalPaidCents ?? 0);
  const collectionPct = invoicedCents > 0 ? Math.round((paidCents / invoicedCents) * 100) : 0;

  // Projects
  const activeProjects = dashboard?.projects?.activeCount ?? dashboard?.kpis?.projectsActiveCount ?? 0;
  const completedProjects = dashboard?.projectMetrics?.completedProjectsCount ?? 0;
  const avgMargin = dashboard?.projectMetrics?.avgProfitabilityPercent ?? 0;

  // CRM
  const clientsCount = dashboard?.clientsCount ?? 0;
  const upcomingInteractions = dashboard?.nextActions?.interactions?.length ?? 0;

  // Finance
  const mtdIncome = dashboard?.kpis?.mtdIncomeCents ?? '0';
  const mtdExpense = dashboard?.kpis?.mtdExpenseCents ?? '0';

  return (
    <PageContainer className="gap-5">
      {/* Top row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/app/pro">
            <ChevronLeft size={16} />
            Retour
          </Link>
        </Button>
        <PeriodPills value={periodDays} onChange={setPeriodDays} />
      </div>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-faint)]">Chargement du dashboard&hellip;</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <p className="text-xs text-[var(--text-faint)]">Verifie la connexion ou reessaie.</p>
        </Card>
      ) : (
        <>
          {/* ── Score Business ── */}
          <div
            className="rounded-xl p-5 animate-fade-in-up"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Score Business</p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: businessScore.color, color: 'white' }}
              >
                {businessScore.label}
              </span>
            </div>
            <div className="flex items-end gap-3">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ fontFamily: 'var(--font-barlow), sans-serif', color: businessScore.color }}
              >
                {businessScore.score}
              </span>
              <span className="text-sm text-[var(--text-faint)] mb-1">/ 100</span>
            </div>
            <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${businessScore.score}%`, background: businessScore.color }}
              />
            </div>
            <div className="mt-2 flex gap-4 text-[10px] text-[var(--text-faint)]">
              <span>Taches {taskCompletionPct}%</span>
              <span>Projets {activeProjects > 0 ? 'actifs' : '-'}</span>
              <span>Recouvrement {collectionPct}%</span>
            </div>
          </div>

          {/* ── Universe cards ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Finances */}
            <UniverseCard
              icon={<Banknote size={16} className="text-[var(--text-faint)]" />}
              title="Finances"
              href={`/app/pro/${businessId}/finances`}
              delay={50}
            >
              <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                {fmtKpi(dashboard?.treasury?.balanceCents)}
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-[var(--text-faint)]">
                <span>+{fmtKpi(mtdIncome)} ce mois</span>
                <span>-{fmtKpi(mtdExpense)}</span>
              </div>
            </UniverseCard>

            {/* Projets */}
            <UniverseCard
              icon={<Briefcase size={16} className="text-[var(--text-faint)]" />}
              title="Projets"
              href={`/app/pro/${businessId}/projects`}
              delay={100}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {activeProjects} actif{activeProjects > 1 ? 's' : ''}
                </span>
                <span className="text-xs text-[var(--text-faint)]">{completedProjects} termine{completedProjects > 1 ? 's' : ''}</span>
              </div>
              {avgMargin > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--text-faint)]">Marge {avgMargin}%</span>
                  <MiniProgress value={avgMargin} color={avgMargin >= 20 ? 'var(--success)' : 'var(--warning)'} />
                </div>
              )}
            </UniverseCard>

            {/* Taches */}
            <UniverseCard
              icon={<ListChecks size={16} className="text-[var(--text-faint)]" />}
              title="Taches"
              href={`/app/pro/${businessId}/tasks`}
              delay={150}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {tasksDone}/{tasksTotal}
                </span>
                <span className="text-xs text-[var(--text-faint)]">terminees</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <MiniProgress value={taskCompletionPct} color={taskCompletionPct >= 80 ? 'var(--success)' : 'var(--accent)'} />
                <span className="text-xs text-[var(--text-faint)]">{taskCompletionPct}%</span>
              </div>
            </UniverseCard>

            {/* CRM */}
            <UniverseCard
              icon={<BookUser size={16} className="text-[var(--text-faint)]" />}
              title="CRM"
              href={`/app/pro/${businessId}/agenda`}
              delay={200}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {clientsCount} client{clientsCount > 1 ? 's' : ''}
                </span>
              </div>
              {upcomingInteractions > 0 && (
                <p className="text-xs mt-1" style={{ color: 'var(--warning)' }}>
                  {upcomingInteractions} relance{upcomingInteractions > 1 ? 's' : ''} a faire
                </p>
              )}
            </UniverseCard>

            {/* Facturation */}
            <UniverseCard
              icon={<Receipt size={16} className="text-[var(--text-faint)]" />}
              title="Facturation"
              href={`/app/pro/${businessId}/finances`}
              delay={250}
            >
              <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                {fmtKpi(pendingCents)} en attente
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-[var(--text-faint)]">Recouvrement {collectionPct}%</span>
                <MiniProgress value={collectionPct} color={collectionPct >= 80 ? 'var(--success)' : 'var(--warning)'} />
              </div>
            </UniverseCard>
          </div>

          {/* ── Cashflow chart ── */}
          <div
            className="flex flex-col gap-3 rounded-xl bg-[var(--shell-accent)] p-4 animate-fade-in-up"
            style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}
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
        </>
      )}
    </PageContainer>
  );
}
