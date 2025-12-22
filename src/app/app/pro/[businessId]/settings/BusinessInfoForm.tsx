'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { fetchJson } from '@/lib/apiClient';

type BusinessResponse = {
  id: string;
  name: string;
  websiteUrl?: string | null;
  role?: string | null;
};

type PatchResponse = {
  item: BusinessResponse;
};

type Props = {
  businessId: string;
};

export function BusinessInfoForm({ businessId }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [role, setRole] = useState<string | null>(null);

  const canEdit = role === 'ADMIN' || role === 'OWNER';

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestId(null);
    const res = await fetchJson<BusinessResponse>(`/api/pro/businesses/${businessId}`);
    setRequestId(res.requestId ?? null);
    setLoading(false);
    if (!res.ok || !res.data) {
      const msg = res.error ?? 'Impossible de charger les infos entreprise.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }
    setName(res.data.name ?? '');
    setWebsiteUrl(res.data.websiteUrl ?? '');
    setRole(res.data.role ?? null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canEdit) {
      setInfo('Action réservée aux admins/owners.');
      return;
    }
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nom requis.');
      return;
    }
    setSaving(true);
    setError(null);
    setInfo(null);

    const payload: Record<string, unknown> = {
      name: trimmedName,
      websiteUrl: websiteUrl.trim() || null,
    };

    const res = await fetchJson<PatchResponse>(`/api/pro/businesses/${businessId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Origin: window.location.origin },
      body: JSON.stringify(payload),
    });

    setRequestId(res.requestId ?? null);
    setSaving(false);

    if (!res.ok || !res.data?.item) {
      const msg = res.error ?? 'Mise à jour impossible.';
      setError(res.requestId ? `${msg} (Ref: ${res.requestId})` : msg);
      return;
    }

    setName(res.data.item.name ?? '');
    setWebsiteUrl(res.data.item.websiteUrl ?? '');
    setInfo('Informations mises à jour.');
  }

  return (
    <Card className="space-y-3 border-[var(--border)] bg-[var(--surface)]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Informations générales</p>
          <p className="text-xs text-[var(--text-secondary)]">Nom et site web visibles dans le hub.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading || saving}>
          Recharger
        </Button>
      </div>
      {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
      {info ? <p className="text-xs text-emerald-600">{info}</p> : null}
      {requestId ? <p className="text-[10px] text-[var(--text-faint)]">Req: {requestId}</p> : null}
      <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
        <Input
          label="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit || loading || saving}
          required
        />
        <Input
          label="Site web"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://exemple.com"
          disabled={!canEdit || loading || saving}
        />
        <div className="md:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={!canEdit || saving || loading}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
          {!canEdit ? (
            <p className="text-xs text-[var(--text-secondary)]">Action réservée aux admins/owners.</p>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
