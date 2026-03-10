'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = {
  cgvText?: string | null;
  paymentTermsText?: string | null;
  lateFeesText?: string | null;
  fixedIndemnityText?: string | null;
  legalMentionsText?: string | null;
};

const FIELDS: { key: keyof Settings; label: string }[] = [
  { key: 'cgvText', label: 'CGV' },
  { key: 'paymentTermsText', label: 'Conditions de paiement' },
  { key: 'lateFeesText', label: 'Pénalités de retard' },
  { key: 'fixedIndemnityText', label: 'Indemnité forfaitaire' },
  { key: 'legalMentionsText', label: 'Mentions légales' },
];

export function TextesLegauxSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    cgvText: '', paymentTermsText: '', lateFeesText: '', fixedIndemnityText: '', legalMentionsText: '',
  });

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        const s = res.data.item;
        setForm({
          cgvText: s.cgvText ?? '',
          paymentTermsText: s.paymentTermsText ?? '',
          lateFeesText: s.lateFeesText ?? '',
          fixedIndemnityText: s.fixedIndemnityText ?? '',
          legalMentionsText: s.legalMentionsText ?? '',
        });
      }
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null);

    const payload: Record<string, string | null> = {};
    for (const f of FIELDS) payload[f.key] = form[f.key]?.trim() || null;

    const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      const s = res.data.item;
      setForm({
        cgvText: s.cgvText ?? '',
        paymentTermsText: s.paymentTermsText ?? '',
        lateFeesText: s.lateFeesText ?? '',
        fixedIndemnityText: s.fixedIndemnityText ?? '',
        legalMentionsText: s.legalMentionsText ?? '',
      });
    }
    toast.success('Textes légaux enregistrés.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Textes légaux</p>
        <p className="text-sm text-[var(--text-secondary)]">Ces textes sont repris dans les devis et factures.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block space-y-1">
            <span className="text-xs text-[var(--text-secondary)]">{f.label}</span>
            <textarea
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
              rows={3}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              disabled={disabled}
            />
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
