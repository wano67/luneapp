'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = {
  invoicePrefix: string;
  quotePrefix: string;
  paymentTermsDays: number;
  defaultDepositPercent: number;
  enableAutoNumbering: boolean;
};

export function FacturationSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [quotePrefix, setQuotePrefix] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState(30);
  const [defaultDepositPercent, setDefaultDepositPercent] = useState(30);
  const [enableAutoNumbering, setEnableAutoNumbering] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        const s = res.data.item;
        setInvoicePrefix(s.invoicePrefix);
        setQuotePrefix(s.quotePrefix);
        setPaymentTermsDays(s.paymentTermsDays);
        setDefaultDepositPercent(s.defaultDepositPercent);
        setEnableAutoNumbering(s.enableAutoNumbering);
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
      body: JSON.stringify({ paymentTermsDays, defaultDepositPercent, enableAutoNumbering }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      setPaymentTermsDays(res.data.item.paymentTermsDays);
      setDefaultDepositPercent(res.data.item.defaultDepositPercent);
      setEnableAutoNumbering(res.data.item.enableAutoNumbering);
    }
    toast.success('Paramètres de facturation enregistrés.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Facturation</p>
        <p className="text-sm text-[var(--text-secondary)]">Préfixes, délais de paiement et acomptes par défaut.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Préfixe factures" value={invoicePrefix} disabled helper="Défini automatiquement." />
          <Input label="Préfixe devis" value={quotePrefix} disabled helper="Défini automatiquement." />
          <Input
            label="Délais de paiement (jours)"
            type="number"
            value={paymentTermsDays}
            onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
            min={0}
            max={365}
            disabled={disabled}
          />
          <Input
            label="Acompte par défaut (%)"
            type="number"
            value={defaultDepositPercent}
            onChange={(e) => setDefaultDepositPercent(Number(e.target.value))}
            min={0}
            max={100}
            disabled={disabled}
          />
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input
            type="checkbox"
            className="mt-1"
            checked={enableAutoNumbering}
            onChange={(e) => setEnableAutoNumbering(e.target.checked)}
            disabled={disabled}
          />
          <div>
            <div className="font-medium text-sm">Numérotation automatique</div>
            <p className="text-xs text-[var(--text-secondary)]">Générer automatiquement les numéros de devis/facture.</p>
          </div>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
