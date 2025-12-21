// src/app/app/pro/[businessId]/services/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableEmpty, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import RoleBanner from '@/components/RoleBanner';
import { useActiveBusiness } from '../../ActiveBusinessProvider';
import { ReferencePicker } from '../references/ReferencePicker';

type Service = {
  id: string;
  businessId: string;
  code: string;
  name: string;
  categoryReferenceId: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: { id: string; name: string }[];
  type: string | null;
  description: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
  vatRate: number | null;
  createdAt: string;
  updatedAt: string;
  templateCount?: number;
};

type ServiceListResponse = { items: Service[] };
type ServiceItemResponse = { item: Service };

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

type TemplateListResponse = { items: ServiceTemplate[] };

type TemplateFormState = {
  title: string;
  phase: string;
  defaultAssigneeRole: string;
  defaultDueOffsetDays: string;
};

type ServiceFormState = {
  code: string;
  name: string;
  type: string;
  defaultPrice: string;
  tjm: string;
  durationHours: string;
  vatRate: string;
  description: string;
  categoryReferenceId: string;
  tagReferenceIds: string[];
};

const emptyTemplateForm: TemplateFormState = {
  title: '',
  phase: '',
  defaultAssigneeRole: '',
  defaultDueOffsetDays: '',
};

const emptyForm: ServiceFormState = {
  code: '',
  name: '',
  type: '',
  defaultPrice: '',
  tjm: '',
  durationHours: '',
  vatRate: '',
  description: '',
  categoryReferenceId: '',
  tagReferenceIds: [],
};

function formatMoney(cents: string | null) {
  if (!cents) return '—';
  const num = Number(cents);
  if (Number.isNaN(num)) return '—';
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(num / 100);
  } catch {
    return `${(num / 100).toFixed(0)} €`;
  }
}

