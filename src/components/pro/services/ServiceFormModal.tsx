"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import type { ServiceItem, ServiceTemplate } from './service-types';
import { SERVICE_UNITS, SERVICE_UNIT_LABELS } from './service-types';

// ─── Task template inline editor ─────────────────────────────────────────────

type TemplateFormItem = {
  _key: string;
  title: string;
  estimatedMinutes: string;
};

let _tplKey = 0;
function nextTplKey() { return `tpl-${++_tplKey}`; }

function formatTotalTime(templates: TemplateFormItem[]) {
  const total = templates.reduce((sum, t) => sum + (Number(t.estimatedMinutes) || 0), 0);
  if (total === 0) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
}

// ─── Form state ──────────────────────────────────────────────────────────────

type ServiceFormState = {
  code: string;
  name: string;
  type: string;
  unit: string;
  defaultQuantity: string;
  defaultPrice: string;
  tjm: string;
  cost: string;
  durationHours: string;
  vatRate: string;
  description: string;
};

const emptyForm: ServiceFormState = {
  code: '',
  name: '',
  type: '',
  unit: 'FORFAIT',
  defaultQuantity: '1',
  defaultPrice: '',
  tjm: '',
  cost: '',
  durationHours: '',
  vatRate: '',
  description: '',
};

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  editing: ServiceItem | null;
  businessId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAfterSave: (createdId: string | null, isEdit: boolean) => Promise<void>;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ServiceFormModal({ open, editing, businessId, isAdmin, onClose, onAfterSave }: Props) {
  const toast = useToast();

  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [templates, setTemplates] = useState<TemplateFormItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const nextForm = editing
      ? {
          code: editing.code,
          name: editing.name,
          type: editing.type ?? '',
          unit: editing.unit ?? 'FORFAIT',
          defaultQuantity: String(editing.defaultQuantity ?? 1),
          description: editing.description ?? '',
          defaultPrice: formatCentsToEuroInput(editing.defaultPriceCents),
          tjm: formatCentsToEuroInput(editing.tjmCents),
          cost: formatCentsToEuroInput(editing.costCents),
          durationHours: editing.durationHours != null ? String(editing.durationHours) : '',
          vatRate: editing.vatRate != null ? String(editing.vatRate) : '',
        }
      : emptyForm;
    queueMicrotask(() => {
      setForm(nextForm);
      setTemplates([]);
      setFormError(null);
      setSaving(false);
    });
    // Load existing templates when editing
    if (editing) {
      void fetchJson<{ item: { taskTemplates?: ServiceTemplate[] } }>(
        `/api/pro/businesses/${businessId}/services/${editing.id}`
      ).then((res) => {
        if (!res.ok || !res.data?.item?.taskTemplates) return;
        setTemplates(
          res.data.item.taskTemplates.map((t) => ({
            _key: nextTplKey(),
            title: t.title,
            estimatedMinutes: t.estimatedMinutes != null ? String(t.estimatedMinutes) : '',
          }))
        );
      });
    }
  }, [open, editing, businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!isAdmin) {
      setFormError('Action réservée aux admins/owners.');
      return;
    }
    setFormError(null);
    setSaving(true);

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
    };

    if (priceNum != null) payload.defaultPriceCents = priceNum;
    if (tjmNum != null) payload.tjmCents = tjmNum;
    if (costNum != null) payload.costCents = costNum;
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;

    // Include task templates
    const validTemplates = templates
      .filter((t) => t.title.trim())
      .map((t) => ({
        title: t.title.trim(),
        estimatedMinutes: t.estimatedMinutes.trim() ? Number(t.estimatedMinutes) : null,
      }));
    payload.taskTemplates = validTemplates;

    const isEdit = Boolean(editing);
    const endpoint = isEdit
      ? `/api/pro/businesses/${businessId}/services/${editing?.id}`
      : `/api/pro/businesses/${businessId}/services`;

    const res = await fetchJson<{ item?: { id?: string } }>(endpoint, {
      method: isEdit ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de sauvegarder.';
      setFormError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      setSaving(false);
      return;
    }

    const createdId = res.data.item?.id ?? null;
    setSaving(false);
    onClose();
    toast.success(isEdit ? 'Service mis à jour.' : 'Service créé.');
    await onAfterSave(createdId, isEdit);
  }

  return (
    <Modal
      open={open}
      onCloseAction={() => {
        if (saving) return;
        onClose();
      }}
      title={editing ? 'Éditer le service' : 'Créer un service'}
      description="Renseigne les informations clés pour que l&apos;équipe puisse le vendre."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Identité */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-faint)]">Identité</p>
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
            <div className="grid gap-2 grid-cols-2">
              <Select
                label="Unité"
                value={form.unit}
                onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
              >
                {SERVICE_UNITS.map((u) => (
                  <option key={u} value={u}>{SERVICE_UNIT_LABELS[u]}</option>
                ))}
              </Select>
              <Input
                label="Qté défaut"
                type="number"
                inputMode="numeric"
                min={1}
                value={form.defaultQuantity}
                onChange={(e) => setForm((prev) => ({ ...prev, defaultQuantity: e.target.value }))}
                placeholder="1"
              />
            </div>
          </div>
          {/* Tarification */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[var(--text-faint)]">Tarification</p>
            <Input
              label="Prix par défaut (€)"
              type="text"
              inputMode="decimal"
              value={form.defaultPrice}
              onChange={(e) => setForm((prev) => ({ ...prev, defaultPrice: sanitizeEuroInput(e.target.value) }))}
              placeholder="1500"
            />
            <Input
              label="TJM (€)"
              type="text"
              inputMode="decimal"
              value={form.tjm}
              onChange={(e) => setForm((prev) => ({ ...prev, tjm: sanitizeEuroInput(e.target.value) }))}
              placeholder="800"
            />
            <Input
              label="Coût interne (€)"
              type="text"
              inputMode="decimal"
              value={form.cost}
              onChange={(e) => setForm((prev) => ({ ...prev, cost: sanitizeEuroInput(e.target.value) }))}
              placeholder="500"
            />
            <div className="grid gap-2 grid-cols-2">
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

        {/* Description */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[var(--text-faint)]">Description</p>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Pitch commercial, livrables clés, exclusions…"
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-faint)] transition-colors hover:border-[var(--border-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          />
        </div>

        {/* Tâches associées */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--text-faint)]">
              Tâches associées {templates.length > 0 ? `(${templates.length})` : ''}
            </p>
            {formatTotalTime(templates) ? (
              <span className="text-xs text-[var(--text-faint)]">
                Total : {formatTotalTime(templates)}
              </span>
            ) : null}
          </div>
          {templates.map((tpl) => (
            <div key={tpl._key} className="flex items-center gap-2">
              <input
                type="text"
                value={tpl.title}
                onChange={(e) =>
                  setTemplates((prev) =>
                    prev.map((t) => (t._key === tpl._key ? { ...t, title: e.target.value } : t))
                  )
                }
                placeholder="Titre de la tâche"
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              />
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={tpl.estimatedMinutes}
                onChange={(e) =>
                  setTemplates((prev) =>
                    prev.map((t) =>
                      t._key === tpl._key ? { ...t, estimatedMinutes: e.target.value } : t
                    )
                  )
                }
                placeholder="min"
                className="w-20 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] text-right focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              />
              <button
                type="button"
                onClick={() => setTemplates((prev) => prev.filter((t) => t._key !== tpl._key))}
                className="cursor-pointer shrink-0 rounded-lg p-1.5 text-[var(--text-faint)] hover:bg-[var(--surface-2)] hover:text-[var(--danger)] transition-colors"
                aria-label="Supprimer la tâche"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setTemplates((prev) => [...prev, { _key: nextTplKey(), title: '', estimatedMinutes: '' }])}
            className="cursor-pointer flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline"
          >
            <Plus size={14} />
            Ajouter une tâche
          </button>
        </div>

        {formError ? <p className="text-sm font-semibold text-[var(--danger)]">{formError}</p> : null}
        {!isAdmin ? (
          <p className="text-xs text-[var(--text-faint)]">
            Lecture seule : passe en ADMIN/OWNER pour créer ou modifier un service.
          </p>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button type="submit" disabled={saving || !isAdmin}>
            {saving ? 'Enregistrement…' : editing ? 'Mettre à jour' : 'Créer le service'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
