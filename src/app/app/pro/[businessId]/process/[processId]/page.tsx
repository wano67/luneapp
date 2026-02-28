'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import RoleBanner from '@/components/RoleBanner';
import { PageHeader } from '../../../../components/PageHeader';

type ProcessStatus = 'ACTIVE' | 'ARCHIVED';

type ProcessStep = {
  id: string;
  processId: string;
  title: string;
  description: string | null;
  position: number;
  isDone: boolean;
  createdAt: string;
  updatedAt: string;
};

type Process = {
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  status: ProcessStatus;
  createdAt: string;
  updatedAt: string;
  steps: ProcessStep[];
};

type ProcessDetailResponse = { item: Process };
type StepDetailResponse = { item: ProcessStep };

const STATUS_LABELS: Record<ProcessStatus, string> = {
  ACTIVE: 'Actif',
  ARCHIVED: 'Archivé',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR').format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProcessDetailPage() {
  const params = useParams();
  const router = useRouter();
  const businessId = (params?.businessId ?? '') as string;
  const processId = (params?.processId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const actorRole = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = actorRole === 'OWNER' || actorRole === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [process, setProcess] = useState<Process | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [stepForm, setStepForm] = useState({ title: '', description: '', position: '' });
  const [editingStep, setEditingStep] = useState<ProcessStep | null>(null);
  const [stepSaving, setStepSaving] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const orderedSteps = useMemo(() => {
    return [...(process?.steps ?? [])].sort((a, b) => a.position - b.position);
  }, [process]);

  function updateForm<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateStepForm<K extends keyof typeof stepForm>(key: K, value: (typeof stepForm)[K]) {
    setStepForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadProcess() {
    try {
      setLoading(true);
      setError(null);
      setInfo(null);
      const res = await fetchJson<ProcessDetailResponse>(
        `/api/pro/businesses/${businessId}/processes/${processId}`
      );
      setRequestId(res.requestId);
      if (!res.ok || !res.data) {
        setError(
          res.requestId
            ? `${res.error ?? 'Process introuvable.'} (Ref: ${res.requestId})`
            : res.error ?? 'Process introuvable.'
        );
        setProcess(null);
        return;
      }
      setProcess(res.data.item);
      setForm({
        name: res.data.item.name,
        description: res.data.item.description ?? '',
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, processId]);

  async function handleUpdateProcess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setActionError(readOnlyMessage);
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setSaving(true);
    setActionError(null);
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setActionError('Le nom est requis.');
      setSaving(false);
      return;
    }
    const payload: Record<string, unknown> = {
      name: trimmedName,
      description: form.description.trim() ? form.description.trim() : null,
    };

    const res = await fetchJson<ProcessDetailResponse>(
      `/api/pro/businesses/${businessId}/processes/${processId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Mise à jour impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Mise à jour impossible.'
      );
      setSaving(false);
      return;
    }

    setProcess(res.data.item);
    setInfo('Process mis à jour.');
    setSaving(false);
    setEditOpen(false);
  }

  async function handleArchiveToggle() {
    if (!process) return;
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    const targetArchived = process.status === 'ACTIVE';
    const res = await fetchJson<ProcessDetailResponse>(
      `/api/pro/businesses/${businessId}/processes/${processId}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ archived: targetArchived }),
      }
    );
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
      );
      return;
    }

    setProcess(res.data.item);
    setInfo(targetArchived ? 'Process archivé.' : 'Process réactivé.');
  }

  async function handleDeleteProcess() {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    const confirmed = window.confirm('Supprimer ce process ? Les étapes seront perdues.');
    if (!confirmed) return;

    const res = await fetchJson<null>(`/api/pro/businesses/${businessId}/processes/${processId}`, {
      method: 'DELETE',
    });
    setRequestId(res.requestId);

    if (!res.ok) {
      setActionError(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setInfo('Process supprimé.');
    router.push(`/app/pro/${businessId}/process`);
  }

  async function handleSubmitStep(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      setStepError(readOnlyMessage);
      return;
    }
    setStepSaving(true);
    setStepError(null);
    const trimmedTitle = stepForm.title.trim();
    if (!trimmedTitle) {
      setStepError('Le titre est requis.');
      setStepSaving(false);
      return;
    }
    const payload: Record<string, unknown> = {
      title: trimmedTitle,
      description: stepForm.description.trim() ? stepForm.description.trim() : null,
    };
    if (stepForm.position.trim()) {
      const parsed = Number(stepForm.position);
      if (!Number.isInteger(parsed)) {
        setStepError('Position doit être un entier.');
        setStepSaving(false);
        return;
      }
      if (parsed < 0 || parsed > 10000) {
        setStepError('Position doit être comprise entre 0 et 10000.');
        setStepSaving(false);
        return;
      }
      payload.position = parsed;
    }

    const endpoint = editingStep
      ? `/api/pro/businesses/${businessId}/processes/${processId}/steps/${editingStep.id}`
      : `/api/pro/businesses/${businessId}/processes/${processId}/steps`;
    const method = editingStep ? 'PATCH' : 'POST';

    const res = await fetchJson<StepDetailResponse>(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      setStepError(
        res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
      );
      setStepSaving(false);
      return;
    }

    await loadProcess();
    setStepSaving(false);
    setStepModalOpen(false);
    setStepForm({ title: '', description: '', position: '' });
    setEditingStep(null);
    setInfo(editingStep ? 'Étape mise à jour.' : 'Étape ajoutée.');
  }

  async function toggleDone(step: ProcessStep) {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    const res = await fetchJson<StepDetailResponse>(
      `/api/pro/businesses/${businessId}/processes/${processId}/steps/${step.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: !step.isDone }),
      }
    );
    setRequestId(res.requestId);
    if (!res.ok || !res.data) {
      setActionError(
        res.requestId ? `${res.error ?? 'Action impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Action impossible.'
      );
      return;
    }
    setProcess((prev) =>
      prev
        ? {
            ...prev,
            steps: prev.steps
              .map((s) => (s.id === step.id ? res.data!.item : s))
              .sort((a, b) => a.position - b.position),
          }
        : prev
    );
  }

  async function deleteStep(step: ProcessStep) {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    const confirmed = window.confirm(`Supprimer l’étape « ${step.title} » ?`);
    if (!confirmed) return;

    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/processes/${processId}/steps/${step.id}`,
      { method: 'DELETE' }
    );
    setRequestId(res.requestId);
    if (!res.ok) {
      setActionError(
        res.requestId ? `${res.error ?? 'Suppression impossible.'} (Ref: ${res.requestId})` : res.error ?? 'Suppression impossible.'
      );
      return;
    }
    setProcess((prev) =>
      prev ? { ...prev, steps: prev.steps.filter((s) => s.id !== step.id) } : prev
    );
    setInfo('Étape supprimée.');
  }

  function openStepModal(step?: ProcessStep) {
    if (step) {
      setEditingStep(step);
      setStepForm({
        title: step.title,
        description: step.description ?? '',
        position: step.position.toString(),
      });
    } else {
      setEditingStep(null);
      setStepForm({ title: '', description: '', position: '' });
    }
    setStepError(null);
    setStepModalOpen(true);
  }

  return (
    <div className="space-y-5">
      <RoleBanner role={actorRole} />
      <PageHeader
        backHref={`/app/pro/${businessId}/process`}
        backLabel="Process"
        title={process?.name ?? `Process #${processId}`}
        subtitle={process?.description ?? 'Suivi des étapes et de l’exécution'}
        primaryAction={
          isAdmin
            ? {
                label: 'Ajouter une étape',
                onClick: () => openStepModal(),
              }
            : undefined
        }
        secondaryAction={
          isAdmin
            ? {
                label: 'Modifier',
                onClick: () => {
                  if (!process) return;
                  setEditOpen(true);
                },
                variant: 'outline',
              }
            : undefined
        }
      />

      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="neutral"
              className={
                process?.status === 'ACTIVE'
                  ? 'bg-[var(--success-bg)] text-[var(--success)]'
                  : 'bg-[var(--surface-2)] text-[var(--text)]'
              }
            >
              {process ? STATUS_LABELS[process.status] : '—'}
            </Badge>
            <p className="text-xs text-[var(--text-secondary)]">
              Créé le {formatDate(process?.createdAt ?? null)} · Dernière mise à jour {formatDate(process?.updatedAt ?? null)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleArchiveToggle} disabled={!isAdmin}>
              {process?.status === 'ARCHIVED' ? 'Désarchiver' : 'Archiver'}
            </Button>
            <Button variant="danger" onClick={handleDeleteProcess} disabled={!isAdmin}>
              Supprimer
            </Button>
          </div>
        </div>
        {requestId ? (
          <p className="text-[10px] text-[var(--text-secondary)]">Request ID: {requestId}</p>
        ) : null}
        {info ? <p className="text-xs text-[var(--success)]">{info}</p> : null}
        {error ? <p className="text-xs text-[var(--danger)]">{error}</p> : null}
        {actionError ? <p className="text-xs text-[var(--danger)]">{actionError}</p> : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}
      </Card>

      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Étapes</h2>
          <Button size="sm" variant="outline" onClick={() => openStepModal()} disabled={!isAdmin}>
            Nouvelle étape
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titre</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedSteps.length === 0 ? (
                <TableEmpty>Aucune étape.</TableEmpty>
              ) : (
                orderedSteps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold text-[var(--text-primary)]">{step.title}</p>
                        {step.description ? (
                          <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                            {step.description}
                          </p>
                        ) : null}
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Créé le {formatDate(step.createdAt)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{step.position}</TableCell>
                    <TableCell>
                      <Badge
                        variant="neutral"
                        className={
                          step.isDone ? 'bg-[var(--success-bg)] text-[var(--success)]' : 'bg-[var(--warning-bg)] text-[var(--warning)]'
                        }
                      >
                        {step.isDone ? 'Fait' : 'À faire'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openStepModal(step)} disabled={!isAdmin}>
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleDone(step)}
                          disabled={!isAdmin}
                        >
                          {step.isDone ? 'Repasser en cours' : 'Marquer fait'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => deleteStep(step)}
                          disabled={!isAdmin}
                        >
                          Supprimer
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="p-5">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Historique</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Créé le {formatDate(process?.createdAt ?? null)} · Dernière mise à jour {formatDate(process?.updatedAt ?? null)}
          </p>
        </div>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Les process sont partagés par business. Les étapes sont globales (MVP) et non encore projet-spécifique.
        </p>
        <p className="mt-1 text-sm">
          <Link href={`/app/pro/${businessId}/projects`} className="text-blue-600 hover:underline">
            Aller aux projets
          </Link>
        </p>
      </Card>

      <Modal
        open={editOpen}
        onCloseAction={() => {
          if (saving) return;
          setEditOpen(false);
          setActionError(null);
        }}
        title="Modifier le process"
        description="Met à jour le nom et la description."
      >
        <form onSubmit={handleUpdateProcess} className="space-y-3">
          <Input
            label="Nom"
            value={form.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateForm('name', e.target.value)}
            error={actionError ?? undefined}
          />
          <label className="space-y-1">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Description</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
              rows={3}
              value={form.description}
              onChange={(e) => updateForm('description', e.target.value)}
              placeholder="Détails, livrables, règles internes…"
            />
          </label>
          <div className="flex items-center justify-between">
            {actionError ? <p className="text-xs text-[var(--danger)]">{actionError}</p> : null}
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : modification bloquée.</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setEditOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving || !isAdmin}>
                {saving ? 'Enregistrement…' : 'Mettre à jour'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={stepModalOpen}
        onCloseAction={() => {
          if (stepSaving) return;
          setStepModalOpen(false);
          setStepError(null);
          setEditingStep(null);
        }}
        title={editingStep ? 'Modifier une étape' : 'Nouvelle étape'}
        description="Titre, position et détails de l’étape."
      >
        <form onSubmit={handleSubmitStep} className="space-y-3">
          <Input
            label="Titre"
            value={stepForm.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) => updateStepForm('title', e.target.value)}
            error={stepError ?? undefined}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Position"
              type="number"
              value={stepForm.position}
              onChange={(e: ChangeEvent<HTMLInputElement>) => updateStepForm('position', e.target.value)}
              placeholder="Ordre (optionnel)"
            />
            <div className="space-y-1">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Description</span>
              <textarea
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400/60"
                rows={3}
                value={stepForm.description}
                onChange={(e) => updateStepForm('description', e.target.value)}
                placeholder="Détails ou critères d’acceptation."
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            {stepError ? <p className="text-xs text-[var(--danger)]">{stepError}</p> : null}
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">Lecture seule : modification bloquée.</p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => setStepModalOpen(false)} disabled={stepSaving}>
                Annuler
              </Button>
              <Button type="submit" disabled={stepSaving || !isAdmin}>
                {stepSaving ? 'Enregistrement…' : editingStep ? 'Mettre à jour' : 'Ajouter'}
              </Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
