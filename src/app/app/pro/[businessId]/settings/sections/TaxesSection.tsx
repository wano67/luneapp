'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';
import { VAT_REGIME_LABELS, TVA_SEUILS, IS } from '@/config/taxation';

type Settings = {
  vatEnabled: boolean;
  vatRatePercent: number;
  vatRegime: string | null;
};

export function TaxesSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vatEnabled, setVatEnabled] = useState(false);
  const [vatRatePercent, setVatRatePercent] = useState(20);
  const [vatRegime, setVatRegime] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        setVatEnabled(res.data.item.vatEnabled);
        setVatRatePercent(res.data.item.vatRatePercent);
        setVatRegime(res.data.item.vatRegime ?? '');
      }
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null);

    const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({
        vatEnabled,
        vatRatePercent,
        vatRegime: vatRegime || null,
      }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise a jour impossible.'); return; }
    if (res.data?.item) {
      setVatEnabled(res.data.item.vatEnabled);
      setVatRatePercent(res.data.item.vatRatePercent);
      setVatRegime(res.data.item.vatRegime ?? '');
    }
    toast.success('Taxes mises a jour.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Taxes & TVA</p>
        <p className="text-sm text-[var(--text-secondary)]">Configuration de la TVA et regime fiscal.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input type="checkbox" className="mt-1" checked={vatEnabled} onChange={(e) => setVatEnabled(e.target.checked)} disabled={disabled} />
          <div>
            <div className="font-medium text-sm">TVA activee</div>
            <p className="text-xs text-[var(--text-secondary)]">Active la TVA sur les documents.</p>
          </div>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <Select
            label="Regime TVA"
            value={vatRegime}
            onChange={(e) => {
              const val = e.target.value;
              setVatRegime(val);
              if (val === 'FRANCHISE') setVatEnabled(false);
            }}
            disabled={disabled}
          >
            <option value="">Non renseigne</option>
            {Object.entries(VAT_REGIME_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input
            label="Taux TVA (%)"
            type="number"
            value={vatRatePercent}
            onChange={(e) => setVatRatePercent(Number(e.target.value))}
            min={0}
            max={100}
            disabled={disabled || vatRegime === 'FRANCHISE'}
          />
        </div>

        {vatRegime === 'FRANCHISE' && (
          <div className="rounded-lg border border-amber-300/30 bg-amber-50/10 p-3 text-xs text-[var(--text-secondary)]">
            <p className="font-semibold text-amber-600">Franchise en base de TVA</p>
            <p>Pas de TVA facturee. Mention obligatoire : &laquo; TVA non applicable, art. 293 B du CGI &raquo;</p>
            <p className="mt-1">Seuils : {TVA_SEUILS.FRANCHISE.SERVICES.normal.toLocaleString('fr-FR')} EUR (services) / {TVA_SEUILS.FRANCHISE.VENTE.normal.toLocaleString('fr-FR')} EUR (vente)</p>
          </div>
        )}

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 p-3 text-xs text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">Impot sur les societes (IS)</p>
          <p>Taux reduit PME : {IS.TAUX_REDUIT * 100}% jusqu&apos;a {IS.SEUIL_TAUX_REDUIT.toLocaleString('fr-FR')} EUR de benefice</p>
          <p>Taux normal : {IS.TAUX_NORMAL * 100}% au-dela</p>
          <p className="mt-1 text-[10px]">Applicable si CA &lt; {IS.CA_MAX_TAUX_REDUIT.toLocaleString('fr-FR')} EUR et capital entierement libere.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement...' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Reserve aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
