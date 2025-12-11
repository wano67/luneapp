'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, type ChangeEvent } from 'react';

type LoginFormProps = {
  redirectPath?: string;
};

export default function LoginForm({ redirectPath = '/app' }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          typeof payload.error === 'string'
            ? payload.error
            : 'Impossible de se connecter.'
        );
        return;
      }

      // Redirection après login
      const target = redirectPath && redirectPath.length > 0 ? redirectPath : '/app';
      router.push(target);
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
          <h1 className="text-3xl font-semibold">Connexion</h1>
        </div>

        <Card className="border-slate-800/80 bg-slate-900/60 p-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              label="Email"
              value={email}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setEmail(event.target.value)
              }
              required
            />

            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              label="Mot de passe"
              value={password}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setPassword(event.target.value)
              }
              required
              minLength={8}
            />

            {error ? (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Connexion...' : 'Se connecter'}
            </Button>

            <p className="text-center text-xs text-slate-400">
              Pas de compte ?{' '}
              <Link
                href="/register"
                className="text-blue-300 hover:text-blue-200"
              >
                Créer un compte
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
