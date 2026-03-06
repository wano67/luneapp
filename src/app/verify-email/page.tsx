'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PivotLogo, PivotWordmark } from '@/components/pivot-icons';
import { Mail, CheckCircle, RefreshCw } from 'lucide-react';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') ?? null;

  const [status, setStatus] = useState<'pending' | 'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'pending'
  );
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const verifyToken = useCallback(async (t: string) => {
    setStatus('verifying');
    setError(null);

    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token: t }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && (data as Record<string, unknown>).verified) {
        setStatus('success');
        setTimeout(() => router.push('/app'), 2000);
      } else {
        setStatus('error');
        setError(
          typeof (data as Record<string, unknown>).error === 'string'
            ? (data as { error: string }).error
            : 'Lien invalide ou expiré.'
        );
      }
    } catch {
      setStatus('error');
      setError('Une erreur est survenue.');
    }
  }, [router]);

  useEffect(() => {
    if (token && status === 'verifying') {
      verifyToken(token);
    }
  }, [token, status, verifyToken]);

  async function handleResend() {
    setResending(true);
    setResent(false);
    setError(null);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        credentials: 'include',
      });

      if (res.ok) {
        setResent(true);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(
          typeof (data as Record<string, unknown>).error === 'string'
            ? (data as { error: string }).error
            : 'Impossible de renvoyer l\'email.'
        );
      }
    } catch {
      setError('Une erreur est survenue.');
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <PivotLogo size={40} color="var(--shell-accent)" />
            <PivotWordmark height={20} color="var(--text)" />
          </Link>
        </div>

        <Card className="space-y-6 border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          {status === 'verifying' && (
            <>
              <div className="flex justify-center">
                <RefreshCw size={48} className="animate-spin" style={{ color: 'var(--accent-strong)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Vérification en cours...
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Merci de patienter quelques instants.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="flex justify-center">
                <CheckCircle size={48} style={{ color: 'var(--success)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Email vérifié !
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Votre adresse email a été confirmée. Redirection en cours...
              </p>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="flex justify-center">
                <Mail size={48} style={{ color: 'var(--accent-strong)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Vérifiez votre email
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Un email de vérification a été envoyé à votre adresse.
                Cliquez sur le lien dans l&apos;email pour activer votre compte.
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="flex justify-center">
                <Mail size={48} style={{ color: 'var(--danger)' }} />
              </div>
              <h1 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Lien invalide
              </h1>
            </>
          )}

          {error && <Alert variant="danger" title="Erreur" description={error} />}

          {resent && (
            <Alert
              variant="success"
              title="Email envoyé"
              description="Un nouvel email de vérification a été envoyé."
            />
          )}

          {(status === 'pending' || status === 'error') && (
            <div className="space-y-3">
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full"
              >
                {resending ? 'Envoi en cours...' : 'Renvoyer l\'email de vérification'}
              </Button>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                <Link href="/login" className="text-[var(--accent-strong)] hover:underline">
                  Se connecter avec un autre compte
                </Link>
              </p>
            </div>
          )}
        </Card>
      </div>
    </main>
  );
}
