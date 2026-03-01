// src/app/app/pro/[businessId]/services/[serviceId]/page.tsx
'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DebugRequestId } from '@/components/ui/debug-request-id';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { ProPageShell } from '@/components/pro/ProPageShell';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { ReferencePicker } from '../../references/ReferencePicker';
import { ServiceTemplatesModal } from '@/components/pro/services/ServiceTemplatesModal';
import { SERVICE_UNITS, SERVICE_UNIT_LABELS } from '@/components/pro/services/service-types';

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
  costCents: string | null;
  unit: string;
  defaultQuantity: number;
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
  unit: string;
  defaultQuantity: string;
  description: string;
  defaultPrice: string;
  tjm: string;
  cost: string;
  durationHours: string;
  vatRate: string;
  categoryReferenceId: string;
  tagReferenceIds: string[];
};

const emptyForm: FormState = {
  code: '',
  name: '',
  type: '',
  unit: 'FORFAIT',
  defaultQuantity: '1',
  description: '',
  defaultPrice: '',
  tjm: '',
  cost: '',
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
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(num / 100);
  } catch {
    return `${(num / 100).toFixed(0)} €`;
  }
}

export default function ServiceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
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
  const [tab, setTab] = useState(searchParams?.get('tab') ?? 'overview');
  const [templatesModalOpen, setTemplatesModalOpen] = useState(searchParams?.get('openTemplate') === '1');
  const controllerRef = useRef<AbortController | null>(null);

  function mapToForm(value: ServiceDetail): FormState {
    return {
      code: value.code,
      name: value.name,
      type: value.type ?? '',
      unit: value.unit ?? 'FORFAIT',
      defaultQuantity: String(value.defaultQuantity ?? 1),
      description: value.description ?? '',
      defaultPrice: formatCentsToEuroInput(value.defaultPriceCents),
      tjm: formatCentsToEuroInput(value.tjmCents),
      cost: formatCentsToEuroInput(value.costCents),
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
        setError(msg);
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
    if (!isAdmin || !service) return;
    setSaving(true);
    setFormError(null);
    setInfo(null);

    const priceNum = form.defaultPrice.trim() ? parseEuroToCents(form.defaultPrice) : null;
    const tjmNum = form.tjm.trim() ? parseEuroToCents(form.tjm) : null;
    const costNum = form.cost.trim() ? parseEuroToCents(form.cost) : null;
    const durationNum = form.durationHours.trim() ? Number(form.durationHours) : null;
    const vatNum = form.vatRate.trim() ? Number(form.vatRate) : null;
    const qtyNum = form.defaultQuantity.trim() ? Number(form.defaultQuantity) : 1;

    if (
      (priceNum != null && !Number.isFinite(priceNum)) ||
      (tjmNum != null && !Number.isFinite(tjmNum)) ||
      (costNum != null && !Number.isFinite(costNum)) ||
      (durationNum != null && Number.isNaN(durationNum)) ||
      (vatNum != null && Number.isNaN(vatNum)) ||
      Number.isNaN(qtyNum) || qtyNum < 1
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
      unit: form.unit,
      defaultQuantity: qtyNum,
      categoryReferenceId: form.categoryReferenceId || null,
      tagReferenceIds: form.tagReferenceIds,
    };
    if (priceNum != null) payload.defaultPriceCents = priceNum;
    if (tjmNum != null) payload.tjmCents = tjmNum;
    if (costNum != null) payload.costCents = costNum;
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;

    const res = await fetchJson<ServiceDetailResponse>(
      `/api/pro/businesses/${businessId}/services/${service.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    setRequestId(res.requestId);
    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Impossible de sauvegarder.';
      setFormError(msg);
      setSaving(false);
      return;
    }

    setService(res.data.item);
    setForm(mapToForm(res.data.item));
    setSaving(false);
    setInfo('Service mis à jour.');
  }

  const templateCount = service?.taskTemplates?.length ?? 0;

  return (
    <>
      <ProPageShell
        backHref={`/app/pro/${businessId}/services`}
        title={service?.name ?? `Service #${serviceId}`}
        subtitle={service?.code}
        tabs={[
          { key: 'overview', label: 'Aperçu' },
          { key: 'templates', label: `Templates (${templateCount})` },
        ]}
        activeTab={tab}
        onTabChange={setTab}
        actions={
          isAdmin ? (
            <Badge variant="neutral">Admin</Badge>
          ) : (
            <Badge variant="neutral">Lecture seule</Badge>
          )
        }
      >
        {loading ? (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-faint)]">Chargement du service…</p>
          </Card>
        ) : error ? (
          <Card className="space-y-2 border border-[var(--danger-border)] bg-[var(--danger-bg)] p-4">
            <p className="text-sm font-semibold text-[var(--danger)]">{error}</p>
          </Card>
        ) : service ? (
          <>
            {tab === 'overview' ? (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                  <Card className="flex flex-col items-center gap-1 p-3 text-center border border-[var(--border)]">
                    <span className="text-lg font-bold text-[var(--text-primary)]">{formatCents(service.defaultPriceCents)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Prix HT</span>
                  </Card>
                  <Card className="flex flex-col items-center gap-1 p-3 text-center border border-[var(--border)]">
                    <span className="text-lg font-bold text-[var(--text-primary)]">{formatCents(service.tjmCents)}</span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">TJM</span>
                  </Card>
                  <Card className="flex flex-col items-center gap-1 p-3 text-center border border-[var(--border)]">
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {service.durationHours != null ? `${service.durationHours}h` : '—'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">Durée</span>
                  </Card>
                  <Card className="flex flex-col items-center gap-1 p-3 text-center border border-[var(--border)]">
                    <span className="text-lg font-bold text-[var(--text-primary)]">
                      {service.vatRate != null ? `${service.vatRate}%` : '—'}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-faint)]">TVA</span>
                  </Card>
                </div>

                {/* Metadata */}
                <Card className="p-4 border border-[var(--border)]">
                  <div className="flex flex-wrap gap-2 text-sm">
                    <Badge variant="neutral">{SERVICE_UNIT_LABELS[service.unit] ?? service.unit}</Badge>
                    <Badge variant="neutral">Qté: {service.defaultQuantity}</Badge>
                    {service.costCents ? (
                      <Badge variant="neutral">Coût: {formatCents(service.costCents)}</Badge>
                    ) : null}
                    {service.categoryReferenceName ? (
                      <Badge variant="neutral">{service.categoryReferenceName}</Badge>
                    ) : null}
                    {service.tagReferences?.map((tag) => (
                      <Badge key={tag.id} variant="neutral" className="bg-[var(--surface-hover)]">
                        #{tag.name}
                      </Badge>
                    ))}
                  </div>
                  {service.description ? (
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{service.description}</p>
                  ) : null}
                </Card>

                {/* Edit form */}
                <Card className="space-y-4 p-5 border border-[var(--border)]">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Mettre à jour</p>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-2">
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
                      <div className="grid gap-2 grid-cols-2">
                        <Select
                          label="Unité"
                          value={form.unit}
                          onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                          disabled={!isAdmin || saving}
                        >
                          {SERVICE_UNITS.map((u) => (
                            <option key={u} value={u}>{SERVICE_UNIT_LABELS[u]}</option>
                          ))}
                        </Select>
                        <Input
                          label="Qté défaut"
                          type="number"
                          min={1}
                          value={form.defaultQuantity}
                          onChange={(e) => setForm((prev) => ({ ...prev, defaultQuantity: e.target.value }))}
                          disabled={!isAdmin || saving}
                        />
                      </div>
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
                        label="Coût interne (€)"
                        value={form.cost}
                        onChange={(e) => setForm((prev) => ({ ...prev, cost: sanitizeEuroInput(e.target.value) }))}
                        placeholder="500"
                        type="text"
                        inputMode="decimal"
                        disabled={!isAdmin || saving}
                      />
                      <div className="grid gap-2 grid-cols-2">
                        <Input
                          label="Durée (h)"
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
                      </div>
                    </div>
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-[var(--text-faint)]">Description</p>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        disabled={!isAdmin || saving}
                        className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-70"
                        placeholder="Pitch commercial, livrables clés, exclusions…"
                      />
                    </div>
                    <ReferencePicker
                      businessId={businessId}
                      categoryId={form.categoryReferenceId || null}
                      tagIds={form.tagReferenceIds}
                      onCategoryChange={(id: string | null) => setForm((prev) => ({ ...prev, categoryReferenceId: id ?? '' }))}
                      onTagsChange={(ids: string[]) => setForm((prev) => ({ ...prev, tagReferenceIds: ids }))}
                      disabled={!isAdmin || saving}
                      title="Références"
                    />
                    {formError ? <p className="text-sm font-semibold text-[var(--danger)]">{formError}</p> : null}
                    {info ? <p className="text-sm text-[var(--success)]">{info}</p> : null}
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Button type="submit" disabled={!isAdmin || saving}>
                        {saving ? 'Sauvegarde…' : 'Enregistrer'}
                      </Button>
                      {!isAdmin ? (
                        <p className="text-xs text-[var(--text-faint)]">{readOnlyMessage}</p>
                      ) : null}
                    </div>
                  </form>
                </Card>
              </div>
            ) : null}

            {tab === 'templates' ? (
              <Card className="space-y-4 p-5 border border-[var(--border)]">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Templates de tâches</p>
                    <p className="text-xs text-[var(--text-faint)]">
                      Ces templates génèrent automatiquement les tâches quand le service est ajouté à un projet.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setTemplatesModalOpen(true)}
                  >
                    Gérer les templates
                  </Button>
                </div>
                {service.taskTemplates.length === 0 ? (
                  <p className="text-sm text-[var(--text-faint)]">Aucun template. Clique sur &quot;Gérer les templates&quot; pour en ajouter.</p>
                ) : (
                  <div className="space-y-2">
                    {service.taskTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="flex flex-col gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{tpl.title}</p>
                          <p className="text-[11px] text-[var(--text-faint)]">
                            Phase: {tpl.phase || '—'} · Rôle: {tpl.defaultAssigneeRole || '—'} · J+{tpl.defaultDueOffsetDays ?? '—'}
                          </p>
                        </div>
                        <Badge variant="neutral">{tpl.phase || 'Sans phase'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            ) : null}
          </>
        ) : (
          <Card className="p-5">
            <p className="text-sm text-[var(--text-faint)]">Service introuvable.</p>
          </Card>
        )}

        <DebugRequestId requestId={requestId} />
      </ProPageShell>

      {service ? (
        <ServiceTemplatesModal
          open={templatesModalOpen}
          service={service}
          businessId={businessId}
          isAdmin={isAdmin}
          onClose={() => setTemplatesModalOpen(false)}
          onTemplateCountChange={() => void load()}
        />
      ) : null}
    </>
  );
}
