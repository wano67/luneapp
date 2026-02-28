'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type SettingsResponse = {
  item: {
    cgvText?: string | null;
    paymentTermsText?: string | null;
    lateFeesText?: string | null;
    fixedIndemnityText?: string | null;
    legalMentionsText?: string | null;
  };
};

type Props = {
  businessId: string;
};

export function BillingLegalTextsForm({ businessId }: Props) {
  const activeCtx = useActiveBusiness({ optional: true });
  const role = activeCtx?.activeBusiness?.role ?? null;
  const canEdit = role === 'ADMIN' || role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [cgvText, setCgvText] = useState('');
  const [paymentTermsText, setPaymentTermsText] = useState('');
  const [lateFeesText, setLateFeesText] = useState('');
  const [fixedIndemnityText, setFixedIndemnityText] = useState('');
  const [legalMentionsText, setLegalMentionsText] = useState('');

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function load() {
    setLoading(true);
    setError(null);
    setInfo(null);
    const res = await fetchJson<SettingsResponse>(`/api/pro/businesses/${businessId}/settings`);
    setRequestId(res.requestId ?? null);
    setLoading(false);
    if (!res.ok || !res.data?.item) {
      setError(res.error ?? 'Impossible de charger les mentions.');
      return;
    }
    setCgvText(res.data.item.cgvText ?? '');
    setPaymentTermsText(res.data.item.paymentTermsText ?? '');
    setLateFeesText(res.data.item.lateFeesText ?? '');
    setFixedIndemnityText(res.data.item.fixedIndemnityText ?? '');
    setLegalMentionsText(res.data.item.legalMentionsText ?? '');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      setInfo('Réservé aux admins/owners.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);

    const payload = {
      cgvText: cgvText.trim() || null,
      paymentTermsText: paymentTermsText.trim() || null,
      lateFeesText: lateFeesText.trim() || null,
      fixedIndemnityText: fixedIndemnityText.trim() || null,
      legalMentionsText: legalMentionsText.trim() || null,
    };

    const res = await fetchJson<SettingsResponse>(`/api/pro/businesses/${businessId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId ?? null);
    setSaving(false);

    if (!res.ok || !res.data?.item) {
      setError(res.error ?? 'Mise à jour impossible.');
      return;
    }

    setInfo('Mentions mises à jour.');
    setCgvText(res.data.item.cgvText ?? '');
    setPaymentTermsText(res.data.item.paymentTermsText ?? '');
    setLateFeesText(res.data.item.lateFeesText ?? '');
    setFixedIndemnityText(res.data.item.fixedIndemnityText ?? '');
    setLegalMentionsText(res.data.item.legalMentionsText ?? '');
  }

  return (
    <Card className="space-y-3 border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">Mentions légales</p>
        <p className="text-xs text-[var(--text-secondary)]">
          Ces textes sont repris dans les devis et factures.
        </p>
      </div>
      {error ? <p className="text-xs font-semibold text-[var(--danger)]">{error}</p> : null}
      {info ? <p className="text-xs text-[var(--success)]">{info}</p> : null}
      {requestId ? <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p> : null}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="space-y-1 text-xs text-[var(--text-secondary)]">
          <span>CGV</span>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={cgvText}
            onChange={(e) => setCgvText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </label>
        <label className="space-y-1 text-xs text-[var(--text-secondary)]">
          <span>Conditions de paiement</span>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={paymentTermsText}
            onChange={(e) => setPaymentTermsText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </label>
        <label className="space-y-1 text-xs text-[var(--text-secondary)]">
          <span>Pénalités de retard</span>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={lateFeesText}
            onChange={(e) => setLateFeesText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </label>
        <label className="space-y-1 text-xs text-[var(--text-secondary)]">
          <span>Indemnité forfaitaire</span>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={fixedIndemnityText}
            onChange={(e) => setFixedIndemnityText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </label>
        <label className="space-y-1 text-xs text-[var(--text-secondary)]">
          <span>Mentions légales</span>
          <textarea
            className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
            rows={3}
            value={legalMentionsText}
            onChange={(e) => setLegalMentionsText(e.target.value)}
            disabled={!canEdit || loading || saving}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!canEdit || loading || saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!canEdit ? <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p> : null}
        </div>
      </form>
    </Card>
  );
}
