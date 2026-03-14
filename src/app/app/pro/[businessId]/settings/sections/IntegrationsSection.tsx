'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = { integrationStripeEnabled: boolean; integrationStripePublicKey: string | null; hasStripeSecretKey?: boolean };

export function IntegrationsSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [hasStripeSecretKey, setHasStripeSecretKey] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        setStripeEnabled(res.data.item.integrationStripeEnabled);
        setStripeKey(res.data.item.integrationStripePublicKey ?? '');
        setHasStripeSecretKey(!!res.data.item.hasStripeSecretKey);
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
        integrationStripeEnabled: stripeEnabled,
        integrationStripePublicKey: stripeKey.trim() || null,
        ...(stripeSecretKey.trim() ? { integrationStripeSecretKey: stripeSecretKey.trim() } : {}),
      }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      setStripeEnabled(res.data.item.integrationStripeEnabled);
      setStripeKey(res.data.item.integrationStripePublicKey ?? '');
      setHasStripeSecretKey(!!res.data.item.hasStripeSecretKey);
    }
    setStripeSecretKey('');
    toast.success('Intégrations enregistrées.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Intégrations</p>
        <p className="text-sm text-[var(--text-secondary)]">Connectez vos outils de paiement.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input type="checkbox" className="mt-1" checked={stripeEnabled} onChange={(e) => setStripeEnabled(e.target.checked)} disabled={disabled} />
          <div>
            <div className="font-medium text-sm">Stripe activé</div>
            <p className="text-xs text-[var(--text-secondary)]">Activer l&apos;intégration Stripe pour les paiements en ligne.</p>
          </div>
        </label>
        <Input
          label="Clé publique Stripe"
          value={stripeKey}
          onChange={(e) => setStripeKey(e.target.value)}
          placeholder="pk_live_..."
          disabled={disabled}
        />
        <div>
          <Input
            label="Clé secrète Stripe"
            type="password"
            value={stripeSecretKey}
            onChange={(e) => setStripeSecretKey(e.target.value)}
            placeholder={hasStripeSecretKey ? 'Clé enregistrée — laisser vide pour conserver' : 'sk_live_... ou sk_test_...'}
            disabled={disabled}
          />
          {hasStripeSecretKey && !stripeSecretKey && (
            <p className="text-xs text-[var(--text-secondary)] mt-1">Clé secrète enregistrée et chiffrée.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
