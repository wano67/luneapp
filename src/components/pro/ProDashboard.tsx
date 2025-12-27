'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, MoreVertical } from 'lucide-react';
import CashflowChart from './charts/CashflowChart';
import TasksDonut from './charts/TasksDonut';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrency } from '@/app/app/pro/pro-data';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';
import { normalizeWebsiteUrl } from '@/lib/website';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

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

export default function ProDashboard({ businessId }: { businessId: string }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [financeAgg, setFinanceAgg] = useState<FinanceAggregate | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
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
        const [dashRes, financeRes, tasksRes] = await Promise.all([
          fetchJson<DashboardPayload>(`/api/pro/businesses/${businessId}/dashboard`, { cache: 'no-store' }),
          fetchJson<FinanceAggregate>(
            `/api/pro/businesses/${businessId}/finances?aggregate=1&periodStart=${encodeURIComponent(periodStart)}&periodEnd=${encodeURIComponent(periodEndIso)}`,
            { cache: 'no-store' }
          ),
          fetchJson<{ items: TaskItem[] }>(`/api/pro/businesses/${businessId}/tasks`, { cache: 'no-store' }),
        ]);

        if (cancelled) return;

        setRequestId(
          dashRes.requestId ||
            financeRes.requestId ||
            tasksRes.requestId ||
            null
        );

        if (!dashRes.ok) throw new Error(dashRes.error || 'Dashboard indisponible');
        if (!financeRes.ok) throw new Error(financeRes.error || 'Finances indisponibles');
        if (!tasksRes.ok) throw new Error(tasksRes.error || 'Tâches indisponibles');

        setDashboard(dashRes.data ?? null);
        setFinanceAgg(financeRes.data ?? null);
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
  const upcomingTasks = dashboard?.latestTasks ?? dashboard?.nextActions?.tasks ?? [];
  const monthlySeries = dashboard?.monthlySeries ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4">
      <BusinessHeader
        businessName={activeCtx?.activeBusiness?.name ?? 'Entreprise'}
        websiteUrl={activeCtx?.activeBusiness?.websiteUrl ?? null}
        role={role}
        businessId={businessId}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
          <span className="text-xs text-[var(--text-secondary)]">Période</span>
          <select
            value={periodDays}
            onChange={(e) => setPeriodDays(Number(e.target.value))}
            className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
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

      <BusinessKpis
        items={[
          { label: 'Solde', value: formatCurrency(net) },
          { label: 'Revenus', value: formatCurrency(income) },
          { label: 'Projets', value: String(activeProjects) },
          { label: 'Tâches', value: String(openTasks) },
        ]}
      />

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
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 space-y-3 border border-[var(--border)]/80 bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Cash flow (12 mois)</p>
                <Button
                  asChild
                  size="sm"
                  className="cursor-pointer rounded-md bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  <Link href={`/app/pro/${businessId}/finances`}>Finances</Link>
                </Button>
              </div>
              <CashflowChart series={monthlySeries} />
            </Card>

            <Card className="space-y-3 border border-[var(--border)]/80 bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Tâches par statut</p>
                <Button
                  asChild
                  size="sm"
                  className="cursor-pointer rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
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
            <Card className="space-y-3 border border-[var(--border)]/80 bg-[var(--surface)] p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Actions rapides</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <QuickLink href={`/app/pro/${businessId}/clients`} label="Nouveau client" />
                <QuickLink href={`/app/pro/${businessId}/projects`} label="Nouveau projet" />
                <QuickLink href={`/app/pro/${businessId}/finances`} label="Ajouter une opération" />
                <QuickLink href={`/app/pro/${businessId}/tasks`} label="Voir les tâches" />
              </div>
            </Card>

            <Card className="space-y-3 border border-[var(--border)]/80 bg-[var(--surface)] p-5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Focus</p>
                <Badge variant="neutral">{lateTasksCount > 0 ? `${lateTasksCount} urgences` : 'Prêt'}</Badge>
              </div>
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {upcomingTasks.slice(0, 3).map((t) => (
                  <div key={t.id} className="flex items-center justify-between rounded-xl border border-[var(--border)]/60 bg-[var(--surface)]/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[var(--text-primary)]">{t.title}</p>
                      <p className="text-[11px]">{t.projectName ?? 'Projet'} · {formatDate(t.dueDate)}</p>
                    </div>
                    <Badge variant="neutral" className="shrink-0">
                      {STATUS_LABELS[t.status]}
                    </Badge>
                  </div>
                ))}
                {upcomingTasks.length === 0 ? <p>Aucune action imminente.</p> : null}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function BusinessHeader({
  businessName,
  websiteUrl,
  role,
  businessId,
}: {
  businessName: string;
  websiteUrl: string | null | undefined;
  role: string | null;
  businessId: string;
}) {
  const normalized = normalizeWebsiteUrl(websiteUrl).value;
  const src = normalized ? `/api/logo?url=${encodeURIComponent(normalized)}` : null;
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-[var(--border)]/80 bg-[var(--surface)]/80 p-4">
      <Link href="/app/pro" className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        ← Studio
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <LogoBlock src={src} fallback={businessName} />
          <div className="min-w-0">
            <p className="text-xl font-semibold text-[var(--text-primary)]">{businessName}</p>
            {role ? (
              <Badge variant="neutral" className="mt-1 text-[11px]">
                {role}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          <Button
            asChild
            size="sm"
            className="w-full cursor-pointer rounded-md bg-neutral-900 px-3 text-xs font-semibold text-white transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] sm:w-auto"
          >
            <Link href={`/app/pro/${businessId}/projects`}>Nouveau projet</Link>
          </Button>
          <HeaderMenu businessId={businessId} />
        </div>
      </div>
    </div>
  );
}

function BusinessKpis({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-3xl bg-[var(--surface)]/70 p-4">
      <div className="grid grid-cols-1 justify-items-center gap-4 sm:grid-cols-4">
        {items.slice(0, 4).map((item) => (
          <div
            key={item.label}
            className="flex h-[120px] w-[120px] flex-col items-center justify-center rounded-full bg-[var(--surface)] text-center shadow-[0_0_0_1px_var(--border)]"
          >
            <span className="text-2xl font-bold text-[var(--text-primary)]">{item.value}</span>
            <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderMenu({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, []);

  const items = [
    { label: 'Projets', href: `/app/pro/${businessId}/projects` },
    { label: 'Clients', href: `/app/pro/${businessId}/clients` },
    { label: 'Catalogue', href: `/app/pro/${businessId}/catalog` },
    { label: 'Finances', href: `/app/pro/${businessId}/finances` },
    { label: 'Membres', href: `/app/pro/${businessId}/settings/team` },
    { label: 'Paramètres', href: `/app/pro/${businessId}/settings` },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Actions"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-black/5 hover:text-[var(--text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical size={18} />
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              role="menuitem"
              className="block cursor-pointer px-3 py-2 text-sm text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LogoBlock({ src, fallback }: { src: string | null; fallback: string }) {
  const initials =
    fallback
      ?.trim()
      .split(/\s+/)
      .map((p) => p[0] || '')
      .join('')
      .slice(0, 2)
      .toUpperCase() || '??';
  const [errored, setErrored] = useState(false);
  return (
    <span
      className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-secondary)]"
      aria-hidden
    >
      {src && !errored ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full rounded-xl object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span className="text-sm font-semibold text-[var(--text-primary)]">{initials}</span>
      )}
    </span>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="card-interactive block cursor-pointer rounded-xl border border-[var(--border)]/70 bg-[var(--surface)]/80 px-3 py-2 text-sm text-[var(--text-primary)] transition hover:-translate-y-[1px] hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <ArrowRight size={14} />
      </div>
    </Link>
  );
}
