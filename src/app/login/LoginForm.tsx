'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState, type ChangeEvent } from 'react';
import { getRequestIdFromResponse } from '@/lib/apiClient';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';
import { DashboardIllustration } from '@/components/marketing/DashboardIllustration';

type LoginFormProps = {
  redirectPath?: string;
};

type ApiErrorShape = { error: string };

function isApiErrorShape(x: unknown): x is ApiErrorShape {
  return (
    !!x &&
    typeof x === 'object' &&
    'error' in x &&
    typeof (x as { error?: unknown }).error === 'string'
  );
}

function sanitizeRedirectPath(value?: string) {
  if (typeof value !== 'string') return '/app';
  const v = value.trim();
  if (!v) return '/app';
  // Must start with single / and not be a protocol-relative URL
  if (!v.startsWith('/')) return '/app';
  if (v.startsWith('//')) return '/app';
  if (/^\/\\/.test(v)) return '/app';
  // Block embedded protocol schemes (e.g. /javascript:, /data:)
  if (/[a-z][a-z0-9+.-]*:/i.test(v)) return '/app';
  // Must stay within /app paths
  if (!v.startsWith('/app')) return '/app';
  return v;
}

export default function LoginForm({ redirectPath = '/app' }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const target = useMemo(() => sanitizeRedirectPath(redirectPath), [redirectPath]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRequestId(null);
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const reqId = getRequestIdFromResponse(response);
      if (reqId) setRequestId(reqId);

      if (!response.ok) {
        setError(isApiErrorShape(payload) ? payload.error : 'Impossible de se connecter.');
        return;
      }

      router.push(target);
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue, merci de réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      {/* Left panel — dark, decorative */}
      <div
        className="hidden w-1/2 flex-col justify-between p-10 md:flex"
        style={{ background: 'var(--shell-sidebar-bg)' }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <PivotLogo size={36} color="var(--shell-accent)" />
          <PivotWordmark height={20} color="var(--shell-sidebar-text)" />
        </Link>

        <div className="mx-auto flex max-w-md flex-1 flex-col justify-center">
          <h2
            className="mb-4 text-3xl font-semibold"
            style={{
              color: 'var(--shell-sidebar-text)',
              fontFamily: 'var(--font-barlow), sans-serif',
            }}
          >
            Structurez votre activité.
          </h2>
          <p
            className="mb-8 text-sm"
            style={{ color: 'var(--shell-sidebar-text)', opacity: 0.6 }}
          >
            Un seul espace pour piloter vos finances perso et votre business pro.
          </p>
          <DashboardIllustration />
        </div>

        <p className="text-xs" style={{ color: 'var(--shell-sidebar-text)', opacity: 0.3 }}>
          © 2026 Pivot
        </p>
      </div>

      {/* Right panel — form */}
      <div
        className="flex flex-1 items-center justify-center p-6"
        style={{ background: 'var(--bg)' }}
      >
        <div className="w-full max-w-md space-y-8">
          {/* Mobile-only logo */}
          <div className="flex justify-center md:hidden">
            <Link href="/" className="flex items-center gap-2.5">
              <PivotLogo size={40} color="var(--shell-accent)" />
              <PivotWordmark height={20} color="var(--text)" />
            </Link>
          </div>

          <div className="space-y-2 text-center md:text-left">
            <h1
              className="text-3xl font-semibold"
              style={{ color: 'var(--text)' }}
            >
              Connexion
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-faint)' }}>
              Connectez-vous pour accéder à votre espace.
            </p>
          </div>

          <Card className="border-[var(--border)] bg-[var(--surface)] p-6">
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

              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                label="Mot de passe"
                value={password}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                required
                minLength={8}
              />

              {error ? (
                <p className="text-sm text-[var(--danger)]" role="alert">
                  {error} {requestId ? `(Ref: ${requestId})` : ''}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Connexion...' : 'Se connecter'}
              </Button>

              <div className="space-y-1 text-center text-xs text-[var(--text-secondary)]">
                <p>
                  <Link href="/forgot-password" className="text-[var(--accent-strong)] hover:underline">
                    Mot de passe oublié ?
                  </Link>
                </p>
                <p>
                  Pas de compte ?{' '}
                  <Link href="/waitlist" className="text-[var(--accent-strong)] hover:underline">
                    Rejoindre la liste d&apos;attente
                  </Link>
                </p>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
