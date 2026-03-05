'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';
import { useActiveBusiness } from '../../../ActiveBusinessProvider';

type Settings = { allowMembersInvite: boolean; allowViewerExport: boolean };

export function PermissionsSection({ businessId }: { businessId: string }) {
  const activeCtx = useActiveBusiness({ optional: true });
  const canEdit = activeCtx?.activeBusiness?.role === 'ADMIN' || activeCtx?.activeBusiness?.role === 'OWNER';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [allowMembersInvite, setAllowMembersInvite] = useState(true);
  const [allowViewerExport, setAllowViewerExport] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetchJson<{ item: Settings }>(`/api/pro/businesses/${businessId}/settings`);
      setLoading(false);
      if (res.ok && res.data?.item) {
        setAllowMembersInvite(res.data.item.allowMembersInvite);
        setAllowViewerExport(res.data.item.allowViewerExport);
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
      body: JSON.stringify({ allowMembersInvite, allowViewerExport }),
    });

    setSaving(false);
    if (!res.ok) { setError(res.error ?? 'Mise à jour impossible.'); return; }
    if (res.data?.item) {
      setAllowMembersInvite(res.data.item.allowMembersInvite);
      setAllowViewerExport(res.data.item.allowViewerExport);
    }
    setInfo('Permissions enregistrées.');
  }

  const disabled = !canEdit || loading || saving;

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Permissions</p>
        <p className="text-sm text-[var(--text-secondary)]">Autorisations globales pour les membres.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input type="checkbox" className="mt-1" checked={allowMembersInvite} onChange={(e) => setAllowMembersInvite(e.target.checked)} disabled={disabled} />
          <div>
            <div className="font-medium text-sm">Autoriser les membres à inviter</div>
            <p className="text-xs text-[var(--text-secondary)]">Permet aux membres (non admins) d&apos;envoyer des invitations.</p>
          </div>
        </label>
        <label className="flex items-start gap-3 rounded-xl border border-[var(--border)] px-3 py-2">
          <input type="checkbox" className="mt-1" checked={allowViewerExport} onChange={(e) => setAllowViewerExport(e.target.checked)} disabled={disabled} />
          <div>
            <div className="font-medium text-sm">Autoriser export pour viewers</div>
            <p className="text-xs text-[var(--text-secondary)]">Permet aux viewers de télécharger/exporter certaines données.</p>
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
