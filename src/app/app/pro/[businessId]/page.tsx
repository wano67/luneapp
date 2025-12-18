// src/app/app/pro/[businessId]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/ui/kpi-card';
import { fetchJson } from '@/lib/apiClient';
import { formatCurrency } from '../pro-data';
import { useActiveBusiness } from '../ActiveBusinessProvider';

type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';
type FinanceType = 'INCOME' | 'EXPENSE';

type DashboardTask = {
  id?: string;
  title?: string;
  status?: TaskStatus;
  dueDate?: string | null;
  createdAt?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

type DashboardFinance = {
  id?: string;
  type?: FinanceType;
  amountCents?: string | number;
  amount?: number;
  category?: string;
  date?: string | null;
  projectId?: string | null;
  projectName?: string | null;
};

type DashboardResponse = Partial<{
  clientsCount: number;
  activeProjectsCount: number;
  openTasksCount: number;
  monthFinance: {
    income?: { amountCents?: string | number; amount?: number };
    expense?: { amountCents?: string | number; amount?: number };
    period?: { start?: string; end?: string };
  };
  latestTasks: DashboardTask[];
  latestFinances: DashboardFinance[];
  kpis: Partial<{
    clientsCount: number;
    projectsActiveCount: number;
    activeProjectsCount: number;
    openTasksCount: number;
    mtdIncomeCents: string;
    mtdExpenseCents: string;
  }>;
  nextActions: Partial<{
    tasks: DashboardTask[];
    interactions: unknown[];
  }>;
}> & Record<string, unknown>;

const STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
};

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

function parseAmount(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const num = Number(value);
    return Number.isFinite(num) ? num / 100 : 0;
  }
  return 0;
}

function toTaskStatus(value: unknown): TaskStatus {
  return value === 'IN_PROGRESS' || value === 'DONE' ? value : 'TODO';
}

function normalizeDashboardData(data: DashboardResponse | null) {
  const clientsCount =
    typeof data?.clientsCount === 'number'
      ? data.clientsCount
      : typeof data?.kpis?.clientsCount === 'number'
        ? data.kpis.clientsCount
        : 0;

  const activeProjectsCount =
    typeof data?.activeProjectsCount === 'number'
      ? data.activeProjectsCount
      : typeof data?.kpis?.projectsActiveCount === 'number'
        ? data.kpis.projectsActiveCount
        : typeof data?.kpis?.activeProjectsCount === 'number'
          ? data.kpis.activeProjectsCount
          : 0;

  const openTasksCount =
    typeof data?.openTasksCount === 'number'
      ? data.openTasksCount
      : typeof data?.kpis?.openTasksCount === 'number'
        ? data.kpis.openTasksCount
        : 0;

  const incomeAmount =
    data?.monthFinance?.income?.amount ??
    parseAmount(data?.monthFinance?.income?.amountCents) ??
    parseAmount(data?.kpis?.mtdIncomeCents) ??
    0;

  const expenseAmount =
    data?.monthFinance?.expense?.amount ??
    parseAmount(data?.monthFinance?.expense?.amountCents) ??
    parseAmount(data?.kpis?.mtdExpenseCents) ??
    0;

  const tasksSource =
    Array.isArray(data?.latestTasks) && data.latestTasks.length > 0
      ? data.latestTasks
      : Array.isArray(data?.nextActions?.tasks)
        ? data.nextActions.tasks
        : [];

  const tasks: DashboardTask[] = tasksSource.map((task, idx) => ({
    id: task.id ?? `task-${idx}`,
    title: task.title ?? 'Sans titre',
    status: toTaskStatus(task.status),
    dueDate: task.dueDate ?? null,
    createdAt: task.createdAt ?? null,
    projectId: task.projectId ?? null,
    projectName: task.projectName ?? null,
  }));

  const finances: DashboardFinance[] = Array.isArray(data?.latestFinances)
    ? data!.latestFinances.map((op, idx) => ({
        id: op.id ?? `finance-${idx}`,
        type: op.type ?? 'EXPENSE',
        amount: typeof op.amount === 'number' ? op.amount : parseAmount(op.amountCents),
        amountCents:
          typeof op.amountCents === 'string' || typeof op.amountCents === 'number'
            ? op.amountCents
            : undefined,
        category: op.category ?? 'Opération',
        date: op.date ?? null,
        projectId: op.projectId ?? null,
        projectName: op.projectName ?? null,
      }))
    : [];

  return {
    clientsCount,
    activeProjectsCount,
    openTasksCount,
    incomeAmount,
    expenseAmount,
    tasks,
    finances,
  };
}

