'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { SectionHeader } from '@/components/ui/section-header';
import { fetchJson } from '@/lib/apiClient';

type MeResponse = {
  user: {
    id: string;
    email: string;
    name?: string | null;
    updatedAt?: string;
  };
};

type ProfilePayload = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
};

function splitName(full?: string | null): { firstName: string; lastName: string } {
  if (!full) return { firstName: '', lastName: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(' ') };
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      setError(null);
      setSaved(false);
      const res = await fetchJson<MeResponse>('/api/auth/me', {}, controller.signal);
      if (controller.signal.aborted) return;
      if (!res.ok || !res.data?.user) {
        setError(res.error ?? 'Impossible de charger le compte.');
        setRequestId(res.requestId);
        setLoading(false);
        return;
      }

      const parts = splitName(res.data.user.name);
      setFirstName(parts.firstName);
      setLastName(parts.lastName);
      setEmail(res.data.user.email);
      setUpdatedAt(res.data.user.updatedAt ?? null);
      setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    const payload: ProfilePayload = {
      firstName: firstName.trim() || null,
      lastName: lastName.trim() || null,
      email: email.trim(),
    };

    const res = await fetchJson<{ user: { email: string; name?: string | null; updatedAt?: string } }>(
      '/api/account/profile',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!res.ok) {
      setError(res.error ?? 'Impossible de sauvegarder.');
      setRequestId(res.requestId);
      setSaving(false);
      return;
    }

    const parts = splitName(res.data?.user.name);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setEmail(res.data?.user.email ?? payload.email);
    setUpdatedAt(res.data?.user.updatedAt ?? null);
    setSaved(true);
    setSaving(false);
  }

  const subtitle = useMemo(() => {
    if (updatedAt) return `Dernière mise à jour : ${new Date(updatedAt).toLocaleString()}`;
    return 'Mettez à jour vos informations personnelles.';
  }, [updatedAt]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Profil" description={subtitle} />
      {error ? (
        <Alert
          variant="danger"
          title="Erreur"
          description={error}
          actions={requestId ? <span className="text-xs text-[var(--text-muted)]">Ref: {requestId}</span> : null}
        />
      ) : null}

      <Card className="border-[var(--border)] bg-[var(--surface)] p-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Prénom"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex: Marie"
              disabled={loading}
            />
            <Input
              label="Nom"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ex: Dupont"
              disabled={loading}
            />
          </div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            disabled={loading}
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-secondary)]">
              Ces informations sont utilisées pour votre compte et vos notifications.
            </div>
            <Button type="submit" disabled={loading || saving}>
              {saving ? 'Enregistrement...' : saved ? 'Sauvegardé' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
