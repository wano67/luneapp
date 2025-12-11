// src/app/register/page.tsx
'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          name: name.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof payload.error === 'string'
            ? payload.error
            : 'Impossible de créer le compte.'
        );
        return;
      }

      router.push('/app');
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue, merci de réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 px-6 py-16">
      <div className="mx-auto flex max-w-md flex-col space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
            Public
          </p>
          <h1 className="text-3xl font-semibold">Créer un compte</h1>
          <p className="text-sm text-slate-400">
            Un compte permet d&apos;accéder à l&apos;app interne (/app).
          </p>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <Input
              id="name"
              type="text"
              autoComplete="name"
              label="Nom (optionnel)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              label="Mot de passe"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />

            {error ? (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Création en cours...' : 'Créer un compte'}
            </Button>

            <p className="text-center text-xs text-slate-400">
              Déjà un compte ?{' '}
              <Link
                href="/login"
                className="text-blue-300 hover:text-blue-200"
              >
                Se connecter
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