export default function BusinessDashboardPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const active = useActiveBusiness({ optional: true });
  const isAdmin = active?.activeBusiness?.role === 'OWNER' || active?.activeBusiness?.role === 'ADMIN';

  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJson<DashboardResponse>(
          `/api/pro/businesses/${businessId}/dashboard`,
          {},
          controller.signal
        );
        setRequestId(res.requestId);
        if (controller.signal.aborted) return;
        if (res.status === 401) {
          const from = window.location.pathname + window.location.search;
          window.location.href = `/login?from=${encodeURIComponent(from)}`;
          return;
        }
        if (!res.ok || !res.data) {
          setError(
            res.requestId ? `${res.error ?? 'Impossible de charger le dashboard.'} (Ref: ${res.requestId})` : res.error ?? 'Impossible de charger le dashboard.'
          );
          setData(null);
          return;
        }
        setData(res.data);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError('Erreur de chargement du dashboard.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [businessId]);

  const normalized = useMemo(() => normalizeDashboardData(data), [data]);

  const kpis = useMemo(
    () => [
      { label: 'Clients', value: normalized.clientsCount.toString() },
      { label: 'Projets actifs', value: normalized.activeProjectsCount.toString() },
      { label: 'Tâches ouvertes', value: normalized.openTasksCount.toString() },
      { label: 'Revenus (mois)', value: formatCurrency(normalized.incomeAmount) },
      { label: 'Dépenses (mois)', value: formatCurrency(normalized.expenseAmount) },
    ],
    [normalized]
  );

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Dashboard
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Vue d’ensemble
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              KPIs clés et dernières activités pour savoir où agir en priorité.
            </p>
          </div>
          {requestId ? (
            <Badge variant="neutral" className="bg-[var(--surface-2)]">
              Ref {requestId}
            </Badge>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement du dashboard…</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 p-5">
          <p className="text-sm font-semibold text-rose-400">{error}</p>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Recharger
          </Button>
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Dernières tâches</p>
                  <p className="text-xs text-[var(--text-secondary)]">5 plus récentes</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/tasks`}>Voir tout</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {normalized.tasks.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p>
                ) : (
                  normalized.tasks.map((task, idx) => (
                    <div
                      key={task.id ?? `task-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {task.title ?? 'Sans titre'}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          Due {formatDate(task.dueDate)} · Créée {formatDate(task.createdAt)}
                        </p>
                      </div>
                      <Badge
                        variant="neutral"
                        className={
                          task.status === 'DONE'
                            ? 'bg-emerald-100 text-emerald-700'
                            : task.status === 'IN_PROGRESS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-amber-100 text-amber-700'
                        }
                      >
                        {STATUS_LABELS[task.status as TaskStatus] ?? STATUS_LABELS.TODO}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Dernières opérations</p>
                  <p className="text-xs text-[var(--text-secondary)]">5 plus récentes</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/app/pro/${businessId}/finances`}>Voir finances</Link>
                </Button>
              </div>
              <div className="space-y-2">
                {normalized.finances.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune opération.</p>
                ) : (
                  normalized.finances.map((op, idx) => (
                    <div
                      key={op.id ?? `finance-${idx}`}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">
                          {op.category ?? 'Opération'}
                        </p>
                        <p className="text-[10px] text-[var(--text-secondary)]">
                          {formatDate(op.date)} · {op.projectName ?? '—'}
                        </p>
                      </div>
                      <Badge
                        variant="neutral"
                        className={
                          op.type === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }
                      >
                        {op.type === 'INCOME' ? '+' : '-'}
                        {formatCurrency(op.amount ?? 0)}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {isAdmin ? (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Actions rapides</p>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/app/pro/${businessId}/clients`}>Clients</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/app/pro/${businessId}/projects`}>Projets</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/app/pro/${businessId}/tasks`}>Tâches</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href={`/app/pro/${businessId}/finances`}>Finances</Link>
              </Button>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
