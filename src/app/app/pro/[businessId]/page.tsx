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

type DashboardResponse = {
  clientsCount: number;
  activeProjectsCount: number;
  openTasksCount: number;
  monthFinance: {
    income: { amountCents: string; amount: number };
    expense: { amountCents: string; amount: number };
    period: { start: string; end: string };
  };
  latestTasks: {
    id: string;
    title: string;
    status: TaskStatus;
    dueDate: string | null;
    createdAt: string;
  }[];
  latestFinances: {
    id: string;
    type: FinanceType;
    amountCents: string;
    amount: number;
    category: string;
    date: string;
    projectId: string | null;
    projectName: string | null;
  }[];
};

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

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Clients', value: data.clientsCount.toString() },
      { label: 'Projets actifs', value: data.activeProjectsCount.toString() },
      { label: 'Tâches ouvertes', value: data.openTasksCount.toString() },
      { label: 'Revenus (mois)', value: formatCurrency(data.monthFinance.income.amount) },
      { label: 'Dépenses (mois)', value: formatCurrency(data.monthFinance.expense.amount) },
    ];
  }, [data]);

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
                {data.latestTasks.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p>
                ) : (
                  data.latestTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
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
                        {STATUS_LABELS[task.status]}
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
                {data.latestFinances.length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">Aucune opération.</p>
                ) : (
                  data.latestFinances.map((op) => (
                    <div
                      key={op.id}
                      className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{op.category}</p>
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
                        {formatCurrency(op.amount)}
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
