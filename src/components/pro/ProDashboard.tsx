'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CashflowChart from './charts/CashflowChart';
import TasksDonut from './charts/TasksDonut';
import PipelineBar from './charts/PipelineBar';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrency } from '@/app/app/pro/pro-data';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';
import { PageHeader } from '@/app/app/components/PageHeader';
import { ActionTile } from '@/app/app/components/ActionTile';
import { Building2, UserPlus, Briefcase, Wallet2 } from 'lucide-react';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type ProspectPipelineStatus = 'NEW' | 'IN_DISCUSSION' | 'OFFER_SENT' | 'FOLLOW_UP' | 'CLOSED';

type DashboardPayload = {
  kpis?: {
    projectsActiveCount?: number;
    activeProjectsCount?: number;
    projectsCompletedCount?: number;
    openTasksCount?: number;
    mtdIncomeCents?: string;
    mtdExpenseCents?: string;
  };
  monthFinance?: {
    income?: { amountCents?: string | number; amount?: number };
    expense?: { amountCents?: string | number; amount?: number };
  };
  latestTasks?: Array<{
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    projectId: string | null;
    projectName: string | null;
  }>;
  nextActions?: {
    tasks?: Array<{
      id: string;
      title: string;
      status: TaskStatus;
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
  monthlySeries?: Array<{ month: string; incomeCents: string | number; expenseCents: string | number }>;
};

type FinanceAggregate = {
  incomeCents: string;
  expenseCents: string;
  netCents: string;
};

type TaskItem = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string | null;
  createdAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

type ProspectItem = {
  id: string;
  name: string;
  pipelineStatus: ProspectPipelineStatus;
};

type ClientItem = {
  id: string;
  name: string;
  email?: string | null;
  createdAt: string;
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
};

function daysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

function parseCents(value?: string | number) {
  if (typeof value === 'number') return value / 100;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n / 100 : 0;
  }
  return 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function countByStatus(tasks: TaskItem[]) {
  const counts: Record<TaskStatus, number> = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const t of tasks) {
    const status = t.status ?? 'TODO';
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function countLateTasks(tasks: TaskItem[]) {
  const now = new Date();
  return tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE').length;
}

function groupPipeline(prospects: ProspectItem[]) {
  const map = new Map<string, number>();
  prospects.forEach((p) => {
    const key = p.pipelineStatus ?? 'UNKNOWN';
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export default function ProDashboard({ businessId }: { businessId: string }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [financeAgg, setFinanceAgg] = useState<FinanceAggregate | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [prospects, setProspects] = useState<ProspectItem[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const activeCtx = useActiveBusiness({ optional: true });

  const active = useActiveBusiness({ optional: true });
  const role = active?.activeBusiness?.role ?? null;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const periodEnd = new Date();
      const periodStart = daysAgo(periodDays).toISOString();
      const periodEndIso = periodEnd.toISOString();

      try {
        const [dashRes, financeRes, tasksRes, prospectsRes, clientsRes] = await Promise.all([
          fetchJson<DashboardPayload>(`/api/pro/businesses/${businessId}/dashboard`, { cache: 'no-store' }),
          fetchJson<FinanceAggregate>(
            `/api/pro/businesses/${businessId}/finances?aggregate=1&periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEndIso)}`,
            { cache: 'no-store' }
          ),
          fetchJson<{ items: TaskItem[] }>(`/api/pro/businesses/${businessId}/tasks`, { cache: 'no-store' }),
          fetchJson<{ items: ProspectItem[] }>(`/api/pro/businesses/${businessId}/prospects`, { cache: 'no-store' }),
          fetchJson<{ items: ClientItem[] }>(`/api/pro/businesses/${businessId}/clients`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        setRequestId(
          dashRes.requestId ||
            financeRes.requestId ||
            tasksRes.requestId ||
            prospectsRes.requestId ||
            clientsRes.requestId ||
            null
        );

        if (!dashRes.ok) throw new Error(dashRes.error || 'Dashboard indisponible');
        if (!financeRes.ok) throw new Error(financeRes.error || 'Finances indisponibles');
        if (!tasksRes.ok) throw new Error(tasksRes.error || 'Tâches indisponibles');
        if (!prospectsRes.ok) throw new Error(prospectsRes.error || 'Prospects indisponibles');
        if (!clientsRes.ok) throw new Error(clientsRes.error || 'Clients indisponibles');

        setDashboard(dashRes.data ?? null);
        setFinanceAgg(financeRes.data ?? null);
        setTasks(tasksRes.data?.items ?? []);
        setProspects(prospectsRes.data?.items ?? []);
        setClients(clientsRes.data?.items ?? []);
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

  const income = useMemo(() => {
    if (financeAgg?.incomeCents) return parseCents(financeAgg.incomeCents);
    return parseCents(dashboard?.kpis?.mtdIncomeCents);
  }, [financeAgg, dashboard]);

  const expense = useMemo(() => {
    if (financeAgg?.expenseCents) return parseCents(financeAgg.expenseCents);
    return parseCents(dashboard?.kpis?.mtdExpenseCents);
  }, [financeAgg, dashboard]);

  const net = useMemo(() => income - expense, [income, expense]);

  const activeProjects = dashboard?.kpis?.projectsActiveCount ?? dashboard?.kpis?.activeProjectsCount ?? 0;
  const openTasks = dashboard?.kpis?.openTasksCount ?? 0;
  const tasksByStatus = useMemo(() => countByStatus(tasks), [tasks]);
  const lateTasksCount = useMemo(() => countLateTasks(tasks), [tasks]);
  const pipelineData = useMemo(() => groupPipeline(prospects), [prospects]);
  const clientsRecent = useMemo(
    () =>
      [...clients].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5),
    [clients]
  );
  const upcomingTasks = dashboard?.latestTasks ?? dashboard?.nextActions?.tasks ?? [];
  const monthlySeries = dashboard?.monthlySeries ?? [];

  const statTiles = [
    {
      label: 'Solde net',
      value: formatCurrency(net),
      hint: 'Finances · trésorerie',
      href: `/app/pro/${businessId}/finances/treasury`,
    },
    {
      label: 'Revenus (période)',
      value: formatCurrency(income),
      hint: 'Détail finances',
      href: `/app/pro/${businessId}/finances`,
    },
    {
      label: 'Projets actifs',
      value: String(activeProjects),
      hint: 'Voir les projets',
      href: `/app/pro/${businessId}/projects`,
    },
    {
      label: 'Tâches ouvertes',
      value: String(openTasks),
      hint: 'Voir les tâches',
      href: `/app/pro/${businessId}/tasks`,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4">
      <RoleBanner role={role} />
      <PageHeader
        backHref="/app/pro"
        backLabel="Studio"
        title={activeCtx?.activeBusiness?.name ?? 'Dashboard pro'}
        subtitle="KPIs, tendances et actions rapides"
        primaryAction={{ label: 'Ajouter un client', href: `/app/pro/${businessId}/clients` }}
        secondaryAction={{ label: 'Nouvelle opération', href: `/app/pro/${businessId}/finances`, variant: 'outline' }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <span className="text-xs text-[var(--text-secondary)]">Période</span>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
          >
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
          </select>
        </div>
        {requestId ? (
          <Badge variant="neutral" className="bg-[var(--surface-2)] text-[11px]">
            Ref {requestId}
          </Badge>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ActionTile
          icon={<UserPlus size={18} />}
          title="Nouveau client"
          description="Ajoute un contact et démarre un projet"
          href={`/app/pro/${businessId}/clients`}
          activeHref={`/app/pro/${businessId}/clients`}
        />
        <ActionTile
          icon={<Briefcase size={18} />}
          title="Nouveau projet"
          description="Crée un devis ou une mission"
          href={`/app/pro/${businessId}/projects`}
          activeHref={`/app/pro/${businessId}/projects`}
        />
        <ActionTile
          icon={<Wallet2 size={18} />}
          title="Enregistrer un paiement"
          description="Paiements et finances"
          href={`/app/pro/${businessId}/finances`}
          activeHref={`/app/pro/${businessId}/finances`}
        />
        <ActionTile
          icon={<Building2 size={18} />}
          title="Pipeline prospects"
          description="Suivre les leads en cours"
          href={`/app/pro/${businessId}/prospects`}
          activeHref={`/app/pro/${businessId}/prospects`}
        />
      </div>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement du dashboard…</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-rose-500">{error}</p>
          <p className="text-xs text-[var(--text-secondary)]">Vérifie la connexion ou réessaie.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {statTiles.map((tile) => (
              <Link
                key={tile.label}
                href={tile.href}
                className="card-interactive block rounded-2xl"
              >
                <div className="space-y-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/70 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                    {tile.label}
                  </p>
                  <p className="text-2xl font-semibold text-[var(--text-primary)]">{tile.value}</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">{tile.hint}</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cash flow (12 mois)</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/finances`}>Finances</Link>
                </Button>
              </div>
              <CashflowChart series={monthlySeries} />
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches par statut</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/tasks`}>Voir tâches</Link>
                </Button>
              </div>
              <TasksDonut
                data={[
                  { name: 'À faire', value: tasksByStatus.TODO },
                  { name: 'En cours', value: tasksByStatus.IN_PROGRESS },
                  { name: 'Terminées', value: tasksByStatus.DONE },
                ]}
              />
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Pipeline prospects</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/prospects`}>Pipeline</Link>
                </Button>
              </div>
              <PipelineBar data={pipelineData} />
            </Card>

            <Card className="lg:col-span-2 space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches à venir (7j)</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/tasks`}>Toutes les tâches</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {upcomingTasks.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune tâche à venir.</p>
                ) : (
                  upcomingTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={`/app/pro/${businessId}/tasks/${t.id}`}
                      className="card-interactive block rounded-xl"
                    >
                      <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{t.title}</p>
                          <p className="text-[11px] text-[var(--text-secondary)]">
                            {t.projectName ?? 'Projet ?'} · {formatDate(t.dueDate)}
                          </p>
                        </div>
                        <Badge variant="neutral">{STATUS_LABELS[t.status]}</Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Clients récents</p>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/clients`}>Voir clients</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {clientsRecent.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucun client récent.</p>
                ) : (
                  clientsRecent.map((c) => (
                    <Link
                      key={c.id}
                      href={`/app/pro/${businessId}/clients/${c.id}`}
                      className="card-interactive block rounded-xl"
                    >
                      <div className="flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          {c.email ?? 'Email manquant'} · {formatDate(c.createdAt)}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">À faire ensuite</p>
                <Badge variant="neutral">{lateTasksCount > 0 ? `${lateTasksCount} urgences` : 'Prêt'}</Badge>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Link href={`/app/pro/${businessId}/clients`} className="card-interactive block rounded-xl">
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Créer un client</p>
                    <p className="text-xs text-[var(--text-secondary)]">Démarrer un dossier rapidement.</p>
                  </div>
                </Link>
                <Link href={`/app/pro/${businessId}/projects`} className="card-interactive block rounded-xl">
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Créer un projet/devis</p>
                    <p className="text-xs text-[var(--text-secondary)]">Planifier la prochaine mission.</p>
                  </div>
                </Link>
                <Link href={`/app/pro/${businessId}/finances`} className="card-interactive block rounded-xl">
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Ajouter une opération</p>
                    <p className="text-xs text-[var(--text-secondary)]">Encaisser ou enregistrer une dépense.</p>
                  </div>
                </Link>
                <Link href={`/app/pro/${businessId}/tasks`} className="card-interactive block rounded-xl">
                  <div className="space-y-1 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches en retard</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {lateTasksCount > 0 ? `${lateTasksCount} à traiter` : 'Aucune, continue !'}
                    </p>
                  </div>
                </Link>
              </div>
            </Card>
          </div>

        </>
      )}
    </div>
  );
}
