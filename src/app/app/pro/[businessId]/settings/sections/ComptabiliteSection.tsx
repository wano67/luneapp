'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = {
  accountInventoryCode: string;
  accountCogsCode: string;
  accountCashCode: string;
  accountRevenueCode: string;
  ledgerSalesAccountCode: string;
  ledgerVatCollectedAccountCode: string;
  ledgerCashAccountCode: string;
};

const FIELDS: { key: keyof Settings; label: string; helper: string }[] = [
  { key: 'accountRevenueCode', label: 'Compte produits (CA)', helper: 'Défaut: 7000' },
  { key: 'accountCogsCode', label: 'Compte charges', helper: 'Défaut: 6000' },
  { key: 'accountCashCode', label: 'Compte trésorerie', helper: 'Défaut: 5300' },
  { key: 'accountInventoryCode', label: 'Compte stocks', helper: 'Défaut: 3700' },
  { key: 'ledgerSalesAccountCode', label: 'Journal ventes', helper: 'Défaut: 706' },
  { key: 'ledgerVatCollectedAccountCode', label: 'TVA collectée', helper: 'Défaut: 44571' },
  { key: 'ledgerCashAccountCode', label: 'Journal banque', helper: 'Défaut: 512' },
];

export function ComptabiliteSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        const s = res.data.item;
        const f: Record<string, string> = {};
        for (const field of FIELDS) f[field.key] = (s[field.key] as string) ?? '';
        setForm(f);
      }
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null); setInfo(null);

    const payload: Record<string, string> = {};
    for (const field of FIELDS) {
      const v = form[field.key]?.trim();
      if (v) payload[field.key] = v;
    }

    const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      const s = res.data.item;
      const f: Record<string, string> = {};
      for (const field of FIELDS) f[field.key] = (s[field.key] as string) ?? '';
      setForm(f);
    }
    setInfo('Codes comptables enregistrés.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Comptabilité</p>
        <p className="text-sm text-[var(--text-secondary)]">Codes comptables utilisés pour les écritures et le grand livre.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((f) => (
            <Input
              key={f.key}
              label={f.label}
              value={form[f.key] ?? ''}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              disabled={disabled}
              helper={f.helper}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
