'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = { vatEnabled: boolean; vatRatePercent: number };

export function TaxesSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRatePercent, setVatRatePercent] = useState(20);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        setVatEnabled(res.data.item.vatEnabled);
        setVatRatePercent(res.data.item.vatRatePercent);
      }
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null); setInfo(null);

    const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({ vatEnabled, vatRatePercent }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      setVatEnabled(res.data.item.vatEnabled);
      setVatRatePercent(res.data.item.vatRatePercent);
    }
    setInfo('Taxes mises à jour.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Taxes</p>
        <p className="text-sm text-[var(--text-secondary)]">Configuration de la TVA.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input type="checkbox" className="mt-1" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} disabled={disabled} />
          <div>
            <div className="font-medium text-sm">TVA activée</div>
            <p className="text-xs text-[var(--text-secondary)]">Active la TVA sur les documents.</p>
          </div>
        </label>
        <Input
          label="Taux TVA (%)"
          type="number"
          value={vatRatePercent}
          onChange={(e) => setVatRatePercent(Number(e.target.value))}
          min={0}
          max={100}
          disabled={disabled}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
