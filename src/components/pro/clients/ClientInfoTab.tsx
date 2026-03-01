import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';
import { useActiveBusiness } from '@/app/app/pro/ActiveBusinessProvider';

type ClientInfo = {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  websiteUrl: string | null;
  company?: string | null;
  companyName?: string | null;
  mainContactName?: string | null;
  billingCompanyName?: string | null;
  billingContactName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingVatNumber?: string | null;
  billingReference?: string | null;
  billingAddressLine1?: string | null;
  billingAddressLine2?: string | null;
  billingPostalCode?: string | null;
  billingCity?: string | null;
  billingCountryCode?: string | null;
  notes: string | null;
  sector?: string | null;
  status?: string | null;
  leadSource?: string | null;
  categoryReferenceId?: string | null;
  categoryReferenceName?: string | null;
  tagReferences?: Array<{ id: string; name: string }>;
};

type Props = {
  businessId: string;
  clientId: string;
  client: ClientInfo;
  onUpdated: (client: ClientInfo) => void;
};

type ReferenceItem = { id: string; name: string };

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Actif' },
  { value: 'PAUSED', label: 'En pause' },
  { value: 'FORMER', label: 'Ancien' },
];

const LEAD_SOURCES = [
  { value: 'UNKNOWN', label: 'Inconnu' },
  { value: 'OUTBOUND', label: 'Outbound' },
  { value: 'INBOUND', label: 'Inbound' },
  { value: 'REFERRAL', label: 'Référent' },
  { value: 'OTHER', label: 'Autre' },
];

