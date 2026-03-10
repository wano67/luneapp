'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Biz = { billingEmail?: string | null; billingPhone?: string | null };

export function ContactFacturationSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<Biz>(`/api/pro/businesses/${businessId}`);
      setLoading(false);
      if (res.ok && res.data) {
        setBillingEmail(res.data.billingEmail ?? '');
        setBillingPhone(res.data.billingPhone ?? '');
      }
    })();
  }, [businessId]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true); setError(null);

    const res = await fetchJson<{ item: Biz }>(`/api/pro/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify({
        billingEmail: billingEmail.trim() || null,
        billingPhone: billingPhone.trim() || null,
      }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    setBillingEmail(res.data?.item?.billingEmail ?? billingEmail);
    setBillingPhone(res.data?.item?.billingPhone ?? billingPhone);
    toast.success('Contact facturation mis à jour.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Contact facturation</p>
        <p className="text-sm text-[var(--text-secondary)]">Coordonnées utilisées sur les devis et factures.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Email facturation" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} disabled={disabled} />
          <Input label="Téléphone facturation" value={billingPhone} onChange={(e) => setBillingPhone(e.target.value)} disabled={disabled} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
