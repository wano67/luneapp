'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { SectionHeader } from '@/components/ui/section-header';
import { fetchJson } from '@/lib/apiClient';

type MeResponse = {
  user: {
    email: string;
    updatedAt?: string;
  };
};

export default function SecurityPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      const res = await fetchJson<MeResponse>('/api/auth/me', {}, controller.signal);
      if (controller.signal.aborted) return;
      if (res.ok && res.data?.user) {
        setEmail(res.data.user.email);
        setLastUpdate(res.data.user.updatedAt ?? null);
      }
    })();
    return () => controller.abort();
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      setSaving(false);
      return;
    }

    const res = await fetchJson<{ ok: true }>(
      '/api/account/password',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      }
    );

    if (!res.ok) {
      setError(res.error ?? 'Impossible de mettre à jour le mot de passe.');
      setRequestId(res.requestId);
      setSaving(false);
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSaved(true);
    setSaving(false);
  }

  const subtitle = useMemo(() => {
    if (lastUpdate) return `Dernière activité : ${new Date(lastUpdate).toLocaleString()}`;
    return 'Mettez à jour votre mot de passe régulièrement.';
  }, [lastUpdate]);

  return (
    <div className="space-y-4">
      <SectionHeader title="Sécurité" description={subtitle} />

      <Alert
        variant="info"
        title="Sécurité"
        description="Lune applique l’auth via cookie HttpOnly, middleware, CSRF sur les mutations et rate-limit. Les erreurs surfacent un request-id."
      />

      {error ? (
        <Alert
          variant="danger"
          title="Erreur"
          description={error}
          actions={requestId ? <span className="text-xs text-[var(--text-muted)]">Ref: {requestId}</span> : null}
        />
      ) : null}

      <Card className="border-[var(--border)] bg-[var(--surface)] p-5">
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            label="Email"
            value={email ?? ''}
            disabled
          />
          <Input
            label="Mot de passe actuel"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="Nouveau mot de passe"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
            />
            <Input
              label="Confirmer"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm text-[var(--text-secondary)]">
              Utilisez un mot de passe long et unique.
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? 'Mise à jour...' : saved ? 'Mis à jour' : 'Enregistrer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
