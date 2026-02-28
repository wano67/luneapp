"use client";

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';

// ─── Local types ──────────────────────────────────────────────────────────────

type TaskPhase = 'CADRAGE' | 'UX' | 'DESIGN' | 'DEV' | 'SEO' | 'LAUNCH' | 'FOLLOW_UP' | null;

type ServiceTemplate = {
  id: string;
  serviceId: string;
  phase: TaskPhase;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
  createdAt: string;
};

type TemplateFormState = {
  title: string;
  phase: string;
  defaultAssigneeRole: string;
  defaultDueOffsetDays: string;
};

type Service = { id: string; code: string; name: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const PHASE_ORDER: TaskPhase[] = ['CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP', null];

const emptyTemplateForm: TemplateFormState = {
  title: '',
  phase: '',
  defaultAssigneeRole: '',
  defaultDueOffsetDays: '',
};

function phaseLabel(phase: TaskPhase) {
  switch (phase) {
    case 'CADRAGE': return 'Cadrage';
    case 'UX': return 'UX';
    case 'DESIGN': return 'Design';
    case 'DEV': return 'Dev';
    case 'SEO': return 'SEO';
    case 'LAUNCH': return 'Lancement';
    case 'FOLLOW_UP': return 'Suivi';
    default: return 'Sans phase';
  }
}

function sortTemplates(list: ServiceTemplate[]) {
  const order = (phase: TaskPhase) => {
    const idx = PHASE_ORDER.findIndex((p) => p === phase);
    return idx === -1 ? PHASE_ORDER.length : idx;
  };
  return [...list].sort((a, b) => {
    const diff = order(a.phase) - order(b.phase);
    if (diff !== 0) return diff;
    return a.title.localeCompare(b.title);
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  service: Service | null;
  businessId: string;
  isAdmin: boolean;
  onClose: () => void;
  onTemplateCountChange: (serviceId: string, count: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceTemplatesModal({
  open,
  service,
  businessId,
  isAdmin,
  onClose,
  onTemplateCountChange,
}: Props) {
  const fetchController = useRef<AbortController | null>(null);

  const [templates, setTemplates] = useState<ServiceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [templateRequestId, setTemplateRequestId] = useState<string | null>(null);
  const [templateFormVisible, setTemplateFormVisible] = useState(false);
  const [templateForm, setTemplateForm] = useState<TemplateFormState>(emptyTemplateForm);
  const [editingTemplate, setEditingTemplate] = useState<ServiceTemplate | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateFormError, setTemplateFormError] = useState<string | null>(null);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  const readOnlyMessage = 'Action réservée aux admins/owners.';

  useEffect(() => {
    if (open && service) handleOpenModal(service);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, service?.id]);

  async function loadTemplates(svc: Service, signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }
    try {
      setTemplatesLoading(true);
      setTemplateError(null);
      setTemplateRequestId(null);
      const res = await fetchJson<{ items: ServiceTemplate[] }>(
        `/api/pro/businesses/${businessId}/services/${svc.id}/templates`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setTemplateRequestId(res.requestId);
      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }
      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les templates.';
        setTemplateError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setTemplates([]);
        return;
      }
      const sorted = sortTemplates(res.data.items);
      setTemplates(sorted);
      setSeedMessage(null);
      setTemplateFormVisible(sorted.length === 0);
      onTemplateCountChange(svc.id, sorted.length);
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setTemplateError('Chargement impossible.');
      setTemplates([]);
    } finally {
      if (!effectiveSignal?.aborted) setTemplatesLoading(false);
    }
  }

  function handleOpenModal(svc: Service) {
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setSeedMessage(null);
    setTemplateError(null);
    setTemplateRequestId(null);
    setEditingTemplate(null);
    setTemplateFormVisible(false);
    void loadTemplates(svc);
  }

  // Called via useEffect in parent when `open` + `service` change
  // Exposed via the onOpen pattern below — see JSX open prop handler

  function handleClose() {
    if (templateSaving || seedingTemplates) return;
    fetchController.current?.abort();
    setTemplates([]);
    setEditingTemplate(null);
    setTemplateFormVisible(false);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setTemplateError(null);
    setSeedMessage(null);
    onClose();
  }

  function startCreateTemplate() {
    if (!isAdmin) { setTemplateFormError(readOnlyMessage); return; }
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setTemplateFormVisible(true);
  }

  function startEditTemplate(template: ServiceTemplate) {
    if (!isAdmin) { setTemplateFormError(readOnlyMessage); return; }
    setEditingTemplate(template);
    setTemplateForm({
      title: template.title,
      phase: template.phase ?? '',
      defaultAssigneeRole: template.defaultAssigneeRole ?? '',
      defaultDueOffsetDays: template.defaultDueOffsetDays != null ? String(template.defaultDueOffsetDays) : '',
    });
    setTemplateFormError(null);
    setTemplateFormVisible(true);
  }

  async function submitTemplate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) { setTemplateFormError(readOnlyMessage); return; }
    if (!service) return;
    setTemplateFormError(null);
    setTemplateSaving(true);
    setSeedMessage(null);

    const title = templateForm.title.trim();
    if (!title) {
      setTemplateFormError('Titre requis.');
      setTemplateSaving(false);
      return;
    }

    const offsetStr = templateForm.defaultDueOffsetDays.trim();
    let offsetVal: number | null = null;
    if (offsetStr) {
      const parsed = Number(offsetStr);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 365 || !Number.isInteger(parsed)) {
        setTemplateFormError('Offset jours entre 0 et 365 (entier).');
        setTemplateSaving(false);
        return;
      }
      offsetVal = parsed;
    }

    const payload: Record<string, unknown> = {
      title,
      phase: templateForm.phase || null,
      defaultAssigneeRole: templateForm.defaultAssigneeRole.trim() || null,
      defaultDueOffsetDays: offsetStr ? offsetVal : null,
    };

    const isEdit = Boolean(editingTemplate);
    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/services/${service.id}/templates/${editingTemplate?.id}`
      : `/api/pro/businesses/${businessId}/services/${service.id}/templates`;

    const res = await fetchJson<ServiceTemplate>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setTemplateRequestId(res.requestId);

    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      setTemplateSaving(false);
      return;
    }

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de sauvegarder le template.';
      setTemplateFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setTemplateSaving(false);
      return;
    }

    setTemplates((prev) => {
      const updated = isEdit ? prev.map((tpl) => (tpl.id === res.data!.id ? res.data! : tpl)) : [...prev, res.data!];
      const sorted = sortTemplates(updated);
      onTemplateCountChange(service.id, sorted.length);
      return sorted;
    });
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormVisible(!isEdit);
    setTemplateSaving(false);
    setTemplateFormError(null);
  }

  async function deleteTemplate(template: ServiceTemplate) {
    if (!service) return;
    if (!isAdmin) { setTemplateError(readOnlyMessage); return; }
    if (!window.confirm(`Supprimer "${template.title}" ?`)) return;
    setTemplateError(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/services/${service.id}/templates/${template.id}`,
      { method: 'DELETE' }
    );
    setTemplateRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      return;
    }
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setTemplateError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setTemplates((prev) => {
      const updated = prev.filter((tpl) => tpl.id !== template.id);
      onTemplateCountChange(service.id, updated.length);
      if (updated.length === 0) setTemplateFormVisible(true);
      return updated;
    });
  }

  async function seedTemplates() {
    if (!service) return;
    if (!isAdmin) { setTemplateError(readOnlyMessage); return; }
    setTemplateFormError(null);
    setTemplateError(null);
    setSeedMessage(null);
    setSeedingTemplates(true);
    const res = await fetchJson<{ createdCount: number; skippedCount: number }>(
      `/api/pro/businesses/${businessId}/services/${service.id}/templates/seed`,
      { method: 'POST' }
    );
    setTemplateRequestId(res.requestId);
    if (res.status === 401) {
      const from = window.location.pathname + window.location.search;
      window.location.href = `/login?from=${encodeURIComponent(from)}`;
      setSeedingTemplates(false);
      return;
    }
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Seed impossible.';
      setTemplateError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSeedingTemplates(false);
      return;
    }
    setSeedMessage(`Pack appliqué : +${res.data.createdCount} · ${res.data.skippedCount} déjà présents.`);
    await loadTemplates(service);
    setSeedingTemplates(false);
  }

  return (
    <Modal
      open={open}
      onCloseAction={handleClose}
      title={`Gérer templates${service ? ` · ${service.code}` : ''}`}
      description="Ces templates deviennent les tâches générées automatiquement quand le service est ajouté à un projet."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Templates de tâches</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Phase, délai par défaut et rôle attendu pour guider l&apos;équipe.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!templateFormVisible ? (
              <Button size="sm" onClick={startCreateTemplate} disabled={!isAdmin}>
                Ajouter un template
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={seedTemplates}
              disabled={seedingTemplates || !isAdmin}
            >
              {seedingTemplates ? 'Ajout du pack…' : 'Ajouter pack standard (7)'}
            </Button>
          </div>
        </div>

        {templateError ? <p className="text-xs font-semibold text-[var(--danger)]">{templateError}</p> : null}
        {seedMessage ? <p className="text-xs text-[var(--success)]">{seedMessage}</p> : null}
        {!isAdmin ? (
          <p className="text-[11px] text-[var(--text-secondary)]">
            Lecture seule : modification des templates réservée aux admins/owners.
          </p>
        ) : null}

        {templatesLoading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement des templates…</p>
        ) : templates.length === 0 ? (
          <Card className="space-y-3 border-dashed border-[var(--border)] bg-transparent p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Aucun template → ce service ne générera pas de tâches lors de l&apos;ajout au projet.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={seedTemplates}
                disabled={seedingTemplates || !isAdmin}
              >
                {seedingTemplates ? 'Ajout du pack…' : 'Ajouter le pack standard'}
              </Button>
              {!templateFormVisible ? (
                <Button size="sm" onClick={startCreateTemplate} disabled={!isAdmin}>
                  Ajouter un template
                </Button>
              ) : null}
            </div>
          </Card>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]/60 p-3 md:flex-row md:items-center md:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="neutral">{phaseLabel(tpl.phase)}</Badge>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{tpl.title}</p>
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    {tpl.defaultDueOffsetDays != null ? `J+${tpl.defaultDueOffsetDays}` : "Pas d\u2019\u00e9ch\u00e9ance auto"}
                    {tpl.defaultAssigneeRole ? ` · ${tpl.defaultAssigneeRole}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => startEditTemplate(tpl)} disabled={!isAdmin}>
                    Modifier
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => deleteTemplate(tpl)} disabled={!isAdmin}>
                    Supprimer
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {templateFormVisible ? (
          <form
            onSubmit={submitTemplate}
            className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4"
          >
            <Input
              label="Titre du template"
              required
              value={templateForm.title}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Kickoff & objectifs"
              disabled={!isAdmin}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Phase"
                value={templateForm.phase}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, phase: e.target.value }))}
                disabled={!isAdmin}
              >
                <option value="">Sans phase</option>
                {PHASE_ORDER.filter(Boolean).map((phase) => (
                  <option key={phase ?? 'none'} value={phase ?? ''}>
                    {phaseLabel(phase)}
                  </option>
                ))}
              </Select>
              <Input
                label="Rôle assigné (optionnel)"
                value={templateForm.defaultAssigneeRole}
                onChange={(e) => setTemplateForm((prev) => ({ ...prev, defaultAssigneeRole: e.target.value }))}
                placeholder="PM / UX / Tech lead…"
                disabled={!isAdmin}
              />
            </div>
            <Input
              label="Échéance relative (J+)"
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={templateForm.defaultDueOffsetDays}
              onChange={(e) => setTemplateForm((prev) => ({ ...prev, defaultDueOffsetDays: e.target.value }))}
              placeholder="0 = le jour du start"
              disabled={!isAdmin}
            />
            {templateFormError ? <p className="text-xs font-semibold text-[var(--danger)]">{templateFormError}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplateFormVisible(false);
                  setEditingTemplate(null);
                  setTemplateForm(emptyTemplateForm);
                }}
                disabled={templateSaving}
              >
                Fermer
              </Button>
              <Button type="submit" disabled={templateSaving || !isAdmin}>
                {templateSaving ? 'Enregistrement…' : editingTemplate ? 'Mettre à jour' : 'Ajouter un template'}
              </Button>
            </div>
          </form>
        ) : null}

        {templateRequestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {templateRequestId}</p>
        ) : null}
      </div>
    </Modal>
  );
}
