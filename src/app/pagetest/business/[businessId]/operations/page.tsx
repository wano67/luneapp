'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchJson } from '@/lib/apiClient';
import { FigmaKpiCard, FigmaSectionTitle, FigmaListRow, FigmaStatusPill, FigmaProgressBar, FigmaEmpty, FigmaFooter, FIGMA, fmtDate } from '../../../figma-ui';

type Project = {
  id: string;
  name: string;
  status: string;
  clientName?: string | null;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
};

type Task = { id: string; title: string; status: string; dueDate?: string | null; projectName?: string | null };

export default function OperationsPage() {
  const params = useParams<{ businessId: string }>();
  const businessId = params?.businessId ?? '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [counts, setCounts] = useState<{ active: number; planned: number; total: number }>({ active: 0, planned: 0, total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    const ctrl = new AbortController();
    (async () => {
      const [pRes, tRes] = await Promise.all([
        fetchJson<{ items?: Project[]; counts?: { active?: number; planned?: number; total?: number } }>(`/api/pro/businesses/${businessId}/projects?scope=ALL`, {}, ctrl.signal),
        fetchJson<{ items?: Task[] }>(`/api/pro/businesses/${businessId}/tasks`, {}, ctrl.signal),
      ]);
      if (ctrl.signal.aborted) return;
      if (pRes.ok) {
        setProjects(pRes.data?.items ?? []);
        setCounts({ active: pRes.data?.counts?.active ?? 0, planned: pRes.data?.counts?.planned ?? 0, total: pRes.data?.counts?.total ?? 0 });
      }
      if (tRes.ok) setTasks(tRes.data?.items ?? []);
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, [businessId]);

  const openTasks = tasks.filter((t) => t.status !== 'DONE').length;

  return (
    <div className="flex flex-col gap-7 p-7" style={{ background: 'white', minHeight: '100%' }}>
      <h1 style={{ color: FIGMA.dark, fontSize: 28, fontWeight: 700 }}>Opérations</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FigmaKpiCard label="Projets actifs" value={loading ? '—' : String(counts.active)} delay={0} />
        <FigmaKpiCard label="Projets planifiés" value={loading ? '—' : String(counts.planned)} delay={50} />
        <FigmaKpiCard label="Tâches ouvertes" value={loading ? '—' : String(openTasks)} delay={100} />
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Projets ({projects.length})</FigmaSectionTitle>
        {projects.length === 0 && !loading && <FigmaEmpty message="Aucun projet" />}
        {projects.slice(0, 20).map((p) => (
          <FigmaListRow
            key={p.id}
            left={p.name}
            sub={p.clientName ?? undefined}
            right={
              <div className="flex items-center gap-3">
                {p.tasksSummary && (
                  <div className="w-20">
                    <FigmaProgressBar value={p.tasksSummary.done} max={p.tasksSummary.total} />
                  </div>
                )}
                <FigmaStatusPill
                  status={p.status === 'ACTIVE' ? 'success' : p.status === 'PLANNED' ? 'warning' : 'neutral'}
                  label={p.status === 'ACTIVE' ? 'Actif' : p.status === 'PLANNED' ? 'Planifié' : p.status === 'COMPLETED' ? 'Terminé' : p.status}
                />
              </div>
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <FigmaSectionTitle>Tâches récentes</FigmaSectionTitle>
        {tasks.length === 0 && !loading && <FigmaEmpty message="Aucune tâche" />}
        {tasks.slice(0, 10).map((t) => (
          <FigmaListRow
            key={t.id}
            left={t.title}
            sub={[t.projectName, fmtDate(t.dueDate)].filter(Boolean).join(' · ')}
            right={
              <FigmaStatusPill
                status={t.status === 'DONE' ? 'success' : t.status === 'IN_PROGRESS' ? 'warning' : 'neutral'}
                label={t.status === 'DONE' ? 'Terminé' : t.status === 'IN_PROGRESS' ? 'En cours' : 'À faire'}
              />
            }
          />
        ))}
      </div>

      <FigmaFooter />
    </div>
  );
}
