'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchJson } from '@/lib/apiClient';

export function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    const res = await fetchJson<{ ok: true }>('/api/account/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? 'Impossible de mettre à jour le mot de passe.');
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setInfo('Mot de passe mis à jour.');
  }

  return (
    <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)]/70 p-5">
      <div>
        <p className="text-base font-semibold text-[var(--text-primary)]">Sécurité</p>
        <p className="text-sm text-[var(--text-secondary)]">Modifiez votre mot de passe. Le nouveau mot de passe doit contenir au moins 8 caractères.</p>
      </div>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {info && <p className="text-sm text-[var(--success)]">{info}</p>}
      <form className="space-y-4" onSubmit={handleSubmit}>
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
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? 'Mise à jour…' : 'Mettre à jour'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
