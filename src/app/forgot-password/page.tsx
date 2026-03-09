'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { FormEvent, useState, type ChangeEvent } from 'react';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(
          data && typeof data === 'object' && 'error' in data && typeof (data as { error?: string }).error === 'string'
            ? (data as { error: string }).error
            : 'Une erreur est survenue.'
        );
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Une erreur est survenue, merci de réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

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
            Mot de passe oublié
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
            Entrez votre email pour recevoir un lien de réinitialisation.
          </p>
        </div>

        <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
          {submitted ? (
            <div className="space-y-4 text-center">
              <p className="text-sm" style={{ color: 'var(--text)' }}>
                Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-[var(--accent-strong)] hover:underline"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                label="Email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
              />

              {error ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {error}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Envoi...' : 'Envoyer le lien'}
              </Button>

              <p className="text-center text-xs text-[var(--text-secondary)]">
                <Link href="/login" className="text-[var(--accent-strong)] hover:underline">
                  Retour à la connexion
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </main>
  );
}
