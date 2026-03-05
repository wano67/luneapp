'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchJson } from '@/lib/apiClient';

type MeResponse = {
  user: { id: string; email: string; name?: string | null; updatedAt?: string };
};

function splitName(full?: string | null): { firstName: string; lastName: string } {
  if (!full) return { firstName: '', lastName: '' };
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  const [first, ...rest] = parts;
  return { firstName: first, lastName: rest.join(' ') };
}

export function ProfileSection() {
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    void (async () => {
      const res = await fetchJson<MeResponse>('/api/auth/me', {}, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (res.ok && res.data?.user) {
        const parts = splitName(res.data.user.name);
        setFirstName(parts.firstName);
        setLastName(parts.lastName);
        setEmail(res.data.user.email);
      }
      setLoading(false);
    })();
    return () => ctrl.abort();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);

    const res = await fetchJson<{ user: { email: string; name?: string | null } }>(
      '/api/account/profile',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim() || null,
          lastName: lastName.trim() || null,
          email: email.trim(),
        }),
      },
    );

    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Impossible de sauvegarder.');
      return;
    }
    const parts = splitName(res.data?.user.name);
    setFirstName(parts.firstName);
    setLastName(parts.lastName);
    setEmail(res.data?.user.email ?? email);
    setInfo('Profil enregistré.');
  }

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Profil</p>
        <p className="text-sm text-[var(--text-secondary)]">Informations personnelles affichées dans l&apos;application et utilisées pour la connexion.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ex: Marie" disabled={loading} />
            <p className="text-xs text-[var(--text-secondary)]">Votre prénom tel qu&apos;affiché dans l&apos;application.</p>
          </div>
          <div className="space-y-1">
            <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ex: Dupont" disabled={loading} />
            <p className="text-xs text-[var(--text-secondary)]">Votre nom de famille.</p>
          </div>
        </div>
        <div className="space-y-1">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required disabled={loading} />
          <p className="text-xs text-[var(--text-secondary)]">Adresse email de connexion et de contact.</p>
        </div>
        <Button type="submit" disabled={loading || saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </Card>
  );
}
