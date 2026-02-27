// src/app/app/pro/[businessId]/services/[serviceId]/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { ReferencePicker } from '../../references/ReferencePicker';

type TaskTemplate = {
  id: string;
  phase: string | null;
  title: string;
  defaultAssigneeRole: string | null;
  defaultDueOffsetDays: number | null;
};

type ServiceDetail = {
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
  taskTemplates: TaskTemplate[];
  createdAt: string;
  updatedAt: string;
};

type ServiceDetailResponse = { item: ServiceDetail };

type FormState = {
  code: string;
  name: string;
  type: string;
  description: string;
  defaultPrice: string;
  tjm: string;
  durationHours: string;
  vatRate: string;
  categoryReferenceId: string;
  tagReferenceIds: string[];
};

const emptyForm: FormState = {
  code: '',
  name: '',
  type: '',
  description: '',
  defaultPrice: '',
  tjm: '',
  durationHours: '',
  vatRate: '',
  categoryReferenceId: '',
  tagReferenceIds: [],
};

function formatCents(value: string | null | undefined) {
  if (!value) return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
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

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ServiceDetailPage() {
  const params = useParams();
  const businessId = (params?.businessId ?? '') as string;
  const serviceId = (params?.serviceId ?? '') as string;
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const isAdmin = role === 'ADMIN' || role === 'OWNER';
  const readOnlyMessage = 'Action réservée aux admins/owners.';

  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function mapToForm(value: ServiceDetail): FormState {
    return {
      code: value.code,
      name: value.name,
      type: value.type ?? '',
      description: value.description ?? '',
      defaultPrice: formatCentsToEuroInput(value.defaultPriceCents),
      tjm: formatCentsToEuroInput(value.tjmCents),
      durationHours: value.durationHours != null ? String(value.durationHours) : '',
      vatRate: value.vatRate != null ? String(value.vatRate) : '',
      categoryReferenceId: value.categoryReferenceId ?? '',
      tagReferenceIds: value.tagReferences?.map((t) => t.id) ?? [],
    };
  }

  async function load(signal?: AbortSignal) {
    const controller = signal ? null : new AbortController();
    const effectiveSignal = signal ?? controller?.signal;
    if (controller) {
      controllerRef.current?.abort();
      controllerRef.current = controller;
    }

    try {
      setLoading(true);
      setError(null);
      setRequestId(null);
      const res = await fetchJson<ServiceDetailResponse>(
        `/api/pro/businesses/${businessId}/services/${serviceId}`,
        {},
        effectiveSignal
      );
      if (effectiveSignal?.aborted) return;
      setRequestId(res.requestId);
      if (!res.ok || !res.data?.item) {
        const msg = res.error ?? 'Service introuvable.';
        setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
        setService(null);
        return;
      }
      setService(res.data.item);
      setForm(mapToForm(res.data.item));
    } catch (err) {
      if (effectiveSignal?.aborted) return;
      setError(getErrorMessage(err));
      setService(null);
    } finally {
      if (!effectiveSignal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, serviceId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setFormError(readOnlyMessage);
      return;
    }
    if (!service) return;
    setSaving(true);
    setFormError(null);
    setInfo(null);

    const priceNum = form.defaultPrice.trim() ? parseEuroToCents(form.defaultPrice) : null;
    const tjmNum = form.tjm.trim() ? parseEuroToCents(form.tjm) : null;
    const durationNum = form.durationHours.trim() ? Number(form.durationHours) : null;
    const vatNum = form.vatRate.trim() ? Number(form.vatRate) : null;

    if (
      (priceNum != null && !Number.isFinite(priceNum)) ||
      (tjmNum != null && !Number.isFinite(tjmNum)) ||
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
      categoryReferenceId: form.categoryReferenceId || null,
      tagReferenceIds: form.tagReferenceIds,
    };
    if (priceNum != null) payload.defaultPriceCents = priceNum;
    if (tjmNum != null) payload.tjmCents = tjmNum;
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;

    const res = await fetchJson<ServiceDetailResponse>(`/api/pro/businesses/${businessId}/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setRequestId(res.requestId);
    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Impossible de sauvegarder.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSaving(false);
      return;
    }

    setService(res.data.item);
    setForm(mapToForm(res.data.item));
    setSaving(false);
    setInfo('Service mis à jour.');
  }

  const requestHint = requestId ? `Ref: ${requestId}` : null;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
              Pro · Service
            </p>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Service #{serviceId}</h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Détail d&apos;un service : code, prix, description et templates.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/app/pro/${businessId}/services`}>Retour catalogue</Link>
          </Button>
        </div>
        {requestHint ? <p className="text-xs text-[var(--text-secondary)]">{requestHint}</p> : null}
      </Card>

      {loading ? (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Chargement du service…</p>
        </Card>
      ) : error ? (
        <Card className="space-y-2 border border-rose-200/60 bg-rose-50/60 p-4">
          <p className="text-sm font-semibold text-rose-500">{error}</p>
          <p className="text-xs text-rose-400">Vérifie l&apos;identifiant ou tes droits.</p>
        </Card>
      ) : service ? (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{service.name}</p>
                <p className="text-sm text-[var(--text-secondary)]">{service.description || 'Pas de description.'}</p>
                <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  <span>Code: {service.code}</span>
                  <span>Type: {service.type || '—'}</span>
                  <span>Créé: {formatDate(service.createdAt)}</span>
                  <span>Maj: {formatDate(service.updatedAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {service.categoryReferenceName ? (
                    <Badge variant="neutral">Catégorie : {service.categoryReferenceName}</Badge>
                  ) : (
                    <Badge variant="neutral">Sans catégorie</Badge>
                  )}
                  {service.tagReferences?.length ? (
                    service.tagReferences.map((tag) => (
                      <Badge key={tag.id} variant="neutral" className="bg-[var(--surface-hover)]">
                        #{tag.name}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="neutral">Aucun tag</Badge>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-start gap-2">
                <Badge variant="neutral">
                  Tarif par défaut: {formatCents(service.defaultPriceCents)} · TJM {formatCents(service.tjmCents)}
                </Badge>
                <Badge variant="neutral">
                  Durée: {service.durationHours != null ? `${service.durationHours} h` : '—'} · TVA{' '}
                  {service.vatRate != null ? `${service.vatRate}%` : '—'}
                </Badge>
              </div>
            </div>
            {service.taskTemplates?.length ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="mb-2 text-sm font-semibold text-[var(--text-primary)]">Templates de tâches</p>
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  {service.taskTemplates.map((tpl) => (
                    <li key={tpl.id} className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[var(--text-primary)]">{tpl.title}</span>
                      <span className="text-xs text-[var(--text-secondary)]">
                        Phase: {tpl.phase || '—'} · Rôle: {tpl.defaultAssigneeRole || '—'} · J+{' '}
                        {tpl.defaultDueOffsetDays ?? '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-transparent p-4">
                <p className="text-sm text-[var(--text-secondary)]">Pas de templates associés.</p>
              </div>
            )}
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Mettre à jour</p>
              {!isAdmin ? (
                <Badge variant="neutral">Lecture seule</Badge>
              ) : (
                <Badge variant="neutral">Admin</Badge>
              )}
            </div>
            <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
              <Input
                label="Code (SER-XXX)"
                value={form.code}
                onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))}
                required
                disabled={!isAdmin || saving}
              />
              <Input
                label="Nom"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
                disabled={!isAdmin || saving}
              />
              <Input
                label="Type"
                value={form.type}
                onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                disabled={!isAdmin || saving}
              />
              <Input
                label="Prix par défaut (€ HT)"
                value={form.defaultPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultPrice: sanitizeEuroInput(e.target.value) }))}
                placeholder="1500"
                type="text"
                inputMode="decimal"
                disabled={!isAdmin || saving}
              />
              <Input
                label="TJM (€ HT)"
                value={form.tjm}
                onChange={(e) => setForm((prev) => ({ ...prev, tjm: sanitizeEuroInput(e.target.value) }))}
                placeholder="800"
                type="text"
                inputMode="decimal"
                disabled={!isAdmin || saving}
              />
              <Input
                label="Durée (heures)"
                value={form.durationHours}
                onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
                placeholder="12"
                disabled={!isAdmin || saving}
              />
              <Input
                label="TVA (%)"
                value={form.vatRate}
                onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                placeholder="20"
                disabled={!isAdmin || saving}
              />
              <div className="md:col-span-2 space-y-2">
                <p className="text-xs font-semibold text-[var(--text-secondary)]">Description</p>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={4}
                  disabled={!isAdmin || saving}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-70"
                  placeholder="Pitch commercial, livrables clés, exclusions…"
                />
              </div>
              <div className="md:col-span-2">
                <ReferencePicker
                  businessId={businessId}
                  categoryId={form.categoryReferenceId || null}
                  tagIds={form.tagReferenceIds}
                  onCategoryChange={(id: string | null) =>
                    setForm((prev) => ({ ...prev, categoryReferenceId: id ?? '' }))
                  }
                  onTagsChange={(ids: string[]) => setForm((prev) => ({ ...prev, tagReferenceIds: ids }))}
                  disabled={!isAdmin || saving}
                  title="Références"
                />
              </div>
              <div className="md:col-span-2 flex flex-col gap-2">
                {formError ? <p className="text-sm font-semibold text-rose-500">{formError}</p> : null}
                {info ? <p className="text-sm text-emerald-600">{info}</p> : null}
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={!isAdmin || saving}>
                    {saving ? 'Sauvegarde…' : 'Enregistrer'}
                  </Button>
                  {!isAdmin ? (
                    <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p>
                  ) : null}
                </div>
              </div>
            </form>
          </Card>
        </div>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Service introuvable.</p>
        </Card>
      )}
    </div>
  );
}
