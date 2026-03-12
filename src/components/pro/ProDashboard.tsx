'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  AlertCircle,
  Briefcase,
  Users,
  FileText,
  FolderKanban,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  UserSearch,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/layouts/PageContainer';
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
  monthlySeries?: Array<{ month: string; incomeCents: string | number; expenseCents: string | number }>;
};

/* ═══ Business Score ═══ */

function computeBusinessScore(dashboard: DashboardPayload | null, tasksDone: number, tasksTotal: number) {
  if (!dashboard) return { score: 0, label: 'Chargement', color: 'var(--text-faint)' };

  const taskScore = tasksTotal > 0 ? Math.min(25, Math.round((tasksDone / tasksTotal) * 25)) : 0;

  const activeProjects = dashboard.projects?.activeCount ?? dashboard.kpis?.projectsActiveCount ?? 0;
  const completedProjects = dashboard.projectMetrics?.completedProjectsCount ?? 0;
  const totalProjects = dashboard.projects?.totalCount ?? 0;
  const completedRate = totalProjects > 0 ? completedProjects / totalProjects : 0;
  const projectScore = activeProjects > 0 ? Math.min(25, 15 + Math.round(completedRate * 10)) : 0;

  const balance = Number(dashboard.treasury?.balanceCents ?? 0);
  const margin = dashboard.projectMetrics?.avgProfitabilityPercent ?? 0;
  let financeScore = balance > 0 ? 20 : 10;
  if (margin > 20) financeScore = Math.min(25, financeScore + 5);

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

/* ═══ KPI Card ═══ */

function KpiCard({
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
      className="flex flex-col gap-1 rounded-xl p-4 animate-fade-in-up transition-colors"
      style={{
        background: accent ? 'var(--shell-accent)' : 'var(--surface)',
        border: alert ? '1px solid var(--danger)' : '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}
        >
          {label}
        </p>
        {icon && <span style={{ color: accent ? 'rgba(255,255,255,0.7)' : 'var(--text-faint)' }}>{icon}</span>}
      </div>
      <p
        className="text-xl font-bold truncate tabular-nums"
        style={{
          fontFamily: 'var(--font-barlow), sans-serif',
          color: accent ? 'white' : alert ? 'var(--danger)' : undefined,
        }}
      >
        {value}
      </p>
      {sub && (
        <p className="text-[11px] truncate" style={{ color: accent ? 'rgba(255,255,255,0.6)' : 'var(--text-faint)' }}>
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

/* ═══ Section Header ═══ */

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs font-medium transition-colors hover:opacity-80"
          style={{ color: 'var(--shell-accent)' }}
        >
          {linkLabel ?? 'Voir tout'}
          <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

/* ═══ Dashboard ═══ */

export default function ProDashboard({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
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
    return () => {
      cancelled = true;
    };
  }, [businessId, periodDays, rv]);

  const tasksDone = dashboard?.doneTasksCount ?? 0;
  const tasksTotal = dashboard?.totalTasksCount ?? 0;
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
  const plannedProjects = dashboard?.projects?.plannedCount ?? 0;
  const completedProjects = dashboard?.projectMetrics?.completedProjectsCount ?? 0;

  // Finance
  const mtdIncome = dashboard?.kpis?.mtdIncomeCents ?? '0';
  const mtdExpense = dashboard?.kpis?.mtdExpenseCents ?? '0';
  const balanceCents = dashboard?.treasury?.balanceCents ?? '0';
  const balancePositive = Number(balanceCents) >= 0;

  // Pipeline
  const prospectsActive = dashboard?.prospectsActiveCount ?? 0;
  const prospectsWon = dashboard?.prospectsWonCount ?? 0;

  // Alerts
  const overdueTasks = dashboard?.overdueTasksCount ?? 0;
  const overdueInvoices = dashboard?.overdueInvoicesCount ?? 0;
  const hasAlerts = overdueTasks > 0 || overdueInvoices > 0;

  return (
    <PageContainer className="gap-5">
      {showOnboarding && (
        <OnboardingModal
          storageKey="lune:onboarding:pro"
          apiField="onboardingProDone"
          onComplete={() => setShowOnboarding(false)}
          steps={[
            {
              icon: <Briefcase size={28} style={{ color: 'white' }} />,
              title: 'Votre espace professionnel',
              description: 'Gérez vos projets, clients et facturation depuis un seul tableau de bord. Tout est centralisé ici.',
            },
            {
              icon: <Users size={28} style={{ color: 'white' }} />,
              title: 'Clients & Prospects',
              description: 'Suivez votre pipeline commercial, gérez vos fiches clients et convertissez vos prospects en clients.',
            },
            {
              icon: <FolderKanban size={28} style={{ color: 'white' }} />,
              title: 'Projets & Tâches',
              description: 'Planifiez vos projets, assignez des tâches à votre équipe et suivez l\'avancement en temps réel.',
            },
            {
              icon: <FileText size={28} style={{ color: 'white' }} />,
              title: 'Devis & Factures',
              description: 'Générez des devis et factures conformes en un clic, suivez les paiements et relancez automatiquement.',
            },
          ]}
        />
      )}

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

      {/* Profile banner */}
      {!profileComplete && !bannerDismissed && isAdminOrOwner && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 animate-fade-in-up">
          <AlertCircle size={18} className="shrink-0 text-amber-600" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">Profil entreprise incomplet</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Completez vos informations (raison sociale, SIRET, adresse) pour generer des documents conformes.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm">
              <Link href={`/app/pro/${businessId}/settings?section=identite`}>Completer</Link>
            </Button>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl p-4 animate-skeleton-pulse" style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 100 }} />
          ))}
        </div>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          <p className="text-xs text-[var(--text-faint)]">Verifie la connexion ou reessaie.</p>
        </Card>
      ) : (
        <>
          {/* ── Alerts banner ── */}
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

          {/* ── KPIs financiers — MEMBER+ ── */}
          {isMemberOrAbove && (
            <>
              <SectionHeader title="Finances" href={`/app/pro/${businessId}/finances`} />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <KpiCard
                  label="Trésorerie"
                  value={fmtKpi(balanceCents)}
                  sub={balancePositive ? 'Solde positif' : 'Solde négatif'}
                  icon={balancePositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  accent={balancePositive}
                  alert={!balancePositive}
                  href={`/app/pro/${businessId}/finances`}
                />
                <KpiCard
                  label="Revenus du mois"
                  value={fmtKpi(mtdIncome)}
                  sub={`Dépenses : ${fmtKpi(mtdExpense)}`}
                  icon={<TrendingUp size={16} />}
                />
                <KpiCard
                  label="A encaisser"
                  value={fmtKpi(pendingCents)}
                  sub={`Recouvrement ${collectionPct}%`}
                  icon={<FileText size={16} />}
                  alert={overdueInvoices > 0}
                />
                <KpiCard
                  label="Devis signés"
                  value={fmtKpi(dashboard?.billing?.totalPlannedCents)}
                  sub="Carnet de commandes"
                  icon={<CheckCircle2 size={16} />}
                />
              </div>
            </>
          )}

          {/* ── Activité ── */}
          <SectionHeader title="Activité" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiCard
              label="Projets"
              value={`${activeProjects}`}
              sub={`${plannedProjects} planifié${plannedProjects > 1 ? 's' : ''} · ${completedProjects} terminé${completedProjects > 1 ? 's' : ''}`}
              icon={<FolderKanban size={16} />}
              href={`/app/pro/${businessId}/projects`}
            />
            <KpiCard
              label="Tâches"
              value={`${tasksDone}/${tasksTotal}`}
              sub={`${taskCompletionPct}% terminées`}
              icon={<CheckCircle2 size={16} />}
              alert={overdueTasks > 0}
              href={`/app/pro/${businessId}/tasks`}
            />
            <KpiCard
              label="Clients"
              value={`${dashboard?.clientsCount ?? 0}`}
              sub={`${prospectsActive} prospect${prospectsActive > 1 ? 's' : ''} actif${prospectsActive > 1 ? 's' : ''}`}
              icon={<Users size={16} />}
              href={`/app/pro/${businessId}/agenda`}
            />
            <KpiCard
              label="Équipe"
              value={`${dashboard?.teamCount ?? 1}`}
              sub={prospectsWon > 0 ? `${prospectsWon} prospect${prospectsWon > 1 ? 's' : ''} converti${prospectsWon > 1 ? 's' : ''}` : 'Membres actifs'}
              icon={<UserSearch size={16} />}
              href={`/app/pro/${businessId}/team`}
            />
          </div>

          {/* ── Performance projets — si données disponibles ── */}
          {(dashboard?.projectMetrics?.avgProfitabilityPercent ?? 0) > 0 && (
            <div
              className="grid grid-cols-3 gap-3 rounded-xl p-4 animate-fade-in-up"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Rentabilité moy.</p>
                <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {dashboard?.projectMetrics?.avgProfitabilityPercent ?? 0}%
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Durée moy.</p>
                <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {dashboard?.projectMetrics?.avgDurationDays ?? 0}j
                </p>
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>Projets terminés</p>
                <p className="text-lg font-bold tabular-nums" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                  {completedProjects}
                </p>
              </div>
            </div>
          )}

          {/* ── Cash flow chart — MEMBER+ ── */}
          {isMemberOrAbove && (
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
          )}

          {/* ── Prochaines actions ── */}
          {((dashboard?.nextActions?.tasks?.length ?? 0) > 0 || (dashboard?.nextActions?.interactions?.length ?? 0) > 0) && (
            <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '300ms', animationFillMode: 'backwards' }}>
              <SectionHeader title="Prochaines actions" href={`/app/pro/${businessId}/tasks`} />
              <div className="space-y-1">
                {(dashboard?.nextActions?.tasks ?? []).map((task) => (
                  <Link
                    key={task.id}
                    href={`/app/pro/${businessId}/tasks`}
                    className="flex items-center gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <Clock size={16} style={{ color: 'var(--text-faint)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{task.title}</p>
                      {task.projectName && (
                        <p className="text-[11px] truncate" style={{ color: 'var(--text-faint)' }}>{task.projectName}</p>
                      )}
                    </div>
                    {task.dueDate && (
                      <span className="text-xs shrink-0" style={{ color: 'var(--text-faint)' }}>
                        {fmtDate(task.dueDate)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Dernières factures — MEMBER+ ── */}
          {isMemberOrAbove && (dashboard?.latestInvoices?.length ?? 0) > 0 && (
            <div className="space-y-3 animate-fade-in-up" style={{ animationDelay: '400ms', animationFillMode: 'backwards' }}>
              <SectionHeader title="Dernières factures" href={`/app/pro/${businessId}/finances`} />
              <div className="space-y-1">
                {(dashboard?.latestInvoices ?? []).map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <FileText size={16} style={{ color: 'var(--text-faint)' }} className="shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {inv.number ?? 'Brouillon'} — {inv.clientName ?? 'Client'}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--text-faint)' }}>
                        {inv.status === 'PAID' ? 'Payée' : inv.status === 'SENT' ? 'Envoyée' : 'Brouillon'}
                        {inv.dueDate ? ` · Éch. ${fmtDate(inv.dueDate)}` : ''}
                      </p>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
                      {fmtKpi(inv.totalCents)}
                    </span>
                    <InvoiceStatusDot status={inv.status} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

/* ═══ Invoice Status Dot ═══ */

function InvoiceStatusDot({ status }: { status: string }) {
  const color = status === 'PAID' ? 'var(--success)' : status === 'SENT' ? 'var(--warning)' : 'var(--text-faint)';
  return <div className="shrink-0 h-2 w-2 rounded-full" style={{ background: color }} />;
}
