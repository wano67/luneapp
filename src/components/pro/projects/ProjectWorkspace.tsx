"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import Select from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { TabsPills } from '@/components/pro/TabsPills';
import { KpiCirclesBlock } from '@/components/pro/KpiCirclesBlock';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCurrencyEUR } from '@/lib/formatCurrency';
import { ProjectSetupChecklist, type ChecklistItem } from '@/components/pro/projects/ProjectSetupChecklist';
import { ServiceProgressRow } from '@/components/pro/projects/ServiceProgressRow';
import { GuidedCtaCard } from '@/components/pro/shared/GuidedCtaCard';

type ProjectDetail = {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  tasksSummary?: { total: number; open: number; done: number; progressPct: number };
  projectServices?: Array<{
    id: string;
    serviceId: string;
    priceCents: string | null;
    quantity: number;
    notes: string | null;
    service: { id: string; code: string; name: string; type: string | null };
  }>;
};

type ServiceItem = {
  id: string;
  projectId: string;
  serviceId: string;
  priceCents: string | null;
  quantity: number;
  service: { id: string; code: string; name: string; type: string | null };
};

type TaskItem = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  projectServiceId: string | null;
  projectId: string | null;
  progress?: number;
};

type MemberItem = { userId: string; email: string; role: string };
type ClientDocument = { id: string; title: string };
type ClientLite = { id: string; name: string; email: string | null };

const tabs = [
  { key: 'overview', label: 'Vue d’ensemble' },
  { key: 'work', label: 'Travail' },
  { key: 'team', label: 'Équipe' },
  { key: 'billing', label: 'Facturation' },
  { key: 'files', label: 'Documents' },
];

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return '—';
  }
}

