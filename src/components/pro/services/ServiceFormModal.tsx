"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { fetchJson } from '@/lib/apiClient';
import { formatCentsToEuroInput, parseEuroToCents, sanitizeEuroInput } from '@/lib/money';
import { ReferencePicker } from '@/app/app/pro/[businessId]/references/ReferencePicker';

// ─── Local types ──────────────────────────────────────────────────────────────

type Service = {
  id: string;
  code: string;
  name: string;
  type: string | null;
  description: string | null;
  defaultPriceCents: string | null;
  tjmCents: string | null;
  durationHours: number | null;
  vatRate: number | null;
  categoryReferenceId: string | null;
  tagReferences?: { id: string; name: string }[];
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

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  editing: Service | null;
  businessId: string;
  isAdmin: boolean;
  onClose: () => void;
  onAfterSave: (createdId: string | null, isEdit: boolean) => Promise<void>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ServiceFormModal({ open, editing, businessId, isAdmin, onClose, onAfterSave }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<ServiceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize form when modal opens or editing changes
  useEffect(() => {
    if (!open) return;
    if (editing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        code: editing.code,
        name: editing.name,
        type: editing.type ?? '',
        description: editing.description ?? '',
        defaultPrice: formatCentsToEuroInput(editing.defaultPriceCents),
        tjm: formatCentsToEuroInput(editing.tjmCents),
        durationHours: editing.durationHours != null ? String(editing.durationHours) : '',
        vatRate: editing.vatRate != null ? String(editing.vatRate) : '',
        categoryReferenceId: editing.categoryReferenceId ?? '',
        tagReferenceIds: editing.tagReferences?.map((t) => t.id) ?? [],
      });
    } else {
      setForm(emptyForm);
    }
    setFormError(null);
    setSaving(false);
  }, [open, editing]);

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
    };

    if (priceNum != null) payload.defaultPriceCents = priceNum;
    if (tjmNum != null) payload.tjmCents = tjmNum;
    if (durationNum != null) payload.durationHours = durationNum;
    if (vatNum != null) payload.vatRate = vatNum;
    payload.categoryReferenceId = form.categoryReferenceId || null;
    payload.tagReferenceIds = form.tagReferenceIds;

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
    await onAfterSave(createdId, isEdit);

    if (!isEdit && createdId) {
      router.push(`/app/pro/${businessId}/services/${createdId}?tab=templates&openTemplate=1`);
    }
  }

  return (
    <Modal
      open={open}
      onCloseAction={() => {
        if (saving) return;
        onClose();
      }}
      title={editing ? 'Éditer le service' : 'Créer un service'}
      description="Renseigne les informations clés pour que l'équipe puisse le vendre."
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
