'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, useState, Suspense, type ChangeEvent } from 'react';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: string }).error === 'string'
            ? (data as { error: string }).error
            : 'Une erreur est survenue.'
        );
        return;
      }

      setSuccess(true);
    } catch {
      setError('Une erreur est survenue, merci de réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="space-y-4 text-center">
          <p className="text-sm text-[var(--danger)]">
            Lien invalide. Demandez un nouveau lien de réinitialisation.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm text-[var(--accent-strong)] hover:underline"
          >
            Mot de passe oublié
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
      {success ? (
        <div className="space-y-4 text-center">
          <p className="text-sm" style={{ color: 'var(--text)' }}>
            Votre mot de passe a été réinitialisé avec succès.
          </p>
          <Link
            href="/login"
            className="inline-block text-sm text-[var(--accent-strong)] hover:underline"
          >
            Se connecter
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            label="Nouveau mot de passe"
            value={password}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
            required
            minLength={8}
          />

          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            label="Confirmer le mot de passe"
            value={confirm}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setConfirm(event.target.value)}
            required
            minLength={8}
          />

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <PivotLogo size={40} color="var(--shell-accent)" />
            <PivotWordmark height={20} color="var(--text)" />
          </Link>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold" style={{ color: 'var(--text)' }}>
            Nouveau mot de passe
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Choisissez un nouveau mot de passe pour votre compte.
          </p>
        </div>

        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