function formatHours(value: number | null) {
  if (value == null) return '—';
  return `${value} h`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

const PHASE_ORDER: TaskPhase[] = ['CADRAGE', 'UX', 'DESIGN', 'DEV', 'SEO', 'LAUNCH', 'FOLLOW_UP', null];

function phaseLabel(phase: TaskPhase) {
  switch (phase) {
    case 'CADRAGE':
      return 'Cadrage';
    case 'UX':
      return 'UX';
    case 'DESIGN':
      return 'Design';
    case 'DEV':
      return 'Dev';
    case 'SEO':
      return 'SEO';
    case 'LAUNCH':
      return 'Lancement';
    case 'FOLLOW_UP':
      return 'Suivi';
    default:
      return 'Sans phase';
  }
}

export default function ServicesPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'OWNER' || role === 'ADMIN';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [categoryOptions, setCategoryOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [tagOptions, setTagOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [referenceRequestId, setReferenceRequestId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [templatesService, setTemplatesService] = useState<Service | null>(null);
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
  const [readOnlyInfo, setReadOnlyInfo] = useState<string | null>(null);

  const fetchController = useRef<AbortController | null>(null);
  const templateFetchController = useRef<AbortController | null>(null);

  const typeOptions = useMemo(() => {
    const values = new Set<string>();
    services.forEach((s) => {
      if (s.type) values.add(s.type);
    });
    return Array.from(values);
  }, [services]);

  async function loadReferenceOptions(signal?: AbortSignal) {
    try {
      setReferenceError(null);
      setReferenceRequestId(null);
      const [catRes, tagRes] = await Promise.all([
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
          {},
          signal
        ),
        fetchJson<{ items: Array<{ id: string; name: string }> }>(
          `/api/pro/businesses/${businessId}/references?type=TAG`,
          {},
          signal
        ),
      ]);
      if (signal?.aborted) return;
      setReferenceRequestId(catRes.requestId || tagRes.requestId || null);
      if (!catRes.ok || !tagRes.ok || !catRes.data || !tagRes.data) {
        const msg = catRes.error || tagRes.error || 'Impossible de charger les références.';
        setReferenceError(catRes.requestId || tagRes.requestId ? `${msg} (Ref: ${catRes.requestId || tagRes.requestId})` : msg);
        return;
      }
      setCategoryOptions(catRes.data.items);
      setTagOptions(tagRes.data.items);
    } catch (err) {
      if (signal?.aborted) return;
      setReferenceError(getErrorMessage(err));
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

  async function loadServices(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      fetchController.current?.abort();
      fetchController.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      setRequestId(null);

      const paramsQuery = new URLSearchParams();
      if (search.trim()) paramsQuery.set('q', search.trim());
      if (typeFilter !== 'ALL') paramsQuery.set('type', typeFilter);
      if (categoryFilter) paramsQuery.set('categoryReferenceId', categoryFilter);
      if (tagFilter) paramsQuery.set('tagReferenceId', tagFilter);

      const res = await fetchJson<ServiceListResponse>(
        `/api/pro/businesses/${businessId}/services${paramsQuery.toString() ? `?${paramsQuery.toString()}` : ''}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);

      if (res.status === 401) {
        const from = window.location.pathname + window.location.search;
        window.location.href = `/login?from=${encodeURIComponent(from)}`;
        return;
      }

      if (!res.ok || !res.data) {
        const msg = res.error ?? 'Impossible de charger les services.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setServices([]);
        return;
      }

      setServices(
        res.data.items.map((item) => ({
          ...item,
          tagReferences: item.tagReferences ?? [],
          templateCount: item.templateCount ?? 0,
        }))
      );
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setError(getErrorMessage(err));
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  async function loadTemplates(service: Service, signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      templateFetchController.current?.abort();
      templateFetchController.current = controller;
    }

    try {
      setTemplatesLoading(true);
      setTemplateError(null);
      setTemplateRequestId(null);

      const res = await fetchJson<TemplateListResponse>(
        `/api/pro/businesses/${businessId}/services/${service.id}/templates`,
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
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, templateCount: sorted.length } : s))
      );
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      console.error(err);
      setTemplateError(getErrorMessage(err));
      setTemplates([]);
    } finally {
      if (!effectiveSignal?.aborted) setTemplatesLoading(false);
    }
  }

  function openTemplates(service: Service) {
    setTemplatesService(service);
    setTemplatesModalOpen(true);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setSeedMessage(null);
    setTemplateError(null);
    setTemplateRequestId(null);
    setEditingTemplate(null);
    setTemplateFormVisible(false);
    void loadTemplates(service);
  }

  function closeTemplates() {
    if (templateSaving || seedingTemplates) return;
    templateFetchController.current?.abort();
    setTemplatesModalOpen(false);
    setTemplatesService(null);
    setTemplates([]);
    setEditingTemplate(null);
    setTemplateFormVisible(false);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setTemplateError(null);
    setSeedMessage(null);
  }

  function startCreateTemplate() {
    if (!isAdmin) {
      setTemplateFormError(readOnlyMessage);
      return;
    }
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormError(null);
    setTemplateFormVisible(true);
  }

  function startEditTemplate(template: ServiceTemplate) {
    if (!isAdmin) {
      setTemplateFormError(readOnlyMessage);
      return;
    }
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
    if (!isAdmin) {
      setTemplateFormError(readOnlyMessage);
      return;
    }
    if (!templatesService) return;
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
      ? `/api/pro/businesses/${businessId}/services/${templatesService.id}/templates/${editingTemplate?.id}`
      : `/api/pro/businesses/${businessId}/services/${templatesService.id}/templates`;

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
      setServices((prevServices) =>
        prevServices.map((s) =>
          s.id === templatesService.id ? { ...s, templateCount: sorted.length } : s
        )
      );
      return sorted;
    });
    setEditingTemplate(null);
    setTemplateForm(emptyTemplateForm);
    setTemplateFormVisible(!isEdit);
    setTemplateSaving(false);
    setTemplateFormError(null);
  }

  async function deleteTemplate(template: ServiceTemplate) {
    if (!templatesService) return;
    if (!isAdmin) {
      setTemplateError(readOnlyMessage);
      return;
    }
    if (!window.confirm(`Supprimer "${template.title}" ?`)) return;
    setTemplateError(null);
    const res = await fetchJson<{ ok: boolean }>(
      `/api/pro/businesses/${businessId}/services/${templatesService.id}/templates/${template.id}`,
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
      setServices((prevServices) =>
        prevServices.map((s) =>
          s.id === templatesService.id ? { ...s, templateCount: updated.length } : s
        )
      );
      if (updated.length === 0) setTemplateFormVisible(true);
      return updated;
    });
  }

  async function seedTemplates() {
    if (!templatesService) return;
    if (!isAdmin) {
      setTemplateError(readOnlyMessage);
      return;
    }
    setTemplateFormError(null);
    setTemplateError(null);
    setSeedMessage(null);
    setSeedingTemplates(true);
    const res = await fetchJson<{ createdCount: number; skippedCount: number }>(
      `/api/pro/businesses/${businessId}/services/${templatesService.id}/templates/seed`,
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
    await loadTemplates(templatesService);
    setSeedingTemplates(false);
  }

  useEffect(() => {
    void loadServices();
    return () => {
      fetchController.current?.abort();
      templateFetchController.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, typeFilter, categoryFilter, tagFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void loadReferenceOptions(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setFormError(readOnlyMessage);
      setSaving(false);
      setInfo(readOnlyMessage);
      return;
    }
    setFormError(null);
    setSaving(true);
    setInfo(null);

    const priceNum = form.defaultPrice.trim() ? Number(form.defaultPrice) : null;
    const tjmNum = form.tjm.trim() ? Number(form.tjm) : null;
    const durationNum = form.durationHours.trim() ? Number(form.durationHours) : null;
    const vatNum = form.vatRate.trim() ? Number(form.vatRate) : null;

    if (
      (priceNum != null && Number.isNaN(priceNum)) ||
      (tjmNum != null && Number.isNaN(tjmNum)) ||
      (durationNum != null && Number.isNaN(durationNum)) ||
      (vatNum != null && Number.isNaN(vatNum))
    ) {
      setFormError('Merci de vérifier les valeurs numériques.');
      setSaving(false);
      return;
    }

    const payload: Record<string, unknown> = {
      code: form.code.trim(),
      name: form.name.trim(),
      type: form.type.trim() || null,
      description: form.description.trim() || null,
    };

    if (priceNum != null) payload.defaultPriceCents = Math.round(priceNum * 100);
    if (tjmNum != null) payload.tjmCents = Math.round(tjmNum * 100);
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;
    payload.categoryReferenceId = form.categoryReferenceId || null;
    payload.tagReferenceIds = form.tagReferenceIds;

    const isEdit = Boolean(editing);
    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/services/${editing?.id}`
      : `/api/pro/businesses/${businessId}/services`;

    const res = await fetchJson<ServiceItemResponse>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId);

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de sauvegarder.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSaving(false);
      return;
    }

    setInfo(isEdit ? 'Service mis à jour.' : 'Service créé.');
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setSaving(false);
    await loadServices();
  }

  function openCreate() {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setForm(emptyForm);
    setEditing(null);
    setFormError(null);
    setInfo(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    if (!isAdmin) {
      setReadOnlyInfo(readOnlyMessage);
      return;
    }
    setEditing(service);
    setForm({
      code: service.code,
      name: service.name,
      type: service.type ?? '',
      description: service.description ?? '',
      defaultPrice: service.defaultPriceCents ? (Number(service.defaultPriceCents) / 100).toString() : '',
      tjm: service.tjmCents ? (Number(service.tjmCents) / 100).toString() : '',
      durationHours: service.durationHours != null ? String(service.durationHours) : '',
      vatRate: service.vatRate != null ? String(service.vatRate) : '',
      categoryReferenceId: service.categoryReferenceId ?? '',
      tagReferenceIds: service.tagReferences?.map((t) => t.id) ?? [],
    });
    setFormError(null);
    setInfo(null);
    setModalOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (!isAdmin) {
      setDeleteError(readOnlyMessage);
      return;
    }
    setDeleteError(null);
    const res = await fetchJson<null>(
      `/api/pro/businesses/${businessId}/services/${deleteTarget.id}`,
      { method: 'DELETE' }
    );
    setRequestId(res.requestId);
    if (!res.ok) {
      const msg = res.error ?? 'Suppression impossible.';
      setDeleteError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setDeleteTarget(null);
    await loadServices();
  }

  const filtered = useMemo(() => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return services.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.code.toLowerCase().includes(q) ||
          (s.type ?? '').toLowerCase().includes(q)
      );
    }
    return services;
  }, [services, search]);

  return (
    <div className="space-y-5">
      <RoleBanner role={role} />
      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Services
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              Catalogue des services
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Structure tes offres : code clair, prix et durée pour les proposer dans les projets.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1">
            <Button onClick={openCreate} disabled={!isAdmin}>
              Créer un service
            </Button>
            {!isAdmin ? (
              <p className="text-[11px] text-[var(--text-secondary)]">
                Lecture seule : nécessite ADMIN/OWNER pour créer ou éditer.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void loadServices();
            }}
            className="col-span-2 flex flex-col gap-2 sm:flex-row"
          >
            <Input
              placeholder="Rechercher (nom, code)…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button type="submit" variant="outline" className="whitespace-nowrap">
              Filtrer
            </Button>
          </form>
          <Select label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="ALL">Tous les types</option>
            {typeOptions.map((t) => (
              <option key={t || 'empty'} value={t}>
                {t || '—'}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Select
            label="Catégorie"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Toutes</option>
            {categoryOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Tag" value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}>
            <option value="">Tous</option>
            {tagOptions.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          {referenceError ? (
            <p className="text-xs text-rose-500">
              {referenceError}
              {referenceRequestId ? ` (Ref: ${referenceRequestId})` : ''}
            </p>
          ) : referenceRequestId ? (
            <p className="text-[10px] text-[var(--text-secondary)]">Refs Request ID: {referenceRequestId}</p>
          ) : null}
        </div>

        {loading ? (
          <p className="text-sm text-[var(--text-secondary)]">Chargement du catalogue…</p>
        ) : error ? (
          <p className="text-sm font-semibold text-rose-400">{error}</p>
        ) : filtered.length === 0 ? (
          <Card className="flex flex-col items-start gap-3 border-dashed border-[var(--border)] bg-transparent p-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Crée ton premier service pour le vendre dans tes projets.
            </p>
            <Button onClick={openCreate} disabled={!isAdmin}>
              Créer un service
            </Button>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Références</TableHead>
                <TableHead>Prix défaut</TableHead>
                <TableHead>TJM</TableHead>
                <TableHead>Durée</TableHead>
                <TableHead>Templates</TableHead>
                <TableHead>Mis à jour</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((service) => (
                <TableRow key={service.id}>
                  <TableCell className="font-semibold text-[var(--text-primary)]">{service.code}</TableCell>
                  <TableCell>{service.name}</TableCell>
                  <TableCell>{service.type || '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {service.categoryReferenceName ? (
                        <Badge variant="neutral" className="bg-indigo-50 text-indigo-700">
                          {service.categoryReferenceName}
                        </Badge>
                      ) : null}
                      {service.tagReferences?.map((tag) => (
                        <Badge key={tag.id} variant="neutral" className="bg-emerald-50 text-emerald-700">
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>{formatMoney(service.defaultPriceCents)}</TableCell>
                  <TableCell>{formatMoney(service.tjmCents)}</TableCell>
                  <TableCell>{formatHours(service.durationHours)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[var(--text-primary)]">{service.templateCount ?? 0}</span>
                      <Button variant="ghost" size="sm" onClick={() => openTemplates(service)}>
                        Gérer
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-[var(--text-secondary)]">
                    {formatDate(service.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(service)}
                      disabled={!isAdmin}
                    >
                      Éditer
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!isAdmin) {
                          setReadOnlyInfo(readOnlyMessage);
                          return;
                        }
                        setDeleteTarget(service);
                      }}
                      disabled={!isAdmin}
                    >
                      Supprimer
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? <TableEmpty>Aucun service.</TableEmpty> : null}
            </TableBody>
          </Table>
        )}

        {info ? <p className="text-sm text-emerald-500">{info}</p> : null}
        {readOnlyInfo ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyInfo}</p> : null}
        {requestId ? (
          <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p>
        ) : null}
      </Card>

      <Modal
        open={templatesModalOpen}
        onCloseAction={closeTemplates}
        title={`Gérer templates ${templatesService ? `· ${templatesService.code}` : ''}`}
        description="Ces templates deviennent les tâches générées automatiquement au démarrage d’un projet."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Templates de tâches</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Phase, délai par défaut et rôle attendu pour guider l’équipe.
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

          {templateError ? <p className="text-xs font-semibold text-rose-500">{templateError}</p> : null}
          {seedMessage ? <p className="text-xs text-emerald-500">{seedMessage}</p> : null}
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
                Aucun template → ce service ne génèrera pas de tâches au démarrage d’un projet.
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
                      {tpl.defaultDueOffsetDays != null ? `J+${tpl.defaultDueOffsetDays}` : 'Pas d’échéance auto'}
                      {tpl.defaultAssigneeRole ? ` · ${tpl.defaultAssigneeRole}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEditTemplate(tpl)}
                      disabled={!isAdmin}
                    >
                      Modifier
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteTemplate(tpl)}
                      disabled={!isAdmin}
                    >
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
              {templateFormError ? <p className="text-xs font-semibold text-rose-500">{templateFormError}</p> : null}
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

      <Modal
        open={modalOpen}
        onCloseAction={() => {
          if (saving) return;
          setModalOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Éditer le service' : 'Créer un service'}
        description="Renseigne les informations clés pour que l’équipe puisse le vendre."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Identité</p>
              <Input
                label="Code"
                required
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="SER-UX"
              />
              <Input
                label="Nom"
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Atelier UX"
              />
              <Input
                label="Type"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                placeholder="Workshop / Audit / Build…"
              />
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">Tarification</p>
              <Input
                label="Prix par défaut (€)"
                type="number"
                inputMode="decimal"
                value={form.defaultPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultPrice: e.target.value }))}
                placeholder="1500"
              />
              <Input
                label="TJM (€)"
                type="number"
                inputMode="decimal"
                value={form.tjm}
                onChange={(e) => setForm((prev) => ({ ...prev, tjm: e.target.value }))}
                placeholder="800"
              />
              <div className="grid gap-2 md:grid-cols-2">
                <Input
                  label="Durée (h)"
                  type="number"
                  inputMode="numeric"
                  value={form.durationHours}
                  onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
                  placeholder="12"
                />
                <Input
                  label="TVA (%)"
                  type="number"
                  inputMode="numeric"
                  value={form.vatRate}
                  onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                  placeholder="20"
                />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)]">Description</p>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Pitch commercial, livrables clés, exclusions…"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            />
          </div>

          <ReferencePicker
            businessId={businessId}
            categoryId={form.categoryReferenceId || null}
            tagIds={form.tagReferenceIds}
            onCategoryChange={(id) => setForm((prev) => ({ ...prev, categoryReferenceId: id || '' }))}
            onTagsChange={(ids) => setForm((prev) => ({ ...prev, tagReferenceIds: ids }))}
            disabled={!isAdmin}
            title="Références (catégorie + tags)"
          />

          {formError ? <p className="text-sm font-semibold text-rose-500">{formError}</p> : null}
          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Lecture seule : passe en ADMIN/OWNER pour créer ou modifier un service.
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving || !isAdmin}>
              {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le service'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onCloseAction={() => setDeleteTarget(null)}
        title="Supprimer le service ?"
        description="Cette action est définitive et retire le service du catalogue."
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            {deleteTarget ? `${deleteTarget.name} (${deleteTarget.code})` : ''}
          </p>
          {deleteError ? <p className="text-sm font-semibold text-rose-500">{deleteError}</p> : null}
          {!isAdmin ? (
            <p className="text-xs text-[var(--text-secondary)]">
              Suppression réservée aux rôles ADMIN/OWNER.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button variant="ghost" onClick={confirmDelete} disabled={!isAdmin}>
              Supprimer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
