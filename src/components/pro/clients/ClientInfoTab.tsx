import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchJson, getErrorMessage } from '@/lib/apiClient';

type ClientInfo = {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  websiteUrl: string | null;
  notes: string | null;
  sector?: string | null;
  status?: string | null;
  leadSource?: string | null;
};

type Props = {
  businessId: string;
  clientId: string;
  client: ClientInfo;
  onUpdated: (client: ClientInfo) => void;
};

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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: client.name ?? '',
    email: client.email ?? '',
    phone: client.phone ?? '',
    websiteUrl: client.websiteUrl ?? '',
    sector: client.sector ?? '',
    status: client.status ?? 'ACTIVE',
    leadSource: client.leadSource ?? 'UNKNOWN',
    notes: client.notes ?? '',
  });

  const hasChanges = useMemo(() => {
    return (
      form.name !== (client.name ?? '') ||
      form.email !== (client.email ?? '') ||
      form.phone !== (client.phone ?? '') ||
      form.websiteUrl !== (client.websiteUrl ?? '') ||
      form.sector !== (client.sector ?? '') ||
      form.status !== (client.status ?? 'ACTIVE') ||
      form.leadSource !== (client.leadSource ?? 'UNKNOWN') ||
      form.notes !== (client.notes ?? '')
    );
  }, [client, form]);

  function resetForm() {
    setForm({
      name: client.name ?? '',
      email: client.email ?? '',
      phone: client.phone ?? '',
      websiteUrl: client.websiteUrl ?? '',
      sector: client.sector ?? '',
      status: client.status ?? 'ACTIVE',
      leadSource: client.leadSource ?? 'UNKNOWN',
      notes: client.notes ?? '',
    });
    setError(null);
  }

  async function handleSave() {
    setError(null);
    try {
      setSaving(true);
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        websiteUrl: form.websiteUrl.trim(),
        sector: form.sector.trim() || null,
        status: form.status,
        leadSource: form.leadSource,
        notes: form.notes.trim(),
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
              <Button variant="outline" onClick={() => { resetForm(); setEditing(false); }} className="w-full sm:w-auto">
                Annuler
              </Button>
              <Button onClick={handleSave} disabled={!hasChanges || saving} className="w-full sm:w-auto bg-neutral-900 text-white hover:bg-neutral-800">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)} className="w-full sm:w-auto">
              Modifier
            </Button>
          )}
        </div>
      </div>
      {error ? <p className="text-sm text-rose-500">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Identité</p>
          {editing ? (
            <div className="space-y-3">
              <Input label="Nom" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <label className="space-y-1 text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Statut</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Secteur" value={form.sector} onChange={(e) => setForm((p) => ({ ...p, sector: e.target.value }))} />
            </div>
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Nom" value={client.name} />
              <InfoRow label="Statut" value={STATUS_OPTIONS.find((s) => s.value === (client.status ?? 'ACTIVE'))?.label ?? 'Actif'} />
              <InfoRow label="Secteur" value={client.sector ?? '—'} />
            </div>
          )}
        </Card>

        <Card className="rounded-3xl border border-[var(--border)]/60 bg-[var(--surface)] p-4 sm:p-6 shadow-sm space-y-3">
          <p className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Contact</p>
          {editing ? (
            <div className="space-y-3">
              <Input label="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              <Input label="Téléphone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              <label className="space-y-1 text-sm text-[var(--text-primary)]">
                <span className="text-xs text-[var(--text-secondary)]">Source</span>
                <select
                  value={form.leadSource}
                  onChange={(e) => setForm((p) => ({ ...p, leadSource: e.target.value }))}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
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
            <Input label="Site web" value={form.websiteUrl} onChange={(e) => setForm((p) => ({ ...p, websiteUrl: e.target.value }))} />
          ) : (
            <div className="space-y-2 text-sm text-[var(--text-secondary)]">
              <InfoRow label="Site web" value={client.websiteUrl ?? '—'} />
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
