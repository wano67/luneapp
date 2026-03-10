'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useToast } from '@/components/ui/toast';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Biz = { iban?: string | null; bic?: string | null; bankName?: string | null; accountHolder?: string | null };

export function BanqueSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<Biz>(`/api/pro/businesses/${businessId}`);
      setLoading(false);
      if (res.ok && res.data) {
        setIban(res.data.iban ?? '');
        setBic(res.data.bic ?? '');
        setBankName(res.data.bankName ?? '');
        setAccountHolder(res.data.accountHolder ?? '');
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
        iban: iban.trim() || null,
        bic: bic.trim() || null,
        bankName: bankName.trim() || null,
        accountHolder: accountHolder.trim() || null,
      }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    const d = res.data?.item;
    if (d) { setIban(d.iban ?? ''); setBic(d.bic ?? ''); setBankName(d.bankName ?? ''); setAccountHolder(d.accountHolder ?? ''); }
    toast.success('Informations bancaires mises à jour.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Banque</p>
        <p className="text-sm text-[var(--text-secondary)]">Coordonnées bancaires reprises sur les factures.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="IBAN" value={iban} onChange={(e) => setIban(e.target.value)} disabled={disabled} />
          <Input label="BIC" value={bic} onChange={(e) => setBic(e.target.value)} disabled={disabled} />
          <Input label="Banque" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={disabled} />
          <Input label="Titulaire du compte" value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} disabled={disabled} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={disabled}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          {!canEdit && <p className="text-xs text-[var(--text-secondary)]">Réservé aux admins/owners.</p>}
        </div>
      </form>
    </Card>
  );
}