export function ProjectWorkspace({ businessId, projectId }: { businessId: string; projectId: string }) {
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'work' | 'team' | 'billing' | 'files'>('overview');
  const [statusFilter, setStatusFilter] = useState<'TODO' | 'IN_PROGRESS' | 'DONE' | 'all'>('all');
  const [activeSetupModal, setActiveSetupModal] = useState<
    null | 'client' | 'deadline' | 'services' | 'tasks' | 'team' | 'documents'
  >(null);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [catalogServices, setCatalogServices] = useState<ServiceItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [serviceSelections, setServiceSelections] = useState<Record<string, number>>({});
  const [taskAssignments, setTaskAssignments] = useState<Record<string, string>>({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentKind, setDocumentKind] = useState<'Administratif' | 'Projet'>('Administratif');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const closeModal = () => {
    setActiveSetupModal(null);
    setModalError(null);
    setSaving(false);
    setDocumentFile(null);
  };

  const loadProject = useCallback(async (): Promise<string | null> => {
    const res = await fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`);
    if (!res.ok || !res.data) {
      setProject(null);
      setError(res.error ?? 'Projet introuvable');
      return null;
    }
    setProject(res.data.item);
    return res.data.item.clientId ?? null;
  }, [businessId, projectId]);

  const loadServices = useCallback(async () => {
    const res = await fetchJson<{ items: ServiceItem[] }>(
      `/api/pro/businesses/${businessId}/projects/${projectId}/services`
    );
    if (res.ok && res.data) setServices(res.data.items);
  }, [businessId, projectId]);

  const loadTasks = useCallback(async () => {
    const res = await fetchJson<{ items: TaskItem[] }>(
      `/api/pro/businesses/${businessId}/tasks?projectId=${projectId}`
    );
    if (res.ok && res.data) setTasks(res.data.items);
  }, [businessId, projectId]);

  const loadMembers = useCallback(async () => {
    const res = await fetchJson<{ items: MemberItem[] }>(`/api/pro/businesses/${businessId}/members`);
    if (res.ok && res.data) setMembers(res.data.items);
  }, [businessId]);

  const loadDocuments = useCallback(async (clientIdOverride?: string | null) => {
    const clientId = clientIdOverride ?? project?.clientId;
    if (!clientId) {
      setDocuments([]);
      return;
    }
    const res = await fetchJson<{ uploads: ClientDocument[] }>(
      `/api/pro/businesses/${businessId}/clients/${clientId}/documents`
    );
    if (res.ok && res.data) setDocuments(res.data.uploads);
  }, [businessId, project?.clientId]);

  const refetchAll = useCallback(async () => {
    const cid = await loadProject();
    await Promise.all([loadServices(), loadTasks(), loadMembers(), loadDocuments(cid)]);
  }, [loadProject, loadServices, loadTasks, loadMembers, loadDocuments]);

  const loadClients = useCallback(async (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetchJson<{ items: ClientLite[] }>(
      `/api/pro/businesses/${businessId}/clients${query}`
    );
    if (res.ok && res.data) setClients(res.data.items);
  }, [businessId]);

  const loadCatalogServices = useCallback(async (q?: string) => {
    const query = q ? `?q=${encodeURIComponent(q)}` : '';
    const res = await fetchJson<{ items: ServiceItem[] }>(
      `/api/pro/businesses/${businessId}/services${query}`
    );
    if (res.ok && res.data) setCatalogServices(res.data.items);
  }, [businessId]);

  const patchProject = async (body: Record<string, unknown>) => {
    return fetchJson<{ item: ProjectDetail }>(`/api/pro/businesses/${businessId}/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await refetchAll();
      } catch (err) {
        if (!cancelled) setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [businessId, projectId, refetchAll]);

  const amountCents = useMemo(() => {
    if (!project?.projectServices?.length) return null;
    return project.projectServices.reduce((sum, s) => sum + Number(s.priceCents ?? 0), 0);
  }, [project?.projectServices]);

  const progressPct = useMemo(() => {
    if (project?.tasksSummary) return project.tasksSummary.progressPct ?? 0;
    if (!tasks.length) return 0;
    const total = tasks.length;
    const sum = tasks.reduce((acc, t) => acc + (t.status === 'DONE' ? 100 : t.status === 'IN_PROGRESS' ? t.progress ?? 0 : 0), 0);
    return Math.round(sum / total);
  }, [project?.tasksSummary, tasks]);

  const kpis = useMemo(() => {
    return [
      { label: 'Avancement', value: `${Math.min(100, Math.max(0, progressPct))}%` },
      { label: 'Valeur', value: amountCents !== null ? formatCurrencyEUR(amountCents, { minimumFractionDigits: 0 }) : '—' },
      { label: 'Échéance', value: formatDate(project?.endDate ?? null) },
    ];
  }, [amountCents, progressPct, project?.endDate]);

  const checklistItems: ChecklistItem[] = useMemo(() => {
    const hasClient = Boolean(project?.clientId);
    const hasEndDate = Boolean(project?.endDate);
    const hasServices = services.length > 0;
    const hasTasks = tasks.length > 0;
    const hasDocs = documents.length > 0;
    const hasTeam = members.length > 0 || tasks.some((t) => t.assigneeEmail || t.assigneeName);
    return [
      { key: 'client', label: 'Client lié', done: hasClient, ctaLabel: 'Associer un client', href: `/app/pro/${businessId}/clients` },
      { key: 'deadline', label: 'Échéance définie', done: hasEndDate, ctaLabel: 'Définir la date', href: `/app/pro/${businessId}/projects/${projectId}/edit` },
      { key: 'services', label: 'Services ajoutés', done: hasServices, ctaLabel: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` },
      { key: 'tasks', label: 'Tâches générées/assignées', done: hasTasks, ctaLabel: 'Configurer les tâches', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` },
      { key: 'team', label: 'Équipe assignée', done: hasTeam, ctaLabel: 'Ajouter un membre', href: `/app/pro/${businessId}/projects/${projectId}?tab=team` },
      { key: 'docs', label: 'Dossier documents initial', done: hasDocs, ctaLabel: 'Ajouter un document', href: `/app/pro/${businessId}/projects/${projectId}?tab=files` },
    ];
  }, [businessId, project?.clientId, project?.endDate, projectId, services.length, tasks, members.length, documents.length]);

  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam && ['overview', 'work', 'team', 'billing', 'files'].includes(tabParam)) {
      setActiveTab(tabParam as typeof activeTab);
    }
  }, [searchParams]);

  const showSetup = (searchParams?.get('setup') ?? '') === '1';
  const upcomingTasks = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'DONE')
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
      .slice(0, 3);
  }, [tasks]);

  const servicesWithTasks = useMemo(() => {
    return services.map((service) => ({
      service,
      tasks: tasks.filter((t) => t.projectServiceId === service.id),
    }));
  }, [services, tasks]);

  useEffect(() => {
    if (project) {
      setSelectedClientId(project.clientId);
      setStartDateInput(project.startDate ? project.startDate.slice(0, 10) : '');
      setEndDateInput(project.endDate ? project.endDate.slice(0, 10) : '');
    }
  }, [project]);

  useEffect(() => {
    if (activeSetupModal === 'client') {
      setModalError(null);
      void loadClients();
    } else if (activeSetupModal === 'services') {
      setModalError(null);
      void loadCatalogServices();
    } else if (activeSetupModal === 'team') {
      setModalError(null);
      void loadMembers();
    } else if (activeSetupModal === 'tasks') {
      setModalError(null);
      void loadMembers();
      void loadTasks();
    } else if (activeSetupModal === 'documents') {
      setModalError(null);
      if (project?.clientId) {
        void loadDocuments(project.clientId);
      }
    }
  }, [activeSetupModal, loadClients, loadCatalogServices, loadMembers, loadTasks, loadDocuments, project?.clientId]);

  async function handleAttachClient() {
    if (!selectedClientId) {
      setModalError('Sélectionne un client.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({ clientId: selectedClientId });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de lier le client.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleUpdateDates() {
    if (startDateInput && endDateInput && new Date(endDateInput) < new Date(startDateInput)) {
      setModalError('La fin doit être après le début.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await patchProject({
      startDate: startDateInput || null,
      endDate: endDateInput || null,
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Impossible de mettre à jour les dates.');
      return;
    }
    await refetchAll();
    closeModal();
  }

  async function handleAddServices() {
    const entries = Object.entries(serviceSelections).filter(([, qty]) => qty > 0);
    if (!entries.length) {
      setModalError('Sélectionne au moins un service.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [serviceId, qty] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/projects/${projectId}/services`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serviceId, quantity: qty }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur service');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleAssignTasks() {
    const entries = Object.entries(taskAssignments).filter(([, memberId]) => memberId);
    if (!entries.length) {
      setModalError('Aucune assignation sélectionnée.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      for (const [taskId, memberId] of entries) {
        const res = await fetchJson(
          `/api/pro/businesses/${businessId}/tasks/${taskId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assigneeUserId: memberId }),
          }
        );
        if (!res.ok) {
          throw new Error(res.error ?? 'Erreur assignation');
        }
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteMember() {
    if (!inviteEmail) {
      setModalError('Email requis.');
      return;
    }
    setSaving(true);
    setModalError(null);
    const res = await fetchJson(`/api/pro/businesses/${businessId}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setSaving(false);
    if (!res.ok) {
      setModalError(res.error ?? 'Invitation impossible.');
      return;
    }
    setMembers((prev) => [...prev, { userId: `invite-${inviteEmail}`, email: inviteEmail, role: inviteRole }]);
    await refetchAll();
    closeModal();
  }

  async function handleUploadDocument() {
    if (!project?.clientId) {
      setModalError('Associe un client avant de déposer un document.');
      return;
    }
    if (!documentFile) {
      setModalError('Choisis un fichier.');
      return;
    }
    setSaving(true);
    setModalError(null);
    try {
      const form = new FormData();
      form.append('file', documentFile);
      form.append('title', `${documentKind} - ${documentFile.name}`);
      const res = await fetch(`/api/pro/businesses/${businessId}/clients/${project.clientId}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = (data as { error?: string } | null)?.error ?? 'Upload impossible.';
        throw new Error(msg);
      }
      await refetchAll();
      closeModal();
    } catch (err) {
      setModalError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <EmptyState title="Chargement..." description="Nous récupérons le projet." />;
  }
  if (error || !project) {
    return (
      <EmptyState
        title="Projet introuvable"
        description={error ?? 'Ce projet est indisponible.'}
        action={
          <Button asChild>
            <Link href={`/app/pro/${businessId}/projects`}>Retour aux projets</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/app/pro/${businessId}/projects`}>
              <ArrowLeft size={16} />
              Retour
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={`/app/pro/${businessId}/projects/${projectId}/edit`}>Modifier</Link>
            </Button>
          </div>
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">{project.name ?? `Projet #${projectId}`}</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {project.clientName ? `Client: ${project.clientName}` : 'Projet'} · Statut: {project.status ?? '—'} · Dates: {formatDate(project.startDate)} → {formatDate(project.endDate)}
        </p>
      </div>

      <KpiCirclesBlock items={kpis} />

      <TabsPills
        items={tabs}
        value={activeTab}
        onChange={(key) => setActiveTab(key as typeof activeTab)}
        ariaLabel="Onglets projet"
        className="-mx-1 px-1"
      />

      {activeTab === 'overview' ? (
        <div className="space-y-4">
          {showSetup ? (
            <ProjectSetupChecklist items={checklistItems} onAction={(key) => setActiveSetupModal(key as typeof activeSetupModal)} />
          ) : null}
          {!showSetup && checklistItems.some((it) => !it.done) ? (
            <ProjectSetupChecklist items={checklistItems} onAction={(key) => setActiveSetupModal(key as typeof activeSetupModal)} />
          ) : null}

          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Services inclus</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=work`}>Ouvrir Travail</Link>
              </Button>
            </div>
            {servicesWithTasks.length ? (
              <div className="space-y-3">
                {servicesWithTasks.map(({ service, tasks: svcTasks }) => (
                  <ServiceProgressRow
                    key={service.id}
                    service={{ id: service.id, name: service.service.name }}
                    tasks={svcTasks}
                    businessId={businessId}
                    projectId={projectId}
                  />
                ))}
              </div>
            ) : (
              <GuidedCtaCard
                title="Aucun service ajouté au projet."
                description="Ajoute des services pour structurer le travail et la facturation."
                primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` }}
              />
            )}
          </Card>

          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Prochaines actions</p>
              <Button asChild size="sm" variant="outline">
                <Link href={`/app/pro/${businessId}/projects/${projectId}?tab=work`}>Gérer les tâches</Link>
              </Button>
            </div>
            {upcomingTasks.length ? (
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[var(--text-primary)]">{task.title}</p>
                      <p className="text-[11px]">
                        {task.assigneeName || task.assigneeEmail || 'Non assigné'} · {task.status}
                      </p>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)]">{formatDate(task.dueDate)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <GuidedCtaCard
                title="Aucune tâche planifiée."
                description="Crée des tâches pour organiser le travail."
                primary={{ label: 'Créer une tâche', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` }}
              />
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <GuidedCtaCard
              title="Équipe"
              description="Ajoute un membre pour suivre les responsabilités."
              primary={{ label: 'Ajouter un membre', href: `/app/pro/${businessId}/projects/${projectId}?tab=team` }}
            />
            <GuidedCtaCard
              title="Activité récente"
              description="Aucune mise à jour récente."
              primary={{ label: 'Envoyer une mise à jour client', href: `/app/pro/${businessId}/clients` }}
            />
          </div>
        </div>
      ) : null}

      {activeTab === 'work' ? (
        <div className="space-y-4">
          <TabsPills
            items={[
              { key: 'TODO', label: 'À faire' },
              { key: 'IN_PROGRESS', label: 'En cours' },
              { key: 'DONE', label: 'Terminées' },
              { key: 'all', label: 'Toutes' },
            ]}
            value={statusFilter}
            onChange={(key) => setStatusFilter(key as typeof statusFilter)}
            ariaLabel="Filtrer tâches"
          />
          {servicesWithTasks.length ? (
            <div className="space-y-3">
              {servicesWithTasks.map(({ service, tasks: svcTasks }) => {
                const filteredTasks =
                  statusFilter === 'all' ? svcTasks : svcTasks.filter((t) => t.status === statusFilter);
                return (
                  <ServiceProgressRow
                    key={service.id}
                    service={{ id: service.id, name: service.service.name }}
                    tasks={filteredTasks}
                    businessId={businessId}
                    projectId={projectId}
                  />
                );
              })}
            </div>
          ) : (
            <GuidedCtaCard
              title="Aucune tâche configurée."
              description="Ajoute des services pour générer des tâches, ou crée-les manuellement."
              primary={{ label: 'Ajouter des services', href: `/app/pro/${businessId}/projects/${projectId}?tab=billing` }}
              secondary={{ label: 'Créer une tâche', href: `/app/pro/${businessId}/tasks?projectId=${projectId}` }}
            />
          )}
        </div>
      ) : null}

      {activeTab === 'team' ? (
        <GuidedCtaCard
          title="Aucun membre assigné."
          description="Ajoute un membre pour suivre les responsabilités."
          primary={{ label: 'Ajouter un membre', href: `/app/pro/${businessId}/settings/team` }}
          secondary={{ label: 'Définir responsables par service', href: `/app/pro/${businessId}/projects/${projectId}?tab=work` }}
        />
      ) : null}

      {activeTab === 'billing' ? (
        <div className="space-y-4">
          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Services du projet</p>
              <Button asChild size="sm">
                <Link href={`/app/pro/${businessId}/services`}>Ajouter depuis catalogue</Link>
              </Button>
            </div>
            {services.length ? (
              <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                {services.map((svc) => (
                  <div key={svc.id} className="flex items-center justify-between rounded-lg border border-[var(--border)]/60 bg-[var(--surface-2)]/70 px-3 py-2">
                    <span className="text-[var(--text-primary)]">{svc.service.name}</span>
                    <span>
                      x{svc.quantity} · {svc.priceCents ? formatCurrencyEUR(Number(svc.priceCents), { minimumFractionDigits: 0 }) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <GuidedCtaCard
                title="Ajoute des services pour générer un devis/facture."
                primary={{ label: 'Ajouter un service', href: `/app/pro/${businessId}/services` }}
              />
            )}
          </Card>

          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Devis</p>
              <Button size="sm" disabled={!services.length}>
                Créer un devis
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Aucun devis existant.</p>
          </Card>

          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Factures</p>
              <Button size="sm" disabled={!services.length}>
                Créer une facture
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Aucune facture pour le moment.</p>
          </Card>
        </div>
      ) : null}

      {activeTab === 'files' ? (
        <div className="space-y-3">
          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Administratif</p>
              <Button size="sm" variant="outline">
                Upload
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Aucun document administratif.</p>
          </Card>
          <Card className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Projet</p>
              <Button size="sm" variant="outline">
                Upload
              </Button>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">Aucun document projet pour l’instant.</p>
          </Card>
        </div>
      ) : null}

      <Modal
        open={activeSetupModal === 'client'}
        onCloseAction={closeModal}
        title="Associer un client"
        description="Sélectionne un client existant."
      >
        <div className="space-y-3">
          <Input
            placeholder="Rechercher un client"
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value);
              void loadClients(e.target.value);
            }}
          />
          <div className="max-h-64 space-y-2 overflow-auto">
            {clients.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-[var(--border)]/70 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{c.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{c.email ?? '—'}</p>
                </div>
                <input
                  type="radio"
                  name="client"
                  checked={selectedClientId === c.id}
                  onChange={() => setSelectedClientId(c.id)}
                />
              </label>
            ))}
          </div>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAttachClient} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Associer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'deadline'}
        onCloseAction={closeModal}
        title="Définir l’échéance"
        description="Renseigne les dates clés du projet."
      >
        <div className="space-y-3">
          <Input
            label="Début"
            type="date"
            value={startDateInput}
            onChange={(e) => setStartDateInput(e.target.value)}
          />
          <Input
            label="Fin"
            type="date"
            value={endDateInput}
            onChange={(e) => setEndDateInput(e.target.value)}
          />
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleUpdateDates} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'services'}
        onCloseAction={closeModal}
        title="Ajouter des services au projet"
        description="Sélectionne les services du catalogue."
      >
        <div className="space-y-3">
          <Input
            placeholder="Rechercher un service"
            value={serviceSearch}
            onChange={(e) => {
              setServiceSearch(e.target.value);
              void loadCatalogServices(e.target.value);
            }}
          />
          <div className="max-h-72 space-y-2 overflow-auto">
            {catalogServices.map((svc) => (
              <div
                key={svc.id}
                className="flex items-center justify-between rounded-lg border border-[var(--border)]/70 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{svc.service.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{svc.service.code}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={serviceSelections[svc.id] !== undefined}
                    onChange={(e) =>
                      setServiceSelections((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[svc.id] = next[svc.id] ?? 1;
                        else delete next[svc.id];
                        return next;
                      })
                    }
                  />
                  <Input
                    type="number"
                    className="w-20"
                    min={1}
                    value={serviceSelections[svc.id] ?? ''}
                    onChange={(e) =>
                      setServiceSelections((prev) => ({
                        ...prev,
                        [svc.id]: Number(e.target.value) || 0,
                      }))
                    }
                    placeholder="Qté"
                  />
                </div>
              </div>
            ))}
            {catalogServices.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Aucun service trouvé.</p> : null}
          </div>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAddServices} disabled={saving}>
              {saving ? 'Ajout…' : 'Ajouter au projet'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'tasks'}
        onCloseAction={closeModal}
        title="Configurer les tâches"
        description="Assigne rapidement les tâches existantes."
      >
        <div className="space-y-3">
          {services.length === 0 ? (
            <GuidedCtaCard
              title="Aucun service"
              description="Ajoute des services pour générer des tâches."
              primary={{ label: 'Ajouter des services', href: '#' }}
            />
          ) : null}
          <div className="space-y-2">
            {tasks.filter((t) => t.status !== 'DONE').slice(0, 10).map((task) => (
              <div key={task.id} className="rounded-lg border border-[var(--border)]/70 bg-[var(--surface-2)]/70 p-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{task.title}</p>
                <div className="mt-2 flex gap-2">
                  <Select
                    value={taskAssignments[task.id] ?? ''}
                    onChange={(e) =>
                      setTaskAssignments((prev) => ({ ...prev, [task.id]: e.target.value }))
                    }
                  >
                    <option value="">Non assigné</option>
                    {members.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.email}
                      </option>
                    ))}
                  </Select>
                  <Input
                    type="date"
                    value={task.dueDate ?? ''}
                    onChange={(e) =>
                      void fetchJson(`/api/pro/businesses/${businessId}/tasks/${task.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dueDate: e.target.value }),
                      })
                    }
                  />
                </div>
              </div>
            ))}
            {tasks.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">Aucune tâche.</p> : null}
          </div>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleAssignTasks} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'team'}
        onCloseAction={closeModal}
        title="Ajouter des membres"
        description="Invite un membre de l’entreprise."
      >
        <div className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <Select label="Rôle" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
            <option value="MEMBER">Membre</option>
            <option value="VIEWER">Viewer</option>
            <option value="ADMIN">Admin</option>
          </Select>
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleInviteMember} disabled={saving}>
              {saving ? 'Invitation…' : 'Inviter'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={activeSetupModal === 'documents'}
        onCloseAction={closeModal}
        title="Ajouter un document"
        description={project?.clientId ? 'Charge un document lié au client.' : 'Associe d’abord un client.'}
      >
        <div className="space-y-3">
          <Select
            label="Catégorie"
            value={documentKind}
            onChange={(e) => setDocumentKind(e.target.value as 'Administratif' | 'Projet')}
          >
            <option value="Administratif">Administratif</option>
            <option value="Projet">Projet</option>
          </Select>
          <input
            type="file"
            onChange={(e) => setDocumentFile(e.target.files?.[0] ?? null)}
            className="text-sm text-[var(--text-secondary)]"
          />
          {modalError ? <p className="text-sm text-rose-500">{modalError}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeModal}>
              Annuler
            </Button>
            <Button onClick={handleUploadDocument} disabled={saving || !project?.clientId}>
              {saving ? 'Upload…' : 'Uploader'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
