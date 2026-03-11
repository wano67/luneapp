'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, AlertCircle, Briefcase, Users, FileText, FolderKanban } from 'lucide-react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageContainer } from '@/components/layouts/PageContainer';
import { fmtKpi } from '@/lib/format';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
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

/* ═══ KPI pill ═══ */

function KpiPill({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex-1 min-w-0 rounded-xl p-3 animate-fade-in-up"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
        {label}
      </p>
      <p className="text-base font-bold truncate" style={{ fontFamily: 'var(--font-barlow), sans-serif' }}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] truncate" style={{ color: 'var(--text-faint)' }}>{sub}</p>
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
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileComplete, setProfileComplete] = useState(true);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dashRes, tasksRes, bizRes] = await Promise.all([
          fetchJson<DashboardPayload>(`/api/pro/businesses/${businessId}/dashboard?days=${periodDays}`, { cache: 'no-store' }),
          fetchJson<{ items: TaskItem[] }>(`/api/pro/businesses/${businessId}/tasks`, { cache: 'no-store' }),
          fetchJson<{ profileComplete?: boolean }>(`/api/pro/businesses/${businessId}`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        if (!dashRes.ok) throw new Error(dashRes.error || 'Dashboard indisponible');
        if (!tasksRes.ok) throw new Error(tasksRes.error || 'Taches indisponibles');

        setDashboard(dashRes.data ?? null);
        setTasks(tasksRes.data?.items ?? []);
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

  // Finance
  const mtdIncome = dashboard?.kpis?.mtdIncomeCents ?? '0';

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

          {/* ── KPI summary ── */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {isMemberOrAbove && (
              <KpiPill
                label="Solde"
                value={fmtKpi(dashboard?.treasury?.balanceCents)}
                sub={`+${fmtKpi(mtdIncome)} ce mois`}
              />
            )}
            <KpiPill
              label="Projets"
              value={`${activeProjects} actif${activeProjects > 1 ? 's' : ''}`}
              sub={`${completedProjects} termine${completedProjects > 1 ? 's' : ''}`}
            />
            <KpiPill
              label="Taches"
              value={`${tasksDone}/${tasksTotal}`}
              sub={`${taskCompletionPct}% terminees`}
            />
            {isMemberOrAbove && (
              <KpiPill
                label="Facturation"
                value={fmtKpi(pendingCents)}
                sub={`Recouvrement ${collectionPct}%`}
              />
            )}
          </div>

          {/* ── Cashflow chart — MEMBER+ ── */}
          {isMemberOrAbove && (
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
          )}
        </>
      )}
    </PageContainer>
  );
}
