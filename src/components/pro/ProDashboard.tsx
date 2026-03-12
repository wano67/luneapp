'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Briefcase,
  Users,
  FileText,
  FolderKanban,
  ChevronRight,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fmtKpi, fmtDate } from '@/lib/format';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useRevalidationKey } from '@/lib/revalidate';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import { OnboardingModal } from '@/components/ui/OnboardingModal';

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
    plannedCount?: number;
    totalCount?: number;
  };
  clientsCount?: number;
  prospectsActiveCount?: number;
  prospectsWonCount?: number;
  teamCount?: number;
  totalTasksCount?: number;
  doneTasksCount?: number;
  overdueTasksCount?: number;
  overdueInvoicesCount?: number;
  latestInvoices?: Array<{
    id: string;
    number: string | null;
    status: string;
    totalCents: string;
    dueDate: string | null;
    clientName: string | null;
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
  monthlySeries?: Array<{ label: string; incomeCents: string | number; expenseCents: string | number }>;
};

/* ═══ Period pills ═══ */

const PERIODS = [
  { value: 0, label: 'Global' },
  { value: 30, label: '30j' },
  { value: 90, label: '90j' },
  { value: 365, label: '1 an' },
] as const;

function PeriodPills({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
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

/* ═══ Dashboard ═══ */

export default function ProDashboard({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const businessName = activeCtx?.activeBusiness?.name ?? '';
  const role = activeCtx?.activeBusiness?.role;
  const isAdminOrOwner = role === 'OWNER' || role === 'ADMIN';
  const isMemberOrAbove = isAdminOrOwner || role === 'MEMBER';
  const [periodDays, setPeriodDays] = useState(0);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const rv = useRevalidationKey(['pro:tasks', 'pro:projects', 'pro:billing', 'pro:finances', 'pro:clients', 'pro:stock', 'pro:team']);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, bizRes] = await Promise.all([
          fetchJson<DashboardPayload>(`/api/pro/businesses/${businessId}/dashboard?days=${periodDays}`, { cache: 'no-store' }),
          fetchJson<{ profileComplete?: boolean }>(`/api/pro/businesses/${businessId}`, { cache: 'no-store' }),
        ]);
        if (cancelled) return;
        if (!dashRes.ok) throw new Error(dashRes.error || 'Dashboard indisponible');
        setDashboard(dashRes.data ?? null);
        if (bizRes.ok && bizRes.data) {
          setProfileComplete(bizRes.data.profileComplete !== false);
        }
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [businessId, periodDays, rv]);

  const tasksDone = dashboard?.doneTasksCount ?? 0;
  const tasksTotal = dashboard?.totalTasksCount ?? 0;
  const taskCompletionPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  const granularity = dashboard?.granularity ?? 'monthly';
  const timeSeries = useMemo(() => dashboard?.timeSeries ?? dashboard?.monthlySeries ?? [], [dashboard]);

  // Finance
  const balanceCents = dashboard?.treasury?.balanceCents ?? '0';
  const balancePositive = Number(balanceCents) >= 0;
  const pendingCents = dashboard?.billing?.pendingCollectionCents ?? '0';
  const periodRevenue = dashboard?.periodRevenueCents ?? '0';

  // Projects
  const activeProjects = dashboard?.projects?.activeCount ?? dashboard?.kpis?.projectsActiveCount ?? 0;
  const plannedProjects = dashboard?.projects?.plannedCount ?? 0;

  // Alerts
  const overdueTasks = dashboard?.overdueTasksCount ?? 0;
  const overdueInvoices = dashboard?.overdueInvoicesCount ?? 0;
  const hasAlerts = overdueTasks > 0 || overdueInvoices > 0;

  // Next tasks
  const nextTasks = dashboard?.nextActions?.tasks ?? [];

  return (
    <ProPageShell
      backHref="/app/pro"
      backLabel="Entreprises"
      title="Dashboard"
      subtitle={businessName || undefined}
      actions={<PeriodPills value={periodDays} onChange={setPeriodDays} />}
    >
      {showOnboarding && (
        <OnboardingModal
          storageKey="lune:onboarding:pro"
          apiField="onboardingProDone"
          onComplete={() => setShowOnboarding(false)}
          steps={[
            {
              icon: <Briefcase size={28} style={{ color: 'white' }} />,
              title: 'Votre espace professionnel',
              description: 'Gérez vos projets, clients et facturation depuis un seul tableau de bord.',
            },
            {
              icon: <Users size={28} style={{ color: 'white' }} />,
              title: 'Clients & Prospects',
              description: 'Suivez votre pipeline commercial et convertissez vos prospects.',
            },
            {
              icon: <FolderKanban size={28} style={{ color: 'white' }} />,
              title: 'Projets & Tâches',
              description: 'Planifiez vos projets et suivez l\'avancement en temps réel.',
            },
            {
              icon: <FileText size={28} style={{ color: 'white' }} />,
              title: 'Devis & Factures',
              description: 'Générez des documents conformes et suivez les paiements.',
            },
          ]}
        />
      )}

      {/* Profile banner */}
      {!profileComplete && !bannerDismissed && isAdminOrOwner && (
        <Card className="flex items-center gap-3 p-4 border-amber-500/30 bg-amber-500/5 animate-fade-in-up">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Profil entreprise incomplet</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Completez vos informations pour generer des documents conformes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm">
              <Link href={`/app/pro/${businessId}/settings?section=identite`}>Completer</Link>
            </Button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-xs hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-faint)' }}
            >
              Plus tard
            </button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl animate-skeleton-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 110 }} />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl animate-skeleton-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 90 }} />
            ))}
          </div>
        </div>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{error}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Verifiez la connexion ou reessayez.</p>
        </Card>
      ) : (
        <>
          {/* ── Alerts ── */}
          {hasAlerts && (
            <div
              className="flex flex-wrap items-center gap-4 rounded-xl px-4 py-3 animate-fade-in-up"
              style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}
            >
              <AlertTriangle size={18} style={{ color: 'var(--danger)' }} className="shrink-0" />
              {overdueTasks > 0 && (
                <Link
                  href={`/app/pro/${businessId}/tasks`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--danger)' }}
                >
                  {overdueTasks} tâche{overdueTasks > 1 ? 's' : ''} en retard
                </Link>
              )}
              {overdueTasks > 0 && overdueInvoices > 0 && (
                <span className="text-sm" style={{ color: 'var(--danger)' }}>·</span>
              )}
              {overdueInvoices > 0 && (
                <Link
                  href={`/app/pro/${businessId}/finances`}
                  className="text-sm font-medium hover:underline"
                  style={{ color: 'var(--danger)' }}
                >
                  {overdueInvoices} facture{overdueInvoices > 1 ? 's' : ''} impayée{overdueInvoices > 1 ? 's' : ''}
                </Link>
              )}
            </div>
          )}

          {/* ── Hero KPIs: CA · En attente · Trésorerie ── */}
          {isMemberOrAbove && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 animate-fade-in-up">
              <HeroKpi
                label="Chiffre d'affaires"
                value={fmtKpi(periodRevenue)}
                icon={<TrendingUp size={18} />}
                href={`/app/pro/${businessId}/finances`}
              />
              <HeroKpi
                label="En attente"
                value={fmtKpi(pendingCents)}
                sub={overdueInvoices > 0 ? `${overdueInvoices} en retard` : undefined}
                icon={<FileText size={18} />}
                alert={overdueInvoices > 0}
                href={`/app/pro/${businessId}/finances`}
              />
              <HeroKpi
                label="Trésorerie"
                value={fmtKpi(balanceCents)}
                icon={balancePositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                accent={balancePositive}
                alert={!balancePositive}
                href={`/app/pro/${businessId}/finances`}
              />
            </div>
          )}

          {/* ── Activity row: Projets · Avancement · Clients ── */}
          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 animate-fade-in-up"
            style={{ animationDelay: '80ms', animationFillMode: 'backwards' }}
          >
            <Link
              href={`/app/pro/${businessId}/projects`}
              className="block rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <FolderKanban size={15} style={{ color: 'var(--shell-accent)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  Projets
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                {activeProjects}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                actif{activeProjects > 1 ? 's' : ''}
                {plannedProjects > 0 ? ` · ${plannedProjects} planifié${plannedProjects > 1 ? 's' : ''}` : ''}
              </p>
            </Link>

            <Link
              href={`/app/pro/${businessId}/tasks`}
              className="block rounded-xl p-4 transition-colors hover:border-[var(--border-strong)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  Avancement
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                {taskCompletionPct}%
              </p>
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${taskCompletionPct}%`,
                    background: taskCompletionPct >= 80 ? 'var(--success)' : taskCompletionPct >= 40 ? 'var(--shell-accent)' : 'var(--warning)',
                  }}
                />
              </div>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-faint)' }}>
                {tasksDone}/{tasksTotal} tâches
                {overdueTasks > 0 ? (
                  <span style={{ color: 'var(--danger)' }}> · {overdueTasks} en retard</span>
                ) : null}
              </p>
            </Link>

            <Link
              href={`/app/pro/${businessId}/agenda`}
              className="block rounded-xl p-4 col-span-2 sm:col-span-1 transition-colors hover:border-[var(--border-strong)]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users size={15} style={{ color: 'var(--shell-accent)' }} />
                <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
                  Clients
                </span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                {dashboard?.clientsCount ?? 0}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                {(dashboard?.prospectsActiveCount ?? 0) > 0
                  ? `${dashboard?.prospectsActiveCount} prospect${(dashboard?.prospectsActiveCount ?? 0) > 1 ? 's' : ''}`
                  : 'Aucun prospect'}
              </p>
            </Link>
          </div>

          {/* ── Cash flow + Prochaines actions ── */}
          <div
            className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px] animate-fade-in-up"
            style={{ animationDelay: '160ms', animationFillMode: 'backwards' }}
          >
            {/* Cash flow chart */}
            {isMemberOrAbove && (
              <div
                className="flex flex-col gap-3 rounded-xl p-4"
                style={{ background: 'var(--shell-accent)' }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Cash flow</span>
                  <Button asChild variant="outline" size="sm" className="!bg-white !text-black !border-0">
                    <Link href={`/app/pro/${businessId}/finances`}>
                      <span className="text-xs font-semibold" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                        Finances
                      </span>
                      <ChevronRight size={13} />
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
            )}

            {/* Next actions */}
            {nextTasks.length > 0 && (
              <Card className="p-4 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Prochaines tâches</span>
                  <Link
                    href={`/app/pro/${businessId}/tasks`}
                    className="text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--shell-accent)' }}
                  >
                    Voir tout
                  </Link>
                </div>
                <div className="flex-1 space-y-1">
                  {nextTasks.slice(0, 5).map((task) => (
                    <Link
                      key={task.id}
                      href={`/app/pro/${businessId}/tasks/${task.id}`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--surface-hover)]"
                    >
                      <Clock size={14} style={{ color: 'var(--text-faint)' }} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{task.title}</p>
                        {task.projectName && (
                          <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{task.projectName}</p>
                        )}
                      </div>
                      {task.dueDate && (
                        <span className="text-[11px] shrink-0 whitespace-nowrap" style={{ color: 'var(--text-faint)' }}>
                          {fmtDate(task.dueDate)}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </>
      )}
    </ProPageShell>
  );
}

/* ═══ Hero KPI Card ═══ */

function HeroKpi({
  label,
  value,
  sub,
  icon,
  href,
  accent,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  href?: string;
  accent?: boolean;
  alert?: boolean;
}) {
  const inner = (
    <div
      className="flex flex-col justify-between rounded-xl p-4 transition-colors"
      style={{
        background: accent ? 'var(--shell-accent)' : 'var(--surface)',
        border: alert ? '1px solid var(--danger)' : '1px solid var(--border)',
        minHeight: 100,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}
        >
          {label}
        </p>
        {icon && (
          <span style={{ color: accent ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)' }}>{icon}</span>
        )}
      </div>
      <p
        className="text-2xl font-bold truncate tabular-nums"
        style={{
          fontFamily: 'var(--font-barlow), sans-serif',
          color: accent ? 'white' : alert ? 'var(--danger)' : undefined,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] mt-1 truncate" style={{ color: accent ? 'rgba(255,255,255,0.6)' : alert ? 'var(--danger)' : 'var(--text-faint)' }}>
          {sub}
        </p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  }
  return inner;
}