export function ClientInfoTab({ businessId, clientId, client, onUpdated }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const isAdmin = activeCtx?.isAdmin ?? false;
  const readOnlyMessage = 'Réservé aux admins/owners.';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [categoryOptions, setCategoryOptions] = useState<ReferenceItem[]>([]);
  const [tagOptions, setTagOptions] = useState<ReferenceItem[]>([]);
  const [form, setForm] = useState({
    name: client.name ?? '',
    companyName: client.companyName ?? client.company ?? '',
    mainContactName: client.mainContactName ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    websiteUrl: client.websiteUrl ?? '',
    sector: client.sector ?? '',
    status: client.status ?? 'ACTIVE',
    leadSource: client.leadSource ?? 'UNKNOWN',
    notes: client.notes ?? '',
    categoryReferenceId: client.categoryReferenceId ?? '',
    tagReferenceIds: client.tagReferences?.map((tag) => tag.id) ?? [],
    billingCompanyName: client.billingCompanyName ?? '',
    billingContactName: client.billingContactName ?? '',
    billingEmail: client.billingEmail ?? '',
    billingPhone: client.billingPhone ?? '',
    billingVatNumber: client.billingVatNumber ?? '',
    billingReference: client.billingReference ?? '',
    billingAddressLine1: client.billingAddressLine1 ?? '',
    billingAddressLine2: client.billingAddressLine2 ?? '',
    billingPostalCode: client.billingPostalCode ?? '',
    billingCity: client.billingCity ?? '',
    billingCountryCode: client.billingCountryCode ?? '',
  });

  useEffect(() => {
    const controller = new AbortController();
    async function loadReferences() {
      try {
        setReferenceError(null);
        const [categoriesRes, tagsRes] = await Promise.all([
          fetchJson<{ items?: ReferenceItem[] }>(
            `/api/pro/businesses/${businessId}/references?type=CATEGORY`,
            {},
            controller.signal
          ),
          fetchJson<{ items?: ReferenceItem[] }>(
            `/api/pro/businesses/${businessId}/references?type=TAG`,
            {},
            controller.signal
          ),
        ]);
        if (controller.signal.aborted) return;
        if (!categoriesRes.ok || !tagsRes.ok) {
          setReferenceError(categoriesRes.error ?? tagsRes.error ?? 'Impossible de charger les références.');
          return;
        }
        setCategoryOptions(categoriesRes.data?.items ?? []);
        setTagOptions(tagsRes.data?.items ?? []);
      } catch (err) {
        if (controller.signal.aborted) return;
        setReferenceError(getErrorMessage(err));
      }
    }
    void loadReferences();
    return () => controller.abort();
  }, [businessId]);

  const hasChanges = useMemo(() => {
    const currentTags = [...form.tagReferenceIds].sort().join('|');
    const initialTags = (client.tagReferences ?? []).map((tag) => tag.id).sort().join('|');
    return (
      form.name !== (client.name ?? '') ||
      form.companyName !== (client.companyName ?? client.company ?? '') ||
      form.mainContactName !== (client.mainContactName ?? '') ||
      form.email !== (client.email ?? '') ||
      form.phone !== (client.phone ?? '') ||
      form.websiteUrl !== (client.websiteUrl ?? '') ||
      form.sector !== (client.sector ?? '') ||
      form.status !== (client.status ?? 'ACTIVE') ||
      form.leadSource !== (client.leadSource ?? 'UNKNOWN') ||
      form.notes !== (client.notes ?? '') ||
      form.categoryReferenceId !== (client.categoryReferenceId ?? '') ||
      currentTags !== initialTags ||
      form.billingCompanyName !== (client.billingCompanyName ?? '') ||
      form.billingContactName !== (client.billingContactName ?? '') ||
      form.billingEmail !== (client.billingEmail ?? '') ||
      form.billingPhone !== (client.billingPhone ?? '') ||
      form.billingVatNumber !== (client.billingVatNumber ?? '') ||
      form.billingReference !== (client.billingReference ?? '') ||
      form.billingAddressLine1 !== (client.billingAddressLine1 ?? '') ||
      form.billingAddressLine2 !== (client.billingAddressLine2 ?? '') ||
      form.billingPostalCode !== (client.billingPostalCode ?? '') ||
      form.billingCity !== (client.billingCity ?? '') ||
      form.billingCountryCode !== (client.billingCountryCode ?? '')
    );
  }, [client, form]);

  function resetForm() {
    setForm({
      name: client.name ?? '',
      companyName: client.companyName ?? client.company ?? '',
      mainContactName: client.mainContactName ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      websiteUrl: client.websiteUrl ?? '',
      sector: client.sector ?? '',
      status: client.status ?? 'ACTIVE',
      leadSource: client.leadSource ?? 'UNKNOWN',
      notes: client.notes ?? '',
      categoryReferenceId: client.categoryReferenceId ?? '',
      tagReferenceIds: client.tagReferences?.map((tag) => tag.id) ?? [],
      billingCompanyName: client.billingCompanyName ?? '',
      billingContactName: client.billingContactName ?? '',
      billingEmail: client.billingEmail ?? '',
      billingPhone: client.billingPhone ?? '',
      billingVatNumber: client.billingVatNumber ?? '',
      billingReference: client.billingReference ?? '',
      billingAddressLine1: client.billingAddressLine1 ?? '',
      billingAddressLine2: client.billingAddressLine2 ?? '',
      billingPostalCode: client.billingPostalCode ?? '',
      billingCity: client.billingCity ?? '',
      billingCountryCode: client.billingCountryCode ?? '',
    });
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!isAdmin) {
      setError(readOnlyMessage);
      return;
    }
    try {
      setSaving(true);
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        companyName: form.companyName.trim() || null,
        mainContactName: form.mainContactName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        websiteUrl: form.websiteUrl.trim() || null,
        sector: form.sector.trim() || null,
        status: form.status,
        leadSource: form.leadSource,
        notes: form.notes.trim() || null,
        categoryReferenceId: form.categoryReferenceId || null,
        tagReferenceIds: form.tagReferenceIds,
        billingCompanyName: form.billingCompanyName.trim() || null,
        billingContactName: form.billingContactName.trim() || null,
        billingEmail: form.billingEmail.trim() || null,
        billingPhone: form.billingPhone.trim() || null,
        billingVatNumber: form.billingVatNumber.trim() || null,
        billingReference: form.billingReference.trim() || null,
        billingAddressLine1: form.billingAddressLine1.trim() || null,
        billingAddressLine2: form.billingAddressLine2.trim() || null,
        billingPostalCode: form.billingPostalCode.trim() || null,
        billingCity: form.billingCity.trim() || null,
        billingCountryCode: form.billingCountryCode.trim() || null,
      };
      const res = await fetchJson<{ item: ClientInfo }>(
        `/api/pro/businesses/${businessId}/clients/${clientId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Enregistrement impossible');
        return;
      }
      onUpdated(res.data.item);
      setEditing(false);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Informations client</p>
          <p className="text-xs text-[var(--text-secondary)]">Identité, contact et notes</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {editing ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  resetForm();
                  setEditing(false);
                }}
                className="w-full sm:w-auto"
                disabled={!isAdmin}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving || !isAdmin}
                className="w-full sm:w-auto"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="w-full sm:w-auto" disabled={!isAdmin}>
              Modifier
            </Button>
          )}
        </div>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {!isAdmin ? <p className="text-xs text-[var(--text-secondary)]">{readOnlyMessage}</p> : null}
      {referenceError ? <p className="text-xs text-[var(--danger)]">{referenceError}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Identité</p>
          {editing ? (
            <div className="space-y-3">
              <Input
                label="Nom"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Société"
                value={form.companyName}
                onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Contact principal"
                value={form.mainContactName}
                onChange={(e) => setForm((p) => ({ ...p, mainContactName: e.target.value }))}
                disabled={!isAdmin}
              />
              <label className="space-y-1 text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Statut</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  disabled={!isAdmin}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Secteur"
                value={form.sector}
                onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Nom" value={client.name} />
              <InfoRow label="Société" value={client.companyName ?? client.company ?? '—'} />
              <InfoRow label="Contact principal" value={client.mainContactName ?? '—'} />
              <InfoRow label="Statut" value={STATUS_OPTIONS.find((s) => s.value === (client.status ?? 'ACTIVE'))?.label ?? 'Actif'} />
              <InfoRow label="Secteur" value={client.sector ?? '—'} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Contact</p>
          {editing ? (
            <div className="space-y-3">
              <Input
                label="Email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Téléphone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                disabled={!isAdmin}
              />
              <label className="space-y-1 text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Source</span>
                <select
                  value={form.leadSource}
                  onChange={(e) => setForm((p) => ({ ...p, leadSource: e.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  disabled={!isAdmin}
                >
                  {LEAD_SOURCES.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Email" value={client.email ?? '—'} />
              <InfoRow label="Téléphone" value={client.phone ?? '—'} />
              <InfoRow label="Source" value={LEAD_SOURCES.find((s) => s.value === (client.leadSource ?? 'UNKNOWN'))?.label ?? '—'} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Web</p>
          {editing ? (
            <Input
              label="Site web"
              value={form.websiteUrl}
              onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))}
              disabled={!isAdmin}
            />
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Site web" value={client.websiteUrl ?? '—'} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3 lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Facturation</p>
          {editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                label="Société facturation"
                value={form.billingCompanyName}
                onChange={(e) => setForm((p) => ({ ...p, billingCompanyName: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Contact facturation"
                value={form.billingContactName}
                onChange={(e) => setForm((p) => ({ ...p, billingContactName: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Email facturation"
                value={form.billingEmail}
                onChange={(e) => setForm((p) => ({ ...p, billingEmail: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Téléphone facturation"
                value={form.billingPhone}
                onChange={(e) => setForm((p) => ({ ...p, billingPhone: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="TVA facturation"
                value={form.billingVatNumber}
                onChange={(e) => setForm((p) => ({ ...p, billingVatNumber: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Référence client"
                value={form.billingReference}
                onChange={(e) => setForm((p) => ({ ...p, billingReference: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Adresse facturation"
                value={form.billingAddressLine1}
                onChange={(e) => setForm((p) => ({ ...p, billingAddressLine1: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Complément adresse"
                value={form.billingAddressLine2}
                onChange={(e) => setForm((p) => ({ ...p, billingAddressLine2: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Code postal"
                value={form.billingPostalCode}
                onChange={(e) => setForm((p) => ({ ...p, billingPostalCode: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Ville"
                value={form.billingCity}
                onChange={(e) => setForm((p) => ({ ...p, billingCity: e.target.value }))}
                disabled={!isAdmin}
              />
              <Input
                label="Pays (ISO)"
                value={form.billingCountryCode}
                onChange={(e) => setForm((p) => ({ ...p, billingCountryCode: e.target.value }))}
                placeholder="FR"
                disabled={!isAdmin}
              />
            </div>
          ) : (
            <div className="grid gap-2 text-sm text-[var(--text-secondary)] md:grid-cols-2">
              <InfoRow label="Société" value={client.billingCompanyName ?? '—'} />
              <InfoRow label="Contact" value={client.billingContactName ?? '—'} />
              <InfoRow label="Email" value={client.billingEmail ?? '—'} />
              <InfoRow label="Téléphone" value={client.billingPhone ?? '—'} />
              <InfoRow label="TVA" value={client.billingVatNumber ?? '—'} />
              <InfoRow label="Référence" value={client.billingReference ?? '—'} />
              <InfoRow label="Adresse" value={client.billingAddressLine1 ?? '—'} />
              <InfoRow label="Complément" value={client.billingAddressLine2 ?? '—'} />
              <InfoRow label="Code postal" value={client.billingPostalCode ?? '—'} />
              <InfoRow label="Ville" value={client.billingCity ?? '—'} />
              <InfoRow label="Pays" value={client.billingCountryCode ?? '—'} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Notes</p>
          {editing ? (
            <label className="space-y-1 text-sm text-[var(--text-primary)]">
              <span className="text-xs text-[var(--text-secondary)]">Notes</span>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                disabled={!isAdmin}
              />
            </label>
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <p className="rounded-2xl bg-[var(--surface-hover)]/60 px-3 py-2 text-[var(--text-primary)]">
                {client.notes ? client.notes : '—'}
              </p>
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3 lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Catégories & tags</p>
          {editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Catégorie"
                value={form.categoryReferenceId}
                onChange={(e) => setForm((p) => ({ ...p, categoryReferenceId: e.target.value }))}
                disabled={!isAdmin}
              >
                <option value="">Aucune</option>
                {categoryOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </Select>
              <label className="text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Tags</span>
                <Select
                  multiple
                  value={form.tagReferenceIds}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      tagReferenceIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                    }))
                  }
                  className="min-h-[140px]"
                  disabled={!isAdmin}
                >
                  {tagOptions.map((tag) => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Catégorie" value={client.categoryReferenceName ?? '—'} />
              <div className="flex flex-wrap gap-2 rounded-xl bg-[var(--surface-hover)]/40 px-3 py-2">
                {(client.tagReferences ?? []).length ? (
                  client.tagReferences?.map((tag) => (
                    <Badge key={tag.id} variant="neutral">
                      {tag.name}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[var(--text-secondary)] text-sm">Aucun tag</span>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-hover)]/40 px-3 py-2">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="truncate text-[var(--text-primary)] font-medium">{value || '—'}</span>
    </div>
  );
}
