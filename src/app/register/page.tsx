// src/app/register/page.tsx
'use client';

import { useState, FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { applyThemePref, type ThemePref } from '@/lib/theme';

type Prefs = { language: 'fr' | 'en'; theme: 'light' | 'dark' | 'system' };

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [language, setLanguage] = useState<Prefs['language']>('fr');
  const [theme, setTheme] = useState<Prefs['theme']>('system');
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function savePreferences(pref: Prefs) {
    await fetch('/api/account/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(pref),
    })
      .then(() => applyThemePref(pref.theme as ThemePref))
      .catch(() => null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRequestId(null);
    setSubmitting(true);

    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email,
          password,
          name: `${firstName} ${lastName}`.trim() || undefined,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      const reqId = response.headers.get('x-request-id');
      if (reqId) setRequestId(reqId);

      if (!response.ok) {
        setError(
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error?: string }).error!
            : 'Impossible de créer le compte.'
        );
        return;
      }

      await savePreferences({ language, theme });
      router.push('/app');
    } catch (err) {
      console.error(err);
      setError('Une erreur est survenue, merci de réessayer.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-16 text-[var(--text)]">
      <div className="mx-auto flex max-w-xl flex-col space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            Public
          </p>
          <h1 className="text-3xl font-semibold">Créer un compte</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Accédez à l’espace interne et configurez vos préférences dès maintenant.
          </p>
        </div>

        {error ? (
          <Alert
            variant="danger"
            title="Erreur"
            description={
              requestId ? (
                <span>
                  {error} <span className="text-xs text-[var(--text-muted)]">(Ref: {requestId})</span>
                </span>
              ) : (
                error
              )
            }
          />
        ) : null}

        <Card className="space-y-4 border-[var(--border)] bg-[var(--surface)] p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Identité</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  id="firstName"
                  type="text"
                  autoComplete="given-name"
                  label="Prénom"
                  value={firstName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFirstName(event.target.value)
                  }
                  required
                />
                <Input
                  id="lastName"
                  type="text"
                  autoComplete="family-name"
                  label="Nom"
                  value={lastName}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setLastName(event.target.value)
                  }
                  required
                />
              </div>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                label="Email"
                value={email}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                required
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  label="Mot de passe"
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setPassword(event.target.value)
                  }
                  required
                  minLength={8}
                />
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  label="Confirmation"
                  value={confirm}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setConfirm(event.target.value)
                  }
                  required
                  minLength={8}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-[var(--text)]">Préférences</div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex w-full flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Langue</span>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Prefs['language'])}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="flex w-full flex-col gap-1">
                  <span className="text-sm font-medium text-[var(--text-secondary)]">Thème</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as Prefs['theme'])}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-sm text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                  >
                    <option value="system">Système</option>
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                  </select>
                </label>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Création en cours...' : 'Créer un compte'}
            </Button>

            <p className="text-center text-xs text-[var(--text-secondary)]">
              Déjà un compte ?{' '}
              <Link href="/login" className="text-[var(--accent-strong)] hover:underline">
                Se connecter
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </main>
  );
}
